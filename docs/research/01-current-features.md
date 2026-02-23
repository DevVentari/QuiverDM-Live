# QuiverDM — Current Feature Inventory
*Generated 2026-02-23*

---

## Platform Overview

QuiverDM is a production-ready, multi-user D&D campaign management platform with:
- **26 tRPC routers** across campaign, session, AI, and billing domains
- **5 background workers** (BullMQ + Redis)
- **32 UI pages** across authenticated app, auth, and marketing routes
- **40+ Prisma models** across campaign, character, content, transcription, AI, and billing
- **8+ third-party integrations**

---

## Routers (26)

| # | Router | What It Does |
|---|--------|-------------|
| 1 | `campaigns` | Campaign CRUD, stats, dashboard queries, membership management |
| 2 | `sessions` | Session lifecycle (create/start/end), DM visibility controls, player-scoped filtering |
| 3 | `npcs` | NPC CRUD with campaign-scoped search, MeiliSearch indexing |
| 4 | `players` | Legacy player records (being migrated to characters) |
| 5 | `characters` | Player-owned D&D 5e characters — full stat blocks, inventory, spells, feats |
| 6 | `charactersDndBeyond` | D&D Beyond character import and sync |
| 7 | `sessionTranscription` | Live transcription job management (AssemblyAI) |
| 8 | `sessionRecordings` | Audio/video recording upload and management |
| 9 | `transcript` | Transcript CRUD, inline editing, speaker rename |
| 10 | `homebrew` | Homebrew content library (10 types), manual create, campaign linking |
| 11 | `homebrewDndBeyond` | D&D Beyond homebrew import/sync |
| 12 | `homebrewPdf` | PDF upload, Docling processing, status polling |
| 13 | `homebrewExtraction` | AI extraction of creatures/spells/items from PDF pages |
| 14 | `userSettings` | Encrypted user API key storage (Gemini, OpenAI, etc.) |
| 15 | `members` | Campaign membership, role management (OWNER/CO_DM/PLAYER/SPECTATOR) |
| 16 | `invites` | Invite codes and direct email invites to campaigns |
| 17 | `onboarding` | 4-step onboarding wizard (welcome → profile → first_campaign → complete) |
| 18 | `feedback` | Closed beta feedback collection |
| 19 | `usage` | Per-user tier tracking (Free/Pro/Team) with quota enforcement |
| 20 | `billing` | Stripe checkout, customer portal, subscription management, webhook handling |
| 21 | `homebrewImage` | AI image generation jobs for NPCs and homebrew items |
| 22 | `whisper` | Speech-to-text via Whisper model (WhisperX fallback) |
| 23 | `encounters` | Real-time encounter tracker — initiative, HP, conditions, during live session |
| 24 | `encounterPlans` | Pre-session encounter builder with SRD monster picker, AI generation |
| 25 | `rules` | Rules lookup via semantic search (RAG over indexed homebrew PDFs + SRD) |
| 26 | `webhooks` | Outbound webhooks for session events (started, ended, summary.ready, encounter.logged) |
| 27 | `search` | Semantic search across campaign content using pgvector embeddings |

---

## Background Workers (5)

| Worker | Queue | What It Does |
|--------|-------|-------------|
| `ai-summary-worker` | `ai-summary` | Generates session summaries + highlight moments via Ollama/Gemini/OpenAI |
| `embeddings-worker` | `embeddings` | Creates semantic embeddings for transcripts, NPCs, quests (pgvector) |
| `webhooks-worker` | `webhooks` | Delivers webhook payloads with HMAC-SHA256 signatures and retry logic |
| `image-generation-worker` | `image-generation` | Generates NPC/homebrew images via ComfyUI, Replicate, or DALL-E |
| `transcription-worker` | `transcription` | Processes audio uploads via AssemblyAI (WhisperX fallback) |

---

## UI Pages (32)

### Core App
- `/dashboard` — Campaign grid, character list, pending invites, usage stats
- `/campaigns` — Campaign list with create dialog
- `/campaigns/join` — Join campaign via invite code
- `/onboarding` — 4-step wizard for new users
- `/settings` — Billing, API keys, account management
- `/feedback` — Closed beta feedback form

### Campaign (per-campaign, slug-scoped)
- `/campaigns/[slug]` — Campaign overview
- `/campaigns/[slug]/sessions` — Session timeline with status filter
- `/campaigns/[slug]/sessions/[id]` — 4-tab session detail (Live Play / Recordings / Transcript / Recap)
- `/campaigns/[slug]/npcs` — NPC list with search
- `/campaigns/[slug]/npcs/[id]` — NPC detail with image generation
- `/campaigns/[slug]/players` — Player party overview
- `/campaigns/[slug]/members` — Membership management (DM-only)
- `/campaigns/[slug]/encounters` — Encounter plan index (grid)
- `/campaigns/[slug]/encounters/[id]` — Encounter builder with tabs
- `/campaigns/[slug]/homebrew` — Campaign homebrew library
- `/campaigns/[slug]/search` — Semantic search across all campaign content
- `/campaigns/[slug]/settings` — Campaign settings + danger zone

### Characters
- `/characters` — All characters across all campaigns
- `/characters/[id]` — Character detail sheet

### Homebrew (global)
- `/homebrew` — Global homebrew library with type filter
- `/homebrew/pdfs` — PDF upload manager with processing status
- `/homebrew/pdfs/[id]` — PDF viewer with extraction controls

### Admin
- `/admin/invites` — Beta invite code generation and management
- `/admin/rules-sources` — Rules PDF indexing for RAG

### Public (unauthenticated)
- `/share/session/[token]` — Public shareable session recap page

---

## Prisma Data Models (40+)

### Core Entities
`User`, `Campaign`, `CampaignMember`, `CampaignInvite`, `GameSession`

### Characters
`Character`, `CampaignCharacter`, `CharacterItem`, `CharacterSpell`, `CharacterFeat`

### Encounters
`Encounter`, `EncounterParticipant`, `EncounterPlan`, `EncounterPlanCreature`

### Content / Homebrew
`HomebrewContent`, `HomebrewPDF`, `CampaignHomebrewContent`

### Transcription & Audio
`SessionRecording`, `Transcript`, `TranscriptionJob`

### AI & Search
`Embedding` (pgvector), `ImageGenerationJob`

### Webhooks & Events
`WebhookEndpoint`

### Billing & Auth
`InviteCode`, `UserUsage`, `UserSettings`, `Account`, `Session`, `VerificationToken`

### Legacy (being migrated)
`Player`, `PlayerSpell`, `PlayerFeat`, `PlayerItem`, `NPC`, `Spell`, `Feat`, `Item`

---

## Third-Party Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| **Stripe** | Billing — checkout, customer portal, subscription webhooks | ✅ Implemented |
| **AssemblyAI** | Live transcription with speaker diarization | ✅ Implemented |
| **Ollama** | On-premises AI (summaries, encounter gen, rules lookup) | ✅ Implemented |
| **Gemini / OpenAI** | Cloud AI fallback (user-provided API keys) | ✅ Implemented |
| **pgvector** | Semantic search via PostgreSQL extension | ✅ Implemented |
| **MeiliSearch** | Full-text search for homebrew and NPCs | ✅ Implemented |
| **D&D Beyond** | Character and homebrew import/sync | ✅ Implemented |
| **Resend** | Transactional email (welcome, invite, password reset) | ✅ Implemented |
| **NextAuth v5** | Authentication (email/password, session management) | ✅ Implemented |
| **ComfyUI / Replicate / DALL-E** | Image generation for NPCs and homebrew | ✅ Implemented |
| **BullMQ + Redis** | Async job queues for all background processing | ✅ Implemented |
| **Docling** | PDF-to-markdown conversion (MIT licensed) | ✅ Implemented |
| **Cloudflare R2** | File storage for PDFs, recordings, images | ✅ Implemented |
| **WebSocket Server** | Live transcription streaming and encounter sync | ✅ Implemented |

---

## Feature Status Summary

| Category | Status |
|----------|--------|
| Campaign Management | ✅ Complete |
| Session Management | ✅ Complete |
| Transcription & Audio | ✅ Complete |
| AI Summaries | ✅ Complete |
| Homebrew & PDF Processing | ✅ Complete |
| Player/Member Management | ✅ Complete |
| Semantic Search | ✅ Complete |
| Encounter Builder & Tracker | ✅ Complete |
| Rules RAG | ✅ Complete |
| Webhooks & Integrations | ✅ Complete |
| Image Generation | ✅ Complete |
| Billing & Subscriptions | ✅ Complete |
| Onboarding | ✅ Complete (polish needed) |
| E2E Tests | 🟡 Partial (2 specs, needs coverage) |
| Production Deployment | 🟡 Pending (Vercel + Railway config) |
