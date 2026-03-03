"""Morning QA report — posts a daily briefing to Discord at 6am AEDT.

Reads:  scenario_state.json (local regression runner state)
        ../qa-agents/reports/latest.json (last browser agent run)
        GitHub open issues via gh CLI

Posts: a forum thread to QA_DISCORD_FORUM_CHANNEL_ID.

Env vars (from .env.qa):
  QUIVERDM_DISCORD_BOT_TOKEN
  QA_DISCORD_FORUM_CHANNEL_ID
  ANTHROPIC_API_KEY   (optional — falls back to template if missing/no credits)
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import db_failures

REPO_ROOT = Path(__file__).parent.parent.parent
STATE_FILE = Path(__file__).parent / 'scenario_state.json'
AGENT_REPORT = REPO_ROOT / 'scripts' / 'qa-agents' / 'reports' / 'latest.json'
DISCORD_API = 'https://discord.com/api/v10'
ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'


def _load_regression_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text(encoding='utf-8'))
    except Exception:
        return {}


def _load_agent_report() -> dict | None:
    if not AGENT_REPORT.exists():
        return None
    try:
        return json.loads(AGENT_REPORT.read_text(encoding='utf-8'))
    except Exception:
        return None


def _get_open_failures() -> list[dict]:
    try:
        return db_failures.get_open_failures() or []
    except Exception:
        return []


def _summarise_state(state: dict) -> dict:
    specs = state.get('specs')
    if not isinstance(specs, dict):
        specs = state.get('scenarios', {})
    active = [s for s, d in specs.items() if d.get('status') == 'active']
    failing = [s for s, d in specs.items() if d.get('status') in ('failing', 'paused')]
    return {
        'total': len(specs),
        'active': len(active),
        'failing': failing,
        'cycles': state.get('cycles_completed', state.get('cycle_count', 0)),
    }


def _summarise_agents(report: dict | None) -> str:
    if not report:
        return 'No agent run on record yet.'

    # Current schema from scripts/qa-agents/reporter.py:
    # { run_id, duration_seconds, agents:[{ outcome, friction_points, ...}] }
    run_id = report.get('run_id')
    if isinstance(run_id, str) and run_id:
        ts = run_id[:16].replace('T', ' ')
    else:
        ts = str(report.get('timestamp', ''))[:16].replace('T', ' ')

    agents = report.get('agents')
    if isinstance(agents, list):
        successes = sum(1 for a in agents if isinstance(a, dict) and a.get('outcome') == 'success')
        issues = sum(int((a.get('friction_points') or 0)) for a in agents if isinstance(a, dict))
        total = len(agents)
    else:
        # Backward compatibility for older report format: { results:[{success, issues_found}] }
        results = report.get('results', [])
        successes = sum(1 for r in results if isinstance(r, dict) and r.get('success'))
        issues = sum(len(r.get('issues_found', [])) for r in results if isinstance(r, dict))
        total = len(results)

    return (
        f"Last run {ts}: {successes}/{total} personas succeeded, "
        f"{issues} issue(s) found."
    )


def _generate_claude(state_summary: dict, agent_summary: str, failures: list[dict]) -> str | None:
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        return None

    failing_str = (
        f"{len(state_summary['failing'])} failing ({', '.join(state_summary['failing'])})"
        if state_summary['failing']
        else 'none failing'
    )
    failure_str = (
        ', '.join(f.get('scenarioId', '') for f in failures[:4]) if failures else 'none'
    )
    prompt = (
        f"Write a brief morning QA briefing for Blake, developer of QuiverDM "
        f"(AI-powered D&D session management). Today: {datetime.now().strftime('%A %d %B %Y')}.\n\n"
        f"Regression runner: {state_summary['active']}/{state_summary['total']} specs active, "
        f"{failing_str}, {state_summary['cycles']} cycles run.\n"
        f"Browser agents: {agent_summary}\n"
        f"Open failures: {len(failures)} ({failure_str})\n\n"
        "3-4 sentences max. Direct and specific. No emojis, no headers. "
        "Plain text that reads naturally in Discord. Address Blake directly."
    )
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                ANTHROPIC_API,
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                json={
                    'model': 'claude-haiku-4-5-20251001',
                    'max_tokens': 300,
                    'messages': [{'role': 'user', 'content': prompt}],
                },
            )
            if resp.status_code == 200:
                return resp.json()['content'][0]['text']
            print(f'[morning_report] Anthropic API error {resp.status_code}: {resp.text[:200]}')
    except Exception as exc:
        print(f'[morning_report] Claude call failed: {exc}')
    return None


def _generate_template(state_summary: dict, agent_summary: str, failures: list[dict]) -> str:
    day = datetime.now().strftime('%A %d %B')
    parts = [f"Morning Blake — QA report for {day}."]
    if state_summary['failing']:
        parts.append(
            f"Regression: {state_summary['active']}/{state_summary['total']} specs active, "
            f"{len(state_summary['failing'])} failing: {', '.join(state_summary['failing'])}."
        )
    else:
        parts.append(
            f"Regression: all {state_summary['total']} specs active "
            f"after {state_summary['cycles']} cycles overnight."
        )
    parts.append(f"Browser agents: {agent_summary}")
    if failures:
        scenario_ids = ', '.join(f.get('scenarioId', '') for f in failures[:3])
        parts.append(f"Open failures: {len(failures)} — {scenario_ids}.")
    else:
        parts.append("No open failures.")
    return ' '.join(parts)


def _post_to_discord(message: str) -> bool:
    token = os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN', '')
    channel = os.environ.get('QA_DISCORD_FORUM_CHANNEL_ID', '')
    if not token or not channel:
        print('[morning_report] Missing Discord env vars')
        return False

    date_str = datetime.now().strftime('%a %d %b')
    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f'{DISCORD_API}/channels/{channel}/threads',
            headers={'Authorization': f'Bot {token}', 'Content-Type': 'application/json'},
            json={
                'name': f'Morning Report — {date_str}',
                'message': {'content': message},
                'auto_archive_duration': 1440,
            },
        )
    if resp.status_code not in (200, 201):
        print(f'[morning_report] Discord error {resp.status_code}: {resp.text[:200]}')
        return False
    return True


def main() -> None:
    # Load env from .env.qa if running standalone (systemd loads it via EnvironmentFile)
    env_file = Path(__file__).parent.parent.parent / '.env.qa'
    if env_file.exists() and not os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN'):
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip())

    state = _load_regression_state()
    agent_report = _load_agent_report()
    failures = _get_open_failures()

    state_summary = _summarise_state(state)
    agent_summary = _summarise_agents(agent_report)

    message = _generate_claude(state_summary, agent_summary, failures)
    if not message:
        message = _generate_template(state_summary, agent_summary, failures)

    print(message)
    success = _post_to_discord(message)
    print(f'[morning_report] posted={success}')


if __name__ == '__main__':
    main()
