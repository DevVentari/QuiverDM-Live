---

kanban-plugin: board

---

## 🔴 Now — Alpha Launch Blockers

- [x] **E2E — DM Brain** — Three-layer test coverage. (1) Playwright `brain.workflow.spec.ts`: extend with seed→entities-appear flow, entity detail page (relationships + properties sections), hook resolve removes from list, entity list navigation — add `data-testid` attrs to EntityCard/HookList/seed button. (2) Vitest integration test `tests/services/brain-ingestion.test.ts`: call `processBrainIngestionJob` directly with mocked `chatWithAI` returning deterministic JSON, assert entities/hooks created in DB. (3) `veteran-dm.persona.spec.ts`: add brain-seeded-and-accessible checkpoint. Session Cockpit E2E tabled — cockpit deprioritised. Persona: veteran-dm (Vic) primary.


## 🟡 Next — Post-Alpha

- [x] **Market Pricing & Position Validation** — Pricing tiers needed before paid tier opens. Not blocking alpha. Refs: `docs/obsidian-vault/10-Research/2026-02-24-deep-market-research-matrix.md`
- [x] **Gemini API — Per-User Key** — geminiApiKey added to UserSettings (encrypted). Settings page shows "Free tier" badge with 1,000 req/day callout. Extraction pipeline uses user key with server env fallback. Refs: `docs/plans/2026-03-01-alpha-readiness-impl.md`


## 🟢 Later — Backlog

- [x] **Mobile E2E Test Suite** — Playwright tests covering every major UI page at 390x844 (iPhone 14) viewport. Checks: no horizontal overflow, no clipped elements, campaign nav scrolls correctly, key actions visible and tappable. Pages: dashboard, campaigns list, campaign overview, sessions list, session detail, NPC list/detail, homebrew, members, settings, characters, prep wizard. Auth helper reuses saved storage state. Screenshots saved to `docs/screenshots/mobile/`.

- [ ] **Phase 7 — Creator Economy** — Monetization and creator economy layer. Spec TBD.
- [x] **Phase 6 — Autonomous Story Worlds** — Self-generating narrative ecosystem: causal world simulation running continuously between sessions. World Motivation Engine (factions/gods/regions/disasters each carry goal+urgency+resources+risk_tolerance, evaluated each tick). Continuous simulation loop (detect instability → actor actions → events → consequences → timeline update). Emergent events caused by world state, not random tables. Story Pressure system (political/supernatural/economic/cosmic/social tracks — threshold breach triggers major arc events). Autonomous adventure hooks generated from world state. Dynamic arc construction (Act I-IV detected from pattern history). NPC autonomous lives between sessions. Player-driven gravity (party behavior shapes probability fields — world learns and adapts). Parallel storylines evolve independently when ignored. Mythogenesis engine writes legend cycles from simulation history. Architecture: Autonomous Story Engine → Living World Simulation → DM Brain → Co-DM → Session Mode. Refs: `docs/obsidian-vault/20-Brainstorm/autonomous-story-worlds.md`
- [x] **Phase 5 — DM Brain** — Persistent world-state intelligence layer: the load-bearing substrate between Co-DM and Autonomous Story Worlds. Entity graph (NPC/PC/Faction/Location/Item/Event nodes + typed relationship edges with history). Per-entity state versioning (stress, loyalty, motivation, secrets, location — each change traced to source session + trigger). World State Registers (faction influence scores, regional stability, pressure tracks, unresolved hooks with age + urgency). Ingestion pipeline: background worker extracts entities from session summaries + transcripts post-session, entity resolution collapses aliases to single nodes using F2 embedding similarity. Inference layer: relationship drift detection, threat trajectory projection, hook decay escalation. Query API consumed by Co-DM + Story Worlds. DM-facing surface: entity graph explorer + faction influence chart + pressure gauges + unresolved hooks list. Bootstrap: can backfill from historical summaries. New Prisma models: WorldEntity, WorldRelationship, WorldStateChange, WorldState. New workers: brain-ingestion-worker, brain-inference-worker. Refs: `docs/obsidian-vault/20-Brainstorm/dm-brain.md` PR: #123
- [x] **Phase 4 — Autonomous Co-DM** — Real-time narrative operator inside Session Mode, powered by DM Brain. Simultaneously: observes (NPC names spoken, goals, threats, HP trends, pacing), predicts (combat drag alerts, engagement drops, escape likelihood), autonomously updates NPC behavior (goals/fear/loyalty/secrets), generates world-consistent improv content on demand, manages encounter autopilot (conditions, recharge, initiative), guards lore continuity, propagates world reactions between sessions, detects table emotional state (spotlight imbalance, boredom). Confidence-threshold UI (silent → hint → highlight → alert). Four permission levels: Manual → Assist → Auto Mechanical → Full Co-DM. Architecture: Context Stream → Decision Models → Action Generator → Session UI. Refs: `docs/obsidian-vault/20-Brainstorm/autonomous-co-dm.md`
- [x] **Phase 3 — Session Mode Dashboard** — Full-screen play UI: party HP/conditions/initiative panel, live scene notes with AI overlay (auto-updates from transcription), zero-friction NPC recall, combat mode (UI morphs in place — no navigation), DM panic tools (roll, generate NPC, suggest twist), real-time AI context alerts, end-session one-click pipeline (summary → journals → NPCs → timeline → prep tasks). No page switching. Everything live. Refs: `docs/obsidian-vault/20-Brainstorm/session-mode-dashboard.md` PR: #125
- [x] **API Usage & Cost Page** — `/settings/api-usage` — per-provider summary cards (Gemini/OpenAI/Anthropic/Ollama), breakdown by feature and model, recent call log, period selector. Internal tracking via `ApiUsageLog` model + optional provider API sync. Refs: `docs/plans/2026-03-07-api-usage-cost-page-design.md`
- [x] **Session Continuity Graph** — Persistent NPC/quest/state graph, surfaces unresolved threads between sessions.
- [x] **Voice-Driven App Interaction** — Full app voice layer: DM Brain guides session prep via text-to-speech questions (who's in this adventure, strong start, encounter hooks), DM responds via speech-to-text, AI works through each prep step conversationally. Plus ambient voice navigation across the whole app for immersive feel at the table — hands-free NPC lookup, dice rolls, scene notes. Stack candidates: Web Speech API (STT), ElevenLabs/browser TTS for DM Brain voice. Core flows: voice session prep wizard, push-to-talk cockpit commands, voice search for NPCs/homebrew.
- [x] **Design Language Unification** — Amber accent system fully applied across all pages: sidebar grain, overline labels + amber separator rules on dashboard/campaign overview/NPC/sessions/homebrew, glass-panel cards throughout, prep wizard uses Tailwind tokens. All create pages redesigned.
- [x] **Player Recap Mode** — 90-second player-safe summary generated after each session.
- [x] **Derailment Detector** — Detects objective drift mid-session, surfaces 2-3 GM recovery options.
- [x] **Device-Side Transcription** — Replaced AssemblyAI WebSocket pipeline with browser-native Web Speech API. Zero server transcription cost. Text-only saved via `saveWebSpeechTranscript` tRPC mutation. Tier limits removed. Chrome/Edge supported; Firefox shows graceful fallback. Async file-upload path (WhisperX/AssemblyAI) retained as optional post-session feature.
- [x] **Source-Aware AI Prompting** — AI summary worker detects `web_speech` transcript source and injects context addendum: tolerate transcription errors, skip speaker attribution, focus on narrative events. Propagates to player recap and brain ingestion via summary quality.


## 💡 Ideas — Not Yet Scoped

- [ ] **Cross-Project API Billing Tracker** — Standalone dashboard (n8n + Postgres + web UI) that polls billing APIs across all projects (QuiverDM, Websites, SmartDrifter, nerdt infra) daily and aggregates spend + all credentials. Hosted on LXC 402/603. Refs: `docs/plans/2026-03-04-api-billing-tracker-design.md`
- [ ] **OpenClaw — Discord Autonomous Agent** — Self-hosted always-on agent accessible via Discord. Heartbeat system for proactive tasks (deployment checks, kanban summaries, reminders). Run in Docker, no ClawHub skills (security risk). Uses Claude/Ollama as model backend. Evaluate as complement to Claude Code workflow, not replacement.
- [ ] Foundry two-screen co-pilot — real-time event sync between Foundry and QuiverDM
- [ ] Shared campaign journal (player-facing write access)
- [ ] Voice-activated DM assistant (push-to-talk during session)
- [ ] Encounter replay / timeline scrubbing from transcript
- [ ] **Salad GPU Farm for AI Workflows** — Evaluate SaladCloud distributed GPU cloud for batch AI workloads (extraction, embeddings, summaries). RTX 4090 at $0.16/hr, RTX 3060 at $0.06/hr, no egress fees. Spin up on demand for heavy jobs, fall back to local GTX 1080 or CPU. Compare cost vs local GPU vs Gemini API for extraction pipeline. Batch priority tier for cost-sensitive non-real-time work.
- [ ] **Workflow Analytics Dashboard** — Metrics and monitoring across all QuiverDM workflows: PDF processing (Docling vs pdfplumber, success/fail rates, conversion times), AI extraction (provider usage, token spend, extraction quality), transcription jobs, session summaries, webhook delivery, worker health. Surface trends, error rates, and cost per operation. Could integrate with API Billing Tracker or standalone admin page.


## ✅ Done

- [x] Campaigns, sessions, NPCs, characters, homebrew (core CRUD)
- [x] Auth, billing (Stripe), transactional email
- [x] D&D Beyond character import
- [x] MeiliSearch full-text search
- [x] Homebrew Effects — structured effects, character active effects panel, DM hints overlay
- [x] Comprehensive test suite (Playwright E2E + Vitest)
- [x] Vercel Deployment — standalone output, R2 storage redirect, presigned upload rewrite
- [x] DnD Beyond Homebrew Import — full implementation: router, service, repository, UI dialog, page button
- [x] **Design System v1 — Dashboard** — Active campaign hero, background depth, section renames, campaign card upgrades.
- [x] **Design System v1 — Homebrew Formatting** — Fix raw HTML in detail views, uniform section layout, AI-detected custom sections.
- [x] **Expanded Usage Caps & Cost Guardrails** — PDF/session/transcription caps enforced, 80% threshold admin email alerts, 4 new settings meters.
- [x] **Combat Condition Co-pilot** — Auto-track HP, concentration, conditions from transcript.
- [x] **Foundry Sidecar Bridge MVP** — Schema, API routes, tRPC router, SSE stream, UI, foundry-module/ scaffold.
- [x] **Foundry Import Plugin** — QuiverDM → Foundry push (NPCs, macros, journal entries).
- [x] **Vercel Deployment (infra)** — App live at app.nerdt.au. Neon keepalive cron added to prevent 504 timeouts.
- [x] **Autonomous Character Sheet** — Phase 1: expanded effect schema (19 mechanic types), AI extraction pipeline, effect resolver service, ResolvedStatsSummary on character sheet. Phase 2: SessionMechanicalEvent + CharacterSessionState models, session-events worker (Levenshtein fuzzy matching, confidence thresholds), live cockpit HP/conditions, DM event review queue, post-session commit to character sheets. Refs: `docs/plans/2026-03-02-autonomous-character-sheet-design.md`
- [x] **Character Builder** — Tabbed character creation (Details/Race/Class/Background/Scores) with SRD 5.1 data (9 races, 12 classes, 13 backgrounds) + user homebrew library options. Standard Array, Point Buy, and Manual score entry. Live preview panel.
- [x] **Session Start Flow** — Merged Start Session + Launch Session into single same-tab flow. In-progress sessions show Continue Session. Cockpit End Session opens confirmation dialog (Keep Playing / End Session) that completes session and redirects.
- [x] **Create Pages Redesign** — New campaign, session, NPC, and character create pages redesigned with two-column layout (sticky preview + form), glass-panel styling, drag-drop portrait upload.


## Feedback/Bugs

- [x] Character Sheets - move health speed prof init above quick actions; mobile matches; spell slot tracking; currency/equipped/attuned icons; inline shorthand for quick actions/spells; remove hero section in campaign overview.
- [x] NPC list shows "No NPCs yet" after creation (stale 2min cache — fixed d238e05)
- [x] Browser tab title always reads "Dashboard" regardless of current page (fixed bb55778)
- [x] PDF upload page shows no file size/type limits before upload (Dana, 2026-03-02)
- [x] NPC form missing D&D 5e stat block fields — no CR, HP, AC, ability scores, actions (Vic, 2026-03-02)
- [x] Feedback widget screenshot shows "No screenshot" — html2canvas capture failing silently (Dana, 2026-03-02)
- [x] campaigns.create returns HTTP 429 for tier-limit errors instead of semantic code (Nora, 2026-03-02)
- [x] favicon.ico returns 404 (Nora, 2026-03-02)
- [x] New campaign creation only seeded DM Brain from onboarding or adventure templates; `/campaigns` flow now captures world seed inputs and has real seed coverage (fixed 2026-05-05)




%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false]}
```
%%
