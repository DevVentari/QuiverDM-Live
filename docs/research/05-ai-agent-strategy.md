# AI Agent Strategy — QuiverDM

**Date:** 2026-02-23
**Status:** Research / Design Document

---

## Executive Summary

QuiverDM already has six standalone AI capabilities: PDF extraction, session transcription, AI session summaries, semantic search (pgvector), image generation, and Rules RAG. The next step is to evolve these isolated features into a coordinated **agent layer** — a set of purpose-built agents that share campaign context, hand off results to each other via BullMQ, and deliver compounding value greater than any single feature.

The recommended approach for beta is **three agents** (Session Recap, NPC Voice, and Plot Continuity), growing to **seven agents** by v2. Each agent is a thin wrapper around existing AI infrastructure (Ollama / Gemini / OpenAI multi-provider chain) with structured DB reads/writes as the source of truth.

---

## 1. Agents to Build — Prioritized List

### BETA (ship with closed beta launch)

---

#### Agent 1: Session Recap Agent (Enhance Existing)

**Purpose:** Upgrade the current `ai-summary-worker.ts` from a single-pass summarizer into a multi-context-aware recap generator that references prior sessions, named NPCs, and unresolved plot threads.

**Data access:**
- `GameSession.transcripts` (current session transcript)
- `GameSession.aiSummary` (last 3 session summaries for continuity context)
- `NPC` table (active NPCs in campaign — names, factions, roles)
- `Campaign.settings` (glossary, campaign tone)
- `Character` / `CampaignCharacter` (who was at the table)

**How it improves DM/player experience:**
- Today the summary reads a single transcript in isolation and loses NPC names, recurring plot threads, and character arcs
- Enriched recap surfaces "X returned, Y completed, Z remains unresolved" in a structured format
- Players who missed a session get an accurate, named recap instead of a generic summary

**Training approach:** Prompt engineering + RAG. Inject prior summaries and NPC context as system-level context blocks. No fine-tuning needed — a well-structured prompt with 3–5k tokens of campaign context produces excellent results.

**Model routing:**
- Ollama (llama3.1 8B or Mistral) for simple recaps when context fits in 8k tokens
- Gemini Flash / GPT-4o-mini for long transcripts (>12k tokens)

**Priority:** BETA — already partially built, needs context enrichment.

**Implementation delta:**
- Pass last 3 `aiSummary` values + NPC list into the BullMQ job data
- Extend `SUMMARY_SYSTEM_PROMPT` to reference them
- Add `aiSummaryContext` JSON field to `GameSession` for storing the enriched input snapshot (aids debugging)

---

#### Agent 2: NPC Voice / Personality Agent

**Purpose:** Given an NPC's name, role, faction, secrets, and the current scene context, generate consistent in-character dialogue, reactions, and motivations. Usable as an on-demand chat interface during play.

**Data access:**
- `NPC` record (description, faction, role, secrets, stats, tags)
- Last session's `aiSummary` (what happened most recently involving this NPC)
- Campaign `settings.glossary` (setting-specific nouns and factions)
- Encounter context (optional — is the NPC in combat right now?)

**How it improves DM/player experience:**
- DMs often lose NPC voice mid-session. A quick "what would Mira Ashvale say to the party's offer?" returns 2–3 dialogue options consistent with her established personality
- Reduces prep burden: DMs describe the NPC once; the agent maintains the voice
- Over time builds a "character bible" per NPC without manual effort

**Training approach:** Prompt engineering. The NPC schema already contains rich fields (description, secrets, role, faction). No RAG or fine-tuning required for MVP — system prompt + NPC JSON is sufficient for a 7B model.

**Model routing:** Ollama-first (fast, cheap, no latency). Fallback to Gemini Flash if Ollama unavailable.

**Priority:** BETA — high DM delight, low complexity, uses existing NPC data.

**Implementation:**
- New tRPC procedure: `npcs.generateDialogue({ npcId, sceneContext, numOptions })`
- Synchronous (no queue) — DM waits 2–4 seconds inline
- Response cached to Redis for 30 minutes per `(npcId, sceneContext)` key

---

#### Agent 3: Post-Session Hook Generator

**Purpose:** After a session ends and the recap is generated, automatically produce 3–5 "next session hooks" — potential story directions, unresolved threads, and NPC motivations that the DM can choose to pursue.

**Data access:**
- Current session `aiSummary` and `aiHighlights`
- Previous 2 session summaries (continuity)
- Active NPCs with `secrets` field (unfollowed threads)
- `Character` backstories and `bonds`/`flaws`/`ideals` fields

**How it improves DM/player experience:**
- Removes the most common DM anxiety: "what do I do next session?"
- Hooks are grounded in what actually happened at the table (not generic)
- Players feel their decisions mattered — hooks reference their specific choices

**Training approach:** Prompt engineering. Chained output from the Session Recap Agent — hooks are generated as a second pass using the recap as input, not the raw transcript.

**Model routing:** Gemini Flash or GPT-4o-mini preferred (better at creative divergent thinking); Ollama fallback.

**Priority:** BETA — extends Session Recap Agent with minimal extra work, very high perceived value.

**Implementation:**
- Add a second stage to the `ai-summary` BullMQ job (after summary complete, enqueue a `session-hooks` job)
- Store result in `GameSession.aiHooks: Json?` — array of `{ hook: string, type: 'npc_thread' | 'pc_arc' | 'world_event' | 'cliffhanger' }`
- Surface in the Session detail page as a collapsible "Next Session Ideas" panel

---

### MVP (v1.x — first 3 months post-beta)

---

#### Agent 4: Plot Continuity Agent

**Purpose:** Maintain a living "story bible" for the campaign — a structured list of open plot threads, resolved threads, NPC relationship changes, and world-state facts. Automatically updated after each session recap.

**Data access:**
- All `GameSession.aiSummary` records for the campaign (ordered by session number)
- `NPC` table (faction, role)
- `Character` records (backstory, bonds, flaws)
- The campaign's previous `plotThreads` state (from the `Campaign.settings` JSON or a new `CampaignContext` table)

**How it improves DM/player experience:**
- "Campaign amnesia" is the #1 pain point for long-running campaigns: DMs forget what they promised, players forget their character motivations
- A single-page plot bible generated and updated after every session gives the DM a reliable briefing before prep begins
- Players get a "story so far" page that never goes stale

**Training approach:** Structured extraction via prompt engineering. Agent is given all session summaries and current thread list; it outputs a JSON diff: `{ opened: [...], closed: [...], changed: [...] }`. Deterministic format makes it easy to store and display.

**Model routing:** Gemini Pro or GPT-4o (complex multi-document reasoning); Ollama fallback for small campaigns.

**Priority:** MVP — high value, moderate complexity.

**Schema additions:**
```prisma
model CampaignPlotThread {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(...)
  title       String
  description String   @db.Text
  status      String   @default("open") // open | resolved | dormant
  sessionOpened Int
  sessionClosed Int?
  relatedNpcs  String[] // NPC ids
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Pipeline position:** Runs after Session Recap Agent completes (BullMQ parent/child job).

---

#### Agent 5: Encounter Difficulty Advisor

**Purpose:** Enhance the existing Encounter Generator with a real-time difficulty assessment that factors in party resource state (spell slots, HP, daily abilities used) rather than just XP budget.

**Data access:**
- `EncounterPlan` and `Encounter` records
- `Character.hitPoints`, `Character.spellcasting` (current state)
- Session encounter history (how many encounters today?)
- SRD monster data (already imported)
- `Transcript` (to infer resource expenditure from recent play)

**How it improves DM/player experience:**
- XP budget alone is a blunt tool — a "medium" encounter after a deadly fight is actually deadly
- Advisor outputs a recommended difficulty adjustment and explains why: "Party used 3rd-level spell slots in the last encounter — consider reducing from Hard to Medium"
- Catches "death spiral" scenarios before they happen

**Training approach:** Hybrid. XP/CR math is deterministic (existing `encounter-calculator.ts`). Natural language advisory layer is prompt engineering. No fine-tuning needed.

**Priority:** MVP — extends existing encounter infrastructure, prevents a common DM mistake.

---

#### Agent 6: Player Engagement Tracker

**Purpose:** Analyze session transcripts to detect which players/characters had the most and least spotlight time, and suggest ways to bring quieter players into future sessions.

**Data access:**
- `Transcript` segments with `speakerLabel` (AssemblyAI diarization)
- `CampaignCharacter` (player-character mapping)
- Last 3 sessions' transcript data

**How it improves DM/player experience:**
- Quieter players often disengage without the DM noticing
- Weekly report: "Tara (Lyra) spoke for 8% of session 12 vs her 23% average — consider giving her a personal scene"
- Concrete, data-driven instead of vague intuition

**Training approach:** Mostly analytics (speaker time aggregation), with a small prompt-engineering layer to generate the actionable suggestion text.

**Priority:** MVP — uses existing transcript data, no new AI infrastructure needed.

**Implementation:** Runs as a post-session analysis job. Stores engagement scores in `GameSession.engagementStats: Json?`.

---

### v2 (6+ months post-beta)

---

#### Agent 7: Campaign Arc Suggester

**Purpose:** After 5+ sessions, analyze the campaign's story shape and suggest macro-level arc structures: rising action, midpoint revelations, climax candidates, and potential endings. Draws on narrative theory (three-act, six-beat, five-room dungeon patterns).

**Data access:**
- All session summaries and plot threads (from Plot Continuity Agent)
- NPC roster with relationship map
- Campaign description and settings

**Training approach:** RAG + prompt engineering. Inject narrative theory documents (three-act structure, story beats) as retrieved context alongside campaign history.

**Model routing:** GPT-4o or Gemini Pro — needs the strongest reasoning for multi-session narrative analysis.

**Priority:** v2 — requires campaign history depth, best after 5+ sessions exist.

---

#### Agent 8: Rules Lookup Agent (Enhance Existing)

**Purpose:** Upgrade the existing `rules.service.ts` (single-turn RAG) into a conversational agent that handles follow-up questions, rule interactions ("can I do X while also doing Y?"), and cites the specific source page.

**Data access:**
- `Embedding` table with `entityType = 'rules'` (existing)
- `HomebrewPDF` indexed sources (existing)
- Conversation history (short-term memory via Redis session)

**Training approach:** Agentic RAG — agent decides whether to retrieve, can issue multiple retrieval queries, and synthesizes a combined answer. Uses the existing pgvector pipeline.

**Priority:** v2 — the single-turn version ships at beta. Conversational version is a significant UX upgrade for v2.

---

## 2. Agent Architecture

### Standalone vs. Multi-step

Most QuiverDM agents should be **single-stage async workers** (one well-constructed prompt, one LLM call, structured JSON output). This is sufficient for 90% of cases and has predictable cost and latency.

The exceptions that benefit from **multi-step tool-calling chains**:
- Plot Continuity Agent: reads all past summaries → extracts threads → diffs against current state → writes update (3 steps)
- Rules Lookup Agent v2: query → retrieve → check sufficiency → optionally re-query → synthesize (up to 5 steps)
- Campaign Arc Suggester: retrieve narrative context → generate arc options → score against campaign facts (3 steps)

For multi-step agents, apply a hard **reasoning budget**: max 5 tool calls, max 3 retrieval cycles per invocation. This keeps costs predictable and prevents runaway loops.

### Context Sharing — Campaign DB as Source of Truth

Every agent reads campaign state from PostgreSQL via Prisma. No agent stores intermediate state in memory between runs. The pattern:

```
Agent invoked (BullMQ job)
  → Read campaign context from DB (sessions, NPCs, characters, plot threads)
  → Build context-rich prompt
  → Call LLM provider
  → Parse structured JSON response
  → Write result back to DB
  → Emit webhook event (optional)
```

This means agents are **stateless compute** over a **stateful DB**. Any agent can be retried, re-run, or parallelized safely.

### Real-time vs. Async

| Agent | Mode | Rationale |
|-------|------|-----------|
| Session Recap Agent | Async (BullMQ) | Long transcript, 10–60s latency acceptable post-session |
| Post-session Hook Generator | Async (BullMQ, chained) | Runs after recap, user is not waiting |
| NPC Voice Agent | Synchronous (inline tRPC) | DM needs answer during play, 2–4s acceptable |
| Plot Continuity Agent | Async (BullMQ, after recap) | 30–90s acceptable, runs in background |
| Encounter Difficulty Advisor | Synchronous (inline tRPC) | DM needs answer during prep, 2–5s acceptable |
| Player Engagement Tracker | Async (BullMQ, post-session) | Report delivered after session ends |
| Campaign Arc Suggester | Async (BullMQ, on-demand) | User triggers explicitly, 30–120s acceptable |
| Rules Lookup Agent | Synchronous (inline tRPC) | Immediate Q&A during play |

### Local (Ollama) vs. Cloud Routing Strategy

Follow a **local-first with policy-based cloud escalation** approach:

```
function selectProvider(task: AgentTask): Provider {
  // Prefer local for short, structured tasks
  if (task.estimatedTokens < 8000 && task.requiresCreativity === false) {
    return 'ollama';
  }
  // Use cloud for long-context or high-creativity tasks
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'ollama'; // always try
}
```

**Model assignments by task type:**

| Task type | Recommended model | Rationale |
|-----------|-------------------|-----------|
| Structured extraction (JSON output) | Ollama llama3.1 8B or Gemini Flash | Fast, cheap, good at structured formats |
| Creative prose (dialogue, hooks, scene descriptions) | Gemini Flash or GPT-4o-mini | Better at tone, voice, variety |
| Long-context reasoning (plot continuity, arc) | Gemini Pro 1.5 or GPT-4o | 128k+ context window needed |
| Rules Q&A (precise, grounded) | Ollama Mistral or GPT-4o-mini | Low temperature, citation-focused |

The existing `callProvider()` pattern in `encounter-generator.ts` should be extracted into a shared `src/lib/ai/provider-router.ts` module and reused by all agents.

---

## 3. How Many Agents — Beta vs. v2

### Beta: 3 agents

1. Session Recap Agent (enhanced)
2. NPC Voice Agent (new)
3. Post-session Hook Generator (new, chained from recap)

**Rationale:** These three deliver the clearest DM value, reuse existing infrastructure (BullMQ, Ollama, existing NPC/session schema), and require no schema migrations. They are all achievable in 1–2 weeks of focused development.

### MVP (v1.x): +3 agents = 6 total

4. Plot Continuity Agent
5. Encounter Difficulty Advisor
6. Player Engagement Tracker

**Rationale:** These require modest schema additions (plot threads table, engagement stats JSON field) and deliver the next tier of DM value. They deepen retention — DMs who see their campaign tracked longitudinally are much harder to churn.

### v2: +2 agents = 8 total

7. Campaign Arc Suggester
8. Rules Lookup Agent v2 (conversational upgrade)

**Rationale:** These require either significant campaign history (arc suggester) or multi-turn agent loops (rules v2). Best introduced after the community has validated the simpler agents.

**Value per implementation cost (ordered):**

1. NPC Voice Agent — highest ratio. 1–2 days work, immediately useful every session.
2. Post-session Hook Generator — 1–2 days, nearly free (chained from recap).
3. Session Recap Agent (enhanced) — 2–3 days, transforms existing feature into genuine value.
4. Player Engagement Tracker — 2–3 days, purely analytics over existing data.
5. Encounter Difficulty Advisor — 3–5 days, extends existing encounter builder.
6. Plot Continuity Agent — 5–7 days, new schema + complex prompt.
7. Rules Lookup Agent v2 — 5–7 days, multi-turn loop adds complexity.
8. Campaign Arc Suggester — 7–10 days, requires campaign history + complex reasoning.

---

## 4. Agent Interaction / Handoffs

### Pipeline Diagram

```
[Session ends]
      |
      v
[Transcription complete] ——————————————————> [Player Engagement Tracker]
      |                                              (async, parallel)
      v
[Session Recap Agent]
  reads: transcript, prior summaries, NPC list, character list
  writes: GameSession.aiSummary, aiHighlights
      |
      v
[Post-session Hook Generator]           ——> [Webhooks]
  reads: aiSummary, aiHighlights,            (notify integrations)
         NPC secrets, character bonds
  writes: GameSession.aiHooks
      |
      v
[Plot Continuity Agent]
  reads: all session summaries, current plot threads
  writes: CampaignPlotThread records (open/close/update)
      |
      v
[Campaign Arc Suggester] (on-demand, triggered by DM)
  reads: all plot threads, all session summaries
  writes: displayed in UI, not persisted long-term
```

### BullMQ Job Chain

Use BullMQ's `FlowProducer` for the parent/child chain:

```typescript
// After transcription completes:
await flowProducer.add({
  name: 'session-recap',
  queueName: 'ai-summary',
  data: { sessionId },
  children: [
    {
      name: 'session-hooks',
      queueName: 'session-hooks',
      data: { sessionId },
      children: [
        {
          name: 'plot-continuity',
          queueName: 'plot-continuity',
          data: { campaignId, sessionId },
        },
      ],
    },
    {
      name: 'player-engagement',
      queueName: 'player-engagement',
      data: { sessionId, campaignId },
    },
  ],
});
```

Parent jobs wait for children to complete before being marked done. This gives the DM a single "processing" indicator and a single "ready" notification when all post-session agents have finished.

### Real-time Agents (No Queue)

NPC Voice Agent and Encounter Difficulty Advisor are invoked synchronously via tRPC. They do not participate in the BullMQ pipeline. They are independent, stateless tools.

---

## 5. Database as Source of Truth

### Schema Additions Required

**For Plot Continuity Agent:**
```prisma
model CampaignPlotThread {
  id             String   @id @default(cuid())
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  title          String
  description    String   @db.Text
  status         String   @default("open") // open | resolved | dormant
  sessionOpened  Int
  sessionClosed  Int?
  relatedNpcIds  String[] // NPC.id references
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([campaignId])
  @@index([status])
}
```

**For Session Recap Agent (enhanced) and Hooks:**
```prisma
// Additions to GameSession model:
aiHooks          Json?   // [{hook, type: 'npc_thread'|'pc_arc'|'world_event'|'cliffhanger'}]
aiHooksStatus    String  @default("none") // none|pending|done|error
engagementStats  Json?   // [{characterId, characterName, speakingFraction, avgFraction, delta}]
```

**For NPC Voice Agent (caching):**
No schema change. Responses cached in Redis with `npc:{id}:voice:{hash}` key, 30-minute TTL.

**For Encounter Difficulty Advisor:**
No schema change. Uses existing `Character.hitPoints`, `Character.spellcasting`, and `Encounter` records.

### Read/Write Safety

- All agent writes use Prisma transactions where multiple fields are updated together
- Agents never overwrite each other's fields (each owns distinct columns)
- The `aiSummaryStatus` / `aiHooksStatus` pattern (none → pending → processing → done | error) is the standard state machine for all async agents
- Workers use `concurrency: 1` per queue to prevent duplicate processing of the same session

### Caching Strategy

| Cache type | Location | TTL | Use case |
|------------|----------|-----|----------|
| Rules lookup | Redis | 600s | Repeat rules questions in session |
| NPC dialogue | Redis | 1800s | Same scene context, same NPC |
| Encounter advice | Redis | 300s | Same party state + encounter config |
| Session context bundle | Redis | 3600s | Shared across recap + hooks + continuity agents in same pipeline run |
| Plot threads | PostgreSQL | Permanent | Source of truth, no TTL |

The **session context bundle** is the key optimization: when the recap job runs, it assembles the full campaign context (NPCs, prior summaries, characters) and caches it in Redis. The hooks job and continuity job read from cache, saving 3–5 DB round trips per pipeline run.

---

## 6. Implementation Priorities — Recommended Sequence

### Sprint 1 (1–2 weeks): NPC Voice Agent + Hook Generator

These are the fastest wins. NPC Voice requires no queue, no schema change — just a new tRPC procedure calling the existing `chatWithOllama`. Hook Generator is a second BullMQ job that reads the completed `aiSummary` and writes `aiHooks`.

**Deliverables:**
- `npcs.generateDialogue` tRPC procedure
- NPC Dialogue UI panel on NPC detail page
- `session-hooks` BullMQ queue + worker
- "Next Session Ideas" panel on Session detail page

### Sprint 2 (2–3 weeks): Enhanced Session Recap + Context Bundle

Upgrade the existing summary worker to pass NPC list + prior summaries. Extract the `callProvider()` pattern into a shared `provider-router.ts`. Build the Redis context bundle for pipeline efficiency.

**Deliverables:**
- `src/lib/ai/provider-router.ts` (shared across all agents)
- Enhanced `ai-summary-worker.ts` with campaign context injection
- Redis context bundle cache

### Sprint 3 (3–5 weeks): Plot Continuity Agent + Player Engagement Tracker

Add `CampaignPlotThread` schema. Build the continuity agent as a BullMQ child job. Build the engagement tracker as a parallel post-session job that aggregates speaker time from transcript segments.

**Deliverables:**
- `CampaignPlotThread` migration
- `plot-continuity` BullMQ queue + worker
- `player-engagement` BullMQ queue + worker
- Campaign "Story Bible" page showing open/closed threads
- Session engagement report component

---

## 7. Key Design Principles

**1. Agents are async by default.** DMs do not wait for agent results except for inline tools (NPC dialogue, rules lookup). Post-session pipeline runs in the background.

**2. Structured JSON output everywhere.** Every agent returns a typed JSON object. This makes results displayable, storable, diffable, and auditable. Avoid free-form markdown from agents except for prose fields (summaries, dialogue).

**3. DB is the only shared state.** Agents never communicate directly. Agent A writes to DB; Agent B reads from DB. This makes the system debuggable and retry-safe.

**4. Local-first, cloud on demand.** Ollama handles structured extraction and short-context tasks at zero variable cost. Cloud providers handle long-context reasoning and creative tasks. Users who supply their own API keys (already supported via `UserSettings`) get better results automatically.

**5. Fail gracefully.** Every agent has a `status` field that surfaces failure to the UI. A failed plot continuity agent does not break session recap. Workers retry up to 3 times with exponential backoff before marking error.

**6. Reasoning budgets.** Multi-step agents enforce hard caps: max 5 tool calls, max 3 retrieval iterations. This prevents cost runaway and makes agent behavior predictable.

---

## References

- [AI Agent Orchestration Patterns — Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [A Practical Guide to AI Agent Architectures — Speakeasy](https://www.speakeasy.com/mcp/ai-agents/architecture-patterns)
- [Multi-Agent Collaboration Patterns — AWS](https://aws.amazon.com/blogs/machine-learning/multi-agent-collaboration-patterns-with-strands-agents-and-amazon-nova/)
- [Tool RAG: The Next Breakthrough in Scalable AI Agents — Red Hat](https://next.redhat.com/2025/11/26/tool-rag-the-next-breakthrough-in-scalable-ai-agents/)
- [Context Window Management for Long-Context Agents — Maxim](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [Observational Memory Cuts AI Agent Costs 10x — VentureBeat](https://venturebare.com/data/observational-memory-cuts-ai-agent-costs-10x-and-outscores-rag-on-long)
- [BullMQ FlowProducer — docs.bullmq.io](https://docs.bullmq.io/)
- [Local LLM vs Cloud Cost Optimization — Ollama review, Sider AI](https://sider.ai/blog/ai-tools/is-ollama-the-best-local-llm-runner-in-2025-a-no-hype-review)
- [RAG Architecture in 2025 — orq.ai](https://orq.ai/blog/rag-architecture)
- [Agentic RAG: Building Private Data Systems — Intuz](https://www.intuz.com/blog/how-to-build-agentic-rag-system)
- [D&D AI Tools for DMs — The Enchanted Scribe](https://www.the-enchanted-scribe.com/post/the-7-best-ai-tools-for-dms-that-will-transform-your-d-d-campaign)
- [LoreKeeper — AI Campaign Manager](https://lorekeeper.ai/)
