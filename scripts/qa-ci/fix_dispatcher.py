"""
Fix dispatcher - runs on host PC, polls GitHub for qa-failure issues.

Usage:
  uv run python fix_dispatcher.py [--once] [--no-idle-check]

--once: process one issue and exit (for testing)
--no-idle-check: skip idle detection (for testing/CI)

Idle detection: Windows only via ctypes.windll.user32.GetLastInputInfo
Idle threshold: 5 minutes (300 seconds)
"""
from __future__ import annotations

import argparse
import ctypes
import platform
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from fix_claude import dispatch_claude_fix
from fix_codex import dispatch_codex_fix
from handoff_generator import generate_handoff
from pr_creator import comment_pr_on_issue, create_fix_pr

IDLE_THRESHOLD_SECONDS = 300
POLL_INTERVAL_SECONDS = 60
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GITHUB_REPO = "DevVentari/QuiverDM-Live"


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
    Return 'simple' or 'complex' based on issue body/title heuristics.
    """
    title = (issue.get("title") or "").lower()
    body = (issue.get("body") or "").lower()
    combined = f"{title}\n{body}"

    simple_terms = ["timeouterror", "selector", "typeerror", "tobevisible", "tohavetext"]
    complex_terms = ["auth", "billing", "401", "403", "race condition", "members"]

    if any(term in combined for term in complex_terms):
        return "complex"

    file_mentions = [line for line in body.splitlines() if "tests/" in line or "src/" in line]
    if len(file_mentions) > 1:
        return "complex"

    if "timeout" in title or "selector" in title:
        return "simple"

    if any(term in combined for term in simple_terms):
        return "simple"

    return "simple"


def _parse_scenario_id_from_title(title: str) -> str:
    marker = "]"
    if marker in title:
        remainder = title.split(marker, 1)[1].strip()
    else:
        remainder = title.strip()

    for sep in (" - ", " -", "- ", " - ", " - ", ":"):
        if sep in remainder:
            candidate = remainder.split(sep, 1)[0].strip()
            if candidate:
                return candidate

    return remainder or "unknown-scenario"


def process_exploratory_trigger(issue: dict) -> None:
    """
    Run scripts/qa-agents/run.py for exploratory agents.
    Then close the trigger issue.
    Import and call from scripts/qa-agents/run.py or subprocess it.
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
                GITHUB_REPO,
                "--comment",
                "Exploratory agent run triggered and completed.",
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
        )


def _load_issue_api():
    try:
        import github_issues  # type: ignore
    except Exception:
        return (
            lambda: [],
            lambda: [],
        )

    get_failures = getattr(github_issues, "get_open_qa_failure_issues", None)
    get_exploratory = getattr(github_issues, "get_open_exploratory_trigger_issues", None)

    if not callable(get_failures):
        get_failures = lambda: []
    if not callable(get_exploratory):
        get_exploratory = lambda: []

    return get_failures, get_exploratory


def main():
    """
    Loop:
    1. Import github_issues (add scripts/qa-ci to sys.path)
    2. Poll get_open_qa_failure_issues()
    3. Also poll get_open_exploratory_trigger_issues()
    4. For exploratory triggers: run regardless of idle
    5. For qa-failure issues: skip if not idle (unless --no-idle-check)
    6. For each unprocessed failure issue:
       a. Parse scenario_id from issue title: [qa-failure] <scenario_id> - ...
       b. Generate handoff doc
       c. Classify issue
       d. Dispatch fix (codex or claude)
       e. If dispatch success: create PR, comment on issue
    7. Sleep POLL_INTERVAL_SECONDS (skip if --once)

    Track processed issues in memory set to avoid reprocessing in same session.
    """
    parser = argparse.ArgumentParser(description="Dispatch qa-failure fixes via Codex or Claude.")
    parser.add_argument("--once", action="store_true", help="Process one poll cycle and exit.")
    parser.add_argument("--no-idle-check", action="store_true", help="Skip idle detection.")
    args = parser.parse_args()

    get_open_qa_failure_issues, get_open_exploratory_trigger_issues = _load_issue_api()
    processed_issue_numbers: set[int] = set()

    while True:
        exploratory_issues = get_open_exploratory_trigger_issues() or []
        for issue in exploratory_issues:
            number = issue.get("number")
            if isinstance(number, int) and number in processed_issue_numbers:
                continue
            process_exploratory_trigger(issue)
            if isinstance(number, int):
                processed_issue_numbers.add(number)

        failures = get_open_qa_failure_issues() or []
        should_process_failures = args.no_idle_check or is_idle()

        if should_process_failures:
            for issue in failures:
                number = issue.get("number")
                if isinstance(number, int) and number in processed_issue_numbers:
                    continue

                title = issue.get("title") or ""
                scenario_id = _parse_scenario_id_from_title(title)

                handoff_base = REPO_ROOT / ".worktrees" / "fix" / "_handoffs" / scenario_id
                handoff_path = generate_handoff(issue, handoff_base)

                classification = classify_issue(issue)
                if classification == "complex":
                    result = dispatch_claude_fix(issue, scenario_id, handoff_path)
                else:
                    result = dispatch_codex_fix(issue, scenario_id)

                if result.get("success"):
                    pr_url = create_fix_pr(
                        Path(result["worktree"]),
                        str(result["branch"]),
                        int(number) if isinstance(number, int) else -1,
                        scenario_id,
                    )
                    if pr_url and isinstance(number, int):
                        comment_pr_on_issue(number, pr_url)

                if isinstance(number, int):
                    processed_issue_numbers.add(number)

        if args.once:
            break

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
