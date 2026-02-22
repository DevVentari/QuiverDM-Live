# QuiverDM Feature Roadmap Design
**Date:** 2026-02-22
**Status:** Approved

## Global Architecture Decisions

- **AI**: Multi-provider via existing `src/lib/ai/` abstraction (Ollama default, Gemini/OpenAI override)
- **Vector search**: pgvector extension on existing Postgres — no new service
- **BullMQ**: New queues: `ai-summary`, `embeddings`, `audio-ingest`, `webhooks`
- **Player portal**: Same app, role-scoped views using existing `PLAYER` role + `campaignMemberProcedure`
- **Image gen**: Extend existing `ImageGenerationJob` / `homebrew-image.ts` — optional `COMFYUI_URL` env flag

## Execution Strategy

```
PHASE 1 (sequential): Feature 1 — AI Summaries (schema migration + worker + UI)
PHASE 2 (parallel):   Features 2–8 — 7 Codex agents in separate worktrees
```

Feature 2 and Feature 7 both use the `Embedding` model. Feature 7's worktree will receive the same schema block as Feature 2 in its handoff doc, and both will be merged after resolving any schema conflicts.

---

## Feature 1 — AI Session Summaries + Highlights Hub

### Schema additions to `GameSession`
```prisma
aiSummary       String?   @db.Text
aiSummaryStatus String    @default("none")  // none|pending|processing|done|error
aiSummaryError  String?
aiSummaryAt     DateTime?
aiHighlights    Json?     // [{type,text,timestampMs,speakerLabel}]
shareToken      String?   @unique
```

### Pipeline
1. `sessions.generateSummary` tRPC mutation → enqueue BullMQ `ai-summary` job
2. Worker: fetch transcript text → call multi-provider LLM → structured output:
   - `summary`: markdown string
   - `highlights`: `[{type: decision|npc_change|cliffhanger|combat|loot, text, timestampMs?, speakerLabel?}]`
3. Write results back to `GameSession`

### UI Components
- Summary panel in session view: generate button → polling → markdown render
- `/campaigns/[slug]/summaries` hub: card grid of all sessions with summary previews
- Highlights inline in transcript view: colored pills on segments by type
- Share: `GameSession.shareToken` → public route `/share/session/[token]`
- Export: "Copy summary" + "Copy highlights" clipboard buttons

---

## Feature 2 — Narrative Search + Timeline

### Schema additions
```prisma
// prisma/schema.prisma — add pgvector extension
generator client {
  // add: previewFeatures = ["postgresqlExtensions"]
}
datasource db {
  // add: extensions = [vector]
}

model Embedding {
  id         String @id @default(cuid())
  entityType String // transcript|npc|location|quest|rules
  entityId   String
  chunkText  String @db.Text
  chunkIndex Int
  vector     Unsupported("vector(1536)")
  metadata   Json?
  campaignId String?
  createdAt  DateTime @default(now())

  @@index([campaignId, entityType])
}
```

### Pipeline
- After transcript save / NPC save → BullMQ `embeddings` queue → chunk text → embed via multi-provider → upsert `Embedding` rows

### tRPC endpoint
`search.semantic(query, campaignId, filters?)` → embed query → cosine similarity SQL → ranked results with chunk previews + entity links

### UI
- Search page `/campaigns/[slug]/search` — filter chips (transcripts/npcs/quests), ranked results with "jump to moment" anchor links
- Timeline view: chronological key events derived from `aiHighlights` across all sessions

---

## Feature 3 — Battle/Encounter Tracker

### Schema — new models
```prisma
model Encounter {
  id           String                 @id @default(cuid())
  sessionId    String
  session      GameSession            @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name         String
  round        Int                    @default(1)
  status       String                 @default("active") // active|complete
  log          Json?                  // [{round, events: [{participantId, action, value}]}]
  participants EncounterParticipant[]
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  @@index([sessionId])
}

model EncounterParticipant {
  id          String    @id @default(cuid())
  encounterId String
  encounter   Encounter @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  npcId       String?
  name        String
  type        String    // pc|npc|monster
  initiative  Int       @default(0)
  hp          Int
  maxHp       Int
  conditions  Json      @default("[]") // ["Poisoned","Stunned",...]
  isAlive     Boolean   @default(true)
  updatedAt   DateTime  @updatedAt

  @@index([encounterId])
}
```

### tRPC router: `encounters`
- `create`, `getBySession`, `update`, `addParticipant`, `updateParticipant`, `nextRound`, `complete`

### UI
- Encounter tracker panel in session view
- Initiative order list, HP bars with inline edit, condition badges (D&D 5e condition set)
- Add participants: from campaign NPC roster or manual entry
- "Next Round" button advances round counter + appends round summary to `GameSession.quickNotes`

---

## Feature 4 — Audio Ingest Everywhere

### Reuses existing transcription pipeline

### Additions
- **`useMediaRecorder` hook** (`src/hooks/useAudioRecorder.ts`): Web Audio API with VAD (energy threshold), outputs WebM blob → uploads to `/api/uploads`
- **Browser recorder component** (`src/components/session/audio-recorder.tsx`): record/pause/stop controls, live level meter, auto-starts on voice activity
- **Mobile upload**: extend existing upload endpoint + add mobile-friendly drag target with camera/mic picker input
- **Speaker labeling UI**: extend existing segment editor to allow real-time speaker assignment during playback
- **Queue wiring**: browser recording creates `SessionRecording` + triggers existing BullMQ transcription worker

---

## Feature 5 — Visual Homebrew Assets

### Extends existing `homebrew-image.ts` + `ImageGenerationJob`

### Schema additions
```prisma
// Add to NPC:
imageUrl    String?
imageJobId  String?

// Add to HomebrewContent:
imageUrl    String?
imageJobId  String?
```

### Additions
- **Prompt templates** in `homebrew-image.ts` router: `npc`, `location`, `handout`, `item` presets with style guidance
- **ComfyUI support**: if `COMFYUI_URL` env set, route image gen through ComfyUI REST API; same `ImageGenerationJob` tracking
- **Image gallery tab** on homebrew + NPC detail pages: grid of generated images, regenerate/delete actions
- **Attach flow**: generate → select → saves `imageUrl` on entity

---

## Feature 6 — Player Portal (Scoped Views)

### Schema additions
```prisma
// Add to GameSession:
playerVisibility String @default("dm-only") // public|dm-only|summary-only

// Add to HomebrewContent:
sharedWithPlayers Boolean @default(false)
```

### tRPC changes
- Add player-scoped variants of `sessions.getById`, `homebrew.list`, `npcs.list` that strip DM-only fields based on caller role
- `members.updateVisibility` — DM sets `playerVisibility` per session

### UI
- Same campaign URL structure; layout conditionally renders DM controls only for `isDM`
- Session view: player sees summary + shared notes only (no raw transcript, no AI highlights unless shared)
- DM visibility toggles: per-session and per-homebrew-item panels
- Homebrew page: "Share with players" toggle per item

---

## Feature 7 — Rules/Source Companion (Local RAG)

### Reuses pgvector + `Embedding` model from Feature 2 (entityType = `"rules"`)

### Schema additions
```prisma
// Add to HomebrewPDF:
isRulesSource Boolean  @default(false)
indexedAt     DateTime?
```

### Pipeline
- PDFs marked `isRulesSource=true` → chunk via existing Docling → embed → store as `Embedding` with `entityType=rules`, `campaignId=null` (global)
- SRD loaded from bundled JSON seed (`scripts/seed-srd.ts`)

### tRPC endpoint
`rules.lookup(question, limit?)` → embed question → cosine similarity over `entityType=rules` embeddings → top-5 chunks with source + page ref

### UI
- Floating "Rules" panel in session view (collapsible sidebar)
- Type question → streamed answer with snippet + citation ("from: SRD p.42")
- Redis cache (10-min TTL) for repeated queries
- **Admin UI** `/admin/rules-sources`: list PDFs, toggle `isRulesSource`, trigger re-index

---

## Feature 8 — Webhook/Integrations

### Schema — new model
```prisma
model WebhookEndpoint {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  url        String
  secret     String
  events     Json     // ["session.started","session.ended","summary.ready","encounter.logged"]
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@index([campaignId])
}
```

### Services
- **`WebhookService`**: HMAC-SHA256 signed POST delivery via BullMQ `webhooks` queue (3 retries, exponential backoff)
- Events fired: `session.started`, `session.ended`, `summary.ready`, `encounter.logged`

### Inbound integrations
- `/api/webhooks/discord` — Discord slash command handler → creates/updates session schedule
- `/api/webhooks/calendar` — iCal subscription URL per campaign (`/api/calendar/[campaignId].ics`)

### Streamer mode
- `/api/overlay/[campaignId]` — SSE endpoint, emits live encounter state as JSON for OBS browser source
- Simple overlay HTML page at `/overlay/[campaignId]` (public, token-gated)

### tRPC router: `webhooks`
- `create`, `list`, `delete`, `test` (send test ping)

### UI
- Campaign settings page: webhook management panel
- `/admin` or campaign settings: streamer mode toggle + overlay URL copy
