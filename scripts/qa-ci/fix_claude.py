"""Dispatch Claude CLI to fix a complex qa-failure issue."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


def _safe_env() -> dict:
    """
    Build safe child env per CLAUDE.md rules:
    - CI=true
    - No CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, ANTHROPIC_API_KEY
    - System vars: PATH, HOME, USERPROFILE, APPDATA, LOCALAPPDATA, TEMP, TMP, SystemRoot, COMSPEC, NODE_ENV
    """
    keep = [
        "PATH",
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "TEMP",
        "TMP",
        "SystemRoot",
        "COMSPEC",
        "NODE_ENV",
    ]
    env = {k: os.environ[k] for k in keep if k in os.environ}
    env["CI"] = "true"
    return env


def _run_git(args: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd or REPO_ROOT,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )


def _find_existing_worktree_for_branch(branch: str) -> Path | None:
    proc = _run_git(["worktree", "list", "--porcelain"])
    if proc.returncode != 0:
        return None

    current_path: Path | None = None
    current_branch: str | None = None

    for line in proc.stdout.splitlines():
        if line.startswith("worktree "):
            current_path = Path(line.split(" ", 1)[1].strip())
            current_branch = None
        elif line.startswith("branch "):
            current_branch = line.split(" ", 1)[1].strip().replace("refs/heads/", "")
        elif not line.strip() and current_path and current_branch == branch:
            return current_path

    if current_path and current_branch == branch:
        return current_path

    return None


def _prepare_worktree(scenario_id: str) -> tuple[Path, str]:
    base_dir = REPO_ROOT / ".worktrees" / "fix"
    base_dir.mkdir(parents=True, exist_ok=True)

    suffix = 0
    while True:
        suffix_token = "" if suffix == 0 else f"-{suffix + 1}"
        branch = f"fix/qa-{scenario_id}{suffix_token}"
        worktree = base_dir / f"{scenario_id}{suffix_token}"

        if worktree.exists() and (worktree / ".git").exists():
            return worktree, branch

        proc = _run_git(["worktree", "add", str(worktree), "-b", branch])
        if proc.returncode == 0:
            return worktree, branch

        stderr = (proc.stderr or "").lower()
        if "already exists" in stderr or "already checked out" in stderr:
            existing = _find_existing_worktree_for_branch(branch)
            if existing:
                return existing, branch

        suffix += 1
        if suffix > 20:
            raise RuntimeError(f"Unable to create worktree for scenario {scenario_id}: {proc.stderr}")


def dispatch_claude_fix(issue: dict, scenario_id: str, handoff_path: Path) -> dict:
    """
    1. Create worktree same as fix_codex
    2. Build claude prompt from issue body + handoff doc content
    3. Run: claude -p --output-format json --model claude-sonnet-4-6 "<prompt>"
       cwd=worktree
       env=_safe_env()
       stdin=subprocess.DEVNULL
       timeout=900 (15 min)
    4. Parse JSON output: result_json = json.loads(stdout); content = result_json.get('result', '')
    5. Return dict: {success: bool, worktree: str, branch: str, output: str}
    """
    worktree, branch = _prepare_worktree(scenario_id)

    target_handoff = worktree / "CODEX_FIX_HANDOFF.md"
    if handoff_path.exists():
        target_handoff.write_text(handoff_path.read_text(encoding="utf-8"), encoding="utf-8")

    issue_number = issue.get("number", "?")
    title = issue.get("title", "")
    issue_body = issue.get("body", "")
    handoff_content = target_handoff.read_text(encoding="utf-8") if target_handoff.exists() else ""

    prompt = (
        "You are fixing a failing Playwright test in QuiverDM.\n\n"
        f"Issue #{issue_number}: {title}\n\n"
        f"{issue_body}\n\n"
        "Handoff context:\n"
        f"{handoff_content}\n\n"
        "Your task:\n"
        "1. Read the failing spec file\n"
        "2. Identify the root cause\n"
        "3. Fix the application code\n"
        "4. Verify TypeScript compiles: npx tsc --noEmit\n\n"
        "Fix only what's needed. No unrelated changes."
    )

    proc = subprocess.run(
        [
            "claude",
            "-p",
            "--output-format",
            "json",
            "--model",
            "claude-sonnet-4-6",
            prompt,
        ],
        cwd=worktree,
        env=_safe_env(),
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=900,
    )

    output = ""
    if proc.stdout:
        try:
            result_json = json.loads(proc.stdout)
            output = result_json.get("result", "")
        except json.JSONDecodeError:
            output = proc.stdout.strip()

    if proc.stderr:
        output = f"{output}\n{proc.stderr.strip()}".strip()

    return {
        "success": proc.returncode == 0,
        "worktree": str(worktree),
        "branch": branch,
        "output": output,
    }
