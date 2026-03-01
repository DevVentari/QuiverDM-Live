# QA Browser Agents — Design

**Date:** 2026-03-02
**Scope:** Stage 1 of the automated QA feedback-to-resolution pipeline. AI browser agents that impersonate personas, execute smoke test scenarios against the local dev environment, submit friction reports via the existing feedback overlay, and post a run summary to Discord.

---

## Context

The existing feedback pipeline is already built:
- Feedback overlay widget → `feedback.createReport` tRPC mutation
- Discord forum thread creation (screenshot + embed)
- GitHub issue creation
- BullMQ triage job → `claude -p` analysis embed posted to thread
- n8n in docker-compose at port 5678

This design adds synthetic browser agents that drive the front end and submit to that pipeline as if they were real users.

---

## Architecture

**Approach:** Python orchestrator (`scripts/qa-agents/`) + n8n as scheduler only.

n8n triggers the agent runner on a schedule. The Python script handles all Browser Use logic, asyncio concurrency, and reporting. The script is also independently runnable for local dev testing.

```
n8n Schedule Trigger
  → Webhook POST → scripts/qa-agents/server.py (port 8765)
    → spawns run.py
      → asyncio.Semaphore(2)
        → Agent: Nora  (create campaign)
        → Agent: Dana  (upload PDF)
        → Agent: Vic   (create NPC)
      → reporter.py writes reports/YYYY-MM-DD-THH.json + latest.json
  → n8n reads latest.json
  → n8n HTTP Request → Discord webhook (run summary embed)
```

---

## Directory Structure

```
scripts/qa-agents/
  pyproject.toml            # uv project: browser-use, langchain-anthropic, playwright
  run.py                    # asyncio orchestrator, Semaphore(2)
  server.py                 # tiny HTTP server (port 8765) — n8n trigger target
  personas.py               # Nora, Dana, Vic definitions
  scenarios/
    __init__.py
    create_campaign.py      # Nora: onboarding → create campaign
    upload_pdf.py           # Dana: homebrew → upload PDF source
    create_npc.py           # Vic: open test campaign → create NPC
  reporter.py               # writes JSON summary
  reports/                  # gitignored output
scripts/seed-qa-accounts.ts # creates test users + Vic's campaign in local DB
```

---

## Personas

| Persona | Account | Trait (injected as message_context) | Scenario |
|---------|---------|--------------------------------------|----------|
| New DM Nora | `nora@test.local` | Beginner, overwhelmed by jargon, expects guided flows. Actively look for confusing labels, dead ends, and missing affordances. | Sign in → complete onboarding → create first campaign |
| Power DM Dana | `dana@test.local` | Efficiency-focused, frustrated by slowness or extra clicks. Actively look for slow loads, redundant steps, and unclear progress indicators. | Sign in → homebrew → upload a PDF source |
| Veteran Vic | `vic@test.local` | D&D expert, opinionated about correctness. Actively look for missing fields, incorrect defaults, and weak validation. | Sign in → open test campaign → create NPC with full stat block |

All personas include an explicit instruction to **find problems** — countering the people-pleasing bias documented in Nielsen Norman Group research on synthetic users.

---

## LLM

Browser Use Python library with `ChatAnthropic`:

```python
from browser_use import Agent
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6")
agent = Agent(
    task="<scenario task>",
    llm=llm,
    message_context="PERSONA: New DM Nora. Beginner...",
    extend_system_message="Always fill ALL feedback form fields with numbered steps.",
)
```

`ANTHROPIC_API_KEY` is already in `credentials.env`. Each agent gets its own Chromium instance via Playwright.

Note: Browser Use also offers a hosted MCP server (`api.browser-use.com/mcp`) for cloud integrations, but it cannot reach localhost — not applicable here.

---

## Authentication

Each agent navigates to `http://localhost:3847/auth/signin` and logs in with credentials from env vars:

```
QA_NORA_EMAIL=nora@test.local
QA_DANA_EMAIL=dana@test.local
QA_VIC_EMAIL=vic@test.local
QA_TEST_PASSWORD=<secret, never committed>
```

These live in `.env.local` only.

---

## Friction Handling

When an agent encounters a problem during its scenario it:

1. Clicks the feedback widget (bottom-right corner of every authenticated page)
2. Selects type: Bug or Feature
3. Fills description with structured text:
   ```
   [QA-AGENT] Persona: Nora | Scenario: create_campaign | Step: clicking "Create Campaign" | Issue: button unresponsive after 3 seconds
   ```
4. Submits — goes through the real pipeline (Discord thread + Claude triage)

The `[QA-AGENT]` prefix makes synthetic reports filterable from real user reports.

---

## Run Summary

After all agents complete, `reporter.py` writes:

```json
{
  "run_id": "2026-03-02T07:00",
  "duration_seconds": 143,
  "agents": [
    {
      "persona": "Nora",
      "scenario": "create_campaign",
      "outcome": "success",
      "friction_points": 1,
      "feedback_ids": ["fb_abc123"],
      "error": null
    }
  ]
}
```

Written to `reports/YYYY-MM-DD-THH.json` and symlinked as `reports/latest.json`. n8n reads `latest.json` and posts a summary embed to Discord.

---

## n8n Workflow

**Trigger schedule** (AEST):

| Days | Time | Cron |
|------|------|------|
| Tuesday + Wednesday | 7:00am | `0 7 * * 2,3` |
| Thursday + Friday + Saturday | 9:00am | `0 9 * * 4,5,6` |

**Nodes:**
1. Schedule Trigger (two cron rules)
2. HTTP Request → `POST http://host.docker.internal:8765/run` (triggers `server.py`)
3. Wait node (polls `GET http://host.docker.internal:8765/status` until done)
4. Read Binary File → `scripts/qa-agents/reports/latest.json`
5. HTTP Request → Discord webhook (summary embed)

`host.docker.internal` resolves to the Windows host from inside the n8n container.

---

## Fixture Data

**Seed script:** `scripts/seed-qa-accounts.ts`
**Run via:** `npm run seed:qa` (added to package.json)

Creates if not exists:
- `nora@test.local` — no campaigns (onboarding flow is the scenario)
- `dana@test.local` — no campaigns
- `vic@test.local` — pre-seeded "Vic's Test Campaign" with one session (NPC scenario needs an existing campaign)

Password: hashed from `QA_TEST_PASSWORD` env var.

---

## Setup Steps (One-Time)

```bash
# 1. Seed test accounts
npm run seed:qa

# 2. Install Python deps
cd scripts/qa-agents
uv sync
uv run playwright install chromium

# 3. Start the trigger server (keep running alongside dev)
uv run python server.py
```

Add `QA_TEST_PASSWORD`, `QA_NORA_EMAIL`, `QA_DANA_EMAIL`, `QA_VIC_EMAIL` to `.env.local`.

---

## Out of Scope (Stage 1)

- Stage 4: Discord approval buttons on triage embeds
- Stage 5: Claude Code CLI auto-fix execution
- Embedding-based duplicate detection
- Multiple scenarios per persona
- CI/CD integration (post-deploy trigger)
