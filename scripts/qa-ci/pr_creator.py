"""Push fix branch and create a GitHub PR."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path


def get_github_repo() -> str:
    return (
        os.environ.get('QA_GITHUB_REPO')
        or os.environ.get('GITHUB_FEEDBACK_REPO')
        or 'DevVentari/QuiverDM-Live'
    )


def _run(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )


def create_fix_pr(worktree_path: Path, branch: str, issue_number: int, scenario_id: str) -> str | None:
    """
    1. In worktree: git add -A && git commit -m "fix(qa): repair {scenario_id} spec (closes #{issue_number})"
       If nothing to commit (returncode != 0 on add), return None - no changes made
    2. git push -u origin {branch}
    3. gh pr create --repo GITHUB_REPO --title "fix(qa): {scenario_id}" --body "..."
       Body: "Closes #{issue_number}\n\nAutomated fix for failing QA scenario `{scenario_id}`."
       --label "bug"
    4. Return PR URL (strip from gh pr create stdout) or None on failure.

    All subprocess calls: cwd=worktree_path, capture_output=True, text=True, stdin=subprocess.DEVNULL
    """
    add_proc = _run(["git", "add", "-A"], cwd=worktree_path)
    if add_proc.returncode != 0:
        return None

    diff_proc = _run(["git", "diff", "--cached", "--quiet"], cwd=worktree_path)
    if diff_proc.returncode == 0:
        return None

    commit_msg = f"fix(qa): repair {scenario_id} spec (closes #{issue_number})"
    commit_proc = _run(["git", "commit", "-m", commit_msg], cwd=worktree_path)
    if commit_proc.returncode != 0:
        return None

    push_proc = _run(["git", "push", "-u", "origin", branch], cwd=worktree_path)
    if push_proc.returncode != 0:
        return None

    pr_body = f"Closes #{issue_number}\n\nAutomated fix for failing QA scenario `{scenario_id}`."
    pr_proc = _run(
        [
            "gh",
            "pr",
            "create",
            "--repo",
            get_github_repo(),
            "--title",
            f"fix(qa): {scenario_id}",
            "--body",
            pr_body,
            "--label",
            "bug",
        ],
        cwd=worktree_path,
    )
    if pr_proc.returncode != 0:
        return None

    for line in pr_proc.stdout.splitlines():
        candidate = line.strip()
        if candidate.startswith("http://") or candidate.startswith("https://"):
            return candidate

    return pr_proc.stdout.strip() or None


def comment_pr_on_issue(issue_number: int, pr_url: str) -> None:
    """
    gh issue comment <issue_number> --repo GITHUB_REPO --body "Fix PR opened: <pr_url>"
    """
    subprocess.run(
        [
            "gh",
            "issue",
            "comment",
            str(issue_number),
            "--repo",
            get_github_repo(),
            "--body",
            f"Fix PR opened: {pr_url}",
        ],
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )
