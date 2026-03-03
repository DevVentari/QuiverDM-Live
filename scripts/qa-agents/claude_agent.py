"""
Runs one QA persona via terminal AI CLI (`codex` or `claude`).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from personas import Persona
from reporter import AgentResult

_STRIP_ENV_KEYS = {'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ACCESS_TOKEN'}
PROJECT_ROOT = Path(__file__).parent.parent.parent


def _resolve_agent_cli(requested: str | None = None) -> str:
    value = (requested or os.environ.get('QA_AGENT_CLI', 'auto')).strip().lower()
    if value == 'auto':
        return 'codex' if shutil.which('codex') else 'claude'
    if value in {'codex', 'claude'}:
        return value
    return 'codex'


def _build_claude_prompt(persona: Persona, scenario_task: str, screenshot_path: str) -> str:
    return f"""You are a QA tester for QuiverDM, a D&D session management web app.

PERSONA: {persona.name}
{persona.message_context}

YOUR TASK:
{scenario_task}

PLAYWRIGHT MCP TOOLS - use these to interact with the browser:
- browser_navigate(url) - go to a URL
- browser_snapshot() - read the accessibility tree (do this before clicking to get element refs)
- browser_click(ref, element) - click an element (get ref from snapshot)
- browser_type(ref, text) - type into a field
- browser_take_screenshot(type="png", filename="{screenshot_path}") - save a screenshot
- browser_console_messages(level="error") - get JS errors (call this on ANY failure)
- browser_network_requests(includeStatic=False) - get API calls (call this on ANY failure)

WORKFLOW:
1. Take a screenshot to see the current state
2. Use browser_snapshot before every click to get current element refs
3. On any failure: call browser_console_messages then browser_network_requests to investigate
4. Try alternative approaches before giving up
5. Take a final screenshot before reporting your outcome

At the very end of your response, output ONLY this JSON on its own line (no trailing text):
{{"outcome": "success", "findings": "describe what worked and what failed with root causes", "friction_points": 0, "urls_visited": ["url1", "url2"], "feedback_ids": ["fb-id-1"]}}
"""


def _build_codex_prompt(persona: Persona, scenario_task: str, screenshot_path: str) -> str:
    return f"""You are a QA tester for QuiverDM, running in a terminal agent environment.

PERSONA: {persona.name}
{persona.message_context}

TASK:
{scenario_task}

CONSTRAINTS:
- Do NOT modify product code.
- You may run commands/tests/scripts needed to validate behavior.
- Prefer running existing Playwright tests or lightweight one-off checks.
- Capture concrete evidence for failures (URL, error text, failing command output).
- If possible, save a screenshot to: {screenshot_path}

Return ONLY one JSON object as your final response:
{{
  "outcome": "success" | "partial" | "failed",
  "findings": "summary with root causes and evidence",
  "friction_points": 0,
  "urls_visited": ["url1", "url2"],
  "feedback_ids": []
}}
"""


def _extract_json_payload(text: str) -> dict[str, Any]:
    s = (text or '').strip()
    if not s:
        raise json.JSONDecodeError('empty', s, 0)

    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    for line in reversed(s.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue

    decoder = json.JSONDecoder()
    best: dict[str, Any] | None = None
    for i, ch in enumerate(s):
        if ch != '{':
            continue
        try:
            obj, end = decoder.raw_decode(s[i:])
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            tail = s[i + end :].strip()
            if not tail:
                return obj
            best = obj

    if best is not None:
        return best

    raise json.JSONDecodeError('no json object', s, 0)


def _run_claude(prompt: str, persona: Persona, timeout: int) -> tuple[subprocess.CompletedProcess[str] | None, float]:
    env = {k: v for k, v in os.environ.items() if k not in _STRIP_ENV_KEYS}
    real_home = Path.home()
    tmp_home = Path(tempfile.mkdtemp(prefix=f'qa-{persona.name.lower().replace(" ", "-")}-'))
    start = time.monotonic()
    try:
        src_json = real_home / '.claude.json'
        if src_json.exists():
            shutil.copy2(src_json, tmp_home / '.claude.json')
        src_dir = real_home / '.claude'
        if src_dir.exists():
            shutil.copytree(src_dir, tmp_home / '.claude', dirs_exist_ok=True)

        claude_json_path = tmp_home / '.claude.json'
        if claude_json_path.exists():
            try:
                config = json.loads(claude_json_path.read_text(encoding='utf-8'))
                pw = config.get('mcpServers', {}).get('playwright', {})
                if pw and pw.get('type') == 'stdio':
                    args = list(pw.get('args', []))
                    profile_dir = str(tmp_home / 'pw-profile')
                    if '--user-data-dir' not in args:
                        args.extend(['--user-data-dir', profile_dir])
                    pw['args'] = args
                    config['mcpServers']['playwright'] = pw
                    claude_json_path.write_text(json.dumps(config), encoding='utf-8')
            except Exception:
                pass

        env['HOME'] = str(tmp_home)
        env['USERPROFILE'] = str(tmp_home)
        env['CI'] = 'true'

        result = subprocess.run(
            ['claude', '-p', prompt, '--output-format', 'json', '--dangerously-skip-permissions'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            stdin=subprocess.DEVNULL,
            env=env,
            timeout=timeout,
        )
        duration = round(time.monotonic() - start, 1)
        return result, duration
    except subprocess.TimeoutExpired:
        return None, round(time.monotonic() - start, 1)
    finally:
        shutil.rmtree(tmp_home, ignore_errors=True)


def _run_codex(prompt: str, timeout: int, output_path: Path) -> tuple[subprocess.CompletedProcess[str] | None, float]:
    start = time.monotonic()
    codex_path = shutil.which('codex.cmd') or shutil.which('codex') or 'codex'
    schema_path = output_path.with_suffix('.schema.json')
    schema_path.write_text(json.dumps({
        'type': 'object',
        'properties': {
            'outcome': {'type': 'string', 'enum': ['success', 'partial', 'failed']},
            'findings': {'type': 'string'},
            'friction_points': {'type': 'integer', 'minimum': 0},
            'urls_visited': {'type': 'array', 'items': {'type': 'string'}},
            'feedback_ids': {'type': 'array', 'items': {'type': 'string'}},
        },
        'required': ['outcome', 'findings', 'friction_points', 'urls_visited', 'feedback_ids'],
        'additionalProperties': False,
    }), encoding='utf-8')

    base_args = [
        'exec',
        '--full-auto',
        '--skip-git-repo-check',
        '--cd',
        str(PROJECT_ROOT),
        '--output-schema',
        str(schema_path),
        '--output-last-message',
        str(output_path),
        '-',
    ]
    use_shell = False
    if sys.platform == 'win32':
        codex_cmd = shutil.which('codex.cmd') or codex_path
        cmd = [codex_cmd, *base_args]
        use_shell = True
    else:
        cmd = [codex_path, *base_args]
    try:
        run_args: Any = cmd
        if use_shell:
            run_args = subprocess.list2cmdline(cmd)
        result = subprocess.run(
            run_args,
            input=prompt,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=timeout,
            shell=use_shell,
        )
        duration = round(time.monotonic() - start, 1)
        return result, duration
    except subprocess.TimeoutExpired:
        return None, round(time.monotonic() - start, 1)


def run_claude_agent(
    persona: Persona,
    scenario_task: str,
    run_id: str,
    screenshot_dir: Path,
    agent_cli: str = 'auto',
) -> AgentResult:
    """Run one persona agent via selected terminal CLI backend."""
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    slug = persona.name.lower().replace(' ', '-')
    screenshot_path = str(screenshot_dir / f'{run_id}-{slug}.png')
    codex_last_message = screenshot_dir / f'{run_id}-{slug}-codex-last-message.txt'
    cli = _resolve_agent_cli(agent_cli)

    prompt = (
        _build_codex_prompt(persona, scenario_task, screenshot_path)
        if cli == 'codex'
        else _build_claude_prompt(persona, scenario_task, screenshot_path)
    )

    print(f'[qa_agent] Starting ({cli}): {persona.name}')

    try:
        if cli == 'codex':
            result, duration = _run_codex(prompt, timeout=1200, output_path=codex_last_message)
        else:
            result, duration = _run_claude(prompt, persona, timeout=1200)
    except Exception as e:
        return AgentResult(
            persona=persona.name,
            scenario=persona.scenario,
            outcome='failed',
            friction_points=0,
            feedback_ids=[],
            error=f'{cli} launcher error: {e}',
            duration_seconds=0,
        )

    if result is None:
        return AgentResult(
            persona=persona.name,
            scenario=persona.scenario,
            outcome='failed',
            friction_points=0,
            feedback_ids=[],
            error=f'{cli} timeout after 1200s',
            duration_seconds=duration,
        )

    raw_text = ''
    if cli == 'claude':
        raw_text = result.stdout or ''
    else:
        if codex_last_message.exists():
            raw_text = codex_last_message.read_text(encoding='utf-8', errors='replace')
        if not raw_text:
            raw_text = result.stdout or ''

    if result.returncode != 0 or not raw_text.strip():
        err_tail = (result.stderr or '').strip()
        if not err_tail:
            err_tail = (raw_text or '').strip()
        tail = err_tail[-600:] if len(err_tail) > 600 else err_tail
        error_msg = f'{cli} exit {result.returncode}: {tail}'
        print(f'[qa_agent] Error ({cli}): {persona.name} - {error_msg}')
        return AgentResult(
            persona=persona.name,
            scenario=persona.scenario,
            outcome='failed',
            friction_points=0,
            feedback_ids=[],
            error=error_msg,
            duration_seconds=duration,
        )

    parsed: dict[str, Any]
    try:
        if cli == 'claude':
            outer = json.loads(raw_text)
            parsed = _extract_json_payload(str(outer.get('result', '')))
        else:
            parsed = _extract_json_payload(raw_text)
    except Exception as e:
        parsed = {
            'outcome': 'failed',
            'findings': f'JSON parse error: {e}. Raw tail: {raw_text[-300:]}',
            'friction_points': 0,
            'urls_visited': [],
            'feedback_ids': [],
        }

    outcome = parsed.get('outcome', 'failed')
    if outcome not in ('success', 'partial', 'failed'):
        outcome = 'failed'

    print(f'[qa_agent] Done ({cli}): {persona.name} - {outcome} in {duration}s')
    return AgentResult(
        persona=persona.name,
        scenario=persona.scenario,
        outcome=outcome,
        friction_points=int(parsed.get('friction_points', 0) or 0),
        feedback_ids=parsed.get('feedback_ids', []) or [],
        error=None,
        duration_seconds=duration,
        findings=parsed.get('findings', '') or '',
        urls_visited=parsed.get('urls_visited', []) or [],
        screenshot_path=screenshot_path if Path(screenshot_path).exists() else None,
    )
