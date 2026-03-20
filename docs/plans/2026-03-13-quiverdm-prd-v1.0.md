# PRODUCT REQUIREMENTS DOCUMENT

## QuiverDM
### AI-Powered D&D Session Management Platform
**Version 1.0 | March 2026**
**Prepared by Blake Wales — blakewales.au**

---

| Field | Detail |
|---|---|
| Document Status | Draft |
| Version | 1.0 |
| Last Updated | 13 March 2026 |
| Author | Blake Wales |
| Stakeholders | Product Owner, Alpha Testers |
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

QuiverDM is an AI-powered D&D session management platform built for Dungeon Masters who want to spend less time on administrative prep and more time at the table. The system automates the full lifecycle of a D&D campaign: session recording and transcription, AI-generated session summaries, NPC and homebrew content management, persistent world-state tracking via the DM Brain, and real-time session assistance through the Session Cockpit.

The platform addresses the core pain point of experienced DMs: prep time. A typical session requires 2–4 hours of preparation — writing NPC backstories, tracking faction relationships, summarising past sessions, and generating encounter content. QuiverDM reduces this to under 30 minutes by extracting, organising, and surfacing world-state automatically from every session the DM runs.

The architecture is split across Vercel (frontend/API), a Hetzner VPS (BullMQ background workers and Docling PDF processing), Neon PostgreSQL, and Upstash Redis. The estimated monthly infrastructure cost is $15–40 AUD at current scale, growing to $80–120 AUD at 500 active users. The platform is live at https://quiverdm.com and self-hosted on app.nerdt.au.

---

## 2. Product Vision and Goals

### Vision Statement

Enable Dungeon Masters of all experience levels to run richer, more consistent campaigns by eliminating the administrative burden of world-tracking and session prep — replacing manual note-taking and research with an intelligent, always-current picture of their world.

### Core Principles

- **DM-first:** Every feature is designed for the person running the game, not the players.
- **Reduce friction, not agency:** AI assists and surfaces — it never decides for the DM.
- **Persistent world intelligence:** The system accumulates campaign knowledge across sessions, not just within them.
- **Table-ready:** Key flows must work on a phone or tablet at the gaming table.
- **Self-hostable soul:** The architecture reflects the values of the D&D community — open, customisable, not locked to a single cloud vendor.

---

## 3. Business Goals

| Goal | Description |
|---|---|
| Alpha launch | Ship to 50 invited DMs by end of March 2026 with all alpha-blocker features passing E2E |
| User growth | Reach 500 monthly active DMs by Q4 2026 |
| Revenue | Achieve $500 MRR from Pro/Team subscriptions within 6 months of paid tier launch |
| Retention | 60-day retention rate above 40% for DMs who complete onboarding and run at least one session |
| Content volume | Users upload 1,000+ session recordings per month by Q3 2026 |
| Conversion | Convert 20% of free users to Pro within 90 days of using the transcription or DM Brain features |

---

## 4. Success Metrics

| Metric | Baseline (Current) | Target (90 Days) | Measurement |
|---|---|---|---|
| Invited alpha users | 0 | 50 | Auth database |
| Weekly active DMs | 0 | 30 | PostHog session events |
| Sessions recorded per week | 0 | 50 | SessionRecording table |
| Avg session prep time | 120+ min (manual) | < 30 min (with QuiverDM) | User survey |
| Transcription accuracy | Baseline only | > 90% WER | Spot-check evaluation |
| DM Brain entities per campaign | 0 | 20+ | WorldEntity table |
| AI summary acceptance rate | N/A | > 70% unedited | GameSession.summary edit detection |
| Pro conversion rate | N/A | 20% | Stripe + user table |
| Onboarding completion rate | N/A | > 80% | Onboarding step tracking |
| E2E test pass rate | ~90% | 100% | npm run qa:cycle |

---

## 5. User Personas

### Persona 1: Nora — New DM

**Role:** First-time Dungeon Master, running a campaign for friends
**Technical level:** Basic (comfortable with apps, not code)
**Experience:** Has played D&D as a player for 2 years, just started DMing
**Goals:** Understand what to prep, create NPCs without reading the full rulebook, not forget what happened in previous sessions
**Pain points:** Overwhelmed by prep volume; forgets NPC names and details mid-session; doesn't know how to write a stat block
**App needs:** Guided onboarding, NPC creation wizard, session summary email after each session, simple campaign dashboard
**E2E persona:** `tests/personas/new-dm.persona.spec.ts`

### Persona 2: Vic — Veteran DM

**Role:** Experienced DM running 2–3 campaigns simultaneously
**Technical level:** Moderate (uses Obsidian, Foundry VTT, D&D Beyond)
**Experience:** 10+ years DMing, hundreds of sessions
**Goals:** Reduce session prep from 3 hours to under 45 minutes; maintain continuity across a long-running campaign; quickly recall any NPC from any session
**Pain points:** Session notes are scattered across Obsidian, Google Docs, and paper; can't keep track of faction relationships over 60+ sessions; prep time competes with real life
**App needs:** Obsidian vault import, DM Brain entity graph, rapid NPC search, session transcription, full stat block management
**E2E persona:** `tests/personas/veteran-dm.persona.spec.ts`

### Persona 3: Dana — Power DM

**Role:** Content creator and DM who publishes homebrew campaigns
**Technical level:** Advanced (uses custom modules, Foundry, Roll20, PDF tools)
**Experience:** Professional-level, runs published modules and custom content
**Goals:** Upload homebrew PDFs and have content auto-extracted; manage spell, item, and creature libraries; import from D&D Beyond
**Pain points:** Manually entering stat blocks from PDFs takes hours; homebrew content lives in too many places; character sheet tracking is error-prone
**App needs:** PDF upload with AI extraction, D&D Beyond character import, homebrew content library, encounter planner, image generation for NPCs/items
**E2E persona:** `tests/personas/power-dm.persona.spec.ts`

### Persona 4: Player — Campaign Participant

**Role:** Player in a DM's campaign (invited via link)
**Technical level:** Basic
**Goals:** View campaign information, access character sheet, see session summaries
**Pain points:** Forgets what happened in the last session; doesn't know what their character's spells/feats do
**App needs:** Campaign overview (read-only), character sheet access, session summary history
**E2E persona:** `tests/personas/player-join.persona.spec.ts`

### Persona 5: Mobile DM

**Role:** Any DM running a session at a physical table
**Technical level:** Basic (phone-first at the table)
**Goals:** Look up NPCs and homebrew quickly mid-session; add notes without breaking immersion; approve AI-generated content from phone
**Pain points:** Desktop UI is hard to use on a phone; typing is slow mid-combat; session cockpit must work on 390px viewport
**App needs:** Mobile-optimised campaign pages, NPC quick-lookup, tap-friendly action buttons, no horizontal overflow
**E2E persona:** `tests/personas/mobile-dm.persona.spec.ts`

### Persona 6: Error-Resilience

**Role:** Any user encountering service degradation
**Goals:** See clean error states, not crashes or blank screens
**Pain points:** White screen of death; silent failures on AI features when API quota is exceeded
**App needs:** Graceful fallback messaging on all AI features; form validation with clear field errors; retry surfaces on failed jobs
**E2E persona:** `tests/personas/error-resilience.persona.spec.ts`

---

## 6. System Architecture

### Architecture Overview

QuiverDM operates as a five-layer system: a Next.js frontend, a tRPC API layer, domain services, background worker processes, and an AI/processing layer. Each layer is independently deployable and communicates through well-defined interfaces.

| Layer | Purpose | Technology |
|---|---|---|
| 1. Web Application | User-facing Next.js pages and React components | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui |
| 2. API Layer | Type-safe RPC endpoints, authentication, route handlers | tRPC v11, NextAuth v5, Zod |
| 3. Domain Services | Business logic: campaign rules, AI orchestration, billing | 29 TypeScript service classes |
| 4. Background Workers | Async processing: transcription, PDF, summaries, embeddings | BullMQ v5, Redis (Upstash), 12 workers |
| 5. AI / Processing | LLM inference, transcription, PDF parsing, image generation | AssemblyAI, Gemini/OpenAI/Ollama, Docling, fal.ai |

### App Structure

```
src/app/
  page.tsx                          # Root redirect (auth → dashboard, else signin)
  (app)/                            # Authenticated app — all campaign/user pages
    dashboard/                      # Home dashboard
    campaigns/                      # Campaign list + creation
    campaigns/[slug]/               # Campaign workspace (11 sub-sections)
    characters/                     # Character library
    homebrew/                       # Homebrew content library
    settings/                       # User settings + API keys
    admin/                          # Admin panel (admin users only)
  (auth)/auth/                      # signin, signup, error
  (marketing)/                      # landing, pricing
  api/                              # auth, trpc, webhooks/stripe, uploads, health
```

### Server Structure

```
src/server/
  routers/          # 35 tRPC routers
  services/         # 29 business logic services
  repositories/     # 17 Prisma repository classes
  errors/           # Typed application errors
  trpc.ts           # tRPC initialisation and procedures
```

---

## 7. Technology Stack

| Component | Technology | Hosting | Est. Monthly Cost |
|---|---|---|---|
| Web Application | Next.js 15 (App Router) + TypeScript | Vercel | $0 (hobby tier) |
| API Layer | tRPC v11 + Zod | Vercel | (included) |
| Authentication | NextAuth v5 beta + Prisma adapter | Vercel | $0 |
| Database | PostgreSQL 16 (pgvector extension) | Neon | $0–19 |
| Queue / Cache | Redis 7 | Upstash | $0–10 |
| Background Workers | BullMQ v5 (12 workers) | Hetzner VPS | $8/mo |
| PDF Processing | Docling (Docker) | Hetzner VPS | (included) |
| Full-text Search | MeiliSearch | Hetzner VPS | (included) |
| Media Storage | Cloudflare R2 (S3-compatible) | Cloudflare | $0–5 |
| AI Transcription | AssemblyAI | Cloud API | $0.12/hr audio |
| AI Copy / Extraction | Gemini 2.0 Flash / OpenAI / Ollama | Cloud API / self-hosted | $0–20 |
| Image Generation | fal.ai | Cloud API | $0–10 |
| Billing | Stripe | Cloud SaaS | 2.9% + 30c per txn |
| Transactional Email | Resend | Cloud API | $0 (free tier) |
| Error / Analytics | PostHog (EU cloud) | Cloud SaaS | $0 (free tier) |
| Feedback | Discord Bot | Discord | $0 |
| Reverse Proxy / HTTPS | Cloudflare (DNS) | Cloudflare | $0 |
| CI / Deploy | Vercel Git integration | Vercel | $0 |

**Minimum monthly cost:** ~$8 AUD (Hetzner VPS only, within free tiers everywhere else)
**At 500 active users:** ~$50–120 AUD depending on AI API usage volume

---

## 8. Infrastructure

### Service Topology

| Service | Location | Port | Purpose |
|---|---|---|---|
| Next.js App | Vercel | 443 (HTTPS) | Frontend + API routes + tRPC |
| PostgreSQL (pgvector) | Neon | 5432 | Primary database |
| Redis | Upstash | 6380 | BullMQ queues + caching |
| BullMQ Workers (×12) | Hetzner VPS | — | All background job processing |
| Docling | Hetzner VPS | 5001 | PDF-to-markdown conversion |
| MeiliSearch | Hetzner VPS | 7701 | Full-text search indexing |
| Cloudflare R2 | Cloudflare | — | Session recordings, generated media |
| Ollama (optional) | Local / Hetzner | 11434 | Local LLM inference fallback |

### Local Development Services (Docker Compose)

```yaml
postgres:    port 5433   # pgvector required
redis:       port 6380
meilisearch: port 7701
docling:     port 5001
ollama:      port 11434
```

### Deployment Flow

- `git push origin main` → Vercel auto-deploys frontend + API
- Worker redeploy: `ssh root@204.168.157.125 'cd /opt/quiverdm && docker compose up -d --force-recreate workers'`
- Database migrations: `npm run db:push` (Prisma schema push to Neon)
- Vercel cron: `/api/health` every 4 minutes (prevents Neon DB autosuspend causing 504s)

---

## 9. Data Model

All persistent data lives in PostgreSQL managed via Prisma. Key models are described below.

### User and Settings

| Model | Key Fields | Purpose |
|---|---|---|
| User | id, email, name, role, tier, onboardingCompleted | Auth identity and billing tier |
| UserSettings | userId, geminiApiKey (encrypted), openAiApiKey | Per-user AI provider credentials |
| UserUsage | userId, provider, requestCount, tokenCount | Usage tracking for rate limiting and cost attribution |
| ApiUsageLog | userId, provider, model, feature, inputTokens, outputTokens, cost | Granular AI cost log per call |

### Campaign and Members

| Model | Key Fields | Purpose |
|---|---|---|
| Campaign | id, slug, name, userId, description, setting | Root campaign entity |
| CampaignMember | campaignId, userId, role (OWNER / CO_DM / PLAYER / SPECTATOR) | Campaign access control |
| CampaignInvite | campaignId, code, role, expiresAt | Invite link management |
| Player | campaignId, userId, characterName, backstory | Player-facing campaign presence |

### Sessions

| Model | Key Fields | Purpose |
|---|---|---|
| GameSession | id, campaignId, title, date, summary, summaryStatus, prepNotes | Session record with AI summary |
| SessionRecording | sessionId, storageUrl, duration, fileSize, contentType | Audio/video upload from recording |
| TranscriptionJob | recordingId, status, provider, result, errorMessage | Async transcription job tracking |
| Transcript | sessionId, content, wordCount, speakerDiarized | Final transcript text |
| SessionEntityAppearance | sessionId, entityId, mentionCount, context | Entity → session cross-reference |
| SessionMechanicalEvent | sessionId, type, description, timestamp | Combat/mechanical event log |

### NPCs and Characters

| Model | Key Fields | Purpose |
|---|---|---|
| NPC | id, campaignId, name, race, class, alignment, statBlock (JSON), backstory, imageUrl | Full NPC record with 5e stat block |
| Character | id, userId, name, class, race, level, abilityScores (JSON), dndBeyondId | Player character sheet |
| CharacterSpell / CharacterFeat / CharacterItem | characterId, … | Character spell/feat/item lists |
| Spell / Feat / Item | Global compendium entries seeded from 5e SRD | Rules reference data |

### Homebrew Content

| Model | Key Fields | Purpose |
|---|---|---|
| HomebrewContent | id, campaignId, type (SPELL/MONSTER/ITEM/RULE), name, data (JSON), sourceType | Extracted or manually created homebrew |
| HomebrewPDF | id, campaignId, fileName, storageUrl, processingStatus, extractedCount | Uploaded PDF with processing state |
| CampaignHomebrewContent | campaignId, contentId | Many-to-many campaign ↔ homebrew |
| ImageGenerationJob | contentId, prompt, status, resultUrl | Async fal.ai image generation job |

### DM Brain — World State

| Model | Key Fields | Purpose |
|---|---|---|
| WorldEntity | campaignId, name, type (NPC/PC/FACTION/LOCATION/ITEM/EVENT), properties (JSON), embedding | Entity node in world graph |
| WorldRelationship | sourceId, targetId, type, strength, description, history (JSON) | Typed relationship edge between entities |
| WorldStateChange | entityId, sessionId, field, previousValue, newValue, trigger | Immutable audit log of world state mutations |
| WorldState | campaignId, registers (JSON), pressureTracks (JSON), unresolvedHooks (JSON) | Aggregate world state snapshot |
| WorldActor | campaignId, type (FACTION/GOD/REGION), goal, urgency, resources, riskTolerance | Autonomous world simulation actor |
| WorldSimulationEvent | campaignId, actorId, description, consequences (JSON), timestamp | Event emitted by world simulation |

### Encounters and Search

| Model | Key Fields | Purpose |
|---|---|---|
| Encounter | sessionId, name, status (PLANNED/ACTIVE/COMPLETE), round, initiativeOrder (JSON) | Combat encounter tracker |
| EncounterParticipant | encounterId, name, hp, maxHp, initiative, conditions | Participant in an encounter |
| EncounterPlan | campaignId, title, creatures (JSON), notes | Pre-built encounter template |
| Embedding | entityId, entityType, content, vector | pgvector embeddings for narrative search |

### Infrastructure Models

| Model | Key Fields | Purpose |
|---|---|---|
| ObsidianImportJob | userId, campaignId, status, fileCount, processedCount, errorCount | Obsidian vault import job state |
| FoundryImportJob | campaignId, status, entityCount | Foundry VTT data import job |
| FoundryEvent | jobId, type, data (JSON) | Individual Foundry event during import |
| QaFailure | testName, error, screenshotUrl, timestamp | E2E failure log for QA monitoring |
| WebhookEndpoint | userId, url, events, secret | Outbound webhook delivery |
| Feedback | userId, message, context, discordThreadId | In-app feedback with Discord integration |

---

## 10. Feature Pipeline Architecture

### Pipeline 1: Session Recording and Transcription

Triggered when a DM uploads or records audio/video for a session. Handles multi-format input, uploads to R2 storage, and dispatches async transcription.

1. DM uploads audio/video via session page or audio recorder component
2. Client requests presigned R2 upload URL via `POST /api/uploads`
3. File uploaded directly to Cloudflare R2 (browser-to-R2, never through Next.js server)
4. `SessionRecording` record created; `transcription-worker` job enqueued in BullMQ
5. Worker calls AssemblyAI with presigned audio URL; polls for completion
6. On success: `Transcript` record created; session page updates via tRPC query invalidation
7. On failure: `TranscriptionJob.status = FAILED`; error surfaced in session UI; retry available
8. Speaker diarisation applied if enabled (AssemblyAI speaker labels)

### Pipeline 2: AI Session Summary

Triggered on demand or automatically after transcription completes. Generates a structured narrative summary from transcript content.

1. DM clicks "Generate Summary" or pipeline auto-triggers post-transcription
2. `summary-worker` job enqueued with session ID
3. Worker fetches transcript + existing campaign context (recent sessions, key NPC names)
4. Calls Gemini 2.0 Flash (user key if set, server env fallback) with structured prompt
5. Prompt instructs model to produce: narrative summary, key events list, NPC appearances, unresolved hooks
6. Result written to `GameSession.summary`; `summaryStatus = COMPLETE`
7. Summary displayed in session page; DM can edit inline

### Pipeline 3: DM Brain Ingestion

Triggered after session summary generation completes. Extracts entities, relationships, and state changes from session content, updating the persistent world graph.

1. `brain-ingestion-worker` receives session ID after summary is marked complete
2. Worker loads summary + transcript + existing `WorldEntity` records for campaign
3. Calls AI with extraction schema: identifies entities (NPCs/PCs/Factions/Locations) and relationships
4. Entity resolution: compares extracted names against existing entities using embedding similarity (pgvector cosine distance). Aliases resolved to canonical nodes.
5. New entities created as `WorldEntity` records with `embedding` vector
6. New/updated relationships written as `WorldRelationship` records
7. State changes (loyalty, location, stress) logged as `WorldStateChange` records
8. `WorldState` registers updated (faction influence scores, pressure tracks, unresolved hooks)
9. DM Brain dashboard reflects updated entity graph and hook list

### Pipeline 4: Homebrew PDF Processing

Triggered when a DM uploads a PDF to their campaign homebrew library.

1. DM uploads PDF via drag-and-drop uploader in campaign homebrew page
2. File streamed to R2 storage; `HomebrewPDF` record created with `processingStatus = PROCESSING`
3. `pdf-worker` job enqueued with PDF storage URL
4. Worker fetches PDF from R2, sends to Docling service (Hetzner VPS, port 5001)
5. Docling returns structured markdown; pdfplumber used as fallback if Docling fails
6. Markdown chunked by content type: spell blocks, creature stat blocks, item entries, rules text
7. Each chunk passed to `obsidian-extraction.ts` with type-specific Zod schema and AI prompt
8. Extracted content written as `HomebrewContent` records with `type` and `data` (JSON)
9. `HomebrewPDF.processingStatus = COMPLETE`; extracted count surfaced in UI
10. Image generation jobs optionally enqueued per NPC/creature via `image-worker` (fal.ai)

### Pipeline 5: Obsidian Vault Import

Triggered when a DM uploads a zipped Obsidian vault to bootstrap their campaign.

1. DM uploads vault ZIP via settings or onboarding import screen
2. `obsidian-import-process.ts` worker receives job; extracts ZIP
3. Smart session file detection filters duplicates, raw transcripts, and non-content files
4. Markdown files parsed: headings mapped to entity types, frontmatter extracted
5. Per-file entity extraction via AI (same pipeline as PDF processing)
6. Entities upserted into campaign: NPCs, sessions, locations, factions
7. Progress events streamed to UI via tRPC subscription; `ObsidianImportJob` status updated
8. Summary shown on completion: "Imported 47 NPCs, 12 sessions, 8 locations"

### Pipeline 6: Narrative Search (Embeddings)

Runs continuously after content is created or updated. Powers semantic search across campaign content.

1. `embeddings-worker` processes new/updated content (NPCs, sessions, homebrew, transcripts)
2. Text content chunked and sent to embedding model (Ollama `nomic-embed-text` or OpenAI `text-embedding-3-small`)
3. Vectors stored in `Embedding` table (pgvector)
4. MeiliSearch index updated in parallel for keyword search
5. `/campaigns/[slug]/search` page queries both: pgvector for semantic, MeiliSearch for keyword; results merged
6. DM Brain inference layer uses embeddings for entity resolution and relationship drift detection

---

## 11. Application Views and Requirements

### Dashboard

The authenticated home page for a logged-in DM.

- Recent campaigns grid with last-active date and session count
- Quick-create campaign button
- Upcoming session countdown (if sessions have dates set)
- Recent activity feed: last DM Brain update, last transcription completed, last homebrew added
- Global NPC and content search bar (powered by MeiliSearch)

### Campaign Workspace

The primary workspace for a single campaign, accessible at `/campaigns/[slug]/`. Tab navigation to 10 sub-sections:

**Overview (`/page.tsx`):** Campaign name, description, setting summary, DM Brain status summary card (entity count, hook count), recent sessions list, quick-access NPC grid.

**Sessions (`/sessions`):** Paginated list of all sessions with date, title, summary preview, and recording status badge. Per-session page: transcript, AI summary, recording player, entity appearances, mechanical events log.

**NPCs (`/npcs`):** Searchable grid of all campaign NPCs with avatar, name, race/class, and faction badge. NPC detail page: full 5e stat block, backstory, relationships tab (DM Brain graph), session history, AI-generated image.

**Players (`/players`):** List of campaign members with role badges. Player management for the DM: set roles, remove members, send invites.

**Members (`/members`):** Campaign invite management. Generate invite links by role. View accepted/pending invites.

**Homebrew (`/homebrew`):** Campaign homebrew library. Filter by type (spells/monsters/items/rules). Upload PDF, view extraction status, manually create content. D&D Beyond import flow.

**Brain (`/brain`):** DM Brain workspace. Entity list with type filter. Unresolved hooks panel with urgency indicators. Seed button to bootstrap from existing session summaries. Entity detail drawer: properties, relationship graph, state change history.

**Encounters (`/encounters`):** Encounter planner and tracker. Create encounter plans with creature lists. Activate encounter for live combat tracking: initiative order, HP, conditions, round counter.

**Summaries (`/summaries`):** Paginated session summary history with edit access. Export to PDF or Markdown.

**Settings (`/settings`):** Campaign-level settings: name, description, setting, image. Danger zone: delete campaign.

**Search (`/search`):** Full-text + semantic search across all campaign content.

### Homebrew Library (`/homebrew`)

Global homebrew library across all campaigns. Filter by type, source, and campaign. Batch assign content to campaigns. PDF management with processing status.

### Characters (`/characters`)

User's character library across all campaigns. Import from D&D Beyond (CobaltSession cookie). Character sheet tabs: stats, spells, feats, items. Session state tracking (HP, conditions per session).

### Settings (`/settings`)

- Profile: display name, avatar
- API Keys: Gemini key (with free tier badge and quota callout), OpenAI key, CobaltSession for D&D Beyond
- Notifications: email preferences
- Billing: current plan badge, upgrade CTA, Stripe customer portal link
- API Usage: per-provider summary, feature breakdown, recent call log, period selector (`/settings/api-usage`)

### Onboarding

Wizard flow for new users. Steps: create first campaign → import Obsidian vault or start fresh → create first NPC → invite a player → run first session. Skippable at any point; progress saved. Completion gates the main dashboard.

---

## 12. Role-Based Access Control

| Role | Dashboard | Campaign Overview | Sessions | NPCs | Members | Brain | Settings |
|---|---|---|---|---|---|---|---|
| OWNER | Full | Full | Full | Full | Full | Full | Full |
| CO_DM | Full | Full | Full | Full | View + Invite | Full | No |
| PLAYER | Own only | Read | Read (summaries only) | Read | No | No | No |
| SPECTATOR | No | Read | Read | Read | No | No | No |

Campaign procedures in `src/server/trpc.ts`:
- `campaignMemberProcedure` — any campaign member
- `campaignDMProcedure` — OWNER or CO_DM only
- `campaignOwnerProcedure` — OWNER only

---

## 13. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Dashboard page load | < 1.5s on 4G mobile |
| Performance | NPC list (100 NPCs) render | < 500ms |
| Performance | AI summary generation | < 60s end-to-end |
| Performance | Transcription turnaround | < 2× audio length |
| Performance | PDF extraction (50-page PDF) | < 5 min end-to-end |
| Performance | Semantic search response | < 300ms |
| Availability | Vercel uptime | > 99.9% (Vercel SLA) |
| Availability | Hetzner worker uptime | > 99% monthly |
| Availability | Graceful AI degradation | Queue jobs if API unavailable; surface status in UI |
| Scalability | Concurrent BullMQ workers | 12 workers, configurable concurrency per queue |
| Scalability | PostgreSQL row limit | No degradation up to 1M rows per table |
| Scalability | Embedding search | pgvector HNSW index for < 100ms at 100k vectors |
| Security | Authentication | NextAuth v5 with PKCE, bcrypt password hashing |
| Security | API key storage | AES-256 encrypted at rest in UserSettings |
| Security | Session recordings | Presigned R2 URLs (15-min expiry) — never public |
| Security | tRPC procedures | All mutations require authenticated session; campaign procedures verify membership |
| Security | Stripe webhook | Signature verification on all events |
| Data Privacy | AI content | User-uploaded content never used for model training (API contracts with Gemini/OpenAI) |
| Data Privacy | Voice/audio | Recordings stored in user-scoped R2 paths; never shared between accounts |
| Maintainability | All workers containerised | Docker Compose with version-pinned images on Hetzner |
| Maintainability | Type safety | tRPC + Zod across all API boundaries; no `any` in production paths |
| Maintainability | E2E coverage | All major user flows covered by persona specs; `npm run qa:cycle` passes before every merge |
| Mobile | Touch targets | Minimum 44×44px on all interactive elements |
| Mobile | Viewport | No horizontal overflow at 390px (iPhone 14); all key actions visible without scroll |

---

## 14. Phased Implementation Plan

### Phase 1: Foundation — Complete

**Goal:** Core campaign, session, NPC, and character management. Authentication and billing infrastructure.

- Next.js 15 App Router with tRPC v11 and NextAuth v5
- Prisma schema: User, Campaign, CampaignMember, GameSession, NPC, Character, HomebrewContent
- Campaign CRUD with slug routing, member invite system
- NPC creation with manual stat block entry
- Billing: Stripe checkout, subscription management, usage tiers (Free/Pro/Team)
- Email: welcome, invite, password reset (Resend)
- Deliverable: DMs can create campaigns, run sessions, add NPCs, invite players.

### Phase 2: AI Processing Pipelines — Complete

**Goal:** Session recording, transcription, AI summaries, homebrew PDF processing, and embeddings.

- Cloudflare R2 integration with presigned browser upload
- AssemblyAI transcription pipeline with BullMQ job orchestration
- Gemini 2.0 Flash session summary generation
- Docling PDF processing with AI entity extraction
- Narrative search via pgvector embeddings + MeiliSearch
- Per-user Gemini API key support with encrypted storage
- Deliverable: DMs can upload recordings, get transcripts and summaries, extract homebrew from PDFs.

### Phase 3: Session Mode Dashboard — Complete

**Goal:** Real-time session cockpit for use during active play.

- `/sessions/[id]/live` — full-screen session cockpit
- Live scene notes with AI overlay
- Party HP/conditions/initiative panel
- Zero-friction NPC recall sidebar
- Combat mode (encounter tracker morphs in-place)
- DM panic tools: roll, generate NPC, suggest twist
- Real-time AI context alerts
- One-click end-session pipeline: summary → journals → NPCs → prep tasks
- Deliverable: DMs can run entire sessions without leaving the cockpit.

### Phase 4: Autonomous Co-DM — Complete

**Goal:** Real-time narrative operator inside the session cockpit powered by DM Brain context.

- Context stream processing (NPC names, goals, threats, HP trends, pacing signals)
- Prediction models: combat drag alerts, engagement drops, escape likelihood
- Autonomous NPC behavior updates (goals/fear/loyalty/secrets)
- On-demand improv content generation (world-consistent twists, NPC reactions)
- Encounter autopilot (conditions, recharge, initiative management)
- Lore continuity guardian
- Confidence threshold UI: silent → hint → highlight → alert
- Four permission levels: Manual → Assist → Auto Mechanical → Full Co-DM
- Deliverable: DMs have a persistent AI collaborator during sessions.

### Phase 5: DM Brain — Complete

**Goal:** Persistent world-state intelligence layer; load-bearing substrate between Co-DM and Story Worlds.

- Entity graph: NPC/PC/Faction/Location/Item/Event nodes + typed relationship edges
- Per-entity state versioning (stress, loyalty, motivation, secrets, location)
- WorldState registers: faction influence scores, regional stability, pressure tracks, unresolved hooks
- Brain ingestion pipeline: background worker extracts entities from summaries + transcripts
- Entity resolution: alias collapse using pgvector embedding similarity
- DM-facing surface: entity graph explorer, unresolved hooks list, faction influence chart
- Bootstrap: backfill from historical summaries via seed button
- Deliverable: Every session automatically enriches a persistent world model the DM can query at any time.

### Phase 6: Autonomous Story Worlds — In Progress

**Goal:** Self-generating narrative ecosystem; continuous simulation running between sessions.

- World Motivation Engine: factions/gods/regions/disasters each carry goal/urgency/resources/risk_tolerance, evaluated each simulation tick
- Continuous simulation loop: detect instability → actor actions → events → consequences → timeline update
- Story Pressure system: political/supernatural/economic/cosmic/social pressure tracks; threshold breach triggers major arc events
- Autonomous adventure hooks generated from world state (not random tables)
- Dynamic arc construction: Act I–IV detected from pattern history
- NPC autonomous lives between sessions
- Player-driven gravity: party behavior shapes probability fields
- Parallel storylines evolve independently when ignored
- Mythogenesis engine: writes legend cycles from simulation history
- Architecture: Autonomous Story Engine → Living World Simulation → DM Brain → Co-DM → Session Mode
- Deliverable: The world feels alive between sessions without DM input.

### Phase 7: Creator Economy — Planned

**Goal:** Monetisation and creator economy layer.

- Public homebrew marketplace: DMs publish and share content packs
- Campaign module publishing: sell complete campaign modules with encounters, NPCs, maps
- Creator revenue share: Stripe Connect for creator payouts
- Subscription content: premium campaign modules available on Pro tier
- Community ratings and reviews
- Content versioning and forking
- Deliverable: QuiverDM becomes a platform, not just a tool.

---

## 15. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AssemblyAI transcription quality poor for D&D content (spell names, creature names) | Medium | High | Post-processing vocabulary hints with D&D terminology. Store custom vocabulary list. Evaluate Whisper as fallback via self-hosted whisper worker. |
| Gemini API quota exceeded for free-tier users | High | Medium | Per-user API key support already implemented. Server-side rate limiting via `UserUsage`. Clear quota indicators in settings. |
| AI extracts incorrect entity relationships, polluting DM Brain | Medium | High | Human-in-the-loop: DM can review and delete world entities/relationships. State changes are immutable audit log (never overwrite, only append). |
| Neon DB autosuspend causing cold-start 504s | High | Medium | Vercel cron pings `/api/health` every 4 minutes to keep connection warm. |
| Docling service unavailable on Hetzner VPS | Low | Medium | pdfplumber fallback in PDF worker. Queue jobs retry 3× before marking as failed. |
| R2 CORS misconfiguration breaks browser uploads | Medium | High | CORS config managed as code (`r2-cors.json`). Content-type detection from file extension when browser `file.type` is empty (already fixed). |
| Stripe webhook replay or duplicate event processing | Low | High | Webhook event deduplication by `stripe_event_id`. Idempotent handler logic. |
| D&D Beyond scraper breaks on site changes | Medium | Medium | CobaltSession cookie approach is user-authenticated, not scraping. Monitor for API changes. Graceful error if import fails. |
| Long-running AI jobs block BullMQ worker slots | Medium | Medium | Separate queues per job type with independent concurrency limits. Timeout policies per queue. |
| Obsidian vault import ingests sensitive personal notes | Low | High | User owns their data. Import wizard shows file list before processing. Users can delete any imported entity. Privacy policy covers user-uploaded content. |
| Worker container crash on Hetzner causes silent job loss | Low | High | BullMQ job persistence in Redis. Workers restart automatically via Docker `restart: unless-stopped`. Dead letter queue for failed jobs. Alert on queue depth spike. |
| Overextended feature scope delays alpha launch | High | High | Hard alpha blocker list in kanban. Definition of Done requires E2E persona specs passing. No new features merge until blockers are green. |

---

## 16. Future Enhancements (Beyond Phase 7)

**Foundry VTT two-way sync:** Export QuiverDM campaign state to Foundry modules. Import Foundry scenes, actors, and items back into QuiverDM. Real-time sync during live sessions via WebSocket bridge.

**Roll20 / D&D Beyond integration:** Import campaign data from existing platforms for DMs migrating to QuiverDM. Sync character sheets bidirectionally with D&D Beyond.

**Voice-driven app interaction:** Hands-free DM Brain queries via Web Speech API. Push-to-talk commands during sessions: "look up Malachar the Red", "roll persuasion DC 15", "add 10 damage to the goblin boss". ElevenLabs TTS for AI responses.

**Mobile app (React Native / Expo):** Native iOS and Android app with offline support for session notes and NPC lookup when table has no internet.

**Live session sharing:** Players can follow along in real-time on their phones during a session. DM controls what players see (initiative order, scene description, NPC portraits).

**AI map generation:** Generate encounter maps and regional maps from campaign descriptions using Stable Diffusion. Integrated into the session prep workflow.

**Multi-DM campaign support:** Shared DM Brain across a team of co-DMs running the same campaign world (e.g., shared setting, different parties). Conflict resolution for entity state changes.

**Session video support:** Upload full session video recordings. Extract video frames for moment-in-time snapshots. Speaker diarisation from video audio track.

**Remotion video generation:** Replace static NPC portraits with 15-second animated reveal videos for major NPCs. DM plays the video at the table when introducing a character.

**Podcast / actual play mode:** Export session summaries as formatted actual-play episode notes. Generate intro/recap scripts. Integrate with podcast RSS feed generation.

---

## 17. Appendix

### Appendix A: Docker Compose Service Map (Hetzner VPS)

| Service | Image | Volume | Purpose |
|---|---|---|---|
| workers | Custom build (Node 20) | app:/app | All 12 BullMQ workers |
| docling | ghcr.io/ds4sd/docling:latest | — | PDF-to-markdown conversion |
| meilisearch | getmeili/meilisearch:latest | meili-data:/data | Full-text search |
| ollama | ollama/ollama:latest | ollama-models:/root/.ollama | Local LLM inference |

### Appendix B: BullMQ Worker List (12 Workers)

| Worker | Queue | Purpose |
|---|---|---|
| pdf-worker | homebrew-pdf | PDF extraction via Docling |
| transcription-worker | transcription | AssemblyAI transcription jobs |
| summary-worker | session-summary | AI session summary generation |
| embeddings-worker | embeddings | pgvector embedding generation |
| image-worker | image-generation | fal.ai NPC/homebrew image generation |
| brain-ingestion-worker | brain-ingestion | DM Brain entity extraction |
| brain-inference-worker | brain-inference | Relationship drift detection, hook escalation |
| obsidian-worker | obsidian-import | Obsidian vault ZIP processing |
| foundry-worker | foundry-import | Foundry VTT data import |
| webhooks-worker | webhooks | Outbound webhook delivery |
| feedback-worker | feedback | Discord forum thread creation |
| health-worker | health | Queue depth monitoring, dead letter processing |

### Appendix C: Estimated Monthly Costs at Scale

| Item | Free / Current | At 500 Users | Notes |
|---|---|---|---|
| Vercel (hosting) | $0 | $0–20 | Hobby tier → Pro if bandwidth exceeds limits |
| Neon PostgreSQL | $0 | $19 | Scale tier for 500 active users |
| Upstash Redis | $0 | $10 | Pay-per-use, ~10k BullMQ jobs/day |
| Hetzner VPS | $8 | $8–20 | CPX21 sufficient to ~500 users; upgrade at 1k |
| Cloudflare R2 | $0 | $5 | Storage + egress for recordings |
| AssemblyAI | $0 | $30–60 | $0.12/hr audio; 50 sessions × avg 3hr/week |
| Gemini/OpenAI | $0 | $20–40 | Per-user key preferred; server key for free tier only |
| fal.ai image gen | $0 | $10 | ~5 images/user/month on average |
| Resend email | $0 | $0 | 3,000 emails/month free tier |
| Stripe | 2.9%+30c | 2.9%+30c | Per transaction; no monthly fee |
| PostHog | $0 | $0 | 1M events/month free |
| **Total** | **~$8** | **~$100–175** | Scales linearly with active users |

### Appendix D: Glossary

| Term | Definition |
|---|---|
| DM | Dungeon Master — the player who runs the game, creates the world, and adjudicates rules |
| DM Brain | QuiverDM's persistent world-state intelligence layer; accumulates entities and relationships from every session |
| Co-DM | QuiverDM's real-time AI session assistant operating during active play |
| BullMQ | Bull Message Queue — Redis-backed job queue library for Node.js background workers |
| tRPC | Type-safe RPC framework for TypeScript; shared types between server and client with no codegen |
| pgvector | PostgreSQL extension enabling vector similarity search — used for entity resolution and narrative search |
| Docling | Open-source PDF-to-structured-markdown converter; used as primary PDF processing service |
| AssemblyAI | Cloud ASR (Automatic Speech Recognition) API; used for session audio transcription |
| Neon | Serverless PostgreSQL with autoscaling and branching; primary production database |
| Upstash | Serverless Redis with HTTP API; used for BullMQ job queues |
| Cloudflare R2 | S3-compatible object storage; used for session recordings and generated media |
| Hetzner VPS | Virtual private server running all BullMQ workers and Docling |
| fal.ai | Cloud API for diffusion model image generation (NPC portraits, item illustrations) |
| SRD | System Reference Document — the open-licensed subset of D&D 5e rules used for compendium data |
| WER | Word Error Rate — transcription accuracy metric; lower is better |
| HNSW | Hierarchical Navigable Small World — approximate nearest neighbour index used by pgvector |
| LUFS | Loudness Units Full Scale — audio loudness standard (relevant for future voice features) |
| Obsidian | Popular markdown-based knowledge management app; many DMs keep campaign notes there |
| Foundry VTT | Foundry Virtual Tabletop — self-hosted VTT platform with import/export support |
