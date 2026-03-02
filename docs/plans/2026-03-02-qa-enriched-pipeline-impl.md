# QA Enriched Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace browser-use with Claude subagents (using Playwright MCP), add Playwright smoke gate, and enrich QA output with screenshots, Discord forum threads, and GitHub issues.

**Architecture:** A Python orchestrator (`run.py`) first runs a Playwright smoke gate; on pass it spawns one `claude -p` subprocess per persona (in parallel via ThreadPoolExecutor), each using Playwright MCP tools to navigate the app and investigate failures deeply. Results feed into an enriched reporter that posts a Discord forum thread and creates GitHub issues for failures.

**Tech Stack:** Python 3.11 + httpx (Discord REST), subprocess (claude CLI + gh CLI + npx playwright), Playwright TypeScript (smoke spec), Claude CLI (`--output-format json`)

---

## Context

**Key files:**
- `scripts/qa-agents/run.py` — orchestrator (modify)
- `scripts/qa-agents/reporter.py` — JSON writer (modify)
- `scripts/qa-agents/personas.py` — persona definitions (read-only)
- `scripts/qa-agents/scenarios/` — TASK strings (read-only)
- `scripts/qa-agents/pyproject.toml` — deps (modify)
- `tests/helpers/auth.ts` — Playwright auth helper (read-only)
- `playwright.config.ts` — base URL config (read-only)

**Key env vars** (all in `.env.local` unless noted):
- `QA_DANA_EMAIL`, `QA_VIC_EMAIL`, `QA_NORA_EMAIL`, `QA_TEST_PASSWORD`
- `QA_APP_URL` (default: `http://localhost:3847`)
- `QUIVERDM_DISCORD_BOT_TOKEN` — **in `~/.claude/credentials.env`**, must be copied to `.env.local`
- `QA_DISCORD_FORUM_CHANNEL_ID` — added after Task 6
- GitHub: `gh` CLI already authenticated as `DevVentari` on `DevVentari/QuiverDM-Live`

**Vic's seeded campaign:** slug = `vics-test-campaign` (used in smoke tests)

---

## Task 1: Playwright smoke spec

**Files:**
- Create: `tests/smoke.spec.ts`

This spec covers the 5 critical paths that browser-use agents depend on. It uses `QA_DANA_EMAIL` / `QA_VIC_EMAIL` / `QA_TEST_PASSWORD` from env.

**Step 1: Create `tests/smoke.spec.ts`**

```typescript
import { test, expect, Page } from '@playwright/test';

const APP_URL = process.env.QA_APP_URL ?? 'http://localhost:3847';
const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

async function signInAs(page: Page, email: string, password: string) {
  await page.goto(`${APP_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|campaigns/, { timeout: 15_000 });
}

test('sign-in redirects to dashboard', async ({ page }) => {
  await signInAs(page, DANA_EMAIL, PASSWORD);
  await expect(page).toHaveURL(/dashboard/);
});

test('dashboard renders campaign section', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await expect(page.getByText(/campaign/i).first()).toBeVisible({ timeout: 10_000 });
});

test('campaign detail page loads', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await page.goto(`${APP_URL}/campaigns/vics-test-campaign`);
  await expect(page).toHaveURL(/vics-test-campaign/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
});

test('campaign NPC section is accessible', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await page.goto(`${APP_URL}/campaigns/vics-test-campaign/npcs`);
  await expect(page).toHaveURL(/npcs/);
  // Page renders (no crash)
  await expect(page.locator('body')).not.toContainText('500');
});

test('homebrew page loads', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await page.goto(`${APP_URL}/campaigns/vics-test-campaign/homebrew`);
  await expect(page).toHaveURL(/homebrew/);
  await expect(page.locator('body')).not.toContainText('500');
});
```

**Step 2: Run smoke spec to verify it works**

```bash
cd /e/Projects/QuiverDM
QA_DANA_EMAIL=dana@test.local QA_VIC_EMAIL=vic@test.local QA_TEST_PASSWORD=<password> \
  npx playwright test tests/smoke.spec.ts --reporter=list
```

Expected: 5/5 passing. If any fail, fix the app first before continuing.

**Step 3: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "test(smoke): add 5 critical path smoke tests for QA gate"
```

---

## Task 2: Smoke gate Python runner

**Files:**
- Create: `scripts/qa-agents/smoke_gate.py`
- Create: `scripts/qa-agents/tests/test_smoke_gate.py`

**Step 1: Write failing test**

```python
# scripts/qa-agents/tests/test_smoke_gate.py
from unittest.mock import patch, MagicMock
from smoke_gate import run_smoke_gate, SmokeResult


def test_smoke_gate_all_pass():
    mock_output = '{"stats":{"expected":5,"unexpected":0,"flaky":0,"skipped":0},"suites":[],"errors":[]}'
    with patch('smoke_gate.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=mock_output, stderr='')
        result = run_smoke_gate()
    assert result.passed == 5
    assert result.failed == 0
    assert result.failures == []


def test_smoke_gate_one_fail():
    mock_output = '''{
      "stats":{"expected":5,"unexpected":1,"flaky":0,"skipped":0},
      "suites":[{"specs":[{"ok":false,"title":"sign-in test","tests":[{"results":[{"status":"failed","error":{"message":"Timeout"}}]}]}]}],
      "errors":[]
    }'''
    with patch('smoke_gate.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout=mock_output, stderr='')
        result = run_smoke_gate()
    assert result.passed == 4
    assert result.failed == 1
    assert 'sign-in test' in result.failures[0]['title']
```

**Step 2: Run test to verify it fails**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run pytest tests/test_smoke_gate.py -v
```

Expected: `ModuleNotFoundError: No module named 'smoke_gate'`

**Step 3: Implement `smoke_gate.py`**

```python
# scripts/qa-agents/smoke_gate.py
import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent


@dataclass
class SmokeResult:
    passed: int
    failed: int
    failures: list[dict] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.failed == 0


def run_smoke_gate(env_override: dict | None = None) -> SmokeResult:
    """Run tests/smoke.spec.ts via npx playwright. Returns structured result."""
    env = {**os.environ, **(env_override or {})}
    result = subprocess.run(
        ['npx', 'playwright', 'test', 'tests/smoke.spec.ts', '--reporter=json'],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=env,
    )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        # Playwright sometimes writes non-JSON to stdout on crash
        return SmokeResult(passed=0, failed=1, failures=[{'title': 'playwright-crash', 'error': result.stderr[:500]}])

    stats = data.get('stats', {})
    passed = stats.get('expected', 0) - stats.get('unexpected', 0)
    failed = stats.get('unexpected', 0)

    failures = []
    for suite in data.get('suites', []):
        for spec in suite.get('specs', []):
            if not spec.get('ok', True):
                error_msg = ''
                for test in spec.get('tests', []):
                    for r in test.get('results', []):
                        if r.get('status') == 'failed':
                            error_msg = (r.get('error') or {}).get('message', '')[:300]
                failures.append({'title': spec.get('title', ''), 'error': error_msg})

    return SmokeResult(passed=max(passed, 0), failed=failed, failures=failures)
```

**Step 4: Run tests to verify they pass**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run pytest tests/test_smoke_gate.py -v
```

Expected: 2/2 PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/smoke_gate.py scripts/qa-agents/tests/test_smoke_gate.py
git commit -m "feat(qa): add Playwright smoke gate runner"
```

---

## Task 3: Enriched AgentResult dataclass

**Files:**
- Modify: `scripts/qa-agents/reporter.py`
- Modify: `scripts/qa-agents/tests/test_reporter.py` (or create if not exists)

**Step 1: Write failing test**

```python
# scripts/qa-agents/tests/test_reporter.py
import json
from pathlib import Path
import tempfile
from reporter import AgentResult, write_report


def test_agent_result_includes_new_fields():
    r = AgentResult(
        persona='Nora',
        scenario='create_campaign',
        outcome='failed',
        friction_points=1,
        feedback_ids=[],
        error=None,
        duration_seconds=12.3,
        findings='Button click had no effect. Console showed TypeError.',
        urls_visited=['http://localhost:3847/auth/signin', 'http://localhost:3847/onboarding'],
        screenshot_path='/tmp/run-nora.png',
    )
    assert r.findings == 'Button click had no effect. Console showed TypeError.'
    assert len(r.urls_visited) == 2
    assert r.screenshot_path == '/tmp/run-nora.png'


def test_write_report_includes_new_fields():
    r = AgentResult(
        persona='Dana', scenario='upload_pdf', outcome='success',
        friction_points=0, feedback_ids=[], error=None, duration_seconds=50.0,
        findings='All steps completed.', urls_visited=['http://localhost:3847/dashboard'],
        screenshot_path=None,
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        path = write_report([r], reports_dir=Path(tmpdir))
        data = json.loads(path.read_text())
    assert data['agents'][0]['findings'] == 'All steps completed.'
    assert data['agents'][0]['urls_visited'] == ['http://localhost:3847/dashboard']
```

**Step 2: Run test to verify it fails**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run pytest tests/test_reporter.py -v
```

Expected: `TypeError: AgentResult.__init__() got unexpected keyword argument 'findings'`

**Step 3: Update `reporter.py`**

```python
# scripts/qa-agents/reporter.py
import json
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class AgentResult:
    persona: str
    scenario: str
    outcome: str
    friction_points: int
    feedback_ids: list[str]
    error: Optional[str]
    duration_seconds: float
    findings: str = ''
    urls_visited: list[str] = field(default_factory=list)
    screenshot_path: Optional[str] = None


def write_report(
    results: list[AgentResult],
    reports_dir: Path | None = None,
) -> Path:
    if reports_dir is None:
        reports_dir = Path(__file__).parent / 'reports'
    reports_dir.mkdir(parents=True, exist_ok=True)

    run_id = datetime.now().strftime('%Y-%m-%dT%H%M')
    total_duration = sum(r.duration_seconds for r in results)

    payload = {
        'run_id': run_id,
        'duration_seconds': round(total_duration, 1),
        'agents': [asdict(r) for r in results],
    }

    timestamped = reports_dir / f'{run_id}.json'
    timestamped.write_text(json.dumps(payload, indent=2))

    latest = reports_dir / 'latest.json'
    latest.write_text(json.dumps(payload, indent=2))

    return timestamped
```

**Step 4: Run tests**

```bash
uv run pytest tests/test_reporter.py -v
```

Expected: 2/2 PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/reporter.py scripts/qa-agents/tests/test_reporter.py
git commit -m "feat(qa): enrich AgentResult with findings, urls_visited, screenshot_path"
```

---

## Task 4: Claude agent runner

**Files:**
- Create: `scripts/qa-agents/claude_agent.py`
- Create: `scripts/qa-agents/tests/test_claude_agent.py`

Each persona runs as a `claude -p` subprocess with full Playwright MCP access. The agent navigates the app, investigates failures, and returns structured JSON.

**Step 1: Write failing test**

```python
# scripts/qa-agents/tests/test_claude_agent.py
import json
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
from personas import PERSONAS
from claude_agent import run_claude_agent, build_agent_prompt


def test_build_agent_prompt_contains_key_parts():
    persona = PERSONAS[0]  # Nora
    task = 'Go to http://localhost:3847 and create a campaign'
    screenshot_path = '/tmp/run-nora.png'
    prompt = build_agent_prompt(persona, task, screenshot_path)
    assert 'browser_navigate' in prompt
    assert 'browser_snapshot' in prompt
    assert screenshot_path in prompt
    assert '"outcome"' in prompt


def test_run_claude_agent_success():
    inner = json.dumps({'outcome': 'success', 'findings': 'Campaign created.', 'friction_points': 0, 'urls_visited': ['http://localhost:3847/dashboard']})
    outer = json.dumps({'result': inner})
    with patch('claude_agent.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=outer, stderr='')
        with tempfile.TemporaryDirectory() as tmpdir:
            result = run_claude_agent(PERSONAS[0], 'test task', 'run123', Path(tmpdir))
    assert result.outcome == 'success'
    assert result.findings == 'Campaign created.'


def test_run_claude_agent_subprocess_error():
    with patch('claude_agent.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout='', stderr='claude: command not found')
        with tempfile.TemporaryDirectory() as tmpdir:
            result = run_claude_agent(PERSONAS[0], 'test task', 'run123', Path(tmpdir))
    assert result.outcome == 'failed'
    assert 'claude' in result.error.lower()
```

**Step 2: Run tests to verify they fail**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run pytest tests/test_claude_agent.py -v
```

Expected: `ModuleNotFoundError: No module named 'claude_agent'`

**Step 3: Implement `claude_agent.py`**

```python
# scripts/qa-agents/claude_agent.py
"""
Runs one QA persona as a `claude -p` subprocess with Playwright MCP.
Claude navigates the app, investigates failures, and returns structured JSON.
"""
import json
import os
import subprocess
import time
from pathlib import Path

from personas import Persona
from reporter import AgentResult

# Strip Claude Code session vars so `claude -p` doesn't inherit an active session
_STRIP_ENV_KEYS = {'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ACCESS_TOKEN'}


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
1. Start by taking a screenshot to see the current state
2. Use browser_snapshot before every click to get current element refs
3. On any failure or unexpected state: call browser_console_messages then browser_network_requests
4. Try alternative approaches before giving up
5. Take a final screenshot before reporting your outcome

At the very end of your response, output ONLY this JSON on its own line (no trailing text):
{{"outcome": "success", "findings": "describe what worked and what failed with root causes", "friction_points": 0, "urls_visited": ["url1", "url2"]}}

Where outcome is one of: "success" | "partial" | "failed"
Where friction_points is count of UX issues or bugs you found
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

    print(f'[claude_agent] Starting: {persona.name}')
    start = time.monotonic()

    result = subprocess.run(
        ['claude', '-p', prompt, '--output-format', 'json'],
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        env=env,
        timeout=600,  # 10 min hard limit
    )

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
        # The agent's JSON is the last line of its response
        last_line = inner_raw.strip().split('\n')[-1]
        inner = json.loads(last_line)
    except (json.JSONDecodeError, KeyError) as e:
        # Fall back: scan for any JSON object in the output
        inner = {'outcome': 'failed', 'findings': f'Parse error: {e}. Raw: {result.stdout[:300]}', 'friction_points': 0, 'urls_visited': []}

    outcome = inner.get('outcome', 'failed')
    if outcome not in ('success', 'partial', 'failed'):
        outcome = 'failed'

    print(f'[claude_agent] Done: {persona.name} — {outcome} in {duration}s')
    return AgentResult(
        persona=persona.name,
        scenario=persona.scenario,
        outcome=outcome,
        friction_points=inner.get('friction_points', 0),
        feedback_ids=[],
        error=None,
        duration_seconds=duration,
        findings=inner.get('findings', ''),
        urls_visited=inner.get('urls_visited', []),
        screenshot_path=screenshot_path if Path(screenshot_path).exists() else None,
    )
```

**Step 4: Run tests**

```bash
uv run pytest tests/test_claude_agent.py -v
```

Expected: 3/3 PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/claude_agent.py scripts/qa-agents/tests/test_claude_agent.py
git commit -m "feat(qa): Claude agent runner — replaces browser-use with claude -p + Playwright MCP"
```

---

## Task 5: Discord notifier

**Files:**
- Create: `scripts/qa-agents/notifier.py`
- Create: `scripts/qa-agents/tests/test_notifier.py`

Uses the QuiverDM Discord bot to post one forum thread per run and creates GitHub issues for failures via `gh` CLI.

**Step 1: Write failing tests**

```python
# scripts/qa-agents/tests/test_notifier.py
from unittest.mock import patch, MagicMock, call
from reporter import AgentResult
from notifier import build_run_summary, build_failure_detail, check_issue_exists


def _make_result(outcome, persona='Dana', findings='ok', screenshot_path=None):
    return AgentResult(
        persona=persona, scenario='upload_pdf', outcome=outcome,
        friction_points=0, feedback_ids=[], error=None, duration_seconds=55.0,
        findings=findings, urls_visited=[], screenshot_path=screenshot_path,
    )


def test_build_run_summary_all_pass():
    results = [_make_result('success', 'Dana'), _make_result('success', 'Vic')]
    summary = build_run_summary('2026-03-02T1038', results, smoke_passed=True)
    assert '2/2' in summary or 'passed' in summary.lower()
    assert '🟢' in summary


def test_build_run_summary_with_failure():
    results = [_make_result('success', 'Dana'), _make_result('failed', 'Nora')]
    summary = build_run_summary('2026-03-02T1038', results, smoke_passed=True)
    assert '🔴' in summary
    assert 'Nora' in summary


def test_build_failure_detail_includes_findings():
    result = _make_result('failed', findings='TypeError in campaign.ts:47')
    detail = build_failure_detail(result)
    assert 'TypeError in campaign.ts:47' in detail


def test_check_issue_exists_true():
    with patch('notifier.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout='[QA] Nora — create_campaign failed\t1\tOPEN')
        assert check_issue_exists('[QA] Nora — create_campaign failed') is True


def test_check_issue_exists_false():
    with patch('notifier.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout='')
        assert check_issue_exists('[QA] Nora — create_campaign failed') is False
```

**Step 2: Run to verify they fail**

```bash
uv run pytest tests/test_notifier.py -v
```

Expected: `ModuleNotFoundError: No module named 'notifier'`

**Step 3: Implement `notifier.py`**

```python
# scripts/qa-agents/notifier.py
"""
Posts QA run results to Discord (forum thread) and creates GitHub issues for failures.

Requires env vars:
- QUIVERDM_DISCORD_BOT_TOKEN
- QA_DISCORD_FORUM_CHANNEL_ID
"""
import json
import os
import subprocess
from pathlib import Path

import httpx

from reporter import AgentResult

DISCORD_API = 'https://discord.com/api/v10'
GITHUB_REPO = 'DevVentari/QuiverDM-Live'
QA_LABEL = 'qa-failure'

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
        f'**Findings:** {result.findings or "No details captured"}',
    ]
    if result.urls_visited:
        lines += ['', '**URLs visited:**'] + [f'- {u}' for u in result.urls_visited[:10]]
    if result.error:
        lines += ['', f'**Error:** `{result.error}`']
    return '\n'.join(lines)


def _bot_headers(token: str) -> dict:
    return {'Authorization': f'Bot {token}', 'User-Agent': 'QuiverDM-QA/1.0'}


def post_run(report: dict, screenshot_dir: Path | None = None) -> None:
    """Post run summary to Discord forum thread and create GitHub issues for failures."""
    token = os.environ.get('QUIVERDM_DISCORD_BOT_TOKEN', '')
    channel_id = os.environ.get('QA_DISCORD_FORUM_CHANNEL_ID', '')

    run_id = report['run_id']
    results = [AgentResult(**a) for a in report['agents']]
    smoke_passed = report.get('smoke_passed', True)

    passed = sum(1 for r in results if r.outcome == 'success')
    total = len(results)
    thread_title = f'{run_id} — {passed}/{total} passed'

    summary = build_run_summary(run_id, results, smoke_passed)

    # Post Discord forum thread
    thread_id = None
    if token and channel_id:
        thread_id = _post_discord_thread(token, channel_id, thread_title, summary)
        if thread_id:
            # Post failure details with screenshots
            for r in results:
                if r.outcome != 'success':
                    _post_failure_to_thread(token, thread_id, r, screenshot_dir)
    else:
        print('[notifier] Discord env vars missing — skipping Discord post')

    # Create GitHub issues for failures
    for r in results:
        if r.outcome == 'failed':
            _create_github_issue(r, run_id)


def _post_discord_thread(token: str, channel_id: str, title: str, content: str) -> str | None:
    """Create a forum thread. Returns thread_id or None on error."""
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
    """Post failure detail + screenshot attachment to an existing thread."""
    content = build_failure_detail(result)
    screenshot_path = result.screenshot_path and Path(result.screenshot_path)
    has_screenshot = screenshot_path and screenshot_path.exists()

    try:
        if has_screenshot:
            with open(screenshot_path, 'rb') as f:
                files = {'files[0]': (screenshot_path.name, f, 'image/png')}
                data = {
                    'payload_json': json.dumps({'content': content[:2000]}),
                }
                r = httpx.post(
                    f'{DISCORD_API}/channels/{thread_id}/messages',
                    headers=_bot_headers(token),
                    data=data,
                    files=files,
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
        ['gh', 'issue', 'list', '--repo', GITHUB_REPO, '--state', 'open',
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
    """Create qa-failure label if it doesn't exist."""
    subprocess.run(
        ['gh', 'label', 'create', QA_LABEL, '--repo', GITHUB_REPO,
         '--color', 'e11d48', '--description', 'Automated QA agent failure', '--force'],
        capture_output=True, stdin=subprocess.DEVNULL,
    )


def _create_github_issue(result: AgentResult, run_id: str) -> None:
    title = f'[QA] {result.persona} — {result.scenario} failed'
    if check_issue_exists(title):
        print(f'[notifier] Issue already open: {title}')
        return

    _ensure_qa_label()
    body_lines = [
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
            ['gh', 'issue', 'create', '--repo', GITHUB_REPO,
             '--title', title, '--body', body,
             '--label', 'bug', '--label', QA_LABEL],
            capture_output=True, text=True, stdin=subprocess.DEVNULL,
        )
        if r.returncode == 0:
            print(f'[notifier] GitHub issue created: {r.stdout.strip()}')
        else:
            print(f'[notifier] GitHub issue failed: {r.stderr[:200]}')
    except Exception as e:
        print(f'[notifier] GitHub issue error: {e}')
```

**Step 4: Run tests**

```bash
uv run pytest tests/test_notifier.py -v
```

Expected: 5/5 PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/notifier.py scripts/qa-agents/tests/test_notifier.py
git commit -m "feat(qa): Discord forum notifier + GitHub issue creator"
```

---

## Task 6: Discord forum channel setup

**Files:**
- Create: `scripts/qa-agents/setup_discord.py`

One-time script to create the `#qa-agent-runs` forum channel and print its ID.

**Step 1: Create `setup_discord.py`**

```python
# scripts/qa-agents/setup_discord.py
"""
One-time setup: creates the #qa-agent-runs forum channel in the QuiverDM Discord server.
Run once, then add QA_DISCORD_FORUM_CHANNEL_ID to .env.local.

Usage:
  uv run python setup_discord.py
"""
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / '.env.local')

DISCORD_API = 'https://discord.com/api/v10'
TOKEN = os.environ['QUIVERDM_DISCORD_BOT_TOKEN']
GUILD_ID = os.environ['QA_DISCORD_GUILD_ID']


def get_or_create_forum_channel(name: str = 'qa-agent-runs') -> str:
    headers = {'Authorization': f'Bot {TOKEN}', 'User-Agent': 'QuiverDM-QA/1.0'}

    # Check if channel already exists
    r = httpx.get(f'{DISCORD_API}/guilds/{GUILD_ID}/channels', headers=headers, timeout=10)
    r.raise_for_status()
    channels = r.json()
    for ch in channels:
        if ch.get('name') == name and ch.get('type') == 15:
            print(f'Channel already exists: {ch["id"]}')
            return ch['id']

    # Create forum channel (type 15 = GUILD_FORUM)
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
```

**Step 2: Add required env vars to `.env.local`**

```bash
# Add these to .env.local (get values from credentials.env and Discord server settings):
# QUIVERDM_DISCORD_BOT_TOKEN=<from credentials.env>
# QA_DISCORD_GUILD_ID=<your Discord server ID — right-click server → Copy Server ID>
```

To get the Discord server ID: enable Developer Mode in Discord → right-click the server name → Copy Server ID.

**Step 3: Run the setup script**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run python setup_discord.py
```

Expected output:
```
Forum channel created: 1234567890123456789
Add to .env.local:
QA_DISCORD_FORUM_CHANNEL_ID=1234567890123456789
```

**Step 4: Add `QA_DISCORD_FORUM_CHANNEL_ID` to `.env.local`**

**Step 5: Commit**

```bash
git add scripts/qa-agents/setup_discord.py
git commit -m "feat(qa): Discord forum setup script for #qa-agent-runs channel"
```

---

## Task 7: Update run.py orchestrator

**Files:**
- Modify: `scripts/qa-agents/run.py`

Replace browser-use with the new gate → Claude agents → notify pipeline.

**Step 1: Read current `run.py` first** (already read above)

**Step 2: Replace `run.py` entirely**

```python
"""
QA Agent Orchestrator
Pipeline: Playwright smoke gate → Claude subagents (one per persona) → report → notify.

Usage:
  uv run python run.py
"""
import asyncio
import importlib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(env_path)

from claude_agent import run_claude_agent
from notifier import post_run
from personas import PERSONAS
from reporter import AgentResult, write_report
from smoke_gate import run_smoke_gate


def _load_task(persona) -> str:
    scenario_mod = importlib.import_module(f'scenarios.{persona.scenario}')
    return scenario_mod.TASK.format(
        app_url=os.environ.get('QA_APP_URL', 'http://localhost:3847'),
        email=os.environ[persona.email_env],
        password=os.environ['QA_TEST_PASSWORD'],
    )


def main():
    run_id = datetime.now().strftime('%Y-%m-%dT%H%M')
    reports_dir = Path(__file__).parent / 'reports'
    screenshot_dir = reports_dir / 'screenshots'

    # ── Stage 1: Playwright smoke gate ──────────────────────────────────────
    print('[run] Stage 1: Playwright smoke gate')
    smoke = run_smoke_gate(env_override={
        'QA_DANA_EMAIL': os.environ.get('QA_DANA_EMAIL', 'dana@test.local'),
        'QA_VIC_EMAIL': os.environ.get('QA_VIC_EMAIL', 'vic@test.local'),
        'QA_TEST_PASSWORD': os.environ.get('QA_TEST_PASSWORD', ''),
        'QA_APP_URL': os.environ.get('QA_APP_URL', 'http://localhost:3847'),
    })

    print(f'[run] Smoke: {smoke.passed} passed, {smoke.failed} failed')

    if not smoke.ok:
        print('[run] Smoke gate failed — skipping agents, posting alert')
        failure_summary = '\n'.join(f'  - {f["title"]}: {f["error"]}' for f in smoke.failures)
        smoke_report = {
            'run_id': run_id,
            'duration_seconds': 0,
            'smoke_passed': False,
            'smoke_failures': smoke.failures,
            'agents': [],
        }
        _write_and_notify(smoke_report, screenshot_dir, reports_dir)
        return

    # ── Stage 2: Claude agents (parallel) ───────────────────────────────────
    print('[run] Stage 2: Claude persona agents')
    tasks = [(persona, _load_task(persona)) for persona in PERSONAS]

    def run_one(args):
        persona, task = args
        return run_claude_agent(persona, task, run_id, screenshot_dir)

    with ThreadPoolExecutor(max_workers=len(PERSONAS)) as pool:
        results: list[AgentResult] = list(pool.map(run_one, tasks))

    # ── Stage 3: Report + notify ─────────────────────────────────────────────
    report_data = {
        'run_id': run_id,
        'duration_seconds': round(sum(r.duration_seconds for r in results), 1),
        'smoke_passed': True,
        'agents': [],
    }
    report_path = write_report(results, reports_dir)
    # Reload to get full dict (write_report returns timestamped path)
    import json
    report_data = json.loads(report_path.read_text())
    report_data['smoke_passed'] = True

    print(f'[run] Report written to {report_path}')
    _write_and_notify(report_data, screenshot_dir, reports_dir)


def _write_and_notify(report: dict, screenshot_dir: Path, reports_dir: Path) -> None:
    try:
        post_run(report, screenshot_dir)
    except Exception as e:
        print(f'[run] Notify failed: {e}')


if __name__ == '__main__':
    main()
```

**Step 3: Update `pyproject.toml` — remove browser-use**

```toml
[project]
name = "qa-agents"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "playwright>=1.50.0",
    "python-dotenv>=1.0.0",
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Step 4: Run the full test suite**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run pytest -q
```

Expected: all tests pass

**Step 5: Do a dry run (verify imports work before live test)**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run python -c "from run import main; print('imports OK')"
```

Expected: `imports OK`

**Step 6: Commit**

```bash
git add scripts/qa-agents/run.py scripts/qa-agents/pyproject.toml scripts/qa-agents/uv.lock
git commit -m "feat(qa): replace browser-use with claude -p subagents, add smoke gate + notify pipeline"
```

---

## Task 8: End-to-end verification

**Step 1: Ensure app is running**

```bash
# In a separate terminal:
cd /e/Projects/QuiverDM && npm run dev
```

**Step 2: Run the full pipeline**

```bash
cd /e/Projects/QuiverDM/scripts/qa-agents
uv run python run.py
```

Watch for:
- `[run] Stage 1: Playwright smoke gate` → `Smoke: 5 passed, 0 failed`
- `[claude_agent] Starting: New DM Nora` (and Dana, Vic)
- Each agent completes with outcome
- `[notifier] Discord thread created: ...`
- `[notifier] GitHub issue created: ...` (for any failures)

**Step 3: Verify Discord**

Check the `#qa-agent-runs` channel — one new thread should appear with:
- Thread title: `2026-03-02T{time} — 2/3 passed` (or similar)
- Summary embed with 🟢/🔴 per agent
- Failure follow-up message with screenshot

**Step 4: Verify GitHub**

```bash
gh issue list --repo DevVentari/QuiverDM-Live --label qa-failure
```

Expected: one issue per failed agent (if any)

**Step 5: Commit final state if any fixes were needed**

```bash
git add -A
git commit -m "fix(qa): e2e verification fixes"
```

---

## Environment variables checklist

Add to `.env.local` before running:

```env
# Already present:
QA_TEST_PASSWORD=...
QA_NORA_EMAIL=nora@test.local
QA_DANA_EMAIL=dana@test.local
QA_VIC_EMAIL=vic@test.local
QA_APP_URL=http://localhost:3847

# Add these:
QUIVERDM_DISCORD_BOT_TOKEN=<copy from ~/.claude/credentials.env>
QA_DISCORD_GUILD_ID=<your Discord server ID>
QA_DISCORD_FORUM_CHANNEL_ID=<from setup_discord.py output>
```

GitHub: already handled by `gh` CLI (authenticated as `DevVentari`).
