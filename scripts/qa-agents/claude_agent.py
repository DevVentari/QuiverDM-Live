"""
Runs one QA persona as a `claude -p` subprocess with Playwright MCP access.
The agent navigates the app, investigates failures, and returns structured JSON.
"""
import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from personas import Persona
from reporter import AgentResult

_STRIP_ENV_KEYS = {'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ACCESS_TOKEN', 'ANTHROPIC_API_KEY'}


def build_agent_prompt(persona: Persona, scenario_task: str, screenshot_path: str) -> str:
    return f"""You are a QA tester for QuiverDM, a D&D session management web app.

PERSONA: {persona.name}
{persona.message_context}

YOUR TASK:
{scenario_task}

PLAYWRIGHT MCP TOOLS — use these to interact with the browser:
- browser_navigate(url) — go to a URL
- browser_snapshot() — read the accessibility tree (do this before clicking to get element refs)
- browser_click(ref, element) — click an element (get ref from snapshot)
- browser_type(ref, text) — type into a field
- browser_take_screenshot(type="png", filename="{screenshot_path}") — save a screenshot
- browser_console_messages(level="error") — get JS errors (call this on ANY failure)
- browser_network_requests(includeStatic=False) — get API calls (call this on ANY failure)

WORKFLOW:
1. Take a screenshot to see the current state
2. Use browser_snapshot before every click to get current element refs
3. On any failure: call browser_console_messages then browser_network_requests to investigate
4. Try alternative approaches before giving up
5. Take a final screenshot before reporting your outcome

At the very end of your response, output ONLY this JSON on its own line (no trailing text):
{{"outcome": "success", "findings": "describe what worked and what failed with root causes", "friction_points": 0, "urls_visited": ["url1", "url2"], "feedback_ids": ["fb-id-1"]}}

Where outcome is one of: "success" | "partial" | "failed"
Where friction_points is count of UX issues or bugs found
Where feedback_ids are IDs returned by the in-app feedback overlay if you submitted any bug reports (empty array if none)
"""


def run_claude_agent(
    persona: Persona,
    scenario_task: str,
    run_id: str,
    screenshot_dir: Path,
) -> AgentResult:
    """Spawn `claude -p` for one persona. Returns enriched AgentResult."""
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    screenshot_path = str(screenshot_dir / f'{run_id}-{persona.name.lower().replace(" ", "-")}.png')
    prompt = build_agent_prompt(persona, scenario_task, screenshot_path)

    env = {k: v for k, v in os.environ.items() if k not in _STRIP_ENV_KEYS}

    # Isolate ~/.claude.json per agent so concurrent processes don't corrupt each other
    real_home = Path.home()
    tmp_home = Path(tempfile.mkdtemp(prefix=f'qa-{persona.name.lower().replace(" ", "-")}-'))
    try:
        src_json = real_home / '.claude.json'
        if src_json.exists():
            shutil.copy2(src_json, tmp_home / '.claude.json')
        src_dir = real_home / '.claude'
        if src_dir.exists():
            shutil.copytree(src_dir, tmp_home / '.claude', dirs_exist_ok=True)
        env['HOME'] = str(tmp_home)
        env['USERPROFILE'] = str(tmp_home)

        print(f'[claude_agent] Starting: {persona.name}')
        start = time.monotonic()

        try:
            result = subprocess.run(
                ['claude', '-p', prompt, '--output-format', 'json'],
                capture_output=True,
                text=True,
                stdin=subprocess.DEVNULL,
                env=env,
                timeout=600,
            )
        except subprocess.TimeoutExpired:
            duration = round(time.monotonic() - start, 1)
            return AgentResult(
                persona=persona.name, scenario=persona.scenario, outcome='failed',
                friction_points=0, feedback_ids=[], error='Timeout after 600s',
                duration_seconds=duration,
            )
    finally:
        shutil.rmtree(tmp_home, ignore_errors=True)

    duration = round(time.monotonic() - start, 1)

    if result.returncode != 0 or not result.stdout.strip():
        error_msg = f'claude exit {result.returncode}: {result.stderr[:200]}'
        print(f'[claude_agent] Error: {persona.name} — {error_msg}')
        return AgentResult(
            persona=persona.name, scenario=persona.scenario, outcome='failed',
            friction_points=0, feedback_ids=[], error=error_msg,
            duration_seconds=duration,
        )

    try:
        outer = json.loads(result.stdout)
        inner_raw = outer.get('result', '')
        last_line = inner_raw.strip().split('\n')[-1]
        inner = json.loads(last_line)
    except json.JSONDecodeError as e:
        inner = {
            'outcome': 'failed',
            'findings': f'JSON parse error: {e}. Raw tail: {result.stdout[-300:]}',
            'friction_points': 0,
            'urls_visited': [],
        }

    outcome = inner.get('outcome', 'failed')
    if outcome not in ('success', 'partial', 'failed'):
        outcome = 'failed'

    print(f'[claude_agent] Done: {persona.name} — {outcome} in {duration}s')
    return AgentResult(
        persona=persona.name,
        scenario=persona.scenario,
        outcome=outcome,
        friction_points=inner.get('friction_points', 0),
        feedback_ids=inner.get('feedback_ids', []),
        error=None,
        duration_seconds=duration,
        findings=inner.get('findings', ''),
        urls_visited=inner.get('urls_visited', []),
        screenshot_path=screenshot_path if Path(screenshot_path).exists() else None,
    )
