---

kanban-plugin: board

---

## 🔴 Now — Alpha Launch Blockers

- [ ] **Vercel Deployment (infra)** — App needs to be live for friends & family alpha. Provision: Neon, Upstash, Cloudflare R2 + Tunnel, Vercel account. Refs: `docs/plans/2026-02-24-vercel-deployment.md`


## 🟡 Next — Post-Alpha

- [ ] **Market Pricing & Position Validation** — Pricing tiers needed before paid tier opens. Not blocking alpha. Refs: `docs/obsidian-vault/10-Research/2026-02-24-deep-market-research-matrix.md`


## 🟢 Later — Backlog

- [ ] **Phase 7 — Creator Economy** — Monetization and creator economy layer. Spec TBD.
- [ ] **Phase 6 — Autonomous Story Worlds** — Self-generating narrative ecosystem: causal world simulation running continuously between sessions. World Motivation Engine (factions/gods/regions/disasters each carry goal+urgency+resources+risk_tolerance, evaluated each tick). Continuous simulation loop (detect instability → actor actions → events → consequences → timeline update). Emergent events caused by world state, not random tables. Story Pressure system (political/supernatural/economic/cosmic/social tracks — threshold breach triggers major arc events). Autonomous adventure hooks generated from world state. Dynamic arc construction (Act I-IV detected from pattern history). NPC autonomous lives between sessions. Player-driven gravity (party behavior shapes probability fields — world learns and adapts). Parallel storylines evolve independently when ignored. Mythogenesis engine writes legend cycles from simulation history. Architecture: Autonomous Story Engine → Living World Simulation → DM Brain → Co-DM → Session Mode. Refs: `docs/obsidian-vault/20-Brainstorm/autonomous-story-worlds.md`
- [ ] **Phase 5 — DM Brain** — Persistent world-state intelligence layer: the load-bearing substrate between Co-DM and Autonomous Story Worlds. Entity graph (NPC/PC/Faction/Location/Item/Event nodes + typed relationship edges with history). Per-entity state versioning (stress, loyalty, motivation, secrets, location — each change traced to source session + trigger). World State Registers (faction influence scores, regional stability, pressure tracks, unresolved hooks with age + urgency). Ingestion pipeline: background worker extracts entities from session summaries + transcripts post-session, entity resolution collapses aliases to single nodes using F2 embedding similarity. Inference layer: relationship drift detection, threat trajectory projection, hook decay escalation. Query API consumed by Co-DM + Story Worlds. DM-facing surface: entity graph explorer + faction influence chart + pressure gauges + unresolved hooks list. Bootstrap: can backfill from historical summaries. New Prisma models: WorldEntity, WorldRelationship, WorldStateChange, WorldState. New workers: brain-ingestion-worker, brain-inference-worker. Refs: `docs/obsidian-vault/20-Brainstorm/dm-brain.md`
- [ ] **Phase 4 — Autonomous Co-DM** — Real-time narrative operator inside Session Mode, powered by DM Brain. Simultaneously: observes (NPC names spoken, goals, threats, HP trends, pacing), predicts (combat drag alerts, engagement drops, escape likelihood), autonomously updates NPC behavior (goals/fear/loyalty/secrets), generates world-consistent improv content on demand, manages encounter autopilot (conditions, recharge, initiative), guards lore continuity, propagates world reactions between sessions, detects table emotional state (spotlight imbalance, boredom). Confidence-threshold UI (silent → hint → highlight → alert). Four permission levels: Manual → Assist → Auto Mechanical → Full Co-DM. Architecture: Context Stream → Decision Models → Action Generator → Session UI. Refs: `docs/obsidian-vault/20-Brainstorm/autonomous-co-dm.md`
- [ ] **Phase 3 — Session Mode Dashboard** — Full-screen play UI: party HP/conditions/initiative panel, live scene notes with AI overlay (auto-updates from transcription), zero-friction NPC recall, combat mode (UI morphs in place — no navigation), DM panic tools (roll, generate NPC, suggest twist), real-time AI context alerts, end-session one-click pipeline (summary → journals → NPCs → timeline → prep tasks). No page switching. Everything live. Refs: `docs/obsidian-vault/20-Brainstorm/session-mode-dashboard.md`
- [ ] **Session Continuity Graph** — Persistent NPC/quest/state graph, surfaces unresolved threads between sessions.
- [x] **Player Recap Mode** — 90-second player-safe summary generated after each session.
- [x] **Derailment Detector** — Detects objective drift mid-session, surfaces 2-3 GM recovery options.


## 💡 Ideas — Not Yet Scoped

- [ ] **Adopt Prep Wizard Aesthetic to Main UI** — The dark obsidian/amber candlelight palette, roman numeral sidebar, and atmospheric grain/vignette from the fullscreen prep wizard are strong. Evaluate porting to the dashboard, campaign overview, and session detail pages as an optional "immersive mode" or as the default dark theme.
- [ ] Foundry two-screen co-pilot — real-time event sync between Foundry and QuiverDM
- [ ] Shared campaign journal (player-facing write access)
- [ ] Voice-activated DM assistant (push-to-talk during session)
- [ ] Encounter replay / timeline scrubbing from transcript


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


## Feedback/Bugs

- [x] Character Sheets - move health speed prof init above quick actions; mobile matches; spell slot tracking; currency/equipped/attuned icons; inline shorthand for quick actions/spells; remove hero section in campaign overview.




%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false]}
```
%%