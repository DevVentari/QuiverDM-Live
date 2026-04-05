# RecapForge Phase 4 — Campaign Context Engine Design

## Overview

After multi-track transcription completes, a background worker extracts structured context (key events, NPCs, decisions, loot) from the transcript using AI, generates pgvector embeddings, and stores them as `CampaignContext` records. A tRPC router exposes recent-session retrieval and semantic search for consumption by Phase 5 (recap) and Phase 6 (Co-DM). Campaign settings gets a one-button sourcebook seeder.

---

## Architecture

### New Files

- `src/lib/queue/context-extraction-queue.ts` — BullMQ queue definition + job type
- `src/lib/queue/context-extraction-worker.ts` — extraction worker (AI → embed → upsert)
- `src/server/routers/campaign-context.ts` — tRPC router (3 procedures)

### Modified Files

- `prisma/schema.prisma` — fix `vector(1536)` → `vector(768)` on `CampaignContext.embedding`
- `src/lib/queue/multi-track-worker.ts` — enqueue context extraction job after `broadcastMultiTrackComplete`
- `src/server/routers/_app.ts` — register `campaignContext` router
- Campaign settings page (`src/app/(app)/campaigns/[slug]/settings/`) — "Seed from sourcebook" section
- `package.json` — add `worker:context-extraction` script
- `deploy/hetzner/docker-compose.yml` — add context-extraction worker container

---

## Data Model

`CampaignContext` (already in schema — fix embedding dimension):

```prisma
model CampaignContext {
  id          String       @id @default(cuid())
  campaignId  String
  campaign    Campaign     @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sessionId   String?
  session     Session?     @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  type        ContextType
  content     String       @db.Text
  embedding   Unsupported("vector(768)")?   // was vector(1536) — fixed to match generateEmbedding() output
  keyEvents   Json?
  npcsInvolved Json?
  decisions   Json?
  lootGained  Json?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  @@unique([campaignId, type, content])   // add this — drives upsert idempotency across both session extracts and sourcebook records
  @@index([campaignId])
  @@index([sessionId])
}

enum ContextType {
  CAMPAIGN_BRIEF
  SESSION_EXTRACT
  SOURCEBOOK_LABEL
}
```

**Schema migration note:** changing `vector(1536)` to `vector(768)` requires a `prisma migrate dev` (or `db push` in dev). Any existing `vector(1536)` rows will be incompatible — truncate `CampaignContext` before migrating if any exist.

---

## tRPC Router (`campaignContext`)

All procedures use `campaignDMProcedure`.

### `getRecent`

```ts
input: z.object({
  campaignId: z.string(),
  limit: z.number().int().min(1).max(10).default(3),
})
// returns: CampaignContext[] (SESSION_EXTRACT only, ordered by createdAt desc)
```

Returns the most recent session extract records, grouped by session. Consumed by Phase 5 recap and Phase 6 Co-DM to provide "last N sessions" narrative context.

### `search`

```ts
input: z.object({
  campaignId: z.string(),
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(5),
})
// returns: Array<{ id, content, type, sessionId, similarity }>
```

Generates an embedding for `query` via `generateEmbedding()`, then runs a pgvector cosine similarity query (`<=>` operator) scoped to `campaignId`. Returns top matches ordered by similarity. Used for "what happened with [NPC]?" lookups.

Raw SQL for the similarity search:
```sql
SELECT id, content, type, "sessionId",
       1 - (embedding <=> $1::vector) AS similarity
FROM "CampaignContext"
WHERE "campaignId" = $2
ORDER BY embedding <=> $1::vector
LIMIT $3
```

### `seedFromSourcebook`

```ts
input: z.object({
  campaignId: z.string(),
  sourcebookId: z.string(),
})
// returns: { seeded: number }
```

Fetches homebrew/sourcebook records for `sourcebookId`, writes `SOURCEBOOK_LABEL` context records (content = `name + ': ' + description`). Generates an embedding per record. Upserts using the `@@unique([campaignId, type, content])` constraint. Returns count of records written.

**Idempotent:** calling twice with same sourcebook produces the same records (upsert, not insert).

---

## Worker (`context-extraction-worker`)

### Job Type

```ts
interface ContextExtractionJobData {
  transcriptId: string;
  sessionId: string;
  campaignId: string;
}
```

Queue name: `context-extraction`

### Processing Steps

1. Fetch `Transcript.correctedText` by `transcriptId`. If empty or null, log and exit — no-op, job completes successfully.
2. Call AI extraction (existing `src/lib/ai/` provider chain) with a structured prompt requesting JSON:
   ```json
   {
     "keyEvents": ["string"],
     "npcsInvolved": ["string"],
     "decisions": ["string"],
     "lootGained": ["string"]
   }
   ```
   Parse response. If parsing fails, log error and exit — never throw, transcript exists with raw text.
3. Flatten each array into individual `content` strings. Generate one embedding per string via `generateEmbedding()`.
4. `prisma.campaignContext.upsert` per chunk:
   - `where: { campaignId_type_content: { campaignId, type: 'SESSION_EXTRACT', content } }`
   - `create`: `{ campaignId, sessionId, type: 'SESSION_EXTRACT', content, embedding, keyEvents, npcsInvolved, decisions, lootGained }`
   - `update`: `{ sessionId, embedding, keyEvents, npcsInvolved, decisions, lootGained }`
5. Broadcast nothing — this is background enrichment. The DM is not waiting on it.

**Failure mode:** if `generateEmbedding()` throws, log + skip that chunk (continue with remaining). If AI extraction throws entirely, log + exit job successfully (no retry storm). Context can be re-extracted if needed.

**Concurrency:** 1 (same as other workers — embedding generation is I/O-bound).

### Enqueueing from Multi-Track Worker

In `src/lib/queue/multi-track-worker.ts`, after `broadcastMultiTrackComplete`:

```ts
await contextExtractionQueue.add('extract', {
  transcriptId: transcript.id,
  sessionId,
  campaignId,
});
```

Wrapped in try/catch — queue failure never blocks multi-track job completion.

---

## UI

### Campaign Settings — "Campaign Context" Section

Location: `src/app/(app)/campaigns/[slug]/settings/` (existing settings page)

- Heading: "Campaign Context"
- For each sourcebook linked to the campaign: a button "Seed context from [sourcebook name]"
- Button calls `campaignContext.seedFromSourcebook({ campaignId, sourcebookId })`
- Loading state on button during mutation
- On success: toast "Seeded N context records from [sourcebook name]"
- On error: toast with error message

No other UI in Phase 4. `getRecent` and `search` are consumed by Phase 5 and Phase 6.

---

## Testing

### Unit Test

File: `tests/unit/recap/context-extraction.test.ts`

- Mock AI response returning deterministic `{ keyEvents, npcsInvolved, decisions, lootGained }`
- Mock `generateEmbedding()` returning a fixed 768-element array
- Assert `prisma.campaignContext.upsert` called once per content chunk with correct fields
- Assert AI extraction failure is caught and job exits cleanly (no throw)

### Workflow Stub

File: `tests/workflows/recapforge-context.workflow.spec.ts`

```ts
test.fixme('context extraction runs after multi-track transcription completes', async ({ page }) => {
  // Phase 4 — requires real worker + R2 + AssemblyAI in E2E env
});
```

---

## Constraints

- `generateEmbedding()` produces 768-dim vectors — schema must match (`vector(768)`)
- AI extraction is best-effort — extraction failure never blocks transcript availability
- `seedFromSourcebook` is idempotent — safe to call multiple times
- `search` requires pgvector extension (already present via `pgvector` Docker image)
- No new pages — sourcebook seeder lives in existing campaign settings
- Phase 4 does not surface `getRecent` or `search` in any DM-facing UI — consumed by Phase 5+
