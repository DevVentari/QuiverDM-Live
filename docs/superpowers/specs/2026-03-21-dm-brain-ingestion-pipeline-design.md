# DM Brain — Ingestion Pipeline Completion

**Date:** 2026-03-21
**Status:** Draft

## Problem

Brain ingestion is partially wired but broken in practice. The auto-trigger chain call exists in `ai-summary-worker.ts` but does not pass `source: 'session_summary'`, causing ingestion jobs to lack context. Entity resolution uses exact name matching only, so the same NPC across multiple sessions can become duplicate entities. There is no way to feed PDFs, recordings, images, or plain text into the brain.

## Solution

Three changes: fix and extend the existing ingestion trigger, add a document ingestion endpoint for bulk/manual import, and upgrade entity resolution to semantic fuzzy matching with a DM-review confirmation queue that learns from decisions.

---

## Change 1 — Fix Ingestion Auto-Trigger

**File:** `src/lib/queue/ai-summary-worker.ts`

The chain call already exists but passes no `source`. Update it to pass:

```ts
await brainIngestionQueue.add('ingest-session', {
  sessionId,
  campaignId,
  source: 'session_summary',
});
```

Also verify `BrainIngestionJobData` in `brain-ingestion-queue.ts` includes an optional `source?: string` field.

---

## Change 2 — Document Ingestion Endpoint

**New tRPC procedure:** `brain.ingest.document`

Uses `protectedProcedure` with a manual ownership check (consistent with all existing `brain.ts` procedures — `campaignDMProcedure` is not imported in this router). The service method validates that `ctx.session.user.id` matches the campaign owner before processing.

**Input:**
```ts
z.object({
  campaignId: z.string(),
  type: z.enum(['pdf', 'image', 'text']),  // 'recording' is out of scope — use existing AssemblyAI transcription pipeline
  url: z.string().optional(),       // for uploaded files (R2 signed URL)
  content: z.string().optional(),   // for raw text
  sourceLabel: z.string(),
})
```

Note: `recording` type is out of scope. Audio files should be submitted through the existing transcription pipeline (`sessionTranscription` router), and the resulting transcript text can then be ingested as `type: 'text'`.

**Processing per type:**

The processed content (Docling markdown, Gemini OCR output, or raw text) maps to the `summary` field in `BrainIngestionJobData` (which the ingestion worker uses directly for AI extraction). The `highlights` field can be left empty.

- `pdf` → POST to Docling at `DOCLING_URL` → markdown string → queue `{ sessionId: null, campaignId, summary: markdownString, highlights: [], source: 'document' }`
- `image` → send to Gemini `gemini-2.0-flash` with image URL → plain text string → queue `{ sessionId: null, campaignId, summary: ocrText, highlights: [], source: 'document' }`
- `text` → queue `{ sessionId: null, campaignId, summary: content, highlights: [], source: 'document' }` directly

**New model:** `BrainIngestSource`

```prisma
model BrainIngestSource {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  type         String   // pdf | image | text | session_summary
  sourceLabel  String
  status       String   @default("pending") // pending | processing | done | failed
  errorMessage String?
  createdAt    DateTime @default(now())
  completedAt  DateTime?

  @@index([campaignId])
}
```

**Campaign model addition** (required by Prisma for the relation):
```prisma
// Add to Campaign model:
brainIngestSources BrainIngestSource[]
```

**UI:** "Ingest Document" button on Brain overview page → modal with file upload (PDF/image) or paste text field, source label field. Past ingestion jobs listed with status badges below.

---

## Change 3 — Semantic Entity Resolution

**New models:**

```prisma
model EntityMergeCandidate {
  id                 String      @id @default(cuid())
  campaignId         String
  campaign           Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  entityAId          String
  entityA            WorldEntity @relation("MergeCandidateA", fields: [entityAId], references: [id], onDelete: Cascade)
  entityBId          String
  entityB            WorldEntity @relation("MergeCandidateB", fields: [entityBId], references: [id], onDelete: Cascade)
  score              Float
  suggestedCanonical String
  status             String      @default("pending") // pending | approved | rejected
  decidedAt          DateTime?
  createdAt          DateTime    @default(now())

  @@index([campaignId, status])
}

model EntityMergeRule {
  id         String      @id @default(cuid())
  campaignId String
  campaign   Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  entityAId  String
  entityA    WorldEntity @relation("MergeRuleA", fields: [entityAId], references: [id], onDelete: Cascade)
  entityBId  String
  entityB    WorldEntity @relation("MergeRuleB", fields: [entityBId], references: [id], onDelete: Cascade)
  decision   String      // merge | never
  learnedAt  DateTime    @default(now())

  @@unique([campaignId, entityAId, entityBId])
  @@index([campaignId])
}
```

**WorldEntity model additions** (required back-relations):
```prisma
// Add to WorldEntity model:
mergeCandidatesA EntityMergeCandidate[] @relation("MergeCandidateA")
mergeCandidatesB EntityMergeCandidate[] @relation("MergeCandidateB")
mergeRulesA      EntityMergeRule[]      @relation("MergeRuleA")
mergeRulesB      EntityMergeRule[]      @relation("MergeRuleB")
```

**Campaign model additions:**
```prisma
// Add to Campaign model:
entityMergeCandidates EntityMergeCandidate[]
entityMergeRules      EntityMergeRule[]
```

**Resolution logic in `brain-ingestion-worker.ts`:**

Entity resolution runs AFTER the extracted entity has been provisionally created in the DB (so it has a real `id`). The ordering is:

1. Extract entities from AI response
2. For each extracted entity: attempt resolution against existing entities
3. If action is `create` or `create_provisional`: upsert the entity, capture its DB `id`
4. If action is `create_provisional`: create merge candidate using the new entity's `id`

```ts
async function resolveEntity(
  extractedName: string,
  extractedType: string,
  campaignId: string
): Promise<ResolveResult> {
  // 1. Check EntityMergeRule — learned overrides
  const rule = await findMergeRule(campaignId, extractedName);
  if (rule?.decision === 'never') return { action: 'create' };
  if (rule?.decision === 'merge') return { action: 'merge', targetId: rule.entityBId };

  // 2. Exact name match (case-insensitive)
  const exact = await findEntityByName(campaignId, extractedName);
  if (exact) return { action: 'merge', targetId: exact.id };

  // 3. Alias match
  const alias = await findEntityByAlias(campaignId, extractedName);
  if (alias) return { action: 'merge', targetId: alias.id };

  // 4. Fuzzy scoring: max(nameScore via Levenshtein, embeddingScore via F2)
  const candidates = await getActiveEntities(campaignId);
  const scored = await scoreCandidates(extractedName, candidates);
  const best = scored[0];

  if (!best || best.score < 0.70) return { action: 'create' };
  if (best.score >= 0.95) return { action: 'merge', targetId: best.id };

  // 0.70–0.95: create provisional entity, queue for DM review
  return { action: 'create_provisional', bestMatchId: best.id, score: best.score };
}

// In the main ingestion loop:
const resolve = await resolveEntity(extracted.name, extracted.type, campaignId);
if (resolve.action === 'merge') {
  await mergeEntityData(resolve.targetId, extracted);
} else {
  // create or create_provisional — upsert entity first
  const newEntity = await upsertEntity(campaignId, extracted);
  if (resolve.action === 'create_provisional') {
    await createMergeCandidate({
      campaignId,
      entityAId: newEntity.id,      // newly created entity
      entityBId: resolve.bestMatchId,
      score: resolve.score,
      suggestedCanonical: extracted.name,
    });
  }
}
```

**New tRPC procedures:**
- `brain.mergeCandidates.list` — list pending `EntityMergeCandidate` for campaign
- `brain.mergeCandidates.approve` — merge the two entities, write `EntityMergeRule` with `decision: 'merge'`
- `brain.mergeCandidates.reject` — write `EntityMergeRule` with `decision: 'never'`, mark candidate rejected

All three use `protectedProcedure` with manual ownership checks (consistent with existing `brain.ts` pattern).

---

## Change 4 — Backfill Script

**New file:** `scripts/brain-backfill.ts`

```ts
// Usage: npx tsx scripts/brain-backfill.ts <campaign-slug>
// Iterates sessions in ascending order, queues brain ingestion for each.
// Skips sessions with an existing BrainIngestSource status=done.
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/queue/ai-summary-worker.ts` | Pass `source: 'session_summary'` to existing chain call |
| `src/lib/queue/brain-ingestion-queue.ts` | Add optional `source?: string` to job data type |
| `src/server/routers/brain.ts` | Add `ingest.document` + `mergeCandidates.*` procedures |
| `src/server/services/brain.service.ts` | Add document routing, resolution logic |
| `src/lib/queue/brain-ingestion-worker.ts` | Upgrade entity resolution to fuzzy + provisional |
| `prisma/schema.prisma` | Add `BrainIngestSource`, `EntityMergeCandidate`, `EntityMergeRule`; add back-relations to `Campaign` and `WorldEntity` |
| `src/app/(app)/campaigns/[slug]/brain/page.tsx` | Add ingest button + merge candidate queue UI |
| `scripts/brain-backfill.ts` | New backfill script |

---

## Out of Scope

- Real-time streaming ingestion
- Recording/audio ingestion (use existing transcription pipeline, then ingest transcript as text)
- Bulk file batch upload (single file at a time)
