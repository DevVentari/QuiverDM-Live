"""
Fix dispatcher - runs on host PC, polls DB failures for qa-failure records.

Usage:
  uv run python fix_dispatcher.py [--once] [--no-idle-check] [--once-per-issue]

--once: process one failure and exit (for testing)
--no-idle-check: skip idle detection (for testing/CI)
--once-per-issue: each failure is attempted exactly once per run; tracked
                  in /tmp/qa-overnight-processed.json

Idle detection: Windows only via ctypes.windll.user32.GetLastInputInfo
Idle threshold: 5 minutes (300 seconds)
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import db_failures
from fix_claude import dispatch_claude_fix
from fix_codex import dispatch_codex_fix
from github_issues import get_open_exploratory_trigger_issues
from handoff_generator import generate_handoff
from pr_creator import create_fix_pr

IDLE_THRESHOLD_SECONDS = 300
POLL_INTERVAL_SECONDS = 60
REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def get_idle_seconds() -> float:
    """
    Windows: use GetLastInputInfo to get ms since last input.
    Non-Windows: return large value (always idle) - allows testing on Linux.
    """
    if platform.system().lower() != "windows":
        return float(IDLE_THRESHOLD_SECONDS + 1)

    user32 = getattr(ctypes, "windll", SimpleNamespace()).user32 if hasattr(ctypes, "windll") else None
    kernel32 = getattr(ctypes, "windll", SimpleNamespace()).kernel32 if hasattr(ctypes, "windll") else None
    if user32 is None or kernel32 is None:
        return float(IDLE_THRESHOLD_SECONDS + 1)

    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(LASTINPUTINFO)

    if not user32.GetLastInputInfo(ctypes.byref(info)):
        return float(IDLE_THRESHOLD_SECONDS + 1)

    tick_count = kernel32.GetTickCount()
    elapsed_ms = max(0, int(tick_count - info.dwTime))
    return elapsed_ms / 1000.0


def is_idle() -> bool:
    return get_idle_seconds() >= IDLE_THRESHOLD_SECONDS


def classify_issue(issue: dict) -> str:
    """
    Return 'simple' or 'complex' based on failure heuristics.
    """
    scenario_id = (issue.get("scenarioId") or "").lower()
    last_error = (issue.get("lastError") or "").lower()
    combined = f"{scenario_id}\n{last_error}"

    simple_terms = ["timeouterror", "selector", "typeerror", "tobevisible", "tohavetext"]
    complex_terms = ["auth", "billing", "401", "403", "race condition", "members"]

    if any(term in combined for term in complex_terms):
        return "complex"

    file_mentions = [line for line in last_error.splitlines() if "tests/" in line or "src/" in line]
    if len(file_mentions) > 1:
        return "complex"

    if "timeout" in scenario_id or "selector" in scenario_id:
        return "simple"

    if any(term in combined for term in simple_terms):
        return "simple"

    return "simple"


OVERNIGHT_PROCESSED_FILE = Path('/tmp/qa-overnight-processed.json')


def _load_overnight_processed() -> dict[str, int]:
    """Load {failure_id: attempt_count} from temp file."""
    if OVERNIGHT_PROCESSED_FILE.exists():
        try:
            data = json.loads(OVERNIGHT_PROCESSED_FILE.read_text())
            return {str(k): int(v) for k, v in data.items()}
        except Exception:
            pass
    return {}


def _save_overnight_processed(processed: dict[str, int]) -> None:
    try:
        OVERNIGHT_PROCESSED_FILE.write_text(json.dumps(processed))
    except Exception as e:
        print(f'[fix_dispatcher] Failed to save processed file: {e}')


def process_exploratory_trigger(issue: dict) -> None:
    """
    Run scripts/qa-agents/run.py for exploratory agents.
    Then close the trigger issue.
    """
    run_script = REPO_ROOT / "scripts" / "qa-agents" / "run.py"
    subprocess.run(
        [sys.executable, str(run_script)],
        cwd=run_script.parent,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )

    issue_number = issue.get("number")
    if issue_number is not None:
        subprocess.run(
            [
                "gh",
                "issue",
                "close",
                str(issue_number),
                "--repo",
                os.environ.get('QA_GITHUB_REPO') or os.environ.get('GITHUB_FEEDBACK_REPO') or 'DevVentari/QuiverDM-Live',
                "--comment",
                "Exploratory agent run triggered and completed.",
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
        )


def _load_exploratory_api():
    try:
        get_exploratory = get_open_exploratory_trigger_issues
    except Exception:
        get_exploratory = lambda: []
    return get_exploratory


def main():
    """
    Loop:
    1. Poll get_open_exploratory_trigger_issues() from GH
    2. Poll db_failures.get_open_failures() for qa failures
    3. For exploratory triggers: run regardless of idle
    4. For qa failures: skip if not idle (unless --no-idle-check)
    5. For each unprocessed failure:
       a. Generate handoff doc
       b. Classify failure
       c. Dispatch fix (codex or claude)
       d. If dispatch success: create PR, update fix attempt in DB
    6. Sleep POLL_INTERVAL_SECONDS (skip if --once)

    Track processed failure ids in memory set to avoid reprocessing in same session.
    """
    parser = argparse.ArgumentParser(description="Dispatch qa-failure fixes via Codex or Claude.")
    parser.add_argument("--once", action="store_true", help="Process one poll cycle and exit.")
    parser.add_argument("--no-idle-check", action="store_true", help="Skip idle detection.")
    parser.add_argument("--once-per-issue", action="store_true",
                        help="Attempt each failure exactly once; track in /tmp/qa-overnight-processed.json.")
    args = parser.parse_args()

    get_open_exploratory_trigger_issues = _load_exploratory_api()
    processed_ids: set[str] = set()

    # Load persistent processed map for --once-per-issue mode
    overnight_processed: dict[str, int] = _load_overnight_processed() if args.once_per_issue else {}

    while True:
        exploratory_issues = get_open_exploratory_trigger_issues() or []
        for issue in exploratory_issues:
            number = issue.get("number")
            key = str(number) if number is not None else None
            if key and key in processed_ids:
                continue
            process_exploratory_trigger(issue)
            if key:
                processed_ids.add(key)

        all_fixable: list[dict] = db_failures.get_open_failures() or []

        should_process = args.no_idle_check or is_idle()

        if should_process:
            for failure in all_fixable:
                failure_id = str(failure.get("id") or "")
                if not failure_id or failure_id in processed_ids:
                    continue

                if args.once_per_issue and failure_id in overnight_processed:
                    continue

                scenario_id = failure.get("scenarioId") or "unknown-scenario"

                handoff_base = REPO_ROOT / ".worktrees" / "fix" / "_handoffs" / scenario_id
                handoff_path = generate_handoff(failure, handoff_base)

                classification = classify_issue(failure)
                if classification == "complex":
                    result = dispatch_claude_fix(failure, scenario_id, handoff_path)
                else:
                    result = dispatch_codex_fix(failure, scenario_id)

                fix_succeeded = result.get("success", False)

                if fix_succeeded:
                    pr_url = create_fix_pr(
                        Path(result["worktree"]),
                        str(result["branch"]),
                        -1,
                        scenario_id,
                    )
                    if pr_url:
                        db_failures.update_fix_attempt(failure_id, pr_url=pr_url)

                if args.once_per_issue:
                    attempt = overnight_processed.get(failure_id, 0) + 1
                    overnight_processed[failure_id] = attempt
                    _save_overnight_processed(overnight_processed)

                processed_ids.add(failure_id)

        if args.once:
            break

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
