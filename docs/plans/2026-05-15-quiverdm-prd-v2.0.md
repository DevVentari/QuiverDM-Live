# PRODUCT REQUIREMENTS DOCUMENT

## QuiverDM
### AI-Powered D&D Session Management Platform
**Version 2.0 | May 2026**
**Prepared by Blake Wales — blakewales.au**

---

| Field | Detail |
|---|---|
| Document Status | Draft |
| Version | 2.0 |
| Last Updated | 15 May 2026 |
| Previous Version | v1.0 (13 March 2026) — `docs/plans/2026-03-13-quiverdm-prd-v1.0.md` |
| Author | Blake Wales |
| Stakeholders | Product Owner, Alpha Testers, Closed Beta DMs |
| Classification | Internal |

---

## Table of Contents

1. Executive Summary
2. Product Vision and Goals
3. Business Goals
4. Success Metrics
5. User Personas
6. System Architecture
7. Technology Stack
8. Infrastructure
9. Data Model
10. Feature Pipeline Architecture
11. Application Views and Requirements
12. Role-Based Access Control
13. Non-Functional Requirements
14. Phased Implementation Plan
15. Risks and Mitigations
16. Future Enhancements
17. Appendix

---

## 1. Executive Summary

QuiverDM is an AI-powered D&D session management platform for Dungeon Masters who want to spend less time on administrative prep and more time at the table. The system automates the full lifecycle of a D&D campaign: session recording and transcription, AI-generated session and player-facing recaps, NPC and homebrew content management, persistent world-state via the DM Brain, sourcebook ingestion and reader, autonomous between-session world simulation, and a real-time Co-DM operating inside the live Session Cockpit.

The platform addresses the core pain point of experienced DMs: prep time. A typical session requires 2–4 hours of preparation — writing NPC backstories, tracking faction relationships, summarising past sessions, generating encounter content, and re-reading sourcebook chapters. QuiverDM reduces this to under 30 minutes by extracting, organising, and surfacing world-state automatically from every session, and by ingesting D&D Beyond sourcebooks directly so the DM can run them inside QuiverDM rather than alongside it.

Since v1.0 (March 2026), the system has grown from 35 to **49 tRPC routers**, from 12 to **28 BullMQ workers**, and from ~30 to **77 Prisma models**. New scope this cycle: full D&D Beyond sourcebook ingestion and reader, Session 0 auto-prep seeded from sourcebook entities, world map with pins, campaign-level mechanics and quest tracking, an autonomous world simulation that runs between sessions, a player-safe recap mode, multi-track audio ingest with speaker mapping, derailment detection, and the Single-Flow Atlas theme that unifies the visual language across the entire app.

The architecture is split across Vercel (frontend/API) and a homelab LXC (PostgreSQL with pgvector, Redis, MeiliSearch, Ollama, crawl4ai, the WebSocket server, and all BullMQ workers under PM2). The platform is live at https://quiverdm.com (also https://app.nerdt.au) and is currently in closed beta with 50 invited DMs.

---

## 2. Product Vision and Goals

### Vision Statement

Enable Dungeon Masters of all experience levels to run richer, more consistent campaigns by eliminating the administrative burden of world-tracking and session prep — replacing manual note-taking, sourcebook hunting, and scattered tools with a single, intelligent, always-current picture of their world.

### Core Principles

- **DM-first.** Every feature is designed for the person running the game, not the players.
- **Reduce friction, not agency.** AI assists and surfaces — it never decides for the DM.
- **Persistent world intelligence.** The system accumulates campaign knowledge across sessions, not just within them.
- **Table-ready.** Key flows must work on a phone or tablet at the gaming table.
- **One coherent surface.** Home, sessions, sourcebook, brain, world, and settings all feel like the same product — the Single-Flow Atlas theme.
- **Self-hostable soul.** The architecture reflects the values of the D&D community — open, customisable, not locked to a single cloud vendor. Production currently runs on a homelab worker plane behind Cloudflare.

---

## 3. Business Goals

| Goal | Description |
|---|---|
| Closed beta saturation | Reach 50 invited DMs with green persona specs by end of May 2026 |
| Open beta launch | Open waitlist + invite codes; 250 active DMs by Q3 2026 |
| User growth | 500 monthly active DMs by Q4 2026; 2,000 by mid-2027 |
| Revenue | $1,500 MRR within 6 months of paid tier launch; $5,000 MRR by Q2 2027 |
| Retention | 60-day retention above 40% for DMs who complete onboarding and run at least one session |
| Content volume | 1,000+ session recordings per month by Q3 2026; 250+ sourcebook-seeded campaigns by Q4 |
| Conversion | 20% of free users to Pro within 90 days of using transcription, DM Brain, or sourcebook reader |
| Marketplace foundation | Quill virtual currency live by Q1 2027 to underpin Phase 7 creator economy |

---

## 4. Success Metrics

| Metric | Baseline (v1.0, Mar 2026) | Current (May 2026) | Target (90 Days) | Measurement |
|---|---|---|---|---|
| Invited alpha/beta users | 0 | ~50 | 250 | Auth database + invite codes |
| Weekly active DMs | 0 | 18 | 80 | PostHog session events |
| Sessions recorded / week | 0 | 22 | 100 | `SessionRecording` table |
| Sourcebook-seeded campaigns | 0 | 9 | 100 | `CampaignSourcebook` rows |
| Avg session prep time | 120+ min | ~45 min | < 30 min | User survey |
| Transcription accuracy | Baseline only | ~92% WER | > 94% WER | Spot-check eval set |
| DM Brain entities / campaign | 0 | 28 (avg) | 60+ | `WorldEntity` count |
| AI summary acceptance rate | N/A | ~74% unedited | > 80% unedited | `GameSession.summary` edit detection |
| Player recap views / session | N/A | 1.8 | > 3 | `SessionRecap.viewedCount` |
| Pro conversion rate | N/A | TBD (no paid live) | 20% | Stripe + user table |
| Onboarding completion | N/A | 71% | > 80% | Onboarding step tracking |
| E2E test pass rate | ~90% | ~96% | 100% | `npm run qa:cycle` |
| Worker queue depth p95 | N/A | < 20 jobs | < 50 jobs | PM2 / BullMQ metrics |

---

## 5. User Personas

### Persona 1: Nora — New DM

**Role:** First-time Dungeon Master, running a campaign for friends.
**Technical level:** Basic.
**Goals:** Understand what to prep; create NPCs without reading the rulebook; not forget what happened in previous sessions.
**Pain points:** Overwhelmed by prep volume; forgets NPC names mid-session; doesn't know how to write a stat block.
**App needs:** Guided onboarding, sourcebook-seeded campaign templates, Session 0 auto-prep, NPC creation wizard, post-session summary email, simple dashboard.
**E2E persona:** `tests/personas/new-dm.persona.spec.ts`

### Persona 2: Vic — Veteran DM

**Role:** Experienced DM running 2–3 campaigns simultaneously.
**Technical level:** Moderate (uses Obsidian, Foundry VTT, D&D Beyond).
**Goals:** Cut prep from 3 hours to under 45 minutes; maintain continuity across long-running campaigns; recall any NPC from any session instantly.
**Pain points:** Notes scattered across Obsidian, Google Docs, and paper; cannot keep track of faction relationships over 60+ sessions; prep competes with real life.
**App needs:** Obsidian vault import, DM Brain entity graph, rapid NPC and sourcebook search, session transcription, full 5e stat block management, world map with pins.
**E2E persona:** `tests/personas/veteran-dm.persona.spec.ts`

### Persona 3: Dana — Power DM

**Role:** Content creator and DM who publishes homebrew campaigns.
**Technical level:** Advanced.
**Goals:** Upload homebrew PDFs and have content auto-extracted; manage spell/item/creature libraries; import from D&D Beyond and run sourcebooks natively.
**Pain points:** Manually entering stat blocks from PDFs takes hours; homebrew lives in too many places; sourcebooks live on DDB and force tab-switching.
**App needs:** PDF upload with AI extraction, D&D Beyond character and sourcebook import, in-app sourcebook reader with entity hover cards, homebrew library, encounter planner, image generation for NPCs/items.
**E2E persona:** `tests/personas/power-dm.persona.spec.ts`

### Persona 4: Player — Campaign Participant

**Role:** Player invited to a DM's campaign via link.
**Technical level:** Basic.
**Goals:** View campaign information, access character sheet, see player-safe session recaps.
**Pain points:** Forgets what happened in the last session; doesn't know what their character's spells/feats do.
**App needs:** Campaign overview (read-only), character sheet access, **player recap** history (the 90-second player-safe summary, not the DM-facing recap).
**E2E persona:** `tests/personas/player-join.persona.spec.ts`

### Persona 5: Mobile DM

**Role:** Any DM running a session at a physical table.
**Technical level:** Basic (phone-first at the table).
**Goals:** Look up NPCs and homebrew quickly mid-session; add notes without breaking immersion; approve AI-generated content from phone; read the sourcebook one-handed.
**Pain points:** Desktop UI hard to use on phone; typing is slow mid-combat; the session cockpit must work on 390px viewport.
**App needs:** Mobile-optimised campaign pages, NPC quick-lookup, tap-friendly action buttons, no horizontal overflow, sourcebook reader that reflows at 72ch column width.
**E2E persona:** `tests/personas/mobile-dm.persona.spec.ts`

### Persona 6: Error-Resilience

**Role:** Any user encountering service degradation.
**Goals:** See clean error states, not crashes or blank screens.
**Pain points:** White screen of death; silent failures on AI features when API quota is exceeded.
**App needs:** Graceful fallback messaging on all AI features; form validation with clear field errors; retry surfaces on failed jobs; visible queue status when workers are backlogged.
**E2E persona:** `tests/personas/error-resilience.persona.spec.ts`

---

## 6. System Architecture

### Architecture Overview

QuiverDM is a five-layer system: a Next.js frontend, a tRPC API layer, domain services, BullMQ background workers, and an AI/processing layer. Each layer is independently deployable.

| Layer | Purpose | Technology |
|---|---|---|
| 1. Web Application | User-facing Next.js pages and React components | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui |
| 2. API Layer | Type-safe RPC endpoints, authentication, route handlers | tRPC v11, NextAuth v5 beta, Zod |
| 3. Domain Services | Business logic: campaign rules, AI orchestration, billing, simulation | 35 TypeScript service classes |
| 4. Background Workers | Async processing: transcription, PDF, summaries, embeddings, simulation | BullMQ v5 on Redis, 28 workers under PM2 |
| 5. AI / Processing | LLM inference, transcription, PDF parsing, image generation | AssemblyAI, Claude/Gemini/OpenAI/Groq/Ollama, Docling, fal.ai, Replicate, ComfyUI |

### App Structure

```
src/app/
  page.tsx                         # Root redirect (auth → dashboard, else signin)
  (app)/                           # Authenticated workspace shell
    dashboard/                     # Home dashboard
    campaigns/                     # Campaign list + creation
    campaigns/[slug]/              # Campaign workspace (15 sub-sections)
    characters/                    # Character library
    homebrew/                      # Homebrew content library
    settings/                      # User settings, API keys, billing, usage
    recap/                         # User-level recap history
    feedback/                      # In-app feedback overlay surface
    session/                       # Bridge to session cockpit
  (session)/campaigns/[slug]/sessions/[id]   # Full-screen Session Cockpit
  (admin)/admin/                   # Admin panel (platform roles only)
  (onboarding)/onboarding/         # Onboarding wizard
  (auth)/auth/                     # signin, signup, error, password reset
  (marketing)/                     # landing, pricing, preview
  share/                           # Public share routes (player recap, etc.)
  overlay/                         # OBS overlay / SSE surface
  dev/                             # Internal dev utilities
  api/                             # auth, trpc, webhooks/stripe, uploads, health
```

### Server Structure

```
src/server/
  routers/          # 49 tRPC routers
  services/         # 35 business logic services
  repositories/     # 19 Prisma repository classes
  errors/           # Typed application errors
  trpc.ts           # tRPC init + procedures
src/lib/queue/      # 28 BullMQ worker entrypoints + queues
src/lib/ai/         # chatWithAI multi-provider router
```

### Router Inventory (49)

Core campaign and content: `campaigns`, `sessions`, `npcs`, `players`, `members`, `invites`, `characters`, `characters-dndbeyond`, `homebrew`, `homebrew-pdf`, `homebrew-extraction`, `homebrew-image`, `homebrew-dndbeyond`, `encounters`, `encounter-plans`.

Session runtime: `session-recordings`, `session-transcription`, `transcript`, `speaker-mapping`, `multi-track-upload`, `play`, `recap`, `whisper`.

World & narrative: `brain`, `world`, `world-map`, `campaign-context`, `campaign-mechanics`, `randomizer`, `rules`, `search`.

Sourcebooks: `sourcebook-reader`, `sourcebook-scenes`, `ddb-sync`.

Integrations: `foundry`, `obsidian`, `webhooks`, `extension-auth`.

Platform: `onboarding`, `feedback`, `password-reset`, `user-settings`, `api-usage`, `usage`, `billing`.

Admin: `admin-overview`, `admin-users`, `admin-health`, `admin-api-usage`.

---

## 7. Technology Stack

| Component | Technology | Hosting | Est. Monthly Cost |
|---|---|---|---|
| Web Application | Next.js 15 (App Router) + TypeScript + React 18 | Vercel | $0 (hobby) — $20 (Pro at scale) |
| API Layer | tRPC v11 + Zod 3 | Vercel | (included) |
| Authentication | NextAuth v5 beta + Prisma adapter | Vercel | $0 |
| Database | PostgreSQL 16 with pgvector | Homelab LXC 206 | $0 (self-hosted) |
| Queue / Cache | Redis 7 | Homelab LXC 206 | $0 (self-hosted) |
| Background Workers | BullMQ v5 (28 workers) under PM2 | Homelab LXC 206 | (included) |
| PDF Processing | Docling + pdfplumber fallback | Homelab LXC 206 | (included) |
| Full-text Search | MeiliSearch 1.x | Homelab LXC 206 | (included) |
| Browser Automation | crawl4ai (Playwright) for D&D Beyond | Homelab LXC 206 | (included) |
| Local LLM | Ollama (nomic-embed-text, llama 3.x) | Homelab LXC 206 | (included) |
| Media Storage | Cloudflare R2 (S3-compatible) | Cloudflare | $0–5 |
| AI Transcription | AssemblyAI + WhisperX fallback | Cloud / self-hosted | $0.12/hr audio |
| AI Chat / Extraction | Claude (Anthropic SDK), OpenAI GPT-4o, Gemini, Groq, Ollama | Cloud API | $0–40 |
| Image Generation | fal.ai, Replicate, ComfyUI | Cloud / self-hosted | $0–10 |
| Billing | Stripe | Cloud SaaS | 2.9% + 30c per txn |
| Transactional Email | Resend | Cloud API | $0 (free tier) |
| Error / Analytics | PostHog (EU cloud) | Cloud SaaS | $0 (free tier) |
| Feedback Ingestion | Discord Bot + GitHub Issues | Discord / GH | $0 |
| Reverse Proxy / DNS | Cloudflare | Cloudflare | $0 |
| CI / Deploy | Vercel Git integration + homelab deploy script | Vercel + SSH | $0 |
| Browser extension | Manifest v3 (Chromium) | Self-hosted | $0 |
| Foundry module | Foundry VTT manifest | Self-distributed | $0 |

**Minimum monthly cost:** ~$5 AUD (homelab electricity is roughly flat — only R2 egress and AI APIs scale).
**At 500 active users:** ~$60–120 AUD depending on AI API usage volume.

Key dependency upgrades since v1.0: Anthropic SDK (`@anthropic-ai/sdk` v0.68), `openai` v6, `@xyflow/react` v12 (DM Brain graph), `react-force-graph-2d` (relationship visualisation), `dexie` v4 (client-side offline cache for session cockpit), `next-pwa` (mobile PWA shell), `posthog-js` and `posthog-node` (analytics).

---

## 8. Infrastructure

### Service Topology

| Service | Location | Port | Purpose |
|---|---|---|---|
| Next.js App | Vercel | 443 (HTTPS) | Frontend + API routes + tRPC |
| PostgreSQL (pgvector) | Homelab LXC 206 (192.168.1.21) | 5432 | Primary database |
| Redis | Homelab LXC 206 | 6379 | BullMQ queues + caching |
| BullMQ Workers (×28) | Homelab LXC 206 (PM2) | — | All background job processing |
| WebSocket server | Homelab LXC 206 | 3004 | Live session sync, transcript streaming, Co-DM events |
| Docling | Homelab LXC 206 | (internal) | PDF-to-markdown conversion |
| MeiliSearch | Homelab LXC 206 | 7700 | Full-text search indexing |
| Ollama | Homelab LXC 206 | 11434 | Embeddings + local LLM fallback |
| crawl4ai | Homelab LXC 206 | 5002 | DDB sourcebook crawling via authenticated browser |
| Cloudflare R2 | Cloudflare | — | Session recordings, generated media, PDFs |

### Deployment Flow

- `git push origin main` → Vercel auto-deploys frontend + API.
- Worker redeploy: `ssh` to homelab; `bash /opt/quiverdm/deploy/homelab/deploy.sh` (pulls main, runs `pm2 reload ecosystem.config.cjs`).
- Database migrations: `npx prisma db execute --url "$HOMELAB_DB_URL" --file <sql>` (note: `npm run db:push` reads `.env`, which points to a dead localhost — see Operational Notes in `CLAUDE.md`).
- Vercel cron: `/api/health` every 4 minutes (keeps connection pool warm).
- DDB cookie refresh: `npm run ddb:refresh` headless; `npm run ddb:login` headed first time.

### Dev Environment

- `npm run dev` → Next.js on `http://localhost:3847`.
- All backing services point at the homelab (no local Docker required).
- Worker code changes require SSH redeploy; frontend hot-reloads automatically.

---

## 9. Data Model

All persistent data lives in PostgreSQL via Prisma. **77 models** total (up from ~30 in v1.0). Key model families below.

### User, Auth, and Settings

| Model | Purpose |
|---|---|
| `User` | Auth identity, billing tier, platform role |
| `Account` / `Session` / `VerificationToken` / `PasswordResetToken` | NextAuth tables |
| `UserSettings` | Per-user encrypted API keys (Claude, Gemini, OpenAI, DDB Cobalt) |
| `UserUsage` / `ApiUsageLog` | Provider/feature usage and cost ledger |
| `InviteCode` | Closed-beta access codes |

### Campaign and Members

| Model | Purpose |
|---|---|
| `Campaign` | Root campaign with slug, description, setting |
| `CampaignMember` | Role-scoped access (OWNER / CO_DM / PLAYER / SPECTATOR) |
| `CampaignInvite` | Invite link management |
| `CampaignDocument` | Free-form attached documents |
| `Player` | Player-facing campaign presence |
| `CampaignContext` | Context blobs (lore, tone, table rules) extracted/edited per campaign |
| `CampaignMechanic` | DM-defined house rules and mechanical variants tracked per campaign |

### Sessions, Audio, Transcripts

| Model | Purpose |
|---|---|
| `GameSession` | Session record with `prepData`, `summary`, `summaryStatus`, `prepStatus` |
| `PlayerSessionState` / `SessionSpotlight` | Per-player and per-moment session state |
| `SessionRecording` | Audio/video upload reference (R2) |
| `TranscriptionJob` | Async transcription job state |
| `Transcript` / `TranscriptCorrection` | Final transcript and inline corrections |
| `SpeakerMapping` | Per-campaign speaker label → player mapping (carries across sessions) |
| `SessionMechanicalEvent` | Combat/mechanical event log |
| `SessionEntityAppearance` | Entity → session cross-reference |
| `SessionRecap` (with `RecapStyle`, `RecapStatus`) | DM and player-safe recap variants |
| `ClarificationQA` | Mid/post-session clarifying Q&A from Co-DM |

### NPCs, Characters, Compendium

| Model | Purpose |
|---|---|
| `NPC` | Full NPC record with 5e stat block |
| `Character` | Player character sheet |
| `CampaignCharacter` | Character ↔ campaign linkage |
| `CharacterSpell` / `CharacterFeat` / `CharacterItem` / `CharacterSessionState` | Character composition + per-session state |
| `Spell` / `Feat` / `Item` / `PlayerSpell` / `PlayerFeat` / `PlayerItem` | SRD + player attachments |

### Homebrew and Sourcebooks (new this cycle)

| Model | Purpose |
|---|---|
| `HomebrewContent` | Spell/Monster/Item/Rule entry |
| `HomebrewPDF` | Uploaded PDF + processing status |
| `CampaignHomebrewContent` | Many-to-many campaign ↔ homebrew |
| `ImageGenerationJob` | Async image generation tracking |
| `DdbEntitlement` | Authenticated DDB ownership (per user) |
| `DdbSourcebook` | Imported sourcebook (e.g. Curse of Strahd) with chapters and entities |
| `DdbSourcebookChapter` | Chapter tree with parent-slug nesting |
| `CampaignSourcebook` | Campaign ↔ sourcebook linkage |
| `SourcebookEntity` | Master library entity per sourcebook (cloned into `WorldEntity` when linked) |
| `SourcebookChapterImage` | Chapter illustrations and maps |
| `SourcebookScene` | Pre-extracted scene blocks ready for session prep |

### DM Brain — World State

| Model | Purpose |
|---|---|
| `WorldEntity` | Entity node (NPC/PC/Faction/Location/Item/Event/Arc/Threat/Secret/Custom/Note) |
| `WorldRelationship` | Typed relationship edge with strength/history |
| `WorldStateChange` | Immutable audit log of mutations |
| `WorldState` | Aggregate registers (faction influence, pressure tracks, hooks) |
| `WorldEntry` | Free-form lore entries linked into the brain |
| `WorldActor` | Autonomous simulation actor (faction/god/region) |
| `WorldSimulationEvent` | Event emitted by between-session simulation |
| `WorldEventProposal` | DM-reviewable proposals from the simulation |
| `WorldPressureHistory` | Time series of pressure tracks |
| `BrainIngestSource` | Source-of-record for every brain ingestion |
| `EntityMergeCandidate` / `EntityMergeRule` | Alias-resolution heuristics and reviewer queue |

### World Map

| Model | Purpose |
|---|---|
| `CampaignMap` | Background image + projection metadata (with `MapBgType` enum) |
| `MapPin` | Pinned entity reference, coordinates, visibility |

### Encounters, Search, Embeddings

| Model | Purpose |
|---|---|
| `Encounter` / `EncounterParticipant` | Live encounter tracker |
| `EncounterPlan` / `EncounterPlanCreature` | Pre-built encounter template |
| `Embedding` | pgvector embeddings for narrative search and entity resolution |

### Integrations and Infra

| Model | Purpose |
|---|---|
| `ObsidianImportJob` | Obsidian vault ZIP import state |
| `FoundryImportJob` / `FoundryEvent` | Foundry VTT import + event log |
| `WebhookEndpoint` | Outbound webhook delivery |
| `QaFailure` | E2E failure log for QA monitoring |
| `Feedback` | In-app feedback with Discord forum threading |

### Key Enums

`PlatformRole`, `CampaignRole`, `ContentVisibility`, `CharacterStatus`, `WorldEntityType`, `WorldEntityStatus`, `WorldEntryType`, `WorldStateChangeType`, `WorldStateChangeSource`, `MapBgType`, `ContextType`, `RecapStyle`, `RecapStatus`.

---

## 10. Feature Pipeline Architecture

### Pipeline 1: Session Recording and Transcription

Triggered when a DM uploads or records audio/video for a session.

1. DM uploads via session page or in-browser MediaRecorder.
2. Client requests presigned R2 upload URL via `POST /api/uploads`.
3. File uploaded directly to Cloudflare R2 (browser-to-R2, never through Next.js).
4. `SessionRecording` created; `transcription-worker` enqueued.
5. Worker calls AssemblyAI (or queues WhisperX fallback) with presigned URL.
6. On success: `Transcript` created; UI updates via tRPC invalidation.
7. `transcript-cleanup-worker` runs post-process passes (punctuation, dedup, speaker normalisation).
8. `speaker-mapping` router lets the DM assign speaker labels to players once; future sessions inherit the mapping.
9. **Multi-track variant** — `multi-track-upload` + `multi-track-worker` handle per-speaker tracks (Discord, Craig bot exports), merging into a diarised transcript without needing AssemblyAI diarisation.

### Pipeline 2: AI Session Summary and Recap

1. DM clicks "Generate Summary" or pipeline auto-triggers post-transcription.
2. `ai-summary-worker` enqueued with session ID.
3. Worker fetches transcript + campaign context (recent sessions, key NPCs, mechanics).
4. `chatWithAI` (default order: claude → groq → openai → ollama) runs a structured prompt producing narrative summary, key events, NPC appearances, unresolved hooks.
5. Result written to `GameSession.summary`; `summaryStatus = COMPLETE`.
6. `recap-generation-worker` then writes a `SessionRecap` in DM and player styles (`RecapStyle`: `dm`, `player`, `cinematic`).
7. `player-recap-worker` produces a 90-second player-safe summary surfaced on the public share route and player portal.

### Pipeline 3: DM Brain Ingestion and Inference

1. `brain-ingestion-worker` receives a session ID after summary completes.
2. Loads summary + transcript + existing `WorldEntity` records for the campaign.
3. Calls AI with an extraction schema: entities, relationships, state changes.
4. Entity resolution: cosine similarity against existing embeddings; alias collapse via `EntityMergeCandidate` + `EntityMergeRule`.
5. New `WorldEntity`, `WorldRelationship`, and `WorldStateChange` rows written; `BrainIngestSource` tracks provenance.
6. `WorldState` registers updated (faction influence, pressure tracks, unresolved hooks).
7. `brain-inference-worker` runs higher-order passes — relationship drift detection, hook escalation, contradiction flagging.
8. DM Brain dashboard reflects updates via tRPC subscription invalidation.

### Pipeline 4: Homebrew PDF Processing

1. DM uploads PDF to campaign homebrew page.
2. `HomebrewPDF` created with `processingStatus = PROCESSING`.
3. `pdf-worker` (`worker.ts`) fetches from R2, sends to Docling (pdfplumber fallback).
4. Markdown chunked by content type (spell, creature, item, rule).
5. Each chunk passed to typed Zod schema extraction prompt.
6. `HomebrewContent` rows written; `processingStatus = COMPLETE`.
7. Optional `image-generation-worker` and `visual-asset-worker` enqueue NPC/creature portrait jobs via fal.ai or Replicate.

### Pipeline 5: D&D Beyond Sourcebook Ingestion (new)

1. DM enters DDB sourcebook URL with their saved `DDB_COBALT_SESSION`.
2. `ddb-sync-coordinator-worker` orchestrates the import.
3. `ddb-chapter-extract-worker` fans out per chapter via crawl4ai (authenticated headless Chromium).
4. Chapters stored as `DdbSourcebookChapter` with raw `bodySections` and chapter images.
5. `sourcebook-scene-extraction-worker` runs the dual-model (Claude + GPT-4o) pipeline from `scripts/create-master-sourcebook.ts`, producing `SourcebookEntity` rows (NPC/LOCATION/EVENT/ARC/FACTION/etc.) and `SourcebookScene` blocks.
6. `ddb-sync-review-worker` surfaces an entity-merge review UI for the DM before content is promoted live.
7. Once linked to a campaign via `CampaignSourcebook`, sourcebook entities can be cloned into `WorldEntity` rows.

### Pipeline 6: Session 0 Auto-Prep (in-flight, approved 2026-05-15)

1. On campaign creation with a sourcebook selected, a `GameSession` with `sessionNumber: 0` is created immediately (`prepStatus: 'draft'`).
2. `session0-prep-worker` enqueued with the sourcebook ID.
3. Worker queries `SourcebookEntity` (up to 15 entities, prioritising NPC/LOCATION/ARC/EVENT, ordered by `createdAt`).
4. Calls `chatWithAI(messages, { forceProvider: 'claude' })` with a structured prompt.
5. Writes `prepData`: `strongStart`, 2–3 opening scenes, 2–3 intro NPCs, 1–2 secrets.
6. Sets `prepStatus: 'complete'`. Hero card on campaign home shimmer-resolves to a "Review Session 0 Prep" CTA.
7. Hero card disappears permanently once any non-zero session exists.
8. Failure mode: `prepStatus` stays `draft`; DM can edit manually.

### Pipeline 7: Co-DM (Phase 4)

1. When a session enters Live mode, `co-dm-prep-worker` runs first — pre-warms entity, mechanics, and rules context.
2. Active session streams transcript chunks over the WebSocket server.
3. `co-dm-worker` consumes events, calling AI for: NPC reaction suggestions, lore continuity warnings, encounter pacing hints.
4. `combat-copilot-worker` handles the combat slice: condition tracking, recharge reminders, initiative management.
5. `derailment-worker` runs an objective-drift detector and proposes 2–3 GM recovery options if the session moves away from the prepped beats.
6. `session-events-worker` writes structured events into `SessionMechanicalEvent` and `ClarificationQA`.
7. Confidence threshold UI: silent → hint → highlight → alert. Four permission levels: Manual / Assist / Auto-Mechanical / Full Co-DM.

### Pipeline 8: Autonomous Story Worlds (Phase 6, in-progress)

1. `world-simulation-worker` runs on a scheduled cadence (typically every 12–24 hours per active campaign).
2. Evaluates `WorldActor` rows: goal, urgency, resources, risk tolerance.
3. Detects instability → actor actions → events → consequences.
4. Writes `WorldSimulationEvent` and `WorldPressureHistory` rows.
5. High-impact outcomes become `WorldEventProposal` records the DM can accept, edit, or discard inside the Brain workspace.
6. Pressure tracks (political / supernatural / economic / cosmic / social) feed autonomous adventure hooks visible on the campaign home.

### Pipeline 9: World Map and Map Generation

1. DM uploads or generates a campaign map (`CampaignMap`).
2. `map-generation-worker` (when AI-generated) renders a tiled image via fal.ai and writes back the URL.
3. `MapPin` rows reference `WorldEntity` IDs and surface entity hover cards on the world map view.

### Pipeline 10: Obsidian Vault Import

1. DM uploads a vault ZIP.
2. `obsidian-import-worker` extracts and filters files; smart detection skips dupes and raw transcripts.
3. Markdown parsed; entities upserted via the same extraction stack as PDFs.
4. Progress streamed via tRPC subscription; `ObsidianImportJob` updated.

### Pipeline 11: Narrative Search (Embeddings)

1. `embeddings-worker` processes new/updated content.
2. Chunks embedded via Ollama `nomic-embed-text` (default) or OpenAI `text-embedding-3-small`.
3. Vectors stored in `Embedding` (pgvector HNSW).
4. `meili-sync-worker` mirrors indexed content into MeiliSearch for keyword search.
5. `/campaigns/[slug]/search` queries both and merges results.

### Pipeline 12: Feedback Triage

1. In-app feedback overlay submits to `feedback` router.
2. `feedback-triage-worker` enriches with context, opens a Discord forum thread and (optionally) a GitHub issue.
3. Discord replies flow back into `Feedback.discordThreadId`.

---

## 11. Application Views and Requirements

### Dashboard (`/dashboard`)

- Recent campaigns grid with last-active date and session count.
- Quick-create campaign button (with optional sourcebook seeding).
- Upcoming session countdown.
- Recent activity: last DM Brain update, last transcription, last simulation event, last recap.
- Global NPC + content search (MeiliSearch).

### Campaign Workspace (`/campaigns/[slug]/*`)

The primary workspace, now with **15 sub-sections** (up from 10 in v1.0):

| Route | Purpose |
|---|---|
| `/` | Campaign overview, Session 0 hero card (when applicable), recent sessions, brain summary |
| `/sessions` | Sessions list and per-session detail (transcript, summary, recap, mechanical events) |
| `/npcs` | NPC library with split-inspector view (in-flight redesign) |
| `/players` | Player list, character access, session state |
| `/members` | Invite management |
| `/homebrew` | Campaign homebrew library |
| `/brain` | DM Brain entity graph + unresolved hooks + simulation feed |
| `/encounters` | Encounter planner and live tracker |
| `/summaries` | DM-facing summary history |
| `/search` | Full-text + semantic search |
| `/settings` | Campaign-level settings |
| `/sourcebook` | In-app sourcebook reader (chapter tree, prose with entity hover cards, illustrations, read-aloud blocks) |
| `/mechanics` | Campaign-level house rules and mechanical variants |
| `/quests` | Quest tracker linked to brain entities |
| `/world` | Campaign world overview (factions, regions, pressure tracks) |
| `/world-map` | Pinned world map with entity overlays |
| `/foundry` | Foundry VTT bridge controls |

### Session Cockpit (`(session)/campaigns/[slug]/sessions/[id]`)

Full-screen, three-panel runtime view used during live play.

- Live scene notes with AI overlay (Co-DM suggestions).
- Party HP / conditions / initiative panel.
- Zero-friction NPC recall sidebar.
- Combat mode (encounter tracker morphs in-place).
- DM panic tools: roll, generate NPC, suggest twist.
- Real-time context alerts (lore continuity, pacing, derailment).
- One-click end-session pipeline: summary → DM recap → player recap → brain ingestion → NPC and prep updates.

### Sourcebook Reader (`/campaigns/[slug]/sourcebook`)

- Chapter tree sidebar with parent-slug nesting.
- 72ch prose column (in-flight formatting improvements, approved 2026-05-15).
- Inline entity hover cards (NPC/Location/Faction popovers).
- Distinct read-aloud blockquote treatment.
- Portrait illustrations float beside text; maps and scene images break out to full column width.
- Image captions from `alt` text.
- Heading hierarchy follows `section.level`.

### Homebrew Library (`/homebrew`)

Global homebrew across all campaigns. Filter by type, source, campaign. Batch assign content to campaigns. PDF management with processing status.

### Characters (`/characters`)

User's character library across all campaigns. Import from D&D Beyond (Cobalt session). Character sheet tabs: stats, spells, feats, items. Session state tracking per session.

### Settings (`/settings`)

- Profile.
- API keys: Claude, Gemini, OpenAI, DDB Cobalt session. Quota and freshness indicators.
- Notifications.
- Billing: current plan badge, Stripe portal link.
- API Usage (`/settings/api-usage`): per-provider summary, feature breakdown, recent call log, period selector.

### Onboarding

Wizard: create first campaign (or seed from a sourcebook) → import Obsidian vault or start fresh → create first NPC → invite a player → run first session. Skippable; progress saved.

### Admin (`/admin`)

Platform-role-only surface: users, invites, rules sources, API usage, system health (queue depth, worker status, recent QA failures).

### Marketing (`/landing`, `/pricing`, `/preview`)

Public marketing surfaces. Preview routes for design system review.

### Public Share Routes (`/share`)

- Player recap public link.
- Session highlight share card.

### OBS Overlay (`/overlay`)

SSE-driven overlay surface for streaming DMs — initiative order, scene description, NPC portraits.

---

## 12. Role-Based Access Control

### Campaign Roles

| Role | Dashboard | Overview | Sessions | NPCs | Brain | Sourcebook | World Map | Mechanics | Members | Settings |
|---|---|---|---|---|---|---|---|---|---|---|
| OWNER | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| CO_DM | Full | Full | Full | Full | Full | Full | Full | Full | View + Invite | No |
| PLAYER | Own only | Read | Read (player recap only) | Read (limited) | No | Read (player-safe) | Read | Read | No | No |
| SPECTATOR | No | Read | Read (player recap only) | Read (limited) | No | Read (player-safe) | Read | Read | No | No |

### Procedures

- `campaignMemberProcedure` — any campaign member.
- `campaignDMProcedure` — OWNER or CO_DM.
- `campaignOwnerProcedure` — OWNER only.
- `platformAdminProcedure` — `User.platformRole === ADMIN`.

### Visibility

Each `WorldEntity`, `SourcebookEntity`, and `SessionRecap` carries a visibility field (`ContentVisibility`: `dm_only`, `players`, `public`) that gates render server-side and on share routes.

---

## 13. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Dashboard page load | < 1.5s on 4G mobile |
| Performance | NPC list (100 NPCs) | < 500ms render |
| Performance | Sourcebook chapter load | < 800ms (cold), < 200ms (warm) |
| Performance | AI summary generation | < 60s end-to-end |
| Performance | Player recap generation | < 30s end-to-end |
| Performance | Transcription turnaround | < 2× audio length |
| Performance | Session 0 auto-prep | < 15s typical, < 60s worst-case |
| Performance | PDF extraction (50-page PDF) | < 5 min end-to-end |
| Performance | DDB sourcebook import (1 chapter) | < 90s end-to-end |
| Performance | Semantic search response | < 300ms |
| Performance | Co-DM hint latency | < 2s from transcript event to UI |
| Availability | Vercel uptime | > 99.9% (SLA) |
| Availability | Homelab worker uptime | > 99% monthly |
| Availability | Graceful AI degradation | Queue jobs if API unavailable; surface status in UI; fall back through provider chain |
| Scalability | BullMQ concurrency | 28 workers, per-queue concurrency configurable |
| Scalability | PostgreSQL | No degradation up to 1M rows per table |
| Scalability | Embedding search | pgvector HNSW; < 100ms at 100k vectors |
| Security | Authentication | NextAuth v5 with PKCE, bcrypt password hashing |
| Security | API key storage | AES-256 encrypted at rest in `UserSettings` |
| Security | Session recordings | Presigned R2 URLs (15-min expiry); never public |
| Security | tRPC procedures | All mutations require authenticated session; campaign procedures verify membership |
| Security | Stripe webhook | Signature verification |
| Security | DDB Cobalt session | Encrypted; never logged; refresh flow tracks expiry |
| Data Privacy | AI content | User-uploaded content never used for model training (per provider contracts) |
| Data Privacy | Voice/audio | Recordings in user-scoped R2 paths; never shared between accounts |
| Data Privacy | Sourcebooks | Imported sourcebooks are private to the importing user's `DdbEntitlement`; not redistributed |
| Maintainability | Workers under PM2 | `pm2 reload ecosystem.config.cjs` on deploy |
| Maintainability | Type safety | tRPC + Zod across all API boundaries; no `any` in production paths |
| Maintainability | E2E coverage | All major user flows covered by persona specs; `npm run qa:cycle` passes before every merge |
| Mobile | Touch targets | Minimum 44×44px on all interactive elements |
| Mobile | Viewport | No horizontal overflow at 390px; key actions visible without scroll |
| Mobile | PWA | `next-pwa` installable shell with offline cache for session cockpit basics |
| Design | Atlas theme adherence | One coherent visual language across the app — no per-page skin variation (in-flight migration) |
| Accessibility | Contrast | Strong contrast on text and key controls; never meaning-by-colour-alone |

---

## 14. Phased Implementation Plan

### Phase 1: Foundation — Complete

Core campaign, session, NPC, and character management. Auth, billing, email.

### Phase 2: AI Processing Pipelines — Complete

Recording, transcription, AI summaries, homebrew PDF processing, narrative search, per-user API keys.

### Phase 3: Session Mode Dashboard — Complete

Full-screen Session Cockpit, party panel, NPC recall, combat morphing, panic tools, end-session pipeline.

### Phase 4: Autonomous Co-DM — Complete

Real-time narrative operator powered by DM Brain context. Context streaming, prediction models, NPC behaviour updates, on-demand improv content, encounter autopilot, lore continuity guardian, derailment detection, confidence threshold UI, four permission levels.

### Phase 5: DM Brain — Complete

Persistent entity graph; typed relationship edges; per-entity state versioning; pressure tracks; brain ingestion pipeline; alias collapse via `EntityMergeCandidate` and `EntityMergeRule`; DM-facing entity graph explorer; backfill seed button.

### Phase 6: Autonomous Story Worlds — In Progress

World Motivation Engine, continuous simulation loop, Story Pressure system, autonomous adventure hooks, dynamic arc construction, NPC autonomous lives between sessions, player-driven gravity, parallel storylines, mythogenesis engine. Architecture: Autonomous Story Engine → Living World Simulation → DM Brain → Co-DM → Session Mode.

**Status May 2026:** World simulation worker live; `WorldActor`, `WorldSimulationEvent`, `WorldEventProposal`, and `WorldPressureHistory` shipped. DM-review UI for proposals is in QA. Parallel storyline divergence and mythogenesis still upcoming.

### Phase 7: Sourcebook Native — In Progress (new this cycle)

QuiverDM as the place DMs *read and run* sourcebooks, not just track them.

- D&D Beyond sourcebook ingestion via authenticated `crawl4ai` and `DDB_COBALT_SESSION`.
- Dual-model (Claude + GPT-4o) chapter extraction with global dedup.
- Sourcebook reader at `/campaigns/[slug]/sourcebook` with entity hover cards, image carousel, scene blocks.
- Sourcebook formatting pass (approved 2026-05-15): prose max-width, heading hierarchy, portrait float, read-aloud boxes, table styling, image captions.
- Session 0 auto-prep seeded from sourcebook entities (approved 2026-05-15).
- Sourcebook entity → `WorldEntity` clone when linked to a campaign.
- **Status:** Curse of Strahd imported end-to-end; reader live; formatting pass and Session 0 auto-prep in active implementation.

### Phase 8: Single-Flow Atlas Theme — In Progress (new this cycle)

Unify the visual language across the entire app. Daylight archive aesthetic: warm parchment paper tokens, ink text, amber accents reserved for primary actions, stone-like cards, restrained shadow. Replace the prior dark-first split identity. Spectral serif for display, IBM Plex Sans for body, IBM Plex Mono for stats.

- Shared token set lives in `src/app/globals.css`.
- Light by default; dark panels only used in dense operational regions.
- Amber is scarce — one dominant action per screen.
- Cards feel like parchment / stone, not SaaS tiles.
- Mobile-safe minimum 44px touch targets.

**Status:** Tokens defined; home and high-traffic campaign pages converted; remaining pages migrating during May.

### Phase 9: Polish + UI 2.0 — In Progress

- NPC Inspector split view (`?npc=<id>` URL state).
- Session Cockpit 3-panel layout.
- DM Brain stone-card visual treatment.

### Phase 10: Creator Economy — Planned

Phase 7 from v1.0, renumbered.

- Public homebrew marketplace with rating, review, and forking.
- Campaign module publishing (multi-session bundles).
- **Quill virtual currency** — players earn during active sessions; DMs earn running them; Pro/Team allocations; seller-to-buyer transfers in V2; real-money cash-out deferred to V3.
- Stripe Connect for creator payouts (V3).
- Subscription content available on Pro tier.

### Phase 11: Multi-System TTRPG Support — Planned

System-agnostic features (transcription, recaps, PDF extraction) extended to Pathfinder 2e first, then CoC, VtM, and others.

---

## 15. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AssemblyAI quality poor on D&D vocabulary (spell/creature names) | Medium | High | Custom vocabulary hints; WhisperX fallback; `transcript-cleanup-worker` for post-process; speaker mapping reused across sessions |
| Gemini/Claude API quota exceeded for free-tier users | High | Medium | Per-user API key support; server-side rate limiting via `UserUsage`; quota indicators in settings; provider chain fallback |
| AI extracts incorrect entity relationships | Medium | High | Human-in-the-loop in brain workspace; immutable `WorldStateChange` log; reviewer queue via `EntityMergeCandidate` |
| Homelab outage (worker plane) | Medium | High | PM2 auto-restart; BullMQ jobs persist in Redis; Vercel surfaces health status; runbook for failover |
| DDB Cobalt session expiry breaking sourcebook ingestion | High | Medium | Refresh flow (`npm run ddb:refresh`); expiry monitor; clear DM-facing error state |
| DDB site structure changes breaking the crawler | Medium | Medium | Versioned crawl scripts; chapter-level retry; manual `--skip-crawl` re-extract path |
| World simulation produces nonsense or contradicts canon | Medium | High | All simulation outputs land as `WorldEventProposal` (review-required); never auto-write canon; lore continuity guardian in Co-DM flags contradictions |
| Atlas theme rollout produces inconsistent screens during migration | High | Medium | Shared token set in `globals.css`; per-page acceptance checklist; visual regression suite (`test:playwright:visual`) |
| Sourcebook reader formatting regressions on mobile | Medium | Medium | 72ch max-width; `overflow-x: auto` tables; layout integrity Playwright spec |
| Stripe webhook replay / duplicate events | Low | High | Event dedupe by `stripe_event_id`; idempotent handlers |
| Long-running AI jobs block worker slots | Medium | Medium | 28 workers with per-queue concurrency; timeout policies; dead letter handling |
| Obsidian vault import ingests sensitive notes | Low | High | Import wizard shows file list before processing; DM can delete any imported entity; privacy policy covers user-uploaded content |
| Worker container crash causes silent job loss | Low | High | PM2 restart; BullMQ persistence; dead letter queue; alerts on queue depth |
| Quill economy creates moderation / fraud surface | Medium | Medium | V2 launches without cash-out; rate limits per account; abuse pattern detection before V3 cash-out |
| Overextended scope delays open beta | High | High | Persona specs as acceptance gate; no merges to main while persona specs fail |

---

## 16. Future Enhancements (Beyond Phase 11)

- **Foundry VTT two-way sync.** Foundry sidecar bridge in active research — real-time event sync via WebSocket. Export campaign state to Foundry modules; import scenes/actors back.
- **Roll20 import.** One-shot migration tooling for DMs leaving Roll20.
- **Voice-driven Co-DM.** Hands-free brain queries via Web Speech API; ElevenLabs TTS for AI responses; push-to-talk commands during sessions.
- **Native mobile app (React Native / Expo).** Offline support for NPC lookup and session notes when the table has no internet.
- **Live session sharing.** Players follow along on phones; DM controls what they see (initiative, scene description, NPC portraits).
- **AI map generation deep integration.** Stable Diffusion or fal.ai region/encounter maps generated from campaign descriptions and pinned to `CampaignMap`.
- **Multi-DM shared world.** Shared DM Brain across a team of co-DMs running the same setting (different parties); conflict resolution for entity state changes.
- **Session video support.** Full session video upload with frame extraction and speaker diarisation from the video audio track.
- **Remotion video generation.** 15-second animated NPC reveal videos for major NPCs.
- **Actual play / podcast mode.** Export session summaries as actual-play episode notes; intro/recap script generation; podcast RSS feed.
- **TTRPG group finder.** Campaign posts, player profiles, DM listings with reviews.
- **Publisher partnerships.** Officially licensed sourcebook ingestion with publisher revenue share.

---

## 17. Appendix

### Appendix A: BullMQ Worker List (28)

| Worker | Queue / Purpose |
|---|---|
| `pdf-worker` (`worker.ts`) | Homebrew PDF extraction via Docling |
| `transcription-worker` | AssemblyAI transcription jobs |
| `transcript-cleanup-worker` | Post-process transcript cleanup |
| `multi-track-worker` | Per-speaker audio merge and diarisation |
| `ai-summary-worker` | AI session summary generation |
| `recap-generation-worker` | DM and cinematic recap variants |
| `player-recap-worker` | Player-safe 90-second recap |
| `embeddings-worker` | pgvector embedding generation |
| `meili-sync-worker` | MeiliSearch index mirror |
| `image-generation-worker` | NPC/homebrew portraits (fal.ai/Replicate) |
| `visual-asset-worker` | Campaign visual assets pipeline |
| `map-generation-worker` | World map render jobs |
| `brain-ingestion-worker` | DM Brain entity/relationship extraction |
| `brain-inference-worker` | Drift detection, hook escalation, contradiction flagging |
| `context-extraction-worker` | `CampaignContext` enrichment |
| `world-simulation-worker` | Between-session world simulation tick |
| `co-dm-prep-worker` | Pre-warm Co-DM context before live session |
| `co-dm-worker` | Real-time Co-DM hints during live session |
| `combat-copilot-worker` | Combat encounter copilot (conditions, recharge, initiative) |
| `derailment-worker` | Objective-drift detection + GM recovery suggestions |
| `session-events-worker` | Structured session event log writer |
| `session0-prep-worker` | Session 0 auto-prep from sourcebook entities |
| `obsidian-import-worker` | Obsidian vault ZIP processing |
| `ddb-sync-coordinator-worker` | DDB sourcebook ingestion orchestrator |
| `ddb-chapter-extract-worker` | Per-chapter crawl + extraction |
| `ddb-sync-review-worker` | Entity-merge review queue |
| `sourcebook-scene-extraction-worker` | Dual-model scene/entity extraction |
| `webhooks-worker` | Outbound webhook delivery |
| `feedback-triage-worker` | Discord thread + GitHub issue creation |

### Appendix B: Estimated Monthly Costs at Scale

| Item | Free / Current | At 500 Users | Notes |
|---|---|---|---|
| Vercel | $0 | $0–20 | Hobby → Pro if bandwidth exceeds limits |
| Homelab LXC 206 | (electricity) | (electricity) | Self-hosted Postgres, Redis, workers, Meili, Ollama, crawl4ai, WS |
| Cloudflare R2 | $0 | $5–10 | Storage + egress for recordings and PDFs |
| AssemblyAI | $0 | $30–60 | $0.12/hr audio; 50 sessions × ~3hr/week |
| Claude / OpenAI / Gemini / Groq | $0 | $20–60 | Per-user keys preferred; server fallback for free tier |
| fal.ai / Replicate | $0 | $10–20 | ~5 images/user/month average |
| Resend email | $0 | $0 | 3,000 emails/month free tier |
| Stripe | 2.9%+30c | 2.9%+30c | Per transaction |
| PostHog | $0 | $0 | 1M events/month free |
| **Total** | **~$5** | **~$65–170** | Scales with AI API usage volume |

### Appendix C: Definition of Done

A feature is not shipped until:

- A workflow spec exists at `tests/workflows/<feature>.workflow.spec.ts`.
- Affected personas (`new-dm`, `veteran-dm`, `power-dm`, `player-join`, `mobile-dm`, `error-resilience`) are green.
- `npm run qa:cycle` passes.
- No `test.fixme` on new tests — stubs must be implemented before the feature is considered done.
- Atlas theme tokens are used; no per-page colour overrides.
- Mobile viewport (390px) verified.

**Persona specs are the acceptance gate.** When all six pass, QuiverDM is ready for that tier of users.

### Appendix D: Glossary

| Term | Definition |
|---|---|
| DM | Dungeon Master — the player who runs the game |
| DM Brain | QuiverDM's persistent world-state intelligence layer |
| Co-DM | QuiverDM's real-time AI session assistant |
| Story Worlds | The autonomous between-session simulation layer (Phase 6) |
| Atlas theme | The Single-Flow visual language unifying every screen (Phase 8) |
| Session 0 | The campaign kickoff session; auto-prepped from sourcebook content |
| Sourcebook | A published D&D book (e.g. Curse of Strahd) ingested from D&D Beyond |
| Sourcebook Entity | A master library NPC/Location/Event/Arc extracted from a sourcebook chapter |
| Quill | The virtual currency that will underpin the Phase 10 creator economy |
| BullMQ | Redis-backed job queue library for Node.js background workers |
| tRPC | Type-safe RPC framework for TypeScript; shared types between server and client |
| pgvector | PostgreSQL extension enabling vector similarity search |
| Docling | Open-source PDF-to-structured-markdown converter |
| AssemblyAI | Cloud ASR API used for session audio transcription |
| WhisperX | Local transcription fallback |
| crawl4ai | Browser automation service (Playwright) used for authenticated DDB crawling |
| Cobalt session | The DDB JWE cookie that authenticates sourcebook and character imports |
| Cloudflare R2 | S3-compatible object storage |
| fal.ai / Replicate / ComfyUI | Image generation backends |
| SRD | System Reference Document — open-licensed subset of D&D 5e rules |
| WER | Word Error Rate — transcription accuracy metric |
| HNSW | Hierarchical Navigable Small World — pgvector ANN index |
| PWA | Progressive Web App — installable mobile shell |
| Obsidian | Markdown knowledge management app — many DMs keep notes there |
| Foundry VTT | Self-hosted virtual tabletop with import/export support |

### Appendix E: What's New vs. PRD v1.0

| Area | v1.0 (March 2026) | v2.0 (May 2026) |
|---|---|---|
| tRPC routers | 35 | 49 |
| BullMQ workers | 12 | 28 |
| Prisma models | ~30 listed | 77 |
| Campaign sub-routes | 10 | 15 (adds sourcebook, mechanics, quests, world, world-map, foundry) |
| Worker plane | Hetzner VPS | Homelab LXC 206 under PM2 |
| AI provider chain | Claude / OpenAI / Gemini / Ollama | + Groq, with `forceProvider` override |
| Design system | Dark-first indigo-black + Cinzel | In-flight migration to Atlas theme: parchment + Spectral + IBM Plex |
| Sourcebooks | Not in scope | Full DDB ingestion + reader + Session 0 auto-prep |
| World simulation | Phase 6 in design | Phase 6 in-flight; world-simulation worker shipped |
| Recap | Single AI summary | DM recap + player recap (separate worker, separate share route) |
| Multi-track audio | Not in scope | Multi-track upload + speaker mapping reused across sessions |
| Derailment detection | Not in scope | `derailment-worker` proposes GM recovery options |
| Map and pins | Not in scope | `CampaignMap` + `MapPin` + `/world-map` view |
| Mechanics + quests pages | Not in scope | Both shipped as campaign-level surfaces |
| Browser extension | Not in scope | `extension-auth` router and Chromium extension folder live |
