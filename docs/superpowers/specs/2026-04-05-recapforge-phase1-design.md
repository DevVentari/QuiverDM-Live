# RecapForge Phase 1 — Schema & Data Layer

**Date:** 2026-04-05  
**Module:** RecapForge  
**Phase:** 1 of 7  
**Source docs:** `docs/Modules/RecapForge-PRD-Package/` (02-PRD, 04-TECH-SPEC)

---

## Scope

Add all Prisma schema changes required by the RecapForge module in a single migration. No application code, no workers, no UI — schema only. This unblocks all subsequent phases.

## Approach

Option A (full schema in one pass) was selected. All 4 new models and 3 existing model extensions land together. This avoids multi-phase migration churn and ensures all relations are wired before any worker or router code references them.

---

## New Models

### SessionRecap
Stores AI-generated summary content for a session.

- `sessionId` — FK to `GameSession`, cascade delete
- `style` — `RecapStyle` enum (NARRATIVE | SESSION_LOG | BARDS_TALE | PREVIOUSLY_ON)
- `status` — `RecapStatus` enum, default `AUTO_GENERATED`
- `sections` — JSON array: `[{ key, title, content }]` — the editable unit of a recap
- `rawContent` — full concatenated text for clipboard/export
- `discordFormatted` — pre-formatted string for Discord posting
- `discordCharLimit` — Int, default 2000
- `discordThreadMode` — Boolean, default false
- `promptVersion`, `modelUsed`, `tokensUsed`, `generationTimeMs` — generation provenance
- `clarificationSkipped` — Boolean, default false
- `editHistory` — JSON audit trail of section edits
- `approvedAt`, `sharedAt`, `sharedTo` — workflow timestamps
- Indexes: `sessionId`, `status`

### ClarificationQA
Ambiguity questions surfaced by AI before generation, with DM answers.

- `recapId` — FK to `SessionRecap`, cascade delete
- `question` — the AI-generated question text
- `context` — relevant transcript excerpt
- `timestamp` — Float, position in recording where ambiguity occurs
- `questionType` — "binary" | "short_answer" | "multiple_choice"
- `options` — JSON, answer choices for binary/multiple_choice types
- `answer` — DM's response string
- `skipped` — Boolean, default false
- `sortOrder` — display ordering
- Index: `recapId`

### CampaignContext
Rolling semantic memory for a campaign, used to ground AI summarization.

- `campaignId` — FK to `Campaign`, cascade delete
- `sessionId` — nullable FK to `GameSession`, SetNull on delete (null = campaign brief)
- `type` — `ContextType` enum (CAMPAIGN_BRIEF | SESSION_EXTRACT | SOURCEBOOK_LABEL)
- `content` — the text content to embed and retrieve
- `embedding` — `Unsupported("vector(1536)")` — pgvector column for semantic search
- `keyEvents`, `npcsInvolved`, `decisions`, `lootGained` — JSON, structured extraction for SESSION_EXTRACT type
- Indexes: `campaignId`, `sessionId`

### SpeakerMapping
Persistent speaker-label → character mapping per campaign, auto-applied to new sessions.

- `campaignId` — FK to `Campaign`, cascade delete
- `speakerLabel` — Discord username or "Speaker 0" etc
- `characterId` — nullable FK to `Character`, SetNull on delete
- `characterName` — denormalised for display without join
- `isDM` — Boolean, default false — DM speech handled differently in summarization
- Unique constraint: `(campaignId, speakerLabel)`
- Index: `campaignId`

---

## New Enums

```prisma
enum RecapStyle {
  NARRATIVE
  SESSION_LOG
  BARDS_TALE
  PREVIOUSLY_ON
}

enum RecapStatus {
  GENERATING
  AUTO_GENERATED
  CLARIFICATION_PENDING
  REVIEWED
  QUICK_FIRE
}

enum ContextType {
  CAMPAIGN_BRIEF
  SESSION_EXTRACT
  SOURCEBOOK_LABEL
}
```

---

## Extensions to Existing Models

### GameSession
- Add `recaps SessionRecap[]`
- Add `campaignContexts CampaignContext[]`

### SessionRecording
- Add `isCraigMultiTrack Boolean @default(false)`
- Add `craigTrackFiles Json?` — `[{ filename, discordUsername, r2Key, duration }]`
- Add `craigMergeStatus String?` — "pending" | "processing" | "complete" | "failed"

### Campaign
- Add `campaignContexts CampaignContext[]`
- Add `speakerMappings SpeakerMapping[]`
- Add `sourcebookLabel String?` — informational label only (e.g. "Curse of Strahd")

---

## pgvector Constraint

The `CampaignContext.embedding` column uses `Unsupported("vector(1536)")` in Prisma. This requires the `pgvector` extension to be active in the database before migration. The project already uses pgvector (it's listed in CLAUDE.md as a requirement), but must be confirmed before pushing.

```sql
-- Confirm before db:push:
SELECT * FROM pg_extension WHERE extname = 'vector';
```

If not present: `CREATE EXTENSION IF NOT EXISTS vector;`

---

## Migration Strategy

- **Local:** `npm run db:push` (existing project convention)
- **Production (Neon):** Run `CREATE EXTENSION IF NOT EXISTS vector;` via Neon console if not already active, then Vercel deploy triggers schema push via `postinstall` or manual `db:push` over prod `DATABASE_URL`
- No seed data required — purely structural

---

## Deliverable

- `schema.prisma` updated with all 4 new models, 3 existing model extensions, 3 new enums
- `npm run db:push` succeeds locally
- Relations verified: `SessionRecap` ↔ `GameSession`, `ClarificationQA` ↔ `SessionRecap`, `CampaignContext` ↔ `Campaign` + `GameSession`, `SpeakerMapping` ↔ `Campaign` + `Character`
- pgvector extension confirmed active before push
