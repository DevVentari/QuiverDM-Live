# QA Browser Agents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build AI browser agents (Browser Use + Claude) that impersonate 3 DM personas, run smoke test scenarios against the local QuiverDM dev server, submit friction reports via the existing feedback overlay, and post a run summary to Discord via n8n.

**Architecture:** Standalone Python project at `scripts/qa-agents/` orchestrated by `asyncio` with a `Semaphore(2)` concurrency limit. A tiny HTTP server (`server.py`) on port 8765 acts as n8n's trigger target. n8n calls it on a working-hours schedule and routes the JSON summary to Discord.

**Tech Stack:** Python 3.11+, `uv`, `browser-use`, `langchain-anthropic`, `playwright`, `pytest`, `httpx` (test client). TypeScript seed script via `npx tsx`. n8n (already in docker-compose on port 5678).

---

## Prerequisites

- Local dev server running: `npm run dev` (port 3847)
- Docker running: `docker-compose up -d` (for n8n, Redis, Postgres)
- `ANTHROPIC_API_KEY` in `.env.local`
- `QA_TEST_PASSWORD` set in `.env.local` (min 8 chars, e.g. `TestPass123`)

---

## Task 1: Python project scaffold

**Files:**
- Create: `scripts/qa-agents/pyproject.toml`
- Create: `scripts/qa-agents/.gitignore`
- Create: `scripts/qa-agents/reports/.gitkeep`
- Create: `scripts/qa-agents/scenarios/__init__.py`
- Create: `scripts/qa-agents/tests/__init__.py`

**Step 1: Create `scripts/qa-agents/pyproject.toml`**

```toml
[project]
name = "qa-agents"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "browser-use>=0.2.0",
    "langchain-anthropic>=0.3.0",
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

**Step 2: Create `scripts/qa-agents/.gitignore`**

```
reports/*.json
__pycache__/
.venv/
*.pyc
.env
```

**Step 3: Create `scripts/qa-agents/reports/.gitkeep`**

Empty file. Ensures the `reports/` directory is tracked by git without its contents.

**Step 4: Create empty `__init__.py` files**

```
scripts/qa-agents/scenarios/__init__.py   (empty)
scripts/qa-agents/tests/__init__.py       (empty)
```

**Step 5: Install deps and Chromium**

```bash
cd scripts/qa-agents
uv sync --extra dev
uv run playwright install chromium
```

Expected: Chromium downloads (~150MB). `uv sync` completes without errors.

**Step 6: Commit**

```bash
git add scripts/qa-agents/
git commit -m "chore: scaffold qa-agents Python project"
```

---

## Task 2: Add env vars and npm seed script

**Files:**
- Modify: `.env.local` (add QA vars)
- Modify: `package.json` (add `seed:qa` script)
- Create: `scripts/seed-qa-accounts.ts`

**Step 1: Add env vars to `.env.local`**

```env
# QA Browser Agents
QA_TEST_PASSWORD=TestPass123!
QA_NORA_EMAIL=nora@test.local
QA_DANA_EMAIL=dana@test.local
QA_VIC_EMAIL=vic@test.local
QA_APP_URL=http://localhost:3847
```

**Step 2: Create `scripts/seed-qa-accounts.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD;
if (!QA_TEST_PASSWORD) {
  console.error('QA_TEST_PASSWORD env var required');
  process.exit(1);
}

const personas = [
  { name: 'New DM Nora',   email: process.env.QA_NORA_EMAIL ?? 'nora@test.local', onboardingCompleted: false },
  { name: 'Power DM Dana', email: process.env.QA_DANA_EMAIL ?? 'dana@test.local', onboardingCompleted: true  },
  { name: 'Veteran Vic',   email: process.env.QA_VIC_EMAIL  ?? 'vic@test.local',  onboardingCompleted: true  },
];

async function main() {
  const hashedPassword = await bcrypt.hash(QA_TEST_PASSWORD!, 10);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const persona of personas) {
    const existing = await prisma.user.findUnique({ where: { email: persona.email } });
    if (existing) {
      console.log(`[skip] ${persona.email} already exists`);
      continue;
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: persona.name,
          email: persona.email,
          emailVerified: now,
          onboardingCompleted: persona.onboardingCompleted,
          onboardingStep: persona.onboardingCompleted ? 'complete' : 'welcome',
        },
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: newUser.id,
          password: hashedPassword,
        },
      });

      await tx.userUsage.create({
        data: {
          userId: newUser.id,
          periodStart: now,
          periodEnd,
        },
      });

      return newUser;
    });

    console.log(`[created] ${persona.email} (id: ${user.id})`);
  }

  // Seed Vic's test campaign (needs a campaign to run NPC scenario)
  const vic = await prisma.user.findUnique({ where: { email: personas[2].email } });
  if (vic) {
    const existing = await prisma.campaign.findFirst({ where: { userId: vic.id, name: "Vic's Test Campaign" } });
    if (!existing) {
      const campaign = await prisma.campaign.create({
        data: {
          name: "Vic's Test Campaign",
          slug: 'vics-test-campaign',
          userId: vic.id,
          members: {
            create: {
              userId: vic.id,
              role: 'OWNER',
            },
          },
        },
      });
      console.log(`[created] Vic's Test Campaign (id: ${campaign.id})`);
    } else {
      console.log(`[skip] Vic's Test Campaign already exists`);
    }
  }

  console.log('[done] QA accounts seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**Step 3: Add `seed:qa` to `package.json`**

Find the `"scripts"` block in `package.json` and add:

```json
"seed:qa": "dotenv -e .env.local -- npx tsx scripts/seed-qa-accounts.ts"
```

**Step 4: Run the seed script**

```bash
npm run seed:qa
```

Expected output:
```
[created] nora@test.local (id: ...)
[created] dana@test.local (id: ...)
[created] vic@test.local (id: ...)
[created] Vic's Test Campaign (id: ...)
[done] QA accounts seeded
```

**Step 5: Verify by running again (idempotency check)**

```bash
npm run seed:qa
```

Expected: all lines show `[skip]`, no errors.

**Step 6: Commit**

```bash
git add scripts/seed-qa-accounts.ts package.json
git commit -m "feat(qa): add test account seed script"
```

---

## Task 3: Personas module + tests

**Files:**
- Create: `scripts/qa-agents/personas.py`
- Create: `scripts/qa-agents/tests/test_personas.py`

**Step 1: Write the failing test**

```python
# scripts/qa-agents/tests/test_personas.py
import os
import pytest
from personas import PERSONAS, Persona


def test_persona_count():
    assert len(PERSONAS) == 3


def test_persona_fields():
    required = {'name', 'email_env', 'message_context', 'scenario'}
    for p in PERSONAS:
        assert required.issubset(vars(p).keys()), f"Persona {p.name} missing fields"


def test_persona_email_loads_from_env(monkeypatch):
    monkeypatch.setenv('QA_NORA_EMAIL', 'nora@test.local')
    monkeypatch.setenv('QA_DANA_EMAIL', 'dana@test.local')
    monkeypatch.setenv('QA_VIC_EMAIL', 'vic@test.local')
    for p in PERSONAS:
        email = os.environ.get(p.email_env)
        assert email and '@' in email, f"{p.name} email not loadable from {p.email_env}"


def test_persona_message_context_mentions_find_problems():
    for p in PERSONAS:
        ctx = p.message_context.lower()
        assert any(word in ctx for word in ['problem', 'issue', 'friction', 'bug', 'find']), \
            f"Persona {p.name} message_context doesn't instruct agent to find problems"
```

**Step 2: Run test to verify it fails**

```bash
cd scripts/qa-agents
uv run pytest tests/test_personas.py -v
```

Expected: `ModuleNotFoundError: No module named 'personas'`

**Step 3: Create `scripts/qa-agents/personas.py`**

```python
from dataclasses import dataclass


@dataclass
class Persona:
    name: str
    email_env: str       # env var name holding the email
    message_context: str # injected into Browser Use agent
    scenario: str        # module name in scenarios/


PERSONAS = [
    Persona(
        name='New DM Nora',
        email_env='QA_NORA_EMAIL',
        scenario='create_campaign',
        message_context=(
            'PERSONA: New DM Nora. You are a complete beginner to D&D and digital tools. '
            'You are easily overwhelmed by jargon, too many options, and unclear labels. '
            'IMPORTANT: Actively look for problems. If anything is confusing, slow, broken, '
            'or missing guidance — that is a friction point. Do not ignore issues or assume '
            'they are your fault. Find bugs and report them.'
        ),
    ),
    Persona(
        name='Power DM Dana',
        email_env='QA_DANA_EMAIL',
        scenario='upload_pdf',
        message_context=(
            'PERSONA: Power DM Dana. You are efficiency-focused and run multiple campaigns. '
            'You are frustrated by extra clicks, slow loading, unclear progress, and redundant steps. '
            'IMPORTANT: Actively look for problems. If anything feels slow, unnecessarily complex, '
            'or lacks feedback — that is a friction point. Find issues and report them.'
        ),
    ),
    Persona(
        name='Veteran Vic',
        email_env='QA_VIC_EMAIL',
        scenario='create_npc',
        message_context=(
            'PERSONA: Veteran Vic. You know D&D rules deeply and have strong opinions about correctness. '
            'You are frustrated by missing fields, wrong defaults, weak validation, and D&D inaccuracies. '
            'IMPORTANT: Actively look for problems. Check that fields, options, and defaults match '
            'D&D 5e conventions. Report anything missing or incorrect.'
        ),
    ),
]
```

**Step 4: Run test to verify it passes**

```bash
uv run pytest tests/test_personas.py -v
```

Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/personas.py scripts/qa-agents/tests/test_personas.py
git commit -m "feat(qa): add personas module"
```

---

## Task 4: Reporter module + tests

**Files:**
- Create: `scripts/qa-agents/reporter.py`
- Create: `scripts/qa-agents/tests/test_reporter.py`

**Step 1: Write the failing test**

```python
# scripts/qa-agents/tests/test_reporter.py
import json
import os
from pathlib import Path
import pytest
from reporter import write_report, AgentResult


def test_write_report_creates_file(tmp_path):
    results = [
        AgentResult(persona='Nora', scenario='create_campaign', outcome='success',
                    friction_points=1, feedback_ids=['fb_abc'], error=None, duration_seconds=42),
    ]
    path = write_report(results, reports_dir=tmp_path)
    assert path.exists()
    data = json.loads(path.read_text())
    assert data['agents'][0]['persona'] == 'Nora'
    assert data['agents'][0]['outcome'] == 'success'
    assert data['agents'][0]['friction_points'] == 1


def test_write_report_updates_latest(tmp_path):
    results = [
        AgentResult(persona='Dana', scenario='upload_pdf', outcome='failed',
                    friction_points=0, feedback_ids=[], error='TimeoutError', duration_seconds=10),
    ]
    write_report(results, reports_dir=tmp_path)
    latest = tmp_path / 'latest.json'
    assert latest.exists()
    data = json.loads(latest.read_text())
    assert data['agents'][0]['error'] == 'TimeoutError'


def test_report_has_run_id(tmp_path):
    results = []
    write_report(results, reports_dir=tmp_path)
    latest = tmp_path / 'latest.json'
    data = json.loads(latest.read_text())
    assert 'run_id' in data
    assert 'duration_seconds' in data
```

**Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_reporter.py -v
```

Expected: `ModuleNotFoundError: No module named 'reporter'`

**Step 3: Create `scripts/qa-agents/reporter.py`**

```python
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class AgentResult:
    persona: str
    scenario: str
    outcome: str                 # 'success' | 'partial' | 'failed'
    friction_points: int
    feedback_ids: list[str]
    error: Optional[str]
    duration_seconds: float


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

**Step 4: Run test to verify it passes**

```bash
uv run pytest tests/test_reporter.py -v
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/reporter.py scripts/qa-agents/tests/test_reporter.py
git commit -m "feat(qa): add reporter module"
```

---

## Task 5: Trigger server + tests

**Files:**
- Create: `scripts/qa-agents/server.py`
- Create: `scripts/qa-agents/tests/test_server.py`

**Step 1: Write the failing test**

```python
# scripts/qa-agents/tests/test_server.py
import pytest
from unittest.mock import patch, MagicMock
from server import app   # httpx test client via starlette or use http.server


def test_status_idle():
    """GET /status returns idle when no run in progress"""
    import httpx
    with patch('server._run_state', {'status': 'idle', 'run_id': None}):
        # Import after patching
        from server import handle_status
        result = handle_status()
        assert result['status'] == 'idle'


def test_run_endpoint_rejects_concurrent():
    """POST /run returns 409 if already running"""
    import httpx
    with patch('server._run_state', {'status': 'running', 'run_id': 'test'}):
        from server import handle_run
        code, body = handle_run()
        assert code == 409
```

**Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_server.py -v
```

Expected: `ModuleNotFoundError: No module named 'server'`

**Step 3: Create `scripts/qa-agents/server.py`**

```python
"""
Tiny HTTP trigger server for n8n integration.
Listens on port 8765.

Endpoints:
  POST /run     — triggers run.py in a subprocess; returns 409 if already running
  GET  /status  — returns current run state (idle / running / done)
"""
import json
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

_run_state: dict = {'status': 'idle', 'run_id': None}
_lock = threading.Lock()

AGENTS_DIR = Path(__file__).parent


def handle_run() -> tuple[int, dict]:
    with _lock:
        if _run_state['status'] == 'running':
            return 409, {'error': 'Run already in progress', 'run_id': _run_state['run_id']}

        import datetime
        run_id = datetime.datetime.now().strftime('%Y-%m-%dT%H%M')
        _run_state['status'] = 'running'
        _run_state['run_id'] = run_id

    def _spawn():
        try:
            subprocess.run(
                [sys.executable, str(AGENTS_DIR / 'run.py')],
                cwd=str(AGENTS_DIR),
                check=False,
            )
        finally:
            with _lock:
                _run_state['status'] = 'done'

    threading.Thread(target=_spawn, daemon=True).start()
    return 200, {'status': 'started', 'run_id': run_id}


def handle_status() -> dict:
    with _lock:
        return dict(_run_state)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f'[server] {format % args}')

    def send_json(self, code: int, body: dict):
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(payload))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path == '/run':
            code, body = handle_run()
            self.send_json(code, body)
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_GET(self):
        if self.path == '/status':
            self.send_json(200, handle_status())
        else:
            self.send_json(404, {'error': 'Not found'})


if __name__ == '__main__':
    port = 8765
    httpd = HTTPServer(('0.0.0.0', port), Handler)
    print(f'[server] Listening on port {port}')
    httpd.serve_forever()
```

**Step 4: Run test to verify it passes**

```bash
uv run pytest tests/test_server.py -v
```

Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add scripts/qa-agents/server.py scripts/qa-agents/tests/test_server.py
git commit -m "feat(qa): add n8n trigger server"
```

---

## Task 6: Nora's scenario — create_campaign

**Files:**
- Create: `scripts/qa-agents/scenarios/create_campaign.py`

No unit tests — this IS the test. Verified by manual run.

**Step 1: Create `scripts/qa-agents/scenarios/create_campaign.py`**

```python
"""
Scenario: New DM Nora creates her first campaign.

Steps the agent attempts:
1. Navigate to sign-in page and log in as Nora
2. Complete onboarding flow (welcome → profile → create first campaign)
3. If onboarding is skipped/broken, navigate to /dashboard and click "New Campaign"
4. Fill in campaign name and submit
5. Verify the campaign page loads
6. If friction encountered at any step, use the feedback overlay to report it
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: create your first D&D campaign as a brand new user.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Complete any onboarding steps that appear (welcome screen, profile setup, campaign creation wizard)
4. If you land on a dashboard with no campaigns, click "New Campaign" or equivalent button
5. Fill in a campaign name: "Nora's First Adventure"
6. Submit and confirm the campaign was created (you should see a campaign page or dashboard with the campaign listed)

When you encounter any problem — button doesn't work, page is confusing, error appears, something is slow:
1. Look for the feedback button in the bottom-right corner of the page (a small icon or "Feedback" label)
2. Click it to open the feedback form
3. Select type: Bug (for errors/broken things) or Feature (for missing/unclear things)
4. Fill description: [QA-AGENT] Persona: Nora | Scenario: create_campaign | Step: <what you were doing> | Issue: <what went wrong>
5. Submit the feedback form
6. Then continue trying to complete the scenario

Report any friction you encounter, even if you eventually work around it.
At the end, report your final outcome: SUCCESS (campaign created), PARTIAL (got partway), or FAILED (could not proceed).
"""
```

**Step 2: Manually run the scenario to verify it works**

```bash
cd scripts/qa-agents
uv run python -c "
import asyncio, os
from dotenv import load_dotenv
load_dotenv('../../.env.local')
from browser_use import Agent
from langchain_anthropic import ChatAnthropic
from scenarios.create_campaign import TASK
from personas import PERSONAS

persona = PERSONAS[0]  # Nora
llm = ChatAnthropic(model='claude-sonnet-4-6')
task = TASK.format(
    app_url=os.environ['QA_APP_URL'],
    email=os.environ[persona.email_env],
    password=os.environ['QA_TEST_PASSWORD'],
)
agent = Agent(task=task, llm=llm, message_context=persona.message_context)
asyncio.run(agent.run())
"
```

Expected: Chromium opens, agent navigates QuiverDM, creates a campaign or reports friction.

**Step 3: Commit**

```bash
git add scripts/qa-agents/scenarios/create_campaign.py
git commit -m "feat(qa): add Nora create_campaign scenario"
```

---

## Task 7: Dana's scenario — upload_pdf

**Files:**
- Create: `scripts/qa-agents/scenarios/upload_pdf.py`

**Step 1: Create `scripts/qa-agents/scenarios/upload_pdf.py`**

```python
"""
Scenario: Power DM Dana uploads a PDF homebrew source.

Steps the agent attempts:
1. Sign in as Dana
2. Navigate to homebrew section (top nav or sidebar)
3. Find the "Upload PDF" or "Add Source" option
4. Upload a test PDF (use a small public domain PDF if available, or note missing file)
5. Wait for processing and verify the source appears
6. Report friction at any step via feedback overlay
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: upload a PDF as a homebrew source, like a DM would when importing a rulebook or supplement.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Navigate to the Homebrew section (look in the sidebar or top navigation)
4. Look for an option to upload or import a PDF
5. If a file picker appears, note that you cannot actually select a file in this test — report if the upload workflow is clear and usable
6. Check if there is visual feedback about what file types/sizes are accepted
7. Navigate to any homebrew library or list view and note if it is easy to find

When you encounter any problem — button doesn't work, page is confusing, error appears, upload progress is unclear:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill description:
   [QA-AGENT] Persona: Dana | Scenario: upload_pdf | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (found and understood upload flow), PARTIAL (found it but something was unclear), or FAILED (could not find it).
"""
```

**Step 2: Commit**

```bash
git add scripts/qa-agents/scenarios/upload_pdf.py
git commit -m "feat(qa): add Dana upload_pdf scenario"
```

---

## Task 8: Vic's scenario — create_npc

**Files:**
- Create: `scripts/qa-agents/scenarios/create_npc.py`

**Step 1: Create `scripts/qa-agents/scenarios/create_npc.py`**

```python
"""
Scenario: Veteran Vic creates an NPC with a full stat block in his existing campaign.

Steps the agent attempts:
1. Sign in as Vic
2. Navigate to "Vic's Test Campaign"
3. Go to the NPCs section of the campaign
4. Create a new NPC — fill name, CR, HP, AC, stats
5. Check that D&D 5e defaults/options are correct
6. Save and verify the NPC appears in the list
7. Report any D&D inaccuracies or missing fields via feedback overlay
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: create a new NPC with a complete stat block inside an existing campaign, like an experienced DM preparing for a session.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Find "Vic's Test Campaign" in your dashboard or campaigns list and open it
4. Look for an NPCs section (sidebar, tab, or menu item)
5. Create a new NPC with these details:
   - Name: Theron the Bandit Captain
   - Challenge Rating: 2
   - HP: 65
   - AC: 15
   - Strength: 16, Dexterity: 15, Constitution: 16, Intelligence: 14, Wisdom: 11, Charisma: 14
   - Type: Humanoid
6. Save the NPC
7. Verify it appears in the NPC list

Pay attention to:
- Are all standard 5e stat block fields present?
- Are CR options correct (not just integers — includes 0, 1/8, 1/4, 1/2)?
- Are ability score modifiers calculated automatically?
- Is anything a D&D player would expect missing or wrong?

When you encounter problems:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill description:
   [QA-AGENT] Persona: Vic | Scenario: create_npc | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (NPC created with full stat block), PARTIAL (created but missing fields), or FAILED.
"""
```

**Step 2: Commit**

```bash
git add scripts/qa-agents/scenarios/create_npc.py
git commit -m "feat(qa): add Vic create_npc scenario"
```

---

## Task 9: Main orchestrator

**Files:**
- Create: `scripts/qa-agents/run.py`

**Step 1: Create `scripts/qa-agents/run.py`**

```python
"""
QA Agent Orchestrator
Runs all 3 persona scenarios concurrently (max 2 at a time).
Writes a JSON summary to reports/.

Usage:
  uv run python run.py
"""
import asyncio
import importlib
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env.local from the project root (two levels up from this file)
env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(env_path)

from browser_use import Agent
from langchain_anthropic import ChatAnthropic
from personas import PERSONAS
from reporter import AgentResult, write_report


async def run_agent(persona, semaphore: asyncio.Semaphore) -> AgentResult:
    async with semaphore:
        print(f'[run] Starting: {persona.name}')
        start = time.monotonic()
        feedback_ids: list[str] = []
        friction_points = 0
        error_msg = None
        outcome = 'failed'

        try:
            scenario_mod = importlib.import_module(f'scenarios.{persona.scenario}')
            task = scenario_mod.TASK.format(
                app_url=os.environ.get('QA_APP_URL', 'http://localhost:3847'),
                email=os.environ[persona.email_env],
                password=os.environ['QA_TEST_PASSWORD'],
            )

            llm = ChatAnthropic(model='claude-sonnet-4-6')
            agent = Agent(
                task=task,
                llm=llm,
                message_context=persona.message_context,
                extend_system_message=(
                    'When you submit feedback via the overlay form, note the feedback ID '
                    'if shown. Include [QA-AGENT] prefix in all feedback descriptions. '
                    'Count each feedback submission as a friction point.'
                ),
            )

            result = await agent.run(max_steps=30)

            # Parse outcome from agent's final message
            final = str(result).upper()
            if 'SUCCESS' in final:
                outcome = 'success'
            elif 'PARTIAL' in final:
                outcome = 'partial'
            else:
                outcome = 'failed'

        except Exception as e:
            error_msg = type(e).__name__ + ': ' + str(e)[:200]
            print(f'[run] Error in {persona.name}: {error_msg}')

        duration = time.monotonic() - start
        print(f'[run] Done: {persona.name} — {outcome} in {duration:.0f}s')
        return AgentResult(
            persona=persona.name,
            scenario=persona.scenario,
            outcome=outcome,
            friction_points=friction_points,
            feedback_ids=feedback_ids,
            error=error_msg,
            duration_seconds=round(duration, 1),
        )


async def main():
    semaphore = asyncio.Semaphore(2)  # max 2 Chromium instances
    tasks = [run_agent(p, semaphore) for p in PERSONAS]
    results = await asyncio.gather(*tasks)
    report_path = write_report(list(results))
    print(f'[run] Report written to {report_path}')


if __name__ == '__main__':
    asyncio.run(main())
```

**Step 2: Run a dry test (verify imports work, don't actually run agents)**

```bash
cd scripts/qa-agents
uv run python -c "import run; print('imports OK')"
```

Expected: `imports OK`

**Step 3: Commit**

```bash
git add scripts/qa-agents/run.py
git commit -m "feat(qa): add asyncio orchestrator"
```

---

## Task 10: n8n workflow setup (manual steps)

n8n cannot be configured via code — do this in the n8n UI at http://localhost:5678.

**Step 1: Open n8n and create a new workflow**

Navigate to http://localhost:5678 → "New Workflow" → name it "QA Browser Agents".

**Step 2: Add Schedule Trigger node**

Add node: "Schedule Trigger"
Configure two rules:
- Rule 1: Cron expression `0 7 * * 2,3`  (7am AEST Tue+Wed)
- Rule 2: Cron expression `0 9 * * 4,5,6` (9am AEST Thu-Fri-Sat)
Timezone: `Australia/Sydney`

**Step 3: Add HTTP Request node — trigger run**

Add node: "HTTP Request"
- Method: POST
- URL: `http://host.docker.internal:8765/run`
- Response format: JSON

Connect: Schedule Trigger → HTTP Request (run)

**Step 4: Add Wait node — poll until done**

Add node: "Wait"
- Wait for: 5 minutes (agents typically finish in 3-8 minutes)

Connect: HTTP Request (run) → Wait

**Step 5: Add HTTP Request node — get status**

Add node: "HTTP Request"
- Method: GET
- URL: `http://host.docker.internal:8765/status`

Connect: Wait → HTTP Request (status)

**Step 6: Add Read Binary File node — load report**

Add node: "Read Binary File"
- File path: `/host-path/scripts/qa-agents/reports/latest.json`

> Note: For this to work, mount the scripts dir into the n8n container. Add to docker-compose.yml under the n8n service:
> ```yaml
> volumes:
>   - ./scripts/qa-agents/reports:/home/node/qa-reports:ro
> ```
> Then set file path to `/home/node/qa-reports/latest.json`

Connect: HTTP Request (status) → Read Binary File

**Step 7: Add HTTP Request node — Discord summary**

Add node: "HTTP Request"
- Method: POST
- URL: `{{ $env.DISCORD_FEEDBACK_WEBHOOK_URL }}`
- Body (JSON):
```json
{
  "embeds": [{
    "title": "QA Agent Run — {{ $json.run_id }}",
    "color": 5763719,
    "fields": [
      { "name": "Duration", "value": "{{ $json.duration_seconds }}s", "inline": true },
      { "name": "Agents", "value": "{{ $json.agents.length }}", "inline": true }
    ],
    "description": "Run complete. Check #feedback channel for individual reports."
  }]
}
```

Connect: Read Binary File → HTTP Request (Discord)

**Step 8: Activate the workflow**

Toggle the workflow to "Active". It will trigger on schedule.

**Step 9: Test with manual trigger**

While the server is running (`uv run python server.py`), click "Execute Workflow" in n8n to trigger a manual run.

---

## Task 11: Run all tests and verify

**Step 1: Run the full Python test suite**

```bash
cd scripts/qa-agents
uv run pytest tests/ -v
```

Expected: All tests PASS

**Step 2: Run a full end-to-end agent run manually**

Ensure prerequisites:
- `npm run dev` running on port 3847
- `npm run seed:qa` already run
- `.env.local` has all QA_ vars and ANTHROPIC_API_KEY

```bash
cd scripts/qa-agents
uv run python run.py
```

Expected: 3 Chromium windows open sequentially (max 2 at once), agents navigate QuiverDM, report is written to `reports/latest.json`.

**Step 3: Verify report contents**

```bash
cat scripts/qa-agents/reports/latest.json
```

Expected: valid JSON with `run_id`, `duration_seconds`, and 3 agent results.

**Step 4: Final commit**

```bash
git add scripts/qa-agents/
git commit -m "feat(qa): complete browser agent pipeline — personas, scenarios, orchestrator, server"
```

---

## Summary

| Component | File | Purpose |
|-----------|------|---------|
| Personas | `personas.py` | Nora/Dana/Vic definitions |
| Scenarios | `scenarios/*.py` | Task strings per persona |
| Reporter | `reporter.py` | JSON summary writer |
| Server | `server.py` | HTTP trigger for n8n (port 8765) |
| Orchestrator | `run.py` | asyncio runner, Semaphore(2) |
| Seed | `scripts/seed-qa-accounts.ts` | Test user + campaign creation |
| n8n | UI config | Scheduled trigger + Discord summary |
