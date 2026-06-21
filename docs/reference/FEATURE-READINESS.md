# QuiverDM — Feature Readiness Catalog

**Status as of:** 2026-06-14 · **Milestone target:** 1.0-beta1
**Scope:** Every functional domain — how it works, how ready it is, how robust it is, and what's left for post-beta1.

> **How readiness is judged.** This catalog grounds each rating in observable artifacts, not vibes:
> - **Router** wired in `src/server/routers/_app.ts` (functional surface)
> - **Route/UI** page under `src/app/(app)/` (user-reachable)
> - **Worker** in `src/lib/queue/` (async backbone)
> - **Workflow spec** in `tests/workflows/` — *the project's "definition of done" gate*
> - **Persona spec** in `tests/personas/` — *the acceptance gate* (David/Vic/Jordan/Perry/Mila/Rex)
> - **DEV-flagged** — surfaced only under the CommandRail "DEV" section or `/dev/*` (work-in-progress)
>
> Ratings are inferred from these artifacts. **For the authoritative green/red, run `npm run qa:cycle`** — that executes the workflow + persona suites against a live stack. This doc tells you *what exists and how complete it is*; qa:cycle tells you *what passes right now*.

## Readiness legend

| Badge | Meaning |
|---|---|
| ✅ **Ready** | Router + UI + workflow spec all present; in main navigation; core path proven |
| 🟢 **Solid** | Fully wired and specced, but depends on an external service or has known edge gaps |
| ⚠️ **Functional, gaps** | Works end-to-end but missing a workflow spec, or thin coverage / rough edges |
| 🚧 **WIP / DEV** | Behind the DEV nav, unmerged, or no production UI yet |
| 🔌 **External-bound** | Correctness depends on a 3rd-party integration (DDB, Foundry, Stripe, Discord) |

---

## Part 1 — Readiness matrix

| Domain | Readiness | Workflow spec | Notes |
|---|---|---|---|
| Onboarding & first-run | ✅ | `new-dm`, `first-time-dm` (persona) | David's journey |
| Auth / invites / members | ✅ | `player-join` (persona) | invite accept → role |
| Campaigns & switching | ✅ | `campaign-create`, `campaign-switcher` | core spine |
| Home / dashboard | ✅ | `home.workflow` | session-first hero |
| NPCs | ✅ | `npc-detail-required-sections` | full stat-block NPCs |
| NPC Voiceover | ✅ | `npc-voiceover.workflow` | **current branch** `feat/npc-voiceover` |
| Players & Characters | ✅ | `character-sheet`, `homebrew-to-character` | sheet tabs |
| Sessions (core) | ✅ | `session-detail` | CRUD + lifecycle |
| Session Prep | ✅ | `session-prep`, `-briefing`, `-map`, `session0-autocreate` | prep wizard |
| Session Cockpit / Play | ✅ | `session-cockpit`, `session-play`, `session-scene-runner`, `session-intelligence-cockpit` | live session run |
| Combat (copilot) | ⚠️ | (via cockpit specs) | `combat-copilot` worker; no standalone combat-hub page |
| RecapForge (recaps) | ✅ | `recapforge-*` ×5, `recap-upload` | flagship pipeline |
| Transcription | 🟢 | `transcription-status`, `audio-upload`, `video-upload` | WhisperX dep |
| AI Summary | ✅ | `ai-summary.workflow` | multi-provider |
| DM Brain / world state | ✅ | `brain.workflow`, `brain-session-prep`, `continuity-graph` | ingestion + inference |
| Homebrew / Compendium | ✅ | `homebrew-chat-import`, `homebrew-pdf-upload-ui` | create/import/link |
| Sourcebook reader | ✅ | `sourcebook.workflow` | DDB chapter import |
| Mechanics | ✅ | `mechanics.workflow` | custom rules |
| Search | ✅ | `global-search.workflow` | MeiliSearch |
| Active effects | ✅ | `active-effects.workflow` | effect-resolver |
| Encounters / planner | ⚠️ | **missing** | router+UI exist; `encounter-ui-review` has skips |
| Import Hub | 🚧→✅ | `import-hub.workflow` | **unmerged** `feat/import-hub-integration` |
| D&D Beyond sync | 🔌 | `sourcebook`, `world-import` | needs `DDB_COBALT_SESSION` |
| Foundry VTT | 🚧🔌 | (none) | DEV nav; `foundry` router |
| World map | 🚧 | `world-map.workflow` | DEV nav; Three.js atmosphere |
| World entries / lore | ⚠️🚧 | `world-import`, `continuity-graph` | DEV nav |
| Quests | 🚧 | (none) | DEV nav; no dedicated router |
| Co-DM (autonomous) | ⚠️ | `co-dm.workflow` | AI agent; advanced |
| Story Worlds (sim) | 🚧 | `story-worlds.workflow` | autonomous world simulation |
| Voice interaction | 🟢 | `voice-interaction.workflow` | merged |
| Billing | 🟢🔌 | `billing` (conditional) | Stripe; tiers wired |
| Usage / quotas | ✅ | (via billing) | usage-tracking |
| Admin console | ⚠️ | `admin-console.workflow` | role-gated (skips when non-admin) |
| Feedback | ✅ | (route + triage worker) | feedback-triage |
| Settings | ✅ | covered across personas | 9 settings pages |
| Randomizer | ⚠️ | (none) | utility |
| Browser extension auth | ⚠️🔌 | (none) | `extension-auth` router |

**Counts:** 54 tRPC routers · 53 app routes · 32 background workers · ~38 services · 44 workflow specs · 7 persona specs.

---

## Part 2 — Domain detail

### Onboarding, Auth & Membership ✅
- **Function.** New-user signup (NextAuth v5 credentials), invite-code redemption, onboarding wizard (`onboarding` router/service, `onboardingCompleted` flag), campaign membership with roles (OWNER / CO_DM / player) via `members` + `invites`.
- **Workflow.** Signup → onboarding steps → first campaign → first NPC. Invitee: invite link → `join` page → role assignment.
- **Readiness.** ✅ Proven by `new-dm` (David) and `player-join` (Perry) personas.
- **Robustness.** Role checks centralized in `authorization.service` + typed errors (`ForbiddenError.forPermission`). Auth procedures gate by `ctx.membership`.
- **Post-beta1.** OAuth providers (currently credentials-first); team/seat management depth.

### Campaigns ✅
- **Function.** Campaign CRUD, active-campaign context (`useCampaign`), switching, settings, slug routing.
- **Workflow.** Create (`campaign-create-sheet`) → becomes active context → all nested features scope to `campaignId`.
- **Readiness.** ✅ `campaign-create` + `campaign-switcher` specs; spine of the app.
- **Robustness.** `campaign-context` provides `campaignId/slug/isDM` everywhere; legacy `userId` ownership kept for migration.

### NPCs + Voiceover ✅
- **Function.** Full D&D stat-block NPCs, detail/edit pages, required sections, behavior profiles (`npcBehaviorProfiles`), and **AI voiceover** (`voice` router → `voice-generation-worker` → `VoiceClip`).
- **Workflow.** Create NPC → entity sheet → DM voice playback row; brain hook auto-creates NPCs from world ingestion.
- **Readiness.** ✅ `npc-detail-required-sections` + `npc-voiceover.workflow` (current branch). Veteran-DM (Vic) persona covers full stat-block path.
- **Post-beta1.** Voiceover provider expansion; behavior-profile-driven dialogue.

### Players & Characters ✅
- **Function.** Player roster, player-owned characters, character sheet with tabs (incl. `CombatTab`), D&D Beyond character import (`characters-dndbeyond`).
- **Readiness.** ✅ `character-sheet` + `homebrew-to-character` specs; Jordan (power-dm) covers sheet tabs. DDB import path is 🔌 external-bound.

### Sessions: Prep → Cockpit → Recap (the core loop) ✅
This is the heart of the app and the most heavily specced area.
- **Prep.** `sessionPhases`/`sessionRoutes`/`prepSecrets` + prep wizard, AI briefing, prep map, Session-0 auto-create. Specs: `session-prep`, `-briefing`, `-map`, `session0-autocreate`, `brain-session-prep`, `session-intelligence-prep`.
- **Cockpit / live play.** `play` router + `play.service` + `session-state.service`; scene runner, combat copilot panel, initiative, active effects. Specs: `session-cockpit`, `session-play`, `session-scene-runner`, `session-intelligence-cockpit`, `active-effects`.
- **Recap (RecapForge).** `recap` router + `recap-generation-worker` + `player-recap-worker`; multi-style generation, editing, Discord preview, multi-track context. Specs: `recapforge-dashboard/-generation/-editing/-context/-multi-track`, `recap-upload`.
- **Readiness.** ✅ Deepest coverage in the codebase.
- **Robustness.** Async via BullMQ; status fields on `GameSession` (`prepStatus`, `aiSummaryStatus`, `playerRecapStatus`, `combatCopiloterStatus`, `derailmentStatus`) make each stage observably resumable.
- **Combat caveat:** ⚠️ combat runs inside the cockpit (`combat-panel.tsx`, `combat-copilot-panel.tsx`); there is **no standalone "combat hub" page** and no dedicated combat workflow spec — richer cockpit tools (initiative tracker, toolbar) sit unmerged on `feature/session-cockpit-enhancements`.

### Transcription & Audio/Video 🟢
- **Function.** Session recording upload, multi-track upload, speaker mapping, WhisperX transcription, transcript cleanup. Routers: `session-recordings`, `session-transcription`, `transcript`, `multi-track-upload`, `speaker-mapping`, `whisper`. Workers: `transcription-worker`, `multi-track-worker`, `transcript-cleanup-worker`.
- **Readiness.** 🟢 Specced (`transcription-status`, `audio-upload`, `video-upload`) but **external-bound** on WhisperX/crawl4ai availability on homelab.
- **Robustness.** Status surfacing spec exists; uploads chunked; cleanup is a separate worker stage.

### DM Brain / World State ✅
- **Function.** Ingest session content → extract entities/hooks/threats/secrets → infer world state. Routers: `brain`, `campaign-context`. Workers: `brain-ingestion-worker`, `brain-inference-worker`, `context-extraction-worker`, `secret-revelation-sync-worker`. Service: `brain.service`, pgvector embeddings (`embeddings-worker`).
- **Readiness.** ✅ `brain.workflow`, `brain-session-prep`, `continuity-graph`. Brain panel + entity pages live.
- **Post-beta1.** Deeper inference loops; secret-revelation automation.

### Homebrew / Compendium ✅
- **Function.** Create/edit homebrew (items, spells, creatures, etc.), PDF extraction pipeline, image generation, DDB import, media/photo import, compendium browsing & linking to campaigns. Routers: `homebrew`, `homebrew-pdf`, `homebrew-extraction`, `homebrew-image`, `homebrew-dndbeyond`. Workers: PDF worker, `image-generation-worker`, `visual-asset-worker`.
- **Readiness.** ✅ `homebrew-chat-import`, `homebrew-pdf-upload-ui`, `markdown-import`. Jordan persona covers PDF upload + create/link.
- **Post-beta1.** **Import Hub** (below) broadens sources.

### Import Hub 🚧→✅ (unmerged)
- **Function.** Multi-source import — Notion, Obsidian, World Anvil, Kanka, Campfire, Google Docs, Docx, Markdown — via `import-adapters` + `importHub` router + `import-job` worker + `ImportJob`/`SourceCredential` models.
- **Readiness.** Code-complete and verified: 0 tsc errors, 14/14 unit tests, schema migration **applied to homelab DB**, `import-hub.workflow.spec` written, live journey verified. **Sitting on `feat/import-hub-integration`, not yet merged to main.**
- **Post-beta1.** Merge → deploy `worker:import` to PM2; add per-source credential encryption hardening.

### Sourcebook Reader & DDB 🟢🔌
- **Function.** Import D&D Beyond sourcebook chapters, read in-app, extract scenes. Routers: `sourcebook-reader`, `sourcebook-scenes`, `ddb-sync`. Workers: `ddb-chapter-extract-worker`, `ddb-sync-coordinator-worker`, `ddb-sync-review-worker`, `sourcebook-scene-extraction-worker`. CLI: `scripts/create-master-sourcebook.ts`.
- **Readiness.** 🟢 `sourcebook.workflow`; **external-bound** on `DDB_COBALT_SESSION` (expires; refresh via `npm run ddb:refresh`).

### Search ✅
- **Function.** Global full-text search via MeiliSearch; `search` router + `meili-sync-worker` + `search.service`.
- **Readiness.** ✅ `global-search.workflow`. Robustness: index sync is a dedicated worker; reindex script exists.

### Mechanics ✅
- **Function.** Custom campaign rules/mechanics (`campaign-mechanics` router/service). Readiness ✅ `mechanics.workflow`.

### Encounters / Planner ⚠️
- **Function.** Encounter building + pre-session encounter plans. Routers: `encounters`, `encounter-plans`; services `encounter.service`, `encounter-plan.service`; routes under `campaigns/[slug]/encounters/*`.
- **Readiness.** ⚠️ **Gap: no `encounters.workflow.spec.ts`.** `encounter-ui-review.spec.ts` exists but contains `test.skip()`s. Per the project's Definition of Done, this is not "shipped" until a workflow spec lands.
- **Post-beta1 priority.** Write the encounters workflow spec; decide relationship to combat cockpit.

### D&D Beyond integration 🔌
Spans `characters-dndbeyond`, `homebrew-dndbeyond`, `ddb-sync`, sourcebook import. All gated on a valid Cobalt session cookie. **External-bound** — degrades when the cookie expires; needs monitoring/refresh runbook for beta.

### Foundry VTT 🚧🔌
- **Function.** `foundry` router + `foundry-export.ts`; export/sync to Foundry; route `campaigns/[slug]/foundry`.
- **Readiness.** 🚧 DEV-flagged in CommandRail; backend + frontend developed on `feat/foundry-backend` / `feat/foundry-frontend`. No workflow spec. Post-beta1 integration target.

### World Map 🚧
- **Function.** `world-map` router + `map-generation-worker`; Three.js atmosphere layer with intensity slider (from `codex/world-map-atmosphere`, merged); routes `world-map`, map pin dev page.
- **Readiness.** 🚧 DEV-flagged. `world-map.workflow` exists. Polish + promote out of DEV post-beta1.

### World / Lore & Quests ⚠️🚧
- **World entries** (`world` router, `world-import`, `continuity-graph` specs, routes `world/*`) — functional but DEV-flagged.
- **Quests** (route `campaigns/[slug]/quests`) — 🚧 DEV, no dedicated router; likely backed by world entities. Needs definition.

### Co-DM & Story Worlds (autonomous AI) ⚠️🚧
- **Co-DM.** `co-dm` router + `co-dm-worker` + `co-dm-prep-worker`; `co-dm.workflow` spec. Advanced AI assistant.
- **Story Worlds.** `world-simulation` router/service/worker; `story-worlds.workflow`. Autonomous world simulation (actors, goals).
- **Readiness.** ⚠️🚧 Specced but advanced/experimental; highest cost + correctness risk. Stage carefully post-beta1.

### Billing & Usage 🟢🔌
- **Function.** Stripe checkout/portal/cancel, tier enforcement (free/pro/team), usage tracking + quotas. Routers: `billing`, `usage`, `api-usage`; services `billing.service`, `usage.service`, `usage-tracking.service`; webhook `api/webhooks/stripe`.
- **Readiness.** 🟢 Implemented end-to-end; `billing.spec` skips conditionally by subscription state (defensive, not broken). External-bound on Stripe + env vars.

### Admin Console ⚠️
- **Function.** Overview, user management, health, API-usage admin. Routers: `admin-overview/-users/-health/-api-usage`; routes under `settings/admin`.
- **Readiness.** ⚠️ `admin-console.workflow` exists; admin specs `test.skip` when the runner isn't an admin (role-gated coverage gap, not a build gap). Seed an admin QA user to exercise fully.

### Feedback, Settings, Randomizer, Extension auth
- **Feedback** ✅ — `feedback` router/service + `feedback-triage-worker`; route `feedback`.
- **Settings** ✅ — 9 pages (account, ai, api-usage, appearance, ddb, integrations, profile, admin), `user-settings` router. Covered across personas.
- **Randomizer** ⚠️ — `randomizer` router; utility; no workflow spec.
- **Extension auth** ⚠️🔌 — `extension-auth` router for a browser extension; no workflow spec; confirm client status.

---

## Part 3 — Cross-cutting infrastructure

- **Async backbone.** 32 BullMQ workers on homelab LXC 206 via PM2 (always-on). Dev machine runs only `npm run dev`. **Every new worker must be added to `worker:all` and deployed** (`bash /opt/quiverdm/deploy/homelab/deploy.sh`).
- **AI multi-provider.** `chatWithAI` falls back claude → groq → openai → ollama (`AI_PROVIDER_ORDER`); `forceProvider` bypasses. Robust to single-provider outage.
- **Data.** Postgres 16 + pgvector (embeddings), Redis (queues/cache), MeiliSearch (search), Ollama (local LLM). Migrations are reviewable `prisma/migrations/*/migration.sql` (gitignored, force-added), applied to homelab via `prisma db execute`.
- **Design system.** OKLCH token layer (`src/styles/tokens.css`) + shadcn compat; dark-first. (Currently being refreshed to the "Living Design Artefact" palette on `feat/npc-voiceover`.)

## Part 4 — Robustness posture

- **Typed errors** (`src/server/errors`) — `NotFoundError`, `ForbiddenError`, `ValidationError` — give clean API failures. Rex (error-resilience) persona asserts failures surface as messages, not crashes.
- **Defensive test skips.** ~45 spec files skip *conditionally* (no campaign, non-admin, no subscription, DDB UI absent). This is graceful degradation coverage, **not** unbuilt features — but it does mean some paths are unproven without the right seed data. Seeding a complete QA fixture (admin + subscription + DDB + populated campaign) would convert many skips into real assertions.
- **Stage status fields** on `GameSession` make long async pipelines observable and resumable.
- **Gap:** Encounters has no workflow spec; Foundry/Quests/World/Story-Worlds are DEV-flagged without full acceptance coverage.

## Part 5 — Post-1.0-beta1 integration backlog

**Unmerged work (recoverable, on branches):**
1. `feat/import-hub-integration` — **ready to merge** (verified); needs `worker:import` PM2 deploy.
2. `feature/session-cockpit-enhancements` — initiative tracker, cockpit toolbar, NPC/twist dialogs (Brain layer already superseded in main — cherry-pick the cockpit components only).
3. `feat/foundry-backend` + `feat/foundry-frontend` — promote Foundry out of DEV.

**Promote out of DEV (needs polish + acceptance specs):**
- World Map · World/Lore · Quests · Foundry.

**Coverage gaps to close before calling beta1 "done":**
- Encounters workflow spec (DoD requirement).
- Admin: seed admin QA user so admin specs assert instead of skip.
- Randomizer / extension-auth: confirm status, add specs or descope.

**External-integration hardening:**
- DDB Cobalt session expiry → monitoring + auto-refresh runbook.
- Stripe webhook resilience under tier changes.
- WhisperX/crawl4ai homelab availability checks (`npm run check:launch`).

**Experimental, stage with care:**
- Co-DM and Story Worlds (autonomous AI) — highest cost/correctness risk; gate behind flags or pro tier.

---

*Maintenance: regenerate the matrix counts when routers/specs change. Run `npm run qa:cycle` for authoritative pass/fail; this catalog tracks existence + completeness, not live green/red.*
