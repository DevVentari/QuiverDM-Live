"""GitHub issue management via gh CLI."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

QA_FAILURE_LABEL = 'qa-failure'
QA_EXPLORATORY_LABEL = 'qa-exploratory'
SOURCE_QA_SPEC_LABEL = 'source/qa-spec'
SOURCE_USER_FEEDBACK_LABEL = 'source/user-feedback'
SOURCE_QA_AGENT_LABEL = 'source/qa-agent'
REPO_ROOT = Path(__file__).parent.parent.parent


def get_github_repo() -> str:
    # Priority: explicit QA repo, then feedback repo, then legacy default.
    return (
        os.environ.get('QA_GITHUB_REPO')
        or os.environ.get('GITHUB_FEEDBACK_REPO')
        or 'DevVentari/QuiverDM-Live'
    )


def _gh(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ['gh', *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )


def ensure_label(label: str, color: str, description: str) -> None:
    _gh('label', 'create', label, '--repo', get_github_repo(),
        '--color', color, '--description', description, '--force')


def create_failure_issue(scenario_id: str, spec_file: str, cycle: int, error: str | None) -> int | None:
    ensure_label(QA_FAILURE_LABEL, 'e11d48', 'Automated QA regression failure')
    ensure_label('bug', 'd73a4a', '')
    ensure_label(SOURCE_QA_SPEC_LABEL, '0075ca', 'Issue from automated Playwright spec runner')

    title = f'[qa-failure] {scenario_id} — 3 consecutive failures (cycle {cycle})'
    error_section = f'\n\n## Last Error\n```\n{error[:1000]}\n```' if error else ''
    body = (
        f'**scenario_id:** {scenario_id}\n'
        f'**spec_file:** {spec_file}\n'
        f'**cycle:** {cycle}\n'
        f'**last_error:** {(error or "")[:200]}'
        f'{error_section}\n\n'
        '## Fix Agent Instructions\n'
        '1. Read the spec file carefully\n'
        '2. Identify root cause from the error\n'
        '3. Fix application code (not the test) unless selector/URL is wrong\n'
        '4. Verify: `npx tsc --noEmit`\n'
    )

    proc = _gh('issue', 'create', '--repo', get_github_repo(),
               '--title', title, '--body', body,
               '--label', 'bug', '--label', QA_FAILURE_LABEL, '--label', SOURCE_QA_SPEC_LABEL)
    if proc.returncode != 0:
        print(f'[github_issues] Failed to create issue: {proc.stderr[:200]}')
        return None

    url = proc.stdout.strip()
    try:
        return int(url.rstrip('/').split('/')[-1])
    except (ValueError, IndexError):
        return None


def close_issue(issue_number: int, comment: str) -> bool:
    repo = get_github_repo()
    _gh('issue', 'comment', str(issue_number), '--repo', repo, '--body', comment)
    proc = _gh('issue', 'close', str(issue_number), '--repo', repo)
    return proc.returncode == 0


def get_open_qa_failure_issues() -> list[dict]:
    proc = _gh('issue', 'list', '--repo', get_github_repo(),
               '--label', QA_FAILURE_LABEL, '--state', 'open',
               '--json', 'number,title,body,createdAt', '--limit', '20')
    if proc.returncode != 0:
        return []
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []


def get_open_exploratory_trigger_issues() -> list[dict]:
    proc = _gh('issue', 'list', '--repo', get_github_repo(),
               '--label', QA_EXPLORATORY_LABEL, '--state', 'open',
               '--json', 'number,title,body,createdAt', '--limit', '5')
    if proc.returncode != 0:
        return []
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []


def get_open_user_feedback_issues() -> list[dict]:
    proc = _gh('issue', 'list', '--repo', get_github_repo(),
               '--label', SOURCE_USER_FEEDBACK_LABEL, '--state', 'open',
               '--json', 'number,title,body,createdAt', '--limit', '20')
    if proc.returncode != 0:
        return []
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []


def get_open_qa_agent_issues() -> list[dict]:
    proc = _gh('issue', 'list', '--repo', get_github_repo(),
               '--label', SOURCE_QA_AGENT_LABEL, '--state', 'open',
               '--json', 'number,title,body,createdAt', '--limit', '20')
    if proc.returncode != 0:
        return []
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []


def create_exploratory_trigger_issue(cycle: int) -> int | None:
    ensure_label(QA_EXPLORATORY_LABEL, '0075ca', 'QA exploratory agent trigger')

    title = f'[QA-Exploratory] Trigger cycle {cycle}'
    body = f'Trigger exploratory browser agents for cycle {cycle}.\n\nFix dispatcher will pick this up and run `scripts/qa-agents/run.py`.'
    proc = _gh('issue', 'create', '--repo', get_github_repo(),
               '--title', title, '--body', body,
               '--label', QA_EXPLORATORY_LABEL)
    if proc.returncode != 0:
        return None
    url = proc.stdout.strip()
    try:
        return int(url.rstrip('/').split('/')[-1])
    except (ValueError, IndexError):
        return None
