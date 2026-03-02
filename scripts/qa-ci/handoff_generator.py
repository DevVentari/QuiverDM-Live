"""Generate Codex handoff doc from a qa-failure GitHub issue."""
from __future__ import annotations

from pathlib import Path


def parse_scenario_from_issue(body: str) -> dict:
    """
    Parse issue body lines like:
    **scenario_id:** campaigns
    **spec_file:** tests/campaigns.spec.ts
    **last_error:** TimeoutError: ...

    Returns dict with scenario_id, spec_file, last_error (may be None if not found).
    Use simple line-by-line parsing, no regex required.
    """
    scenario_id: str | None = None
    spec_file: str | None = None
    last_error: str | None = None

    collecting_error = False
    error_lines: list[str] = []

    for raw_line in body.splitlines():
        line = raw_line.strip()
        lower_line = line.lower()

        if lower_line.startswith("**scenario_id:**"):
            scenario_id = line.split(":", 1)[1].strip() if ":" in line else None
            collecting_error = False
            continue

        if lower_line.startswith("**spec_file:**"):
            spec_file = line.split(":", 1)[1].strip() if ":" in line else None
            collecting_error = False
            continue

        if lower_line.startswith("**last_error:**"):
            last_error_part = line.split(":", 1)[1].strip() if ":" in line else ""
            if last_error_part:
                error_lines = [last_error_part]
            else:
                error_lines = []
            collecting_error = True
            continue

        if collecting_error:
            if line.startswith("**") and line.endswith("**"):
                collecting_error = False
            elif line:
                error_lines.append(line)

    if error_lines:
        last_error = "\n".join(error_lines)

    return {
        "scenario_id": scenario_id,
        "spec_file": spec_file,
        "last_error": last_error,
    }


def generate_handoff(issue: dict, worktree_path: Path) -> Path:
    """
    issue: dict with keys: number, title, body, createdAt
    worktree_path: Path to git worktree

    Parse issue body to extract: scenario_id, spec_file, last_error
    Write handoff doc to worktree_path / 'CODEX_FIX_HANDOFF.md'
    Return path to handoff doc.
    """
    issue_body = issue.get("body") or ""
    parsed = parse_scenario_from_issue(issue_body)

    scenario_id = parsed.get("scenario_id") or "unknown-scenario"
    spec_file = parsed.get("spec_file") or "tests/unknown.spec.ts"
    last_error = parsed.get("last_error") or "No error details were provided in the issue body."

    worktree_path.mkdir(parents=True, exist_ok=True)
    handoff_path = worktree_path / "CODEX_FIX_HANDOFF.md"

    handoff_text = f"""# Fix Handoff: {scenario_id}

## Goal
Fix the failing Playwright test: {spec_file}

## Error
```
{last_error}
```

## Instructions
1. Read {spec_file} carefully
2. Run `npx playwright test {spec_file} --reporter=list` mentally to understand what it tests
3. Identify the root cause from the error
4. Fix the application code (not the test) unless the test has a wrong selector/URL
5. Common fixes: wrong CSS selector, missing await, race condition, missing route handler
6. Do NOT change test timeout values
7. Verify your fix by checking the relevant source files

## Files Likely Involved
- {spec_file}
- src/app/ routes or components mentioned in the test
- src/server/routers/ if it's an API failure

## Constraints
- Fix only what's needed to make {spec_file} pass
- No unrelated refactoring
- TypeScript must compile: `npx tsc --noEmit`
"""

    handoff_path.write_text(handoff_text, encoding="utf-8")
    return handoff_path
