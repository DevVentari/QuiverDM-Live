"""
One-time setup: creates the #qa-agent-runs forum channel in the QuiverDM Discord server.
Run once, then add QA_DISCORD_FORUM_CHANNEL_ID to .env.

Usage:
  uv run python setup_discord.py
"""
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / '.env')

DISCORD_API = 'https://discord.com/api/v10'
TOKEN = os.environ['QUIVERDM_DISCORD_BOT_TOKEN']
GUILD_ID = os.environ['QA_DISCORD_GUILD_ID']


def get_or_create_forum_channel(name: str = 'qa-agent-runs') -> str:
    headers = {'Authorization': f'Bot {TOKEN}', 'User-Agent': 'QuiverDM-QA/1.0'}

    r = httpx.get(f'{DISCORD_API}/guilds/{GUILD_ID}/channels', headers=headers, timeout=10)
    r.raise_for_status()
    for ch in r.json():
        if ch.get('name') == name and ch.get('type') == 15:
            print(f'Channel already exists: {ch["id"]}')
            return ch['id']

    r = httpx.post(
        f'{DISCORD_API}/guilds/{GUILD_ID}/channels',
        headers=headers,
        json={'name': name, 'type': 15, 'topic': 'Automated QA agent run results'},
        timeout=10,
    )
    r.raise_for_status()
    channel_id = r.json()['id']
    print(f'Forum channel created: {channel_id}')
    return channel_id


if __name__ == '__main__':
    channel_id = get_or_create_forum_channel()
    print(f'\nAdd to .env.local:\nQA_DISCORD_FORUM_CHANNEL_ID={channel_id}')
