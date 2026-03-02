"""Discord dashboard — single thread with periodic update messages for overnight QA runs."""
from __future__ import annotations

import os
import time
from datetime import datetime

import httpx

DISCORD_API = 'https://discord.com/api/v10'
_MAX_RETRIES = 3


def _headers() -> dict:
    token = os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN', '')
    return {'Authorization': f'Bot {token}', 'User-Agent': 'QuiverDM-QA-CI/1.0'}


def _channel_id() -> str:
    return os.environ.get('QA_DISCORD_FORUM_CHANNEL_ID', '')


def _post_with_retry(url: str, payload: dict, timeout: int = 15) -> dict | None:
    for attempt in range(_MAX_RETRIES):
        try:
            r = httpx.post(url, headers=_headers(), json=payload, timeout=timeout)
            if r.status_code == 429:
                retry_after = float(r.json().get('retry_after', 5))
                print(f'[dashboard] Discord rate limited, waiting {retry_after}s')
                time.sleep(retry_after * (2 ** attempt))
                continue
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            print(f'[dashboard] HTTP error (attempt {attempt + 1}): {e}')
            if attempt < _MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
        except Exception as e:
            print(f'[dashboard] Request failed (attempt {attempt + 1}): {e}')
            if attempt < _MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
    return None


class Dashboard:
    def __init__(self, bot_token: str | None = None, channel_id: str | None = None):
        self.thread_id: str | None = None
        self.run_start = datetime.now()
        self._token = bot_token or os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN', '')
        self._channel = channel_id or _channel_id()

    @property
    def enabled(self) -> bool:
        return bool(self._token and self._channel)

    def _ts(self) -> str:
        elapsed = datetime.now() - self.run_start
        h, rem = divmod(int(elapsed.total_seconds()), 3600)
        m, _ = divmod(rem, 60)
        return f'{h:02d}:{m:02d}'

    def create_thread(self, title: str) -> str | None:
        if not self.enabled:
            print('[dashboard] Discord not configured — skipping thread creation')
            return None
        payload = {
            'name': title[:100],
            'message': {'content': f'**{title}**\nStarted at {self.run_start.strftime("%Y-%m-%d %H:%M AEDT")}'},
        }
        data = _post_with_retry(f'{DISCORD_API}/channels/{self._channel}/threads', payload)
        if data:
            self.thread_id = data.get('id')
            print(f'[dashboard] Thread created: {self.thread_id}')
            return self.thread_id
        return None

    def post_update(self, stats: dict) -> None:
        if not self.thread_id:
            return
        specs_pass = stats.get('specs_passing', 0)
        specs_total = stats.get('specs_total', 0)
        pct = int(specs_pass / specs_total * 100) if specs_total else 0
        fixed = stats.get('issues_fixed', 0)
        escalated = stats.get('issues_escalated', 0)
        agents_pass = stats.get('agents_passing', 0)
        agents_total = stats.get('agents_total', 0)

        parts = [f'[{self._ts()}]']
        if specs_total:
            parts.append(f'Specs: {specs_pass}/{specs_total} ({pct}%)')
        if fixed:
            parts.append(f'Fixed: {fixed}')
        if escalated:
            parts.append(f'Escalated: {escalated}')
        if agents_total:
            parts.append(f'Agents: {agents_pass}/{agents_total} passing')

        content = ' | '.join(parts)
        _post_with_retry(
            f'{DISCORD_API}/channels/{self.thread_id}/messages',
            {'content': content[:2000]},
        )

    def post_escalation(self, issue_title: str, issue_url: str, details: str = '') -> None:
        if not self.thread_id:
            return
        lines = [
            f'**ESCALATED: {issue_title}**',
            '2 fix attempts failed. Needs manual review.',
            issue_url,
        ]
        if details:
            lines.append(details[:500])
        _post_with_retry(
            f'{DISCORD_API}/channels/{self.thread_id}/messages',
            {'content': '\n'.join(lines)[:2000]},
        )

    def post_phase_change(self, phase_name: str, details: str = '') -> None:
        if not self.thread_id:
            return
        content = f'[{self._ts()}] **{phase_name}**'
        if details:
            content += f'\n{details}'
        _post_with_retry(
            f'{DISCORD_API}/channels/{self.thread_id}/messages',
            {'content': content[:2000]},
        )

    def post_final_summary(self, report: dict) -> None:
        if not self.thread_id:
            return
        start_rate = report.get('start_pass_rate', 0)
        end_rate = report.get('end_pass_rate', 0)
        found = report.get('issues_found', 0)
        fixed = report.get('issues_fixed', 0)
        escalated = report.get('issues_escalated', 0)
        deep = report.get('deep_results', '')
        open_issues = report.get('open_issues', [])
        specs_pass = report.get('specs_passing', 0)
        specs_total = report.get('specs_total', 0)

        pct = int(specs_pass / specs_total * 100) if specs_total else 0
        lines = [
            f'**FINAL OVERNIGHT SUMMARY** [{self._ts()} elapsed]',
            f'Pass rate: {start_rate:.0%} → {end_rate:.0%}',
            f'Specs: {specs_pass}/{specs_total} ({pct}%)',
            f'Issues found: {found} | Auto-fixed: {fixed} | Escalated: {escalated}',
        ]
        if deep:
            lines.append(f'Deep scenarios: {deep}')
        if open_issues:
            lines.append(f'Remaining open: {len(open_issues)} issue(s)')
            for issue in open_issues[:5]:
                lines.append(f'  - {issue}')
        _post_with_retry(
            f'{DISCORD_API}/channels/{self.thread_id}/messages',
            {'content': '\n'.join(lines)[:2000]},
        )
