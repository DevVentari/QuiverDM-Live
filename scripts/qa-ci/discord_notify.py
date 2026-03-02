"""Discord bot REST notifications for regression runner."""
from __future__ import annotations

import os

import httpx

DISCORD_API = 'https://discord.com/api/v10'


def _headers() -> dict:
    token = os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN', '')
    return {'Authorization': f'Bot {token}', 'User-Agent': 'QuiverDM-QA-CI/1.0'}


def _channel_id() -> str:
    return os.environ.get('QA_DISCORD_FORUM_CHANNEL_ID', '')


def post_cycle_summary(cycle: int, total_completions: int, target: int, active: int, total: int, paused_ids: list[str]) -> None:
    channel = _channel_id()
    if not channel:
        return
    content = f'Cycle {cycle} | {total_completions}/{target} completions | {active}/{total} active | {len(paused_ids)} paused'
    if paused_ids:
        content += f'\nPaused: {", ".join(paused_ids)}'
    _post_thread(f'QA Cycle {cycle} Summary', content)


def post_state_change(scenario_id: str, new_status: str, detail: str | None = None) -> None:
    content = f'{scenario_id} -> {new_status}'
    if detail:
        content += f'\n{detail}'
    _post_message(content)


def post_error(message: str) -> None:
    _post_message(f'[QA-CI ERROR] {message}')


def _post_thread(title: str, content: str) -> str | None:
    channel = _channel_id()
    if not channel:
        return None
    try:
        r = httpx.post(
            f'{DISCORD_API}/channels/{channel}/threads',
            headers=_headers(),
            json={'name': title[:100], 'message': {'content': content[:2000]}},
            timeout=15,
        )
        r.raise_for_status()
        return r.json().get('id')
    except Exception as e:
        print(f'[discord_notify] Thread post failed: {e}')
        return None


def _post_message(content: str) -> bool:
    channel = _channel_id()
    if not channel:
        return False
    try:
        r = httpx.post(
            f'{DISCORD_API}/channels/{channel}/messages',
            headers=_headers(),
            json={'content': content[:2000]},
            timeout=15,
        )
        r.raise_for_status()
        return True
    except Exception as e:
        print(f'[discord_notify] Message post failed: {e}')
        return False
