"""
Posts QA run results to Discord (forum thread) and creates GitHub issues for failures.

Required env vars:
  QUIVERDM_DISCORD_BOT_TOKEN — Discord bot token
  QA_DISCORD_FORUM_CHANNEL_ID — ID of the #qa-agent-runs forum channel
"""
import json
import os
import subprocess
from pathlib import Path

import httpx

from reporter import AgentResult

DISCORD_API = 'https://discord.com/api/v10'
QA_LABEL = 'qa-failure'
QA_AGENT_LABEL = 'source/qa-agent'


def get_github_repo() -> str:
    return (
        os.environ.get('QA_GITHUB_REPO')
        or os.environ.get('GITHUB_FEEDBACK_REPO')
        or 'DevVentari/quiverdm-feedback'
    )

_OUTCOME_EMOJI = {'success': '🟢', 'partial': '🟡', 'failed': '🔴'}


def build_run_summary(run_id: str, results: list[AgentResult], smoke_passed: bool) -> str:
    passed = sum(1 for r in results if r.outcome == 'success')
    total = len(results)
    smoke_line = '✅ Playwright smoke: all passed' if smoke_passed else '❌ Playwright smoke: FAILED (agents skipped)'
    lines = [f'**QA Run `{run_id}`** — {passed}/{total} agents passed', smoke_line, '']
    for r in results:
        emoji = _OUTCOME_EMOJI.get(r.outcome, '⚪')
        lines.append(f'{emoji} **{r.persona}** ({r.scenario}) — {r.outcome} in {r.duration_seconds}s')
    return '\n'.join(lines)


def build_failure_detail(result: AgentResult) -> str:
    lines = [
        f'**{result.persona}** failed `{result.scenario}`',
        '',
        f'**Findings:** {result.findings or "_No details captured_"}',
    ]
    if result.urls_visited:
        lines += ['', '**URLs visited:**'] + [f'- {u}' for u in result.urls_visited[:10]]
    if result.error:
        lines += ['', f'**Error:** `{result.error}`']
    return '\n'.join(lines)


def _bot_headers(token: str) -> dict:
    return {'Authorization': f'Bot {token}', 'User-Agent': 'QuiverDM-QA/1.0'}


def post_run(report: dict, screenshot_dir: Path | None = None, quiet: bool = False) -> None:
    """Post run summary to Discord forum thread and create GitHub issues for failures.

    quiet=True: skip Discord posting (overnight orchestrator handles Discord via dashboard).
    GitHub issues are still created in quiet mode (failures need tracking regardless).
    """
    token = os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN', '')
    channel_id = os.environ.get('QA_DISCORD_FORUM_CHANNEL_ID', '')

    run_id = report['run_id']
    results = [AgentResult(**a) for a in report.get('agents', [])]
    smoke_passed = report.get('smoke_passed', True)

    passed = sum(1 for r in results if r.outcome == 'success')
    total = len(results)
    thread_title = f'{run_id} — {passed}/{total} passed'
    summary = build_run_summary(run_id, results, smoke_passed)

    thread_id = None
    if not quiet:
        if token and channel_id:
            thread_id = _post_discord_thread(token, channel_id, thread_title, summary)
            if thread_id:
                for r in results:
                    if r.outcome != 'success':
                        _post_failure_to_thread(token, thread_id, r, screenshot_dir)
        else:
            print('[notifier] Discord env vars missing — skipping Discord post')
    else:
        print('[notifier] Quiet mode — skipping Discord thread (dashboard handles reporting)')

    for r in results:
        if r.outcome == 'failed':
            _create_github_issue(r, run_id)


def _post_discord_thread(token: str, channel_id: str, title: str, content: str) -> str | None:
    payload = {'name': title[:100], 'message': {'content': content[:2000]}}
    try:
        r = httpx.post(
            f'{DISCORD_API}/channels/{channel_id}/threads',
            headers=_bot_headers(token),
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
        thread_id = r.json().get('id')
        print(f'[notifier] Discord thread created: {thread_id}')
        return thread_id
    except Exception as e:
        print(f'[notifier] Discord post failed: {e}')
        return None


def _post_failure_to_thread(token: str, thread_id: str, result: AgentResult, screenshot_dir: Path | None) -> None:
    content = build_failure_detail(result)
    screenshot_path = result.screenshot_path and Path(result.screenshot_path)
    has_screenshot = screenshot_path and screenshot_path.exists()

    try:
        if has_screenshot:
            with open(screenshot_path, 'rb') as f:
                r = httpx.post(
                    f'{DISCORD_API}/channels/{thread_id}/messages',
                    headers=_bot_headers(token),
                    data={'payload_json': json.dumps({'content': content[:2000]})},
                    files={'files[0]': (screenshot_path.name, f, 'image/png')},
                    timeout=30,
                )
        else:
            r = httpx.post(
                f'{DISCORD_API}/channels/{thread_id}/messages',
                headers=_bot_headers(token),
                json={'content': content[:2000]},
                timeout=15,
            )
        r.raise_for_status()
    except Exception as e:
        print(f'[notifier] Failed to post failure detail: {e}')


def check_issue_exists(title: str) -> bool:
    """Return True if an open GitHub issue with this title already exists."""
    result = subprocess.run(
        ['gh', 'issue', 'list', '--repo', get_github_repo(), '--state', 'open',
         '--search', title, '--json', 'title,number,state', '--limit', '5'],
        capture_output=True, text=True, stdin=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        return False
    try:
        issues = json.loads(result.stdout)
        return any(i.get('title') == title for i in issues)
    except json.JSONDecodeError:
        return False


def _ensure_qa_label() -> None:
    subprocess.run(
        ['gh', 'label', 'create', QA_LABEL, '--repo', get_github_repo(),
         '--color', 'e11d48', '--description', 'Automated QA agent failure', '--force'],
        capture_output=True, stdin=subprocess.DEVNULL,
    )


def _ensure_qa_agent_label() -> None:
    subprocess.run(
        ['gh', 'label', 'create', QA_AGENT_LABEL, '--repo', get_github_repo(),
         '--color', '7057ff', '--description', 'Issue found by QA browser agent', '--force'],
        capture_output=True, stdin=subprocess.DEVNULL,
    )


def _create_github_issue(result: AgentResult, run_id: str) -> None:
    title = f'[qa-agent] {result.persona} — {result.scenario} failed'
    if check_issue_exists(title):
        print(f'[notifier] Issue already open: {title}')
        return

    _ensure_qa_label()
    _ensure_qa_agent_label()
    body_lines = [
        f'**Source:** QA browser agent',
        f'**Run:** `{run_id}`',
        f'**Persona:** {result.persona}',
        f'**Scenario:** `{result.scenario}`',
        f'**Duration:** {result.duration_seconds}s',
        '',
        '## Findings',
        result.findings or '_No findings captured_',
    ]
    if result.urls_visited:
        body_lines += ['', '## URLs Visited'] + [f'- {u}' for u in result.urls_visited[:10]]
    if result.error:
        body_lines += ['', f'## Error\n```\n{result.error}\n```']

    body = '\n'.join(body_lines)
    try:
        r = subprocess.run(
            ['gh', 'issue', 'create', '--repo', get_github_repo(),
             '--title', title, '--body', body,
             '--label', 'bug', '--label', QA_LABEL, '--label', QA_AGENT_LABEL],
            capture_output=True, text=True, stdin=subprocess.DEVNULL,
        )
        if r.returncode == 0:
            print(f'[notifier] GitHub issue created: {r.stdout.strip()}')
        else:
            print(f'[notifier] GitHub issue failed: {r.stderr[:200]}')
    except Exception as e:
        print(f'[notifier] GitHub issue error: {e}')
