"""Dispatch Codex to fix a simple qa-failure issue."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from handoff_generator import generate_handoff

REPO_ROOT = Path(__file__).parent.parent.parent


def _run_git(args: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd or REPO_ROOT,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        stdin=subprocess.DEVNULL,
    )


def _slugify(s: str) -> str:
    """Convert scenario_id to a valid git branch/path component."""
    import re
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


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

    slug = _slugify(scenario_id)
    suffix = 0
    while True:
        suffix_token = "" if suffix == 0 else f"-{suffix + 1}"
        branch = f"fix/qa-{slug}{suffix_token}"
        worktree = base_dir / f"{slug}{suffix_token}"

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


def dispatch_codex_fix(issue: dict, scenario_id: str) -> dict:
    """
    1. Create worktree at REPO_ROOT / '.worktrees' / 'fix' / scenario_id
       Branch: fix/qa-<scenario_id>
       Command: git worktree add <path> -b fix/qa-<scenario_id>
    2. Copy handoff doc into worktree (or generate it there)
    3. Run: codex exec --full-auto -C "<worktree>" "Read CODEX_FIX_HANDOFF.md and implement all fixes described."
       timeout=600 (10 min)
       capture_output=True
    4. Return dict: {success: bool, worktree: str, branch: str, stdout: str, stderr: str}

    On worktree creation failure (branch exists): use existing worktree or increment suffix.
    """
    if not shutil.which('codex'):
        return {'success': False, 'worktree': '', 'branch': '', 'stdout': '', 'stderr': 'codex not installed'}

    worktree, branch = _prepare_worktree(scenario_id)
    generate_handoff(issue, worktree)

    proc = subprocess.run(
        [
            "codex",
            "exec",
            "--full-auto",
            "-C",
            str(worktree),
            "Read CODEX_FIX_HANDOFF.md and implement all fixes described.",
        ],
        capture_output=True,
        text=True,
        timeout=600,
        stdin=subprocess.DEVNULL,
    )

    return {
        "success": proc.returncode == 0,
        "worktree": str(worktree),
        "branch": branch,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }
