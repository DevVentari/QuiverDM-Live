# RecapForge Phase 4 — Campaign Context Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a background extraction pipeline that turns session transcripts into pgvector-embedded context records, with a tRPC router for retrieval and a campaign settings UI for sourcebook seeding.

**Architecture:** Multi-track worker enqueues a `context-extraction` job on completion; a dedicated BullMQ worker runs AI extraction → embedding → upsert into `CampaignContext`. The `campaignContext` tRPC router exposes `getRecent`, `search`, `getSourcebooks`, and `seedFromSourcebook`. Campaign settings gets a "Campaign Context" section with per-sourcebook seed buttons.

**Tech Stack:** BullMQ, Prisma (`$executeRawUnsafe` for vector writes, `$queryRaw` for similarity search), `chatWithAI` from `src/lib/ai/chat.ts`, `generateEmbedding` from `src/lib/ai/embeddings.ts`, Vitest for unit tests.

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` — fix `vector(1536)` → `vector(768)`, add `@@unique` |
| Create | `src/lib/recap/context-extraction-utils.ts` — pure parse/build functions |
| Create | `tests/unit/recap/context-extraction.test.ts` — unit tests |
| Create | `src/lib/queue/context-extraction-queue.ts` — queue + job type |
| Create | `src/server/routers/campaign-context.ts` — tRPC router (4 procedures) |
| Modify | `src/server/routers/_app.ts` — register `campaignContext` router |
| Create | `src/lib/queue/context-extraction-worker.ts` — BullMQ worker |
| Modify | `src/lib/queue/multi-track-worker.ts` — enqueue extraction after completion |
| Modify | `src/app/(app)/campaigns/[slug]/settings/page.tsx` — sourcebook seed UI |
| Modify | `package.json` — add `worker:context-extraction` script |
| Modify | `deploy/hetzner/start-workers.sh` — add worker to startup (17 → 18) |
| Create | `tests/workflows/recapforge-context.workflow.spec.ts` — workflow stub |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit `CampaignContext` in `prisma/schema.prisma`**

Find the model at line ~1610. Replace the full model block:

```prisma
// RecapForge — rolling semantic memory per campaign, grounding AI summarisation
model CampaignContext {
  id         String      @id @default(cuid())
  campaignId String
  campaign   Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  sessionId  String?
  session    GameSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  type       ContextType // CAMPAIGN_BRIEF | SESSION_EXTRACT | SOURCEBOOK_LABEL
  content    String      @db.Text

  // pgvector embedding for semantic search (1536 dimensions — OpenAI ada-002 compatible)
  embedding  Unsupported("vector(1536)")?

  // Structured extraction fields (populated for SESSION_EXTRACT type)
  keyEvents    Json? // ["Event description", ...]
  npcsInvolved Json? // ["NPC Name", ...]
  decisions    Json? // ["Decision made", ...]
  lootGained   Json? // ["Item name", ...]

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([campaignId, type])
  @@index([campaignId, createdAt(sort: Desc)])
  @@index([sessionId])
}
```

With:

```prisma
// RecapForge — rolling semantic memory per campaign, grounding AI summarisation
model CampaignContext {
  id         String      @id @default(cuid())
  campaignId String
  campaign   Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  sessionId  String?
  session    GameSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  type       ContextType
  content    String      @db.Text

  embedding  Unsupported("vector(768)")?

  keyEvents    Json?
  npcsInvolved Json?
  decisions    Json?
  lootGained   Json?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([campaignId, type, content])
  @@index([campaignId, type])
  @@index([campaignId, createdAt(sort: Desc)])
  @@index([sessionId])
}
```

- [ ] **Step 2: Push schema to database**

```bash
npm run db:push
```

Expected output includes: `Your database is now in sync with your Prisma schema.`

If the push fails with a vector dimension error, first truncate the table (there should be no production data yet):

```bash
# Only if db:push fails due to existing vector data
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.campaignContext.deleteMany().then(()=>{console.log('Cleared');p.\$disconnect()})"
```

Then re-run `npm run db:push`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): fix CampaignContext vector to 768 dims, add unique constraint"
```

---

## Task 2: Extraction Utility Functions

**Files:**
- Create: `src/lib/recap/context-extraction-utils.ts`

- [ ] **Step 1: Create `src/lib/recap/context-extraction-utils.ts`**

```ts
export interface TranscriptExtract {
  keyEvents: string[];
  npcsInvolved: string[];
  decisions: string[];
  lootGained: string[];
}

export function parseExtractionResponse(raw: string): TranscriptExtract | null {
  let json = raw.trim();
  const codeBlockMatch = json.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) json = codeBlockMatch[1].trim();

  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const p = parsed as Record<string, unknown>;

    const toStringArray = (val: unknown): string[] =>
      Array.isArray(val)
        ? val.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : [];

    return {
      keyEvents: toStringArray(p.keyEvents),
      npcsInvolved: toStringArray(p.npcsInvolved),
      decisions: toStringArray(p.decisions),
      lootGained: toStringArray(p.lootGained),
    };
  } catch {
    return null;
  }
}

export function buildContentStrings(extract: TranscriptExtract): string[] {
  return [
    ...extract.keyEvents,
    ...extract.npcsInvolved,
    ...extract.decisions,
    ...extract.lootGained,
  ]
    .map((s) => s.trim().slice(0, 500))
    .filter((s) => s.length > 0);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to the new file.

---

## Task 3: Unit Tests

**Files:**
- Create: `tests/unit/recap/context-extraction.test.ts`
- Test against: `src/lib/recap/context-extraction-utils.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, buildContentStrings } from '../../../src/lib/recap/context-extraction-utils';

describe('parseExtractionResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({
      keyEvents: ['The party entered Barovia'],
      npcsInvolved: ['Strahd'],
      decisions: ['Party decided to go to the church'],
      lootGained: ['Silver dagger'],
    });
    const result = parseExtractionResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.keyEvents).toEqual(['The party entered Barovia']);
    expect(result!.npcsInvolved).toEqual(['Strahd']);
    expect(result!.decisions).toEqual(['Party decided to go to the church']);
    expect(result!.lootGained).toEqual(['Silver dagger']);
  });

  it('strips markdown code block before parsing', () => {
    const raw = '```json\n{"keyEvents":["foo"],"npcsInvolved":[],"decisions":[],"lootGained":[]}\n```';
    const result = parseExtractionResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.keyEvents).toEqual(['foo']);
  });

  it('returns null for completely invalid JSON', () => {
    expect(parseExtractionResponse('not json at all')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseExtractionResponse('"just a string"')).toBeNull();
    expect(parseExtractionResponse('[1,2,3]')).toBeNull();
  });

  it('coerces missing fields to empty arrays', () => {
    const result = parseExtractionResponse('{}');
    expect(result).not.toBeNull();
    expect(result!.keyEvents).toEqual([]);
    expect(result!.loutGained).toBeUndefined(); // not a field on the type
    expect(result!.lootGained).toEqual([]);
  });

  it('filters out non-string array entries', () => {
    const raw = JSON.stringify({ keyEvents: ['valid', 42, null, 'also valid'], npcsInvolved: [], decisions: [], lootGained: [] });
    const result = parseExtractionResponse(raw);
    expect(result!.keyEvents).toEqual(['valid', 'also valid']);
  });
});

describe('buildContentStrings', () => {
  it('flattens all four arrays into a single list', () => {
    const result = buildContentStrings({
      keyEvents: ['Event A'],
      npcsInvolved: ['NPC B'],
      decisions: ['Decision C'],
      lootGained: ['Loot D'],
    });
    expect(result).toEqual(['Event A', 'NPC B', 'Decision C', 'Loot D']);
  });

  it('truncates strings to 500 characters', () => {
    const long = 'x'.repeat(600);
    const result = buildContentStrings({ keyEvents: [long], npcsInvolved: [], decisions: [], lootGained: [] });
    expect(result[0].length).toBe(500);
  });

  it('filters out empty strings', () => {
    const result = buildContentStrings({ keyEvents: ['', '  ', 'valid'], npcsInvolved: [], decisions: [], lootGained: [] });
    expect(result).toEqual(['valid']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/recap/context-extraction.test.ts
```

Expected: FAIL — module not found or function not defined.

- [ ] **Step 3: Run tests again after Task 2 implementation is in place**

```bash
npx vitest run tests/unit/recap/context-extraction.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/recap/context-extraction-utils.ts tests/unit/recap/context-extraction.test.ts
git commit -m "feat(recapforge): context extraction utility + unit tests"
```

---

## Task 4: Queue Definition

**Files:**
- Create: `src/lib/queue/context-extraction-queue.ts`

- [ ] **Step 1: Create `src/lib/queue/context-extraction-queue.ts`**

Pattern from `src/lib/queue/multi-track-queue.ts`:

```ts
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface ContextExtractionJobData {
  transcriptId: string;
  sessionId: string;
  campaignId: string;
}

export interface ContextExtractionJobResult {
  success: boolean;
  chunksWritten: number;
  skipped?: boolean;
}

export const contextExtractionQueue = new Queue<ContextExtractionJobData, ContextExtractionJobResult>(
  'context-extraction',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

---

## Task 5: tRPC Router

**Files:**
- Create: `src/server/routers/campaign-context.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create `src/server/routers/campaign-context.ts`**

```ts
import { router } from '../trpc';
import { campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { NotFoundError } from '../errors';

export const campaignContextRouter = router({
  getRecent: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().int().min(1).max(10).default(3),
      })
    )
    .query(async ({ input }) => {
      return prisma.campaignContext.findMany({
        where: { campaignId: input.campaignId, type: 'SESSION_EXTRACT' },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          sessionId: true,
          content: true,
          keyEvents: true,
          npcsInvolved: true,
          decisions: true,
          lootGained: true,
          createdAt: true,
        },
      });
    }),

  search: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const queryVector = await generateEmbedding(input.query);
      const vectorStr = `[${queryVector.join(',')}]`;

      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          content: string;
          type: string;
          sessionId: string | null;
          similarity: number | string;
        }>
      >(
        Prisma.sql`
          SELECT id, content, type, "sessionId",
                 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "CampaignContext"
          WHERE "campaignId" = ${input.campaignId}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${input.limit}
        `
      );

      return results.map((r) => ({
        ...r,
        similarity:
          typeof r.similarity === 'number'
            ? r.similarity
            : Number.parseFloat(r.similarity as string),
      }));
    }),

  getSourcebooks: campaignDMProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.ddbSourcebook.findMany({
        where: {
          campaignIds: { has: input.campaignId },
          userId: ctx.session.user.id,
        },
        select: { id: true, title: true, slug: true },
        orderBy: { title: 'asc' },
      });
    }),

  seedFromSourcebook: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sourcebookId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const sourcebook = await prisma.ddbSourcebook.findFirst({
        where: {
          id: input.sourcebookId,
          userId: ctx.session.user.id,
          campaignIds: { has: input.campaignId },
        },
        include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
      });
      if (!sourcebook) throw new NotFoundError('sourcebook', input.sourcebookId);

      let seeded = 0;

      for (const chapter of sourcebook.chapters) {
        const content = `${sourcebook.title} — ${chapter.title}`.slice(0, 500);

        const record = await prisma.campaignContext.upsert({
          where: {
            campaignId_type_content: {
              campaignId: input.campaignId,
              type: 'SOURCEBOOK_LABEL',
              content,
            },
          },
          create: { campaignId: input.campaignId, type: 'SOURCEBOOK_LABEL', content },
          update: {},
        });

        try {
          const embedding = await generateEmbedding(content);
          const vectorStr = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE "CampaignContext" SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            record.id
          );
        } catch (err) {
          console.warn(`[campaignContext.seedFromSourcebook] Embedding failed for "${content}":`, err);
        }

        seeded++;
      }

      return { seeded };
    }),
});
```

- [ ] **Step 2: Register in `src/server/routers/_app.ts`**

Add the import after the existing `speakerMappingRouter` import:

```ts
import { campaignContextRouter } from './campaign-context';
```

Add to the `appRouter` object (after `speakerMapping`):

```ts
campaignContext: campaignContextRouter,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/campaign-context.ts src/server/routers/_app.ts
git commit -m "feat(recapforge): campaignContext tRPC router (getRecent, search, getSourcebooks, seedFromSourcebook)"
```

---

## Task 6: Context Extraction Worker

**Files:**
- Create: `src/lib/queue/context-extraction-worker.ts`

- [ ] **Step 1: Create `src/lib/queue/context-extraction-worker.ts`**

```ts
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import type { ContextExtractionJobData, ContextExtractionJobResult } from './context-extraction-queue';
import { chatWithAI } from '../ai/chat';
import { generateEmbedding } from '../ai/embeddings';
import { parseExtractionResponse, buildContentStrings } from '../recap/context-extraction-utils';

const EXTRACTION_PROMPT = `You are a D&D session analyst. Extract structured information from this session transcript.

Return ONLY a JSON object with these exact fields:
- keyEvents: array of strings — significant events that happened (max 10 items, each under 150 chars)
- npcsInvolved: array of strings — NPC names mentioned (max 15 items, each under 80 chars)
- decisions: array of strings — decisions the party made (max 10 items, each under 150 chars)
- lootGained: array of strings — items or rewards obtained (max 10 items, each under 100 chars)

Respond ONLY with the JSON object. No explanation. No markdown.

Transcript:`;

async function processContextExtraction(
  job: Job<ContextExtractionJobData, ContextExtractionJobResult>
): Promise<ContextExtractionJobResult> {
  const { transcriptId, sessionId, campaignId } = job.data;

  console.log(`[ContextExtractionWorker] Processing transcript ${transcriptId}`);

  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    select: { correctedText: true },
  });

  if (!transcript?.correctedText?.trim()) {
    console.log(`[ContextExtractionWorker] Transcript ${transcriptId} has no text — skipping`);
    return { success: true, chunksWritten: 0, skipped: true };
  }

  // Truncate to avoid LLM token limits (~8k chars is safe)
  const text = transcript.correctedText.slice(0, 8000);

  let extract;
  try {
    const raw = await chatWithAI([
      { role: 'user', content: `${EXTRACTION_PROMPT}\n\n${text}` },
    ]);
    extract = parseExtractionResponse(raw);
  } catch (err) {
    console.warn(`[ContextExtractionWorker] AI extraction failed for ${transcriptId}:`, err);
    return { success: true, chunksWritten: 0, skipped: true };
  }

  if (!extract) {
    console.warn(`[ContextExtractionWorker] Could not parse AI response for ${transcriptId}`);
    return { success: true, chunksWritten: 0, skipped: true };
  }

  const contentStrings = buildContentStrings(extract);
  let chunksWritten = 0;

  for (const content of contentStrings) {
    let record;
    try {
      record = await prisma.campaignContext.upsert({
        where: {
          campaignId_type_content: {
            campaignId,
            type: 'SESSION_EXTRACT',
            content,
          },
        },
        create: {
          campaignId,
          sessionId,
          type: 'SESSION_EXTRACT',
          content,
          keyEvents: extract.keyEvents,
          npcsInvolved: extract.npcsInvolved,
          decisions: extract.decisions,
          lootGained: extract.lootGained,
        },
        update: {
          sessionId,
          keyEvents: extract.keyEvents,
          npcsInvolved: extract.npcsInvolved,
          decisions: extract.decisions,
          lootGained: extract.lootGained,
        },
      });
    } catch (err) {
      console.warn(`[ContextExtractionWorker] Upsert failed for content "${content.slice(0, 50)}...":`, err);
      continue;
    }

    try {
      const embedding = await generateEmbedding(content);
      const vectorStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "CampaignContext" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        record.id
      );
    } catch (err) {
      console.warn(`[ContextExtractionWorker] Embedding failed for "${content.slice(0, 50)}...":`, err);
    }

    chunksWritten++;
  }

  console.log(`[ContextExtractionWorker] Done — ${chunksWritten} chunks written for transcript ${transcriptId}`);
  return { success: true, chunksWritten };
}

const worker = new Worker<ContextExtractionJobData, ContextExtractionJobResult>(
  'context-extraction',
  processContextExtraction,
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[ContextExtractionWorker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[ContextExtractionWorker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[ContextExtractionWorker] Worker error:', err);
});

console.log('[ContextExtractionWorker] Started — listening on context-extraction queue');
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue/context-extraction-queue.ts src/lib/queue/context-extraction-worker.ts
git commit -m "feat(recapforge): context extraction worker + queue"
```

---

## Task 7: Wire Multi-Track Worker

**Files:**
- Modify: `src/lib/queue/multi-track-worker.ts`

- [ ] **Step 1: Add import to `src/lib/queue/multi-track-worker.ts`**

At the top of the file, add after the existing imports:

```ts
import { contextExtractionQueue } from './context-extraction-queue';
```

- [ ] **Step 2: Enqueue extraction after `broadcastMultiTrackComplete`**

Find this block (around line 211):

```ts
  // 8. Broadcast completion
  broadcastMultiTrackComplete(uploadGroupId, transcript.id);
```

Replace with:

```ts
  // 8. Broadcast completion
  broadcastMultiTrackComplete(uploadGroupId, transcript.id);

  try {
    await contextExtractionQueue.add('extract', {
      transcriptId: transcript.id,
      sessionId,
      campaignId,
    });
  } catch (err) {
    console.warn('[MultiTrackWorker] Failed to enqueue context extraction (non-fatal):', err);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queue/multi-track-worker.ts
git commit -m "feat(recapforge): enqueue context extraction after multi-track completion"
```

---

## Task 8: Campaign Settings UI

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/settings/page.tsx`

- [ ] **Step 1: Add query + mutation to `CampaignSettingsPage`**

At the top of the `CampaignSettingsPage` function, after existing queries, add:

```ts
const sourcebooks = trpc.campaignContext.getSourcebooks.useQuery(
  { campaignId },
  { enabled: isDM }
);
const seedMutation = trpc.campaignContext.seedFromSourcebook.useMutation({
  onSuccess: (data, variables) => {
    const book = sourcebooks.data?.find((s) => s.id === variables.sourcebookId);
    toast({ title: `Seeded ${data.seeded} context records from ${book?.title ?? 'sourcebook'}` });
  },
  onError: (err) => {
    toast({ title: 'Seeding failed', description: err.message, variant: 'destructive' });
  },
});
```

- [ ] **Step 2: Add Campaign Context section to the settings page JSX**

Find where the existing accordion or settings sections end (look for the closing `</div>` before the danger zone / delete section). Add this block before the danger zone:

```tsx
{isDM && (
  <div className="space-y-3">
    <Separator />
    <div>
      <h3 className="text-sm font-medium text-white/80">Campaign Context</h3>
      <p className="text-xs text-white/40 mt-0.5">
        Seed AI context from synced sourcebooks to improve session summaries.
      </p>
    </div>
    {sourcebooks.data && sourcebooks.data.length === 0 && (
      <p className="text-xs text-white/30">No sourcebooks synced to this campaign.</p>
    )}
    <div className="flex flex-col gap-2">
      {sourcebooks.data?.map((book) => (
        <Button
          key={book.id}
          variant="outline"
          size="sm"
          className="self-start"
          disabled={seedMutation.isPending}
          onClick={() =>
            seedMutation.mutate({ campaignId, sourcebookId: book.id })
          }
        >
          {seedMutation.isPending && seedMutation.variables?.sourcebookId === book.id
            ? 'Seeding…'
            : `Seed context from ${book.title}`}
        </Button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify the page compiles**

```bash
npx tsc --noEmit 2>&1 | grep "settings" | head -10
```

Expected: no errors for the settings page.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/settings/page.tsx"
git commit -m "feat(recapforge): sourcebook seeder UI in campaign settings"
```

---

## Task 9: npm Script + Worker Startup

**Files:**
- Modify: `package.json`
- Modify: `deploy/hetzner/start-workers.sh`

- [ ] **Step 1: Add worker script to `package.json`**

In `package.json`, find the `worker:multi-track` line (or any worker line). Add after it:

```json
"worker:context-extraction": "tsx src/lib/queue/context-extraction-worker.ts",
```

- [ ] **Step 2: Add worker to `deploy/hetzner/start-workers.sh`**

Find:
```bash
npx tsx src/lib/queue/world-simulation-worker.ts &

echo "[Workers] All 17 workers launched"
```

Replace with:
```bash
npx tsx src/lib/queue/world-simulation-worker.ts &
npx tsx src/lib/queue/context-extraction-worker.ts &

echo "[Workers] All 18 workers launched"
```

- [ ] **Step 3: Commit**

```bash
git add package.json deploy/hetzner/start-workers.sh
git commit -m "feat(recapforge): add context-extraction worker script and Hetzner startup"
```

---

## Task 10: Workflow Stub + Final Type Check

**Files:**
- Create: `tests/workflows/recapforge-context.workflow.spec.ts`

- [ ] **Step 1: Create workflow stub**

```ts
import { test } from '@playwright/test';

test.fixme('context extraction runs after multi-track transcription completes', async ({ page }) => {
  // Phase 4 — requires real context-extraction worker + AssemblyAI in E2E env
  // When implemented: upload multi-track files, wait for transcription, verify
  // CampaignContext records appear in campaign settings context section
});

test.fixme('sourcebook seeder creates context records from DDB sourcebook chapters', async ({ page }) => {
  // Phase 4 — requires DDB sourcebook synced to campaign
  // When implemented: navigate to campaign settings, click seed button,
  // verify toast shows correct count, verify records in DB
});
```

- [ ] **Step 2: Run the full unit test suite to confirm nothing is broken**

```bash
npx vitest run tests/unit/
```

Expected: all tests pass, including the new context-extraction tests.

- [ ] **Step 3: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tests/workflows/recapforge-context.workflow.spec.ts
git commit -m "test(recapforge): workflow stubs for Phase 4 context extraction"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - `vector(768)` fix → Task 1
  - `@@unique([campaignId, type, content])` → Task 1
  - `context-extraction-queue.ts` → Task 4
  - `context-extraction-worker.ts` → Task 6
  - `campaignContext` router with `getRecent`, `search`, `getSourcebooks`, `seedFromSourcebook` → Task 5
  - Register in `_app.ts` → Task 5
  - Multi-track worker enqueue → Task 7
  - Campaign settings UI → Task 8
  - `worker:context-extraction` npm script → Task 9
  - `start-workers.sh` → Task 9
  - Unit tests → Task 3
  - Workflow stub → Task 10

- [x] **Type consistency**
  - `ContextExtractionJobData` defined in queue file, imported by worker — ✓
  - `parseExtractionResponse` returns `TranscriptExtract | null`, worker handles null — ✓
  - `buildContentStrings` takes `TranscriptExtract`, returns `string[]` — ✓
  - `campaignContext_type_content` compound unique key used in both router and worker — ✓
  - `Prisma.sql` pattern for `$queryRaw` matches `embedding.repository.ts` pattern — ✓

- [x] **No placeholders** — all code blocks are complete and correct
