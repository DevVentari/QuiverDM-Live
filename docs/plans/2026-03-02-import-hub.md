# Import Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified Import Hub that ingests D&D content from 8 sources (Notion, Obsidian, Google Docs, Docx, Markdown, World Anvil, Campfire, Kanka) into `HomebrewContent` via a shared adapter pipeline.

**Architecture:** All sources implement `ImportAdapter.normalize() → NormalizedDocument[]`. A single `ImportProcessingService` maps documents to `HomebrewContent` records — structured sources (Notion, Kanka, World Anvil, Campfire) skip AI extraction; unstructured sources (Obsidian, Markdown, Docx, Google Docs) go through `extractWithFallback()`. One `ImportJob` model tracks all sources. One `importHub` tRPC router.

**Tech Stack:** Next.js 15, tRPC, Prisma/PostgreSQL, BullMQ/Redis, Vitest. Import alias `@/` → `src/`. Workers use local Redis only (Upstash doesn't support blocking connections). Test runner: `npm run test` (vitest run). Tests live in `tests/`.

---

## Task 1: Prisma Schema — Add ImportJob, SourceCredential, HomebrewContent fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the two new models and two fields to HomebrewContent**

Open `prisma/schema.prisma`. After the `HomebrewContent` model (around line 800), add:

```prisma
model ImportJob {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaignId String?
  campaign   Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  source     String
  status     String    @default("pending")
  progress   Int       @default(0)
  total      Int       @default(0)
  error      String?
  metadata   Json?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([userId, createdAt(sort: Desc)])
}

model SourceCredential {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  source    String
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, source])
  @@index([userId])
}
```

Inside `HomebrewContent` model, add after `sourceType` line:

```prisma
  sourceExternalId String?
  sourceJobId      String?
```

Add to `HomebrewContent` indexes:

```prisma
  @@index([sourceExternalId])
```

Add `importJobs ImportJob[]` and `sourceCredentials SourceCredential[]` to the `User` model relations.

**Step 2: Run migration**

```bash
cd E:\Projects\QuiverDM && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

**Step 3: Verify generated client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ImportJob, SourceCredential models + HomebrewContent source fields"
```

---

## Task 2: Core Types — NormalizedDocument, ImportAdapter, ImportSource

**Files:**
- Create: `src/lib/import-adapters/types.ts`

**Step 1: Write the failing test**

Create `tests/import-adapters/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { NormalizedDocument, ImportAdapter, ImportSource } from '@/lib/import-adapters/types'

describe('NormalizedDocument', () => {
  it('accepts markdown-only document', () => {
    const doc: NormalizedDocument = {
      title: 'Test',
      markdown: '# Hello',
    }
    expect(doc.title).toBe('Test')
  })

  it('accepts pre-structured document', () => {
    const doc: NormalizedDocument = {
      title: 'Solithar',
      type: 'creature',
      data: { name: 'Solithar', cr: 20 },
      sourceId: 'notion-page-123',
    }
    expect(doc.type).toBe('creature')
  })
})

describe('IMPORT_SOURCES', () => {
  it('contains all 8 sources', async () => {
    const { IMPORT_SOURCES } = await import('@/lib/import-adapters/types')
    expect(IMPORT_SOURCES).toContain('notion')
    expect(IMPORT_SOURCES).toContain('obsidian')
    expect(IMPORT_SOURCES).toContain('google_docs')
    expect(IMPORT_SOURCES).toContain('docx')
    expect(IMPORT_SOURCES).toContain('markdown_file')
    expect(IMPORT_SOURCES).toContain('world_anvil')
    expect(IMPORT_SOURCES).toContain('campfire')
    expect(IMPORT_SOURCES).toContain('kanka')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd E:\Projects\QuiverDM && npm run test -- tests/import-adapters/types.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/import-adapters/types'`

**Step 3: Create the types file**

Create `src/lib/import-adapters/types.ts`:

```typescript
export const IMPORT_SOURCES = [
  'notion',
  'obsidian',
  'google_docs',
  'docx',
  'markdown_file',
  'world_anvil',
  'campfire',
  'kanka',
] as const

export type ImportSource = (typeof IMPORT_SOURCES)[number]

export type HomebrewContentType =
  | 'item'
  | 'creature'
  | 'spell'
  | 'location'
  | 'subclass'
  | 'feat'
  | 'rule'
  | 'race'
  | 'class'
  | 'background'
  | 'character'

export interface NormalizedDocument {
  title: string
  markdown?: string
  type?: HomebrewContentType
  data?: Record<string, unknown>
  tags?: string[]
  sourceId?: string
  sourceUrl?: string
}

export interface ImportAdapter {
  source: ImportSource
  normalize(params: Record<string, unknown>): Promise<NormalizedDocument[]>
}

export interface ImportJobMetadata {
  source: ImportSource
  userId: string
  campaignId?: string
  jobId: string
  params: Record<string, unknown>
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- tests/import-adapters/types.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/lib/import-adapters/types.ts tests/import-adapters/types.test.ts
git commit -m "feat: add import adapter types and NormalizedDocument interface"
```

---

## Task 3: Import Queue

**Files:**
- Create: `src/lib/queue/import-job-queue.ts`

**Step 1: Write the failing test**

Create `tests/import-adapters/import-job-queue.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: vi.fn().mockResolvedValue(null),
    close: vi.fn(),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({ close: vi.fn() })),
}))

vi.mock('@/lib/queue/queue', () => ({
  getRedisConnection: vi.fn().mockReturnValue({ host: 'localhost', port: 6380 }),
}))

describe('importJobQueue', () => {
  it('addImportJob enqueues with jobId', async () => {
    const { addImportJob, importJobQueue } = await import('@/lib/queue/import-job-queue')
    const spy = vi.spyOn(importJobQueue, 'add')
    await addImportJob({ jobId: 'abc', source: 'notion', userId: 'u1', params: {} })
    expect(spy).toHaveBeenCalledWith('import-notion-abc', expect.objectContaining({ jobId: 'abc' }), { jobId: 'abc' })
  })
})
```

**Step 2: Run to verify it fails**

```bash
npm run test -- tests/import-adapters/import-job-queue.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/queue/import-job-queue'`

**Step 3: Create the queue file**

Create `src/lib/queue/import-job-queue.ts`:

```typescript
import { Queue, QueueEvents } from 'bullmq'
import { getRedisConnection } from './queue'
import type { ImportJobMetadata } from '@/lib/import-adapters/types'

const redisConnection = getRedisConnection()

export const importJobQueue = new Queue<ImportJobMetadata>('import-job', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
})

export const importJobQueueEvents = new QueueEvents('import-job', {
  connection: redisConnection as any,
})

export async function addImportJob(data: ImportJobMetadata) {
  return importJobQueue.add(`import-${data.source}-${data.jobId}`, data, {
    jobId: data.jobId,
  })
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- tests/import-adapters/import-job-queue.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/queue/import-job-queue.ts tests/import-adapters/import-job-queue.test.ts
git commit -m "feat: add import-job BullMQ queue"
```

---

## Task 4: Repositories — ImportJob + SourceCredential

**Files:**
- Create: `src/server/repositories/import-job.repository.ts`
- Create: `src/server/repositories/source-credential.repository.ts`

**Step 1: Write the failing test**

Create `tests/repositories/import-job.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  importJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

describe('importJobRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createImportJob writes correct fields', async () => {
    mockPrisma.importJob.create.mockResolvedValue({ id: 'job-1', status: 'pending' })
    const { createImportJob } = await import('@/server/repositories/import-job.repository')
    const result = await createImportJob({
      id: 'job-1',
      userId: 'u1',
      source: 'notion',
      metadata: { pageIds: ['p1'] },
    })
    expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'job-1', userId: 'u1', source: 'notion' }),
    })
    expect(result.status).toBe('pending')
  })

  it('updateImportJobProgress patches progress and total', async () => {
    mockPrisma.importJob.update.mockResolvedValue({})
    const { updateImportJobProgress } = await import('@/server/repositories/import-job.repository')
    await updateImportJobProgress('job-1', 5, 20)
    expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { progress: 5, total: 20, status: 'processing' },
    })
  })
})
```

**Step 2: Run to verify it fails**

```bash
npm run test -- tests/repositories/import-job.repository.test.ts
```

Expected: FAIL

**Step 3: Create import-job repository**

Create `src/server/repositories/import-job.repository.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export async function createImportJob(data: {
  id: string
  userId: string
  campaignId?: string
  source: string
  metadata?: Record<string, unknown>
}) {
  return prisma.importJob.create({
    data: {
      id: data.id,
      userId: data.userId,
      campaignId: data.campaignId,
      source: data.source,
      status: 'pending',
      metadata: data.metadata ?? {},
    },
  })
}

export async function updateImportJobProgress(jobId: string, progress: number, total: number) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { progress, total, status: 'processing' },
  }).catch(() => {})
}

export async function completeImportJob(jobId: string) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'complete' },
  }).catch(() => {})
}

export async function failImportJob(jobId: string, error: string) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'failed', error },
  }).catch(() => {})
}

export async function findImportJob(jobId: string, userId: string) {
  return prisma.importJob.findUnique({
    where: { id: jobId },
  }).then((job) => (job?.userId === userId ? job : null))
}

export async function listImportJobs(userId: string, source?: string) {
  return prisma.importJob.findMany({
    where: { userId, ...(source ? { source } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}
```

**Step 4: Create source-credential repository**

Create `src/server/repositories/source-credential.repository.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export async function upsertSourceCredential(userId: string, source: string, data: Record<string, unknown>) {
  return prisma.sourceCredential.upsert({
    where: { userId_source: { userId, source } },
    create: { userId, source, data },
    update: { data, updatedAt: new Date() },
  })
}

export async function findSourceCredential(userId: string, source: string) {
  return prisma.sourceCredential.findUnique({
    where: { userId_source: { userId, source } },
  })
}

export async function deleteSourceCredential(userId: string, source: string) {
  return prisma.sourceCredential.deleteMany({
    where: { userId, source },
  })
}

export async function listConnectedSources(userId: string) {
  const creds = await prisma.sourceCredential.findMany({
    where: { userId },
    select: { source: true },
  })
  return creds.map((c) => c.source)
}
```

**Step 5: Run tests to verify they pass**

```bash
npm run test -- tests/repositories/import-job.repository.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/server/repositories/import-job.repository.ts src/server/repositories/source-credential.repository.ts tests/repositories/import-job.repository.test.ts
git commit -m "feat: add ImportJob and SourceCredential repositories"
```

---

## Task 5: Import Processing Service

**Files:**
- Create: `src/lib/import-processing.service.ts`

This service takes a `NormalizedDocument` and saves it as `HomebrewContent`. If `data` is present, saves directly. If `markdown` + `type`, runs guided AI extraction. If `markdown` only, runs full `extractWithFallback()`.

**Step 1: Write the failing test**

Create `tests/import-adapters/import-processing.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  homebrewContent: {
    upsert: vi.fn().mockResolvedValue({ id: 'hb-1' }),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ai/extraction', () => ({
  extractWithFallback: vi.fn().mockResolvedValue({
    success: true,
    items: [{ type: 'creature', name: 'Goblin', data: { hp: 7 } }],
  }),
}))

describe('ImportProcessingService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves pre-structured document without calling AI', async () => {
    const { processDocument } = await import('@/lib/import-processing.service')
    const { extractWithFallback } = await import('@/lib/ai/extraction')
    await processDocument(
      { title: 'Solithar', type: 'creature', data: { cr: 20 }, sourceId: 'n1' },
      { userId: 'u1', jobId: 'j1', source: 'notion' }
    )
    expect(extractWithFallback).not.toHaveBeenCalled()
    expect(mockPrisma.homebrewContent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId_name_type: expect.anything() }),
        create: expect.objectContaining({ type: 'creature', name: 'Solithar', sourceType: 'notion_import' }),
      })
    )
  })

  it('calls AI extraction for markdown-only document', async () => {
    const { processDocument } = await import('@/lib/import-processing.service')
    const { extractWithFallback } = await import('@/lib/ai/extraction')
    await processDocument(
      { title: 'Goblin Lair', markdown: '# Goblin Lair\nA damp cave...' },
      { userId: 'u1', jobId: 'j1', source: 'obsidian' }
    )
    expect(extractWithFallback).toHaveBeenCalled()
  })
})
```

**Step 2: Run to verify it fails**

```bash
npm run test -- tests/import-adapters/import-processing.service.test.ts
```

Expected: FAIL

**Step 3: Find the extractWithFallback signature**

Read `src/lib/ai/extraction.ts` lines 80–150 to find how `extractWithFallback(markdown, options?)` is called. It returns `ExtractionResult` with `items: ExtractedContent[]` each having `type`, `name`, `data`.

Also check `src/server/repositories/homebrew-extraction.repository.ts` for the `saveExtractedContent` function signature.

**Step 4: Create the processing service**

Create `src/lib/import-processing.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { extractWithFallback } from '@/lib/ai/extraction'
import type { NormalizedDocument, HomebrewContentType } from './import-adapters/types'

interface ProcessingContext {
  userId: string
  jobId: string
  source: string
  campaignId?: string
}

const SOURCE_TYPE_MAP: Record<string, string> = {
  notion: 'notion_import',
  obsidian: 'obsidian_import',
  google_docs: 'google_docs_import',
  docx: 'docx_import',
  markdown_file: 'markdown_import',
  world_anvil: 'world_anvil_import',
  campfire: 'campfire_import',
  kanka: 'kanka_import',
}

// Maps AI extraction types to HomebrewContent types
const EXTRACTION_TYPE_MAP: Record<string, string> = {
  magic_item: 'item',
  spell: 'spell',
  creature: 'creature',
  feat: 'feat',
  race: 'race',
  background: 'background',
  class_feature: 'subclass',
}

export async function processDocument(
  doc: NormalizedDocument,
  ctx: ProcessingContext
): Promise<{ saved: number; errors: string[] }> {
  const sourceType = SOURCE_TYPE_MAP[ctx.source] ?? `${ctx.source}_import`
  const errors: string[] = []
  let saved = 0

  if (doc.data && doc.type) {
    // Pre-structured: save directly, no AI needed
    try {
      await upsertHomebrewContent({
        userId: ctx.userId,
        type: doc.type,
        name: doc.title,
        data: doc.data,
        tags: doc.tags ?? [],
        sourceType,
        sourceExternalId: doc.sourceId,
        sourceJobId: ctx.jobId,
        sourceUrl: doc.sourceUrl,
        campaignId: ctx.campaignId,
      })
      saved++
    } catch (e) {
      errors.push(`Failed to save "${doc.title}": ${e instanceof Error ? e.message : String(e)}`)
    }
    return { saved, errors }
  }

  if (!doc.markdown) return { saved: 0, errors: ['Document has neither data nor markdown'] }

  // Markdown: run AI extraction
  const result = await extractWithFallback(doc.markdown)
  if (!result.success || result.items.length === 0) {
    return { saved: 0, errors: [`AI extraction returned no items for "${doc.title}"`] }
  }

  for (const item of result.items) {
    const dbType = EXTRACTION_TYPE_MAP[item.type] ?? 'item'
    try {
      await upsertHomebrewContent({
        userId: ctx.userId,
        type: dbType,
        name: item.name,
        data: item.data,
        tags: doc.tags ?? [],
        sourceType,
        sourceExternalId: doc.sourceId,
        sourceJobId: ctx.jobId,
        sourceUrl: doc.sourceUrl,
        campaignId: ctx.campaignId,
      })
      saved++
    } catch (e) {
      errors.push(`Failed to save "${item.name}": ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { saved, errors }
}

async function upsertHomebrewContent(data: {
  userId: string
  type: string
  name: string
  data: Record<string, unknown>
  tags: string[]
  sourceType: string
  sourceExternalId?: string
  sourceJobId?: string
  sourceUrl?: string
  campaignId?: string
}) {
  return prisma.homebrewContent.upsert({
    where: {
      userId_name_type: { userId: data.userId, name: data.name, type: data.type },
    },
    create: {
      userId: data.userId,
      type: data.type,
      name: data.name,
      data: data.data,
      tags: data.tags,
      sourceType: data.sourceType,
      sourceExternalId: data.sourceExternalId,
      sourceJobId: data.sourceJobId,
      searchText: `${data.name} ${JSON.stringify(data.data)}`.toLowerCase(),
    },
    update: {
      data: data.data,
      tags: data.tags,
      sourceType: data.sourceType,
      sourceExternalId: data.sourceExternalId,
      sourceJobId: data.sourceJobId,
      searchText: `${data.name} ${JSON.stringify(data.data)}`.toLowerCase(),
    },
  })
}
```

> **Note:** Check `prisma/schema.prisma` to confirm the unique index name on `HomebrewContent` is `userId_name_type`. If it uses a different `@@unique` name, adjust the `where` clause accordingly.

**Step 5: Run test to verify it passes**

```bash
npm run test -- tests/import-adapters/import-processing.service.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/import-processing.service.ts tests/import-adapters/import-processing.service.test.ts
git commit -m "feat: add ImportProcessingService for structured and markdown documents"
```

---

## Task 6: Import Job Worker

**Files:**
- Create: `src/lib/queue/import-job-worker.ts`

The worker imports the `AdapterFactory` (Task 10 creates this), so stub it here and fill it in after adapters are built. For now, create the worker shell with error handling.

**Step 1: Create the worker**

Create `src/lib/queue/import-job-worker.ts`:

```typescript
import dotenv from 'dotenv'
dotenv.config({ override: true })

import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { processDocument } from '@/lib/import-processing.service'
import {
  updateImportJobProgress,
  completeImportJob,
  failImportJob,
} from '@/server/repositories/import-job.repository'
import type { ImportJobMetadata } from '@/lib/import-adapters/types'

// Local Redis only — Upstash doesn't support BullMQ blocking connections
function getLocalRedis() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  }
}

const worker = new Worker<ImportJobMetadata>(
  'import-job',
  async (job: Job<ImportJobMetadata>) => {
    const { jobId, source, userId, campaignId, params } = job.data

    // Dynamically load adapter to avoid circular imports at module init
    const { AdapterFactory } = await import('@/lib/import-adapters/index')
    const adapter = AdapterFactory.create(source)

    const docs = await adapter.normalize(params)
    await updateImportJobProgress(jobId, 0, docs.length)

    let totalSaved = 0
    const allErrors: string[] = []

    for (let i = 0; i < docs.length; i++) {
      const { saved, errors } = await processDocument(docs[i], {
        userId,
        jobId,
        source,
        campaignId,
      })
      totalSaved += saved
      allErrors.push(...errors)
      await updateImportJobProgress(jobId, i + 1, docs.length)
    }

    await completeImportJob(jobId)
    return { saved: totalSaved, errors: allErrors }
  },
  {
    connection: getLocalRedis() as any,
    concurrency: 2,
  }
)

worker.on('failed', async (job, err) => {
  if (job) {
    await failImportJob(job.data.jobId, err.message)
  }
  console.error('[import-job-worker] job failed:', err)
})

console.log('[import-job-worker] listening...')
```

**Step 2: Add worker script to package.json**

Open `package.json`. In the `scripts` section, add:

```json
"worker:import": "tsx src/lib/queue/import-job-worker.ts"
```

**Step 3: Commit**

```bash
git add src/lib/queue/import-job-worker.ts package.json
git commit -m "feat: add import-job BullMQ worker"
```

---

## Task 7: tRPC Router — importHub

**Files:**
- Create: `src/server/routers/import-hub.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing test**

Create `tests/routers/import-hub.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/repositories/import-job.repository', () => ({
  createImportJob: vi.fn().mockResolvedValue({ id: 'j1', status: 'pending', source: 'notion' }),
  findImportJob: vi.fn().mockResolvedValue({ id: 'j1', status: 'processing', progress: 5, total: 20 }),
  listImportJobs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/queue/import-job-queue', () => ({
  addImportJob: vi.fn().mockResolvedValue({ id: 'j1' }),
}))
vi.mock('@/server/repositories/source-credential.repository', () => ({
  upsertSourceCredential: vi.fn(),
  deleteSourceCredential: vi.fn(),
  listConnectedSources: vi.fn().mockResolvedValue(['notion']),
}))

const mockCtx = { session: { user: { id: 'u1' } } }

describe('importHubRouter', () => {
  it('startImport creates a job and queues it', async () => {
    const { createImportJob } = await import('@/server/repositories/import-job.repository')
    const { addImportJob } = await import('@/lib/queue/import-job-queue')
    const { importHubRouter } = await import('@/server/routers/import-hub')

    const caller = importHubRouter.createCaller(mockCtx as any)
    const result = await caller.startImport({
      source: 'notion',
      params: { pageIds: ['p1'] },
    })

    expect(createImportJob).toHaveBeenCalled()
    expect(addImportJob).toHaveBeenCalled()
    expect(result.jobId).toBeTruthy()
  })

  it('getJobStatus returns job for correct user', async () => {
    const { importHubRouter } = await import('@/server/routers/import-hub')
    const caller = importHubRouter.createCaller(mockCtx as any)
    const result = await caller.getJobStatus({ jobId: 'j1' })
    expect(result.status).toBe('processing')
    expect(result.progress).toBe(5)
  })
})
```

**Step 2: Run to verify it fails**

```bash
npm run test -- tests/routers/import-hub.test.ts
```

Expected: FAIL

**Step 3: Create the router**

Create `src/server/routers/import-hub.ts`:

```typescript
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createId } from '@paralleldrive/cuid2'
import { IMPORT_SOURCES } from '@/lib/import-adapters/types'
import {
  createImportJob,
  findImportJob,
  listImportJobs,
} from '@/server/repositories/import-job.repository'
import {
  upsertSourceCredential,
  deleteSourceCredential,
  listConnectedSources,
  findSourceCredential,
} from '@/server/repositories/source-credential.repository'
import { addImportJob } from '@/lib/queue/import-job-queue'

export const importHubRouter = router({
  startImport: protectedProcedure
    .input(
      z.object({
        source: z.enum(IMPORT_SOURCES),
        params: z.record(z.unknown()),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      const jobId = createId()

      await createImportJob({
        id: jobId,
        userId,
        campaignId: input.campaignId,
        source: input.source,
        metadata: input.params,
      })

      await addImportJob({
        jobId,
        userId,
        source: input.source,
        campaignId: input.campaignId,
        params: input.params,
      })

      return { jobId }
    }),

  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await findImportJob(input.jobId, ctx.session.user.id)
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Import job not found' })
      return {
        status: job.status,
        progress: job.progress,
        total: job.total,
        error: job.error,
      }
    }),

  listJobs: protectedProcedure
    .input(z.object({ source: z.string().optional() }))
    .query(({ input, ctx }) => listImportJobs(ctx.session.user.id, input.source)),

  connectSource: protectedProcedure
    .input(z.object({ source: z.enum(IMPORT_SOURCES), credentials: z.record(z.unknown()) }))
    .mutation(({ input, ctx }) =>
      upsertSourceCredential(ctx.session.user.id, input.source, input.credentials)
    ),

  disconnectSource: protectedProcedure
    .input(z.object({ source: z.enum(IMPORT_SOURCES) }))
    .mutation(({ input, ctx }) =>
      deleteSourceCredential(ctx.session.user.id, input.source)
    ),

  getConnectedSources: protectedProcedure.query(({ ctx }) =>
    listConnectedSources(ctx.session.user.id)
  ),
})

export type ImportHubRouter = typeof importHubRouter
```

**Step 4: Register in _app.ts**

Open `src/server/routers/_app.ts`. Add:

```typescript
import { importHubRouter } from './import-hub'
```

And inside `appRouter`:

```typescript
importHub: importHubRouter,
```

**Step 5: Run test to verify it passes**

```bash
npm run test -- tests/routers/import-hub.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/server/routers/import-hub.ts src/server/routers/_app.ts tests/routers/import-hub.test.ts
git commit -m "feat: add importHub tRPC router"
```

---

## Task 8: File Upload API Route

**Files:**
- Create: `src/app/api/imports/upload/route.ts`

This route accepts multipart file uploads (zip, docx, md, xml, json), stores to R2, and returns a `fileKey` the client passes back to `startImport`.

**Step 1: Create the route**

Create `src/app/api/imports/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { storage } from '@/lib/storage'

const ALLOWED_TYPES: Record<string, string> = {
  'application/zip': 'obsidian',
  'application/x-zip-compressed': 'obsidian',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/markdown': 'markdown_file',
  'text/plain': 'markdown_file',
  'application/xml': 'world_anvil',
  'text/xml': 'world_anvil',
  'application/json': 'campfire', // also kanka
}

const MAX_SIZE = 100 * 1024 * 1024 // 100MB

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const sourceHint = formData.get('source') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })

  const detectedSource = ALLOWED_TYPES[file.type]
  if (!detectedSource && !sourceHint) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const fileKey = `imports/${session.user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await storage.upload(fileKey, buffer, file.type)

  return NextResponse.json({
    fileKey,
    source: sourceHint ?? detectedSource,
    originalName: file.name,
  })
}
```

> **Note:** Check `src/lib/storage/index.ts` for the exact `storage.upload(key, buffer, contentType)` signature — adjust if needed.

**Step 2: Commit**

```bash
git add src/app/api/imports/upload/route.ts
git commit -m "feat: add /api/imports/upload multipart file upload route"
```

---

## Task 9: AdapterFactory + Index

**Files:**
- Create: `src/lib/import-adapters/index.ts`

This file exports `AdapterFactory.create(source)`. Adapters are registered here after each adapter is built (Tasks 10–17).

**Step 1: Create stub**

Create `src/lib/import-adapters/index.ts`:

```typescript
import type { ImportAdapter, ImportSource } from './types'

// Adapters are registered as they're built. Import lazily to avoid circular deps.
const ADAPTER_MAP: Partial<Record<ImportSource, () => Promise<ImportAdapter>>> = {}

export const AdapterFactory = {
  register(source: ImportSource, factory: () => Promise<ImportAdapter>) {
    ADAPTER_MAP[source] = factory
  },

  async create(source: ImportSource): Promise<ImportAdapter> {
    const factory = ADAPTER_MAP[source]
    if (!factory) throw new Error(`No adapter registered for source: ${source}`)
    return factory()
  },
}

// Register all adapters
import('./notion.adapter').then((m) => AdapterFactory.register('notion', () => Promise.resolve(m.notionAdapter)))
import('./obsidian.adapter').then((m) => AdapterFactory.register('obsidian', () => Promise.resolve(m.obsidianAdapter)))
import('./google-docs.adapter').then((m) => AdapterFactory.register('google_docs', () => Promise.resolve(m.googleDocsAdapter)))
import('./docx.adapter').then((m) => AdapterFactory.register('docx', () => Promise.resolve(m.docxAdapter)))
import('./markdown-file.adapter').then((m) => AdapterFactory.register('markdown_file', () => Promise.resolve(m.markdownFileAdapter)))
import('./world-anvil.adapter').then((m) => AdapterFactory.register('world_anvil', () => Promise.resolve(m.worldAnvilAdapter)))
import('./campfire.adapter').then((m) => AdapterFactory.register('campfire', () => Promise.resolve(m.campfireAdapter)))
import('./kanka.adapter').then((m) => AdapterFactory.register('kanka', () => Promise.resolve(m.kankaAdapter)))
```

**Step 2: Commit**

```bash
git add src/lib/import-adapters/index.ts
git commit -m "feat: add AdapterFactory with lazy registration"
```

---

## Task 10: Notion Adapter

**Files:**
- Create: `src/lib/import-adapters/notion.adapter.ts`

**Notion blocks → markdown logic:**
- `paragraph` → plain text
- `heading_1/2/3` → `#`, `##`, `###`
- `bulleted_list_item` → `- `
- `numbered_list_item` → `1. `
- `toggle`, `callout` → blockquote `> `
- `table` → markdown table rows
- `child_page` → recurse

**Pre-classification by parent page title:**
- Contains "NPC" or "Monster" or "Creature" → `creature`
- Contains "Location" or "Region" or "Place" → `location`
- Contains "Character" or "PC" or "Player" → `character`
- Contains "Item" or "Spell" or "Feat" → `null` (AI extracts)
- Default → `null` (full AI extraction)

**Params:** `{ pageIds: string[], token: string }`

**Step 1: Write the failing test**

Create `tests/import-adapters/notion.adapter.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('notionAdapter', () => {
  it('pre-classifies NPC pages as creature', async () => {
    // Mock Notion blocks API: returns a page with title containing NPC
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          object: 'page',
          properties: { title: { title: [{ plain_text: 'Solithar' }] } },
          parent: { type: 'page_id', page_id: 'parent-id' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'A powerful deity.' }] } }
          ],
          has_more: false,
        }),
      })

    const { notionAdapter } = await import('@/lib/import-adapters/notion.adapter')
    const docs = await notionAdapter.normalize({
      pageIds: ['page-1'],
      token: 'secret_test',
      parentTitle: 'NPCs',
    })

    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe('Solithar')
    expect(docs[0].type).toBe('creature')
    expect(docs[0].markdown).toContain('A powerful deity.')
  })
})
```

**Step 2: Run to verify it fails**

```bash
npm run test -- tests/import-adapters/notion.adapter.test.ts
```

Expected: FAIL

**Step 3: Create the adapter**

Create `src/lib/import-adapters/notion.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function classifyByParentTitle(parentTitle: string): HomebrewContentType | undefined {
  const t = parentTitle.toLowerCase()
  if (t.includes('npc') || t.includes('monster') || t.includes('creature')) return 'creature'
  if (t.includes('location') || t.includes('region') || t.includes('place')) return 'location'
  if (t.includes('character') || t.includes(' pc') || t.includes('player')) return 'character'
  if (t.includes('god') || t.includes('deity') || t.includes('pantheon')) return 'creature'
  return undefined
}

async function getPageTitle(pageId: string, token: string): Promise<string> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
  })
  const page = await res.json()
  const titleProp = page.properties?.title ?? page.properties?.Name
  if (!titleProp) return 'Untitled'
  return titleProp.title?.map((t: any) => t.plain_text).join('') ?? 'Untitled'
}

async function getBlocksAsMarkdown(blockId: string, token: string): Promise<string> {
  const lines: string[] = []
  let cursor: string | undefined

  do {
    const url = `${NOTION_API}/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}` : ''}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
    })
    const data = await res.json()

    for (const block of data.results ?? []) {
      lines.push(blockToMarkdown(block))
    }

    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return lines.filter(Boolean).join('\n')
}

function blockToMarkdown(block: any): string {
  const getText = (richText: any[]) => richText?.map((t: any) => t.plain_text).join('') ?? ''
  switch (block.type) {
    case 'heading_1': return `# ${getText(block.heading_1.rich_text)}`
    case 'heading_2': return `## ${getText(block.heading_2.rich_text)}`
    case 'heading_3': return `### ${getText(block.heading_3.rich_text)}`
    case 'paragraph': return getText(block.paragraph.rich_text)
    case 'bulleted_list_item': return `- ${getText(block.bulleted_list_item.rich_text)}`
    case 'numbered_list_item': return `1. ${getText(block.numbered_list_item.rich_text)}`
    case 'callout': return `> ${getText(block.callout.rich_text)}`
    case 'toggle': return `> ${getText(block.toggle.rich_text)}`
    case 'quote': return `> ${getText(block.quote.rich_text)}`
    case 'code': return `\`\`\`\n${getText(block.code.rich_text)}\n\`\`\``
    default: return ''
  }
}

export const notionAdapter: ImportAdapter = {
  source: 'notion',

  async normalize(params) {
    const { pageIds, token, parentTitle } = params as {
      pageIds: string[]
      token: string
      parentTitle?: string
    }

    const docs: NormalizedDocument[] = []

    for (const pageId of pageIds) {
      const title = await getPageTitle(pageId, token)
      const markdown = await getBlocksAsMarkdown(pageId, token)
      const type = parentTitle ? classifyByParentTitle(parentTitle) : undefined

      docs.push({
        title,
        markdown,
        type,
        sourceId: pageId,
        sourceUrl: `https://notion.so/${pageId.replace(/-/g, '')}`,
      })
    }

    return docs
  },
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- tests/import-adapters/notion.adapter.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/import-adapters/notion.adapter.ts tests/import-adapters/notion.adapter.test.ts
git commit -m "feat: add Notion import adapter with pre-classification"
```

---

## Task 11: Obsidian Adapter

**Files:**
- Create: `src/lib/import-adapters/obsidian.adapter.ts`

Wraps existing `src/lib/queue/obsidian-import-process.ts`. Params: `{ fileKey: string }`. Downloads zip from R2, extracts markdown files, passes through existing `obsidian-extraction.ts` logic, returns `NormalizedDocument[]`.

**Step 1: Check what obsidian-import-process.ts exports**

Read `src/lib/queue/obsidian-import-process.ts` to understand what functions are available.

**Step 2: Create adapter**

Create `src/lib/import-adapters/obsidian.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument } from './types'
import { storage } from '@/lib/storage'
import JSZip from 'jszip'
import matter from 'gray-matter'

export const obsidianAdapter: ImportAdapter = {
  source: 'obsidian',

  async normalize(params) {
    const { fileKey } = params as { fileKey: string }

    const buffer = await storage.download(fileKey)
    const zip = await JSZip.loadAsync(buffer)
    const docs: NormalizedDocument[] = []

    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir || !filename.endsWith('.md')) continue
      const content = await file.async('string')
      const { data: frontmatter, content: markdown } = matter(content)

      docs.push({
        title: frontmatter.title ?? filename.replace(/\.md$/, '').split('/').pop() ?? 'Untitled',
        markdown: `# ${frontmatter.title ?? ''}\n\n${markdown}`,
        type: frontmatter.type ?? undefined,
        tags: frontmatter.tags ?? [],
        sourceId: filename,
      })
    }

    return docs
  },
}
```

> **Note:** Check `package.json` to confirm `jszip` and `gray-matter` are installed. If not, run `npm install jszip gray-matter`.

**Step 3: Commit**

```bash
git add src/lib/import-adapters/obsidian.adapter.ts
git commit -m "feat: add Obsidian import adapter"
```

---

## Task 12: Docx + Markdown File Adapters

**Files:**
- Create: `src/lib/import-adapters/docx.adapter.ts`
- Create: `src/lib/import-adapters/markdown-file.adapter.ts`

Both download from R2 and return markdown for full AI extraction.

**Step 1: Check if mammoth is installed**

```bash
cd E:\Projects\QuiverDM && cat package.json | grep mammoth
```

If not present: `npm install mammoth`

**Step 2: Create docx adapter**

Create `src/lib/import-adapters/docx.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument } from './types'
import { storage } from '@/lib/storage'
import mammoth from 'mammoth'

export const docxAdapter: ImportAdapter = {
  source: 'docx',

  async normalize(params) {
    const { fileKey, originalName } = params as { fileKey: string; originalName?: string }
    const buffer = await storage.download(fileKey)
    const { value: markdown } = await mammoth.convertToMarkdown({ buffer })
    const title = originalName?.replace(/\.docx?$/i, '') ?? 'Imported Document'

    return [{ title, markdown, sourceId: fileKey }]
  },
}
```

**Step 3: Create markdown file adapter**

Create `src/lib/import-adapters/markdown-file.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument } from './types'
import { storage } from '@/lib/storage'

export const markdownFileAdapter: ImportAdapter = {
  source: 'markdown_file',

  async normalize(params) {
    const { fileKey, originalName } = params as { fileKey: string; originalName?: string }
    const buffer = await storage.download(fileKey)
    const markdown = buffer.toString('utf-8')
    const title = originalName?.replace(/\.md$/i, '') ?? 'Imported Markdown'

    return [{ title, markdown, sourceId: fileKey }]
  },
}
```

**Step 4: Commit**

```bash
git add src/lib/import-adapters/docx.adapter.ts src/lib/import-adapters/markdown-file.adapter.ts
git commit -m "feat: add Docx and Markdown file import adapters"
```

---

## Task 13: Google Docs Adapter

**Files:**
- Create: `src/lib/import-adapters/google-docs.adapter.ts`

Params: `{ docUrl: string, token?: string }`. For public docs, uses the Google Docs export API directly. For private docs (token present), uses the Drive API.

**Step 1: Create the adapter**

Create `src/lib/import-adapters/google-docs.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument } from './types'

function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

export const googleDocsAdapter: ImportAdapter = {
  source: 'google_docs',

  async normalize(params) {
    const { docUrl, token } = params as { docUrl: string; token?: string }
    const docId = extractDocId(docUrl)
    if (!docId) throw new Error(`Cannot extract doc ID from URL: ${docUrl}`)

    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=markdown`
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(exportUrl, { headers })
    if (!res.ok) {
      // Fallback to text export
      const textUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
      const textRes = await fetch(textUrl, { headers })
      if (!textRes.ok) throw new Error(`Failed to fetch Google Doc: ${res.status}`)
      const text = await textRes.text()
      return [{ title: docId, markdown: text, sourceId: docId, sourceUrl: docUrl }]
    }

    const markdown = await res.text()
    return [{ title: docId, markdown, sourceId: docId, sourceUrl: docUrl }]
  },
}
```

**Step 2: Commit**

```bash
git add src/lib/import-adapters/google-docs.adapter.ts
git commit -m "feat: add Google Docs import adapter"
```

---

## Task 14: World Anvil Adapter

**Files:**
- Create: `src/lib/import-adapters/world-anvil.adapter.ts`

Two modes: API (token + worldSlug) and XML export file (fileKey).

**World Anvil article categories → content types:**
- `location`, `settlement`, `dungeon`, `wilderness` → `location`
- `character`, `person`, `npc` → `character`
- `creature`, `monster`, `race` → `creature`
- `item`, `material`, `technology` → `item`
- `spell`, `magic` → `spell`
- default → markdown for AI extraction

**Step 1: Create the adapter**

Create `src/lib/import-adapters/world-anvil.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'
import { storage } from '@/lib/storage'

const CATEGORY_MAP: Record<string, HomebrewContentType> = {
  location: 'location', settlement: 'location', dungeon: 'location', wilderness: 'location',
  character: 'character', person: 'character', npc: 'character',
  creature: 'creature', monster: 'creature', race: 'race',
  item: 'item', material: 'item', technology: 'item',
  spell: 'spell', magic: 'spell',
}

function classifyArticle(category: string): HomebrewContentType | undefined {
  return CATEGORY_MAP[category?.toLowerCase()]
}

async function fetchViaAPI(token: string, worldSlug: string): Promise<NormalizedDocument[]> {
  const docs: NormalizedDocument[] = []
  let page = 1

  while (true) {
    const res = await fetch(
      `https://www.worldanvil.com/api/aragorn/world/${worldSlug}/articles?page=${page}`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    if (!res.ok) break
    const data = await res.json()
    const articles = data.articles ?? data.data ?? []
    if (articles.length === 0) break

    for (const article of articles) {
      const type = classifyArticle(article.category?.toLowerCase() ?? '')
      docs.push({
        title: article.title ?? article.name,
        markdown: `# ${article.title}\n\n${article.content ?? article.body ?? ''}`,
        type,
        tags: article.tags ?? [],
        sourceId: article.id ?? article.uuid,
        sourceUrl: article.url,
      })
    }

    if (!data.has_more) break
    page++
  }

  return docs
}

async function parseXMLExport(fileKey: string): Promise<NormalizedDocument[]> {
  const { XMLParser } = await import('fast-xml-parser')
  const buffer = await storage.download(fileKey)
  const parser = new XMLParser({ ignoreAttributes: false })
  const xml = parser.parse(buffer.toString())
  const articles = xml?.world?.articles?.article ?? []
  const list = Array.isArray(articles) ? articles : [articles]

  return list.map((a: any) => ({
    title: a.title ?? a.name ?? 'Untitled',
    markdown: `# ${a.title}\n\n${a.content ?? ''}`,
    type: classifyArticle(a.category ?? ''),
    sourceId: a.id ?? a.uuid,
  }))
}

export const worldAnvilAdapter: ImportAdapter = {
  source: 'world_anvil',

  async normalize(params) {
    const { mode, token, worldSlug, fileKey } = params as {
      mode: 'api' | 'export'
      token?: string
      worldSlug?: string
      fileKey?: string
    }

    if (mode === 'api' && token && worldSlug) return fetchViaAPI(token, worldSlug)
    if (mode === 'export' && fileKey) return parseXMLExport(fileKey)
    throw new Error('World Anvil adapter requires either (mode:api, token, worldSlug) or (mode:export, fileKey)')
  },
}
```

> **Note:** Check if `fast-xml-parser` is installed. If not: `npm install fast-xml-parser`.

**Step 2: Commit**

```bash
git add src/lib/import-adapters/world-anvil.adapter.ts
git commit -m "feat: add World Anvil import adapter (API + XML export)"
```

---

## Task 15: Kanka Adapter

**Files:**
- Create: `src/lib/import-adapters/kanka.adapter.ts`

**Kanka entity types → content types:** characters→character, locations→location, creatures→creature, items→item, journals→rule, races→race, organisations→location.

**Step 1: Create the adapter**

Create `src/lib/import-adapters/kanka.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'
import { storage } from '@/lib/storage'

const ENTITY_TYPE_MAP: Record<string, HomebrewContentType> = {
  characters: 'character',
  locations: 'location',
  creatures: 'creature',
  items: 'item',
  journals: 'rule',
  races: 'race',
  organisations: 'location',
  families: 'character',
  notes: 'rule',
}

const KANKA_API = 'https://kanka.io/api/1.0'

async function fetchEntityType(
  token: string,
  campaignId: string,
  entityType: string
): Promise<NormalizedDocument[]> {
  const docs: NormalizedDocument[] = []
  let url: string | null = `${KANKA_API}/campaigns/${campaignId}/${entityType}`

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) break
    const data = await res.json()

    for (const entity of data.data ?? []) {
      docs.push({
        title: entity.name,
        type: ENTITY_TYPE_MAP[entityType],
        data: {
          name: entity.name,
          description: entity.entry_parsed ?? entity.entry ?? '',
          tags: entity.tags ?? [],
          ...entity,
        },
        sourceId: String(entity.id),
        sourceUrl: entity.url,
      })
    }

    url = data.links?.next ?? null
  }

  return docs
}

async function parseExport(fileKey: string): Promise<NormalizedDocument[]> {
  const buffer = await storage.download(fileKey)
  const json = JSON.parse(buffer.toString())
  const docs: NormalizedDocument[] = []

  for (const [entityType, entities] of Object.entries(json)) {
    const type = ENTITY_TYPE_MAP[entityType]
    for (const entity of entities as any[]) {
      docs.push({
        title: entity.name,
        type,
        data: entity,
        sourceId: String(entity.id),
      })
    }
  }

  return docs
}

export const kankaAdapter: ImportAdapter = {
  source: 'kanka',

  async normalize(params) {
    const { mode, token, campaignId, fileKey, entityTypes } = params as {
      mode: 'api' | 'export'
      token?: string
      campaignId?: string
      fileKey?: string
      entityTypes?: string[]
    }

    if (mode === 'export' && fileKey) return parseExport(fileKey)

    if (mode === 'api' && token && campaignId) {
      const types = entityTypes ?? Object.keys(ENTITY_TYPE_MAP)
      const results = await Promise.all(
        types.map((t) => fetchEntityType(token, campaignId, t))
      )
      return results.flat()
    }

    throw new Error('Kanka adapter requires (mode:api, token, campaignId) or (mode:export, fileKey)')
  },
}
```

**Step 2: Commit**

```bash
git add src/lib/import-adapters/kanka.adapter.ts
git commit -m "feat: add Kanka import adapter (API + JSON export)"
```

---

## Task 16: Campfire Adapter

**Files:**
- Create: `src/lib/import-adapters/campfire.adapter.ts`

Export-only (no public API). Campfire exports JSON with entity sections.

**Step 1: Create the adapter**

Create `src/lib/import-adapters/campfire.adapter.ts`:

```typescript
import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'
import { storage } from '@/lib/storage'

const TYPE_MAP: Record<string, HomebrewContentType> = {
  character: 'character',
  characters: 'character',
  location: 'location',
  locations: 'location',
  creature: 'creature',
  creatures: 'creature',
  item: 'item',
  items: 'item',
  lore: 'rule',
  timeline: 'rule',
  note: 'rule',
  notes: 'rule',
}

export const campfireAdapter: ImportAdapter = {
  source: 'campfire',

  async normalize(params) {
    const { fileKey } = params as { fileKey: string }
    const buffer = await storage.download(fileKey)
    const json = JSON.parse(buffer.toString())
    const docs: NormalizedDocument[] = []

    const processSection = (section: any[], typeName: string) => {
      const type = TYPE_MAP[typeName.toLowerCase()]
      for (const entity of section) {
        docs.push({
          title: entity.name ?? entity.title ?? 'Untitled',
          type,
          data: entity,
          tags: entity.tags ?? [],
          sourceId: entity.id ? String(entity.id) : undefined,
        })
      }
    }

    if (Array.isArray(json)) {
      for (const item of json) {
        processSection([item], item.type ?? 'note')
      }
    } else {
      for (const [key, value] of Object.entries(json)) {
        if (Array.isArray(value)) processSection(value, key)
      }
    }

    return docs
  },
}
```

**Step 2: Commit**

```bash
git add src/lib/import-adapters/campfire.adapter.ts
git commit -m "feat: add Campfire import adapter (JSON export)"
```

---

## Task 17: UI — Import Hub Page

**Files:**
- Create: `src/app/(app)/homebrew/import/page.tsx`
- Create: `src/app/(app)/homebrew/import/_components/source-card.tsx`

**Step 1: Create the page**

Create `src/app/(app)/homebrew/import/page.tsx`:

```tsx
import { SourceCard } from './_components/source-card'
import { IMPORT_SOURCES } from '@/lib/import-adapters/types'

const SOURCE_META: Record<string, { label: string; description: string; authMode: 'api' | 'file' | 'both' }> = {
  notion:        { label: 'Notion',       description: 'Import pages from your Notion workspace', authMode: 'api' },
  obsidian:      { label: 'Obsidian',     description: 'Upload a vault ZIP', authMode: 'file' },
  google_docs:   { label: 'Google Docs',  description: 'Import from a shareable Google Doc URL', authMode: 'both' },
  docx:          { label: 'Word (.docx)', description: 'Upload a Word document', authMode: 'file' },
  markdown_file: { label: 'Markdown',     description: 'Upload .md files', authMode: 'file' },
  world_anvil:   { label: 'World Anvil',  description: 'API sync or XML export upload', authMode: 'both' },
  campfire:      { label: 'Campfire',     description: 'Upload a Campfire JSON export', authMode: 'file' },
  kanka:         { label: 'Kanka',        description: 'API sync or JSON export upload', authMode: 'both' },
}

export default function ImportHubPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Import Content</h1>
      <p className="text-muted-foreground mb-8">
        Bring your homebrew content from any platform into QuiverDM.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {IMPORT_SOURCES.map((source) => (
          <SourceCard key={source} source={source} meta={SOURCE_META[source]} />
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create SourceCard**

Create `src/app/(app)/homebrew/import/_components/source-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImportModal } from './import-modal'

interface SourceMeta {
  label: string
  description: string
  authMode: 'api' | 'file' | 'both'
}

export function SourceCard({ source, meta }: { source: string; meta: SourceMeta }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card className="cursor-pointer hover:border-amber-500 transition-colors" onClick={() => setOpen(true)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{meta.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
          <Button size="sm" className="mt-3 w-full" variant="outline">Import</Button>
        </CardContent>
      </Card>
      <ImportModal source={source} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/homebrew/import/
git commit -m "feat: add Import Hub page and source cards"
```

---

## Task 18: UI — Import Modal + Progress View

**Files:**
- Create: `src/app/(app)/homebrew/import/_components/import-modal.tsx`
- Create: `src/app/(app)/homebrew/import/_components/progress-view.tsx`

**Step 1: Create progress view**

Create `src/app/(app)/homebrew/import/_components/progress-view.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { Progress } from '@/components/ui/progress'

export function ProgressView({ jobId, onComplete }: { jobId: string; onComplete: () => void }) {
  const { data, refetch } = api.importHub.getJobStatus.useQuery(
    { jobId },
    { refetchInterval: 2000 }
  )

  useEffect(() => {
    if (data?.status === 'complete' || data?.status === 'failed') {
      onComplete()
    }
  }, [data?.status, onComplete])

  const pct = data?.total ? Math.round((data.progress / data.total) * 100) : 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data?.status === 'failed'
          ? `Import failed: ${data.error}`
          : data?.status === 'complete'
          ? 'Import complete!'
          : `Importing... ${data?.progress ?? 0} / ${data?.total ?? '?'} items`}
      </p>
      <Progress value={pct} />
    </div>
  )
}
```

**Step 2: Create import modal**

Create `src/app/(app)/homebrew/import/_components/import-modal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/trpc/client'
import { ProgressView } from './progress-view'

export function ImportModal({ source, open, onClose }: { source: string; open: boolean; onClose: () => void }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [file, setFile] = useState<File | null>(null)
  const startImport = api.importHub.startImport.useMutation()

  const FILE_SOURCES = ['obsidian', 'docx', 'markdown_file', 'campfire']
  const API_SOURCES = ['notion', 'google_docs', 'world_anvil', 'kanka']
  const isFileSource = FILE_SOURCES.includes(source)

  async function handleSubmit() {
    let finalParams = { ...params }

    if (isFileSource && file) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)
      const res = await fetch('/api/imports/upload', { method: 'POST', body: formData })
      const { fileKey } = await res.json()
      finalParams = { ...finalParams, fileKey, originalName: file.name }
    }

    const result = await startImport.mutateAsync({ source: source as any, params: finalParams })
    setJobId(result.jobId)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from {source}</DialogTitle>
        </DialogHeader>

        {jobId ? (
          <ProgressView jobId={jobId} onComplete={onClose} />
        ) : (
          <div className="space-y-4">
            {source === 'notion' && (
              <div>
                <Label>Notion Page IDs (comma-separated)</Label>
                <Input
                  placeholder="e.g. 3a11b929-6012-4a1a-b7bf-08c4e8a3e55e"
                  onChange={(e) => setParams({ pageIds: e.target.value.split(',').map((s) => s.trim()), token: process.env.NEXT_PUBLIC_NOTION_TOKEN })}
                />
              </div>
            )}
            {source === 'google_docs' && (
              <div>
                <Label>Google Doc URL</Label>
                <Input
                  placeholder="https://docs.google.com/document/d/..."
                  onChange={(e) => setParams({ docUrl: e.target.value })}
                />
              </div>
            )}
            {(source === 'world_anvil' || source === 'kanka') && (
              <>
                <div>
                  <Label>API Token</Label>
                  <Input onChange={(e) => setParams((p) => ({ ...p, token: e.target.value, mode: 'api' }))} />
                </div>
                <div>
                  <Label>{source === 'kanka' ? 'Campaign ID' : 'World Slug'}</Label>
                  <Input onChange={(e) => setParams((p) => ({ ...p, [source === 'kanka' ? 'campaignId' : 'worldSlug']: e.target.value }))} />
                </div>
              </>
            )}
            {isFileSource && (
              <div>
                <Label>Upload File</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            )}
            <Button onClick={handleSubmit} disabled={startImport.isPending} className="w-full">
              {startImport.isPending ? 'Starting...' : 'Start Import'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

> **Note:** The `NEXT_PUBLIC_NOTION_TOKEN` approach is a placeholder for now — for production, fetch the token from `SourceCredential` server-side and pass via a dedicated query.

**Step 3: Add Import button to homebrew page**

Find the homebrew page at `src/app/(app)/homebrew/page.tsx`. Add a link/button:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// In the page header JSX:
<Link href="/homebrew/import">
  <Button variant="outline">Import Content</Button>
</Link>
```

**Step 4: Commit**

```bash
git add src/app/\(app\)/homebrew/import/_components/ src/app/\(app\)/homebrew/page.tsx
git commit -m "feat: add Import Hub modal, progress view, and homebrew page button"
```

---

## Task 19: Final Integration Test

**Step 1: Start dev server and worker in parallel**

Terminal 1:
```bash
cd E:\Projects\QuiverDM && npm run dev
```

Terminal 2:
```bash
cd E:\Projects\QuiverDM && npm run worker:import
```

**Step 2: Test Notion import end-to-end**

1. Navigate to `http://localhost:3000/homebrew/import`
2. Click Notion card
3. Enter page ID: `3a11b929-6012-4a1a-b7bf-08c4e8a3e55e` (D&D root page)
4. Click Start Import
5. Verify progress indicator appears and counts up
6. After complete, navigate to `/homebrew` and confirm items appear with `sourceType: notion_import`

**Step 3: Run full test suite**

```bash
cd E:\Projects\QuiverDM && npm run test
```

Expected: All existing tests pass + new tests pass.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Import Hub — 8-source ingestion pipeline complete"
```

---

## Appendix: Storage API

Check `src/lib/storage/index.ts` for exact method signatures. Expected:
- `storage.upload(key: string, buffer: Buffer, contentType: string): Promise<void>`
- `storage.download(key: string): Promise<Buffer>`

If the method names differ, update adapters accordingly.

## Appendix: tRPC client import

The existing codebase uses `api` from `@/lib/trpc/client`. Verify this path before using it in UI components — it may be `@/lib/trpc` or `@/trpc/client`.

## Appendix: Notion token handling

For the full production flow, the Notion adapter should fetch the token from `SourceCredential` rather than accepting it as a param from the client. Update `startImport` to look up the credential server-side when `source === 'notion'` and inject the token into params before queuing.
