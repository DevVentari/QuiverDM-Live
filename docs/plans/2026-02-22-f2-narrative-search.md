# Feature 2: Narrative Search + Timeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Semantic search across transcripts, NPCs, and quests within a campaign using pgvector embeddings, with a timeline view of key events.

**Architecture:** pgvector extension added to existing Postgres. New `Embedding` model stores chunked text + vector columns. BullMQ `embeddings` queue processes entities after save. tRPC `search.semantic` endpoint embeds queries and runs cosine similarity SQL. Multi-provider embedding (Ollama `nomic-embed-text` default, OpenAI text-embedding-3-small fallback).

**Tech Stack:** Prisma + pgvector, BullMQ, Redis, Ollama embeddings, tRPC, Next.js App Router, shadcn/ui

---

## Task 1: Enable pgvector in Postgres + Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Enable pgvector extension and add Embedding model**

At the top of `schema.prisma`, update the generator and datasource blocks:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}
```

Add the `Embedding` model (before the closing brace of the schema):

```prisma
model Embedding {
  id         String   @id @default(cuid())
  entityType String   // transcript|npc|quest|rules
  entityId   String
  chunkText  String   @db.Text
  chunkIndex Int
  vector     Unsupported("vector(768)")  // 768 = nomic-embed-text dimensions
  metadata   Json?    // {title, sessionId, sessionNumber, date, etc.}
  campaignId String?
  createdAt  DateTime @default(now())

  @@index([campaignId, entityType])
  @@index([entityId])
}
```

**Step 2: Install pgvector Postgres extension (run once)**

Connect to the local Postgres (port 5433) and run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Or add to `prisma/seed.ts` as a raw query:
```typescript
await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
```

**Step 3: Push schema**

```bash
npm run db:push
```

**Step 4: Install Prisma client with vector support**

```bash
npm install @prisma/client
npx prisma generate
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add pgvector extension and Embedding model"
```

---

## Task 2: Embedding Generation Helper

**Files:**
- Create: `src/lib/ai/embeddings.ts`

**Step 1: Create embeddings helper**

```typescript
/**
 * Multi-provider text embedding generation.
 * Primary: Ollama nomic-embed-text (768 dimensions)
 * Fallback: OpenAI text-embedding-3-small (1536 dimensions, truncated to 768)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';

export async function generateEmbedding(text: string): Promise<number[]> {
  // Try Ollama first
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.embeddings?.[0] ?? data.embedding;
    }
  } catch {
    // fall through to OpenAI
  }

  // Fallback: OpenAI
  if (!process.env.OPENAI_API_KEY) throw new Error('No embedding provider available (Ollama down, no OPENAI_API_KEY)');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: 768 }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.statusText}`);
  const data = await res.json();
  return data.data[0].embedding;
}

/** Split text into ~500-token chunks with 50-token overlap */
export function chunkText(text: string, chunkSize = 1800, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().length > 50);
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/embeddings.ts
git commit -m "feat(ai): add multi-provider embedding helper with Ollama + OpenAI"
```

---

## Task 3: Embedding Repository

**Files:**
- Create: `src/server/repositories/embedding.repository.ts`

**Step 1: Create repository**

```typescript
import { prisma } from '../db';

export async function upsertEmbeddings(
  entityId: string,
  entityType: string,
  chunks: { text: string; index: number; vector: number[] }[],
  metadata: object,
  campaignId?: string
) {
  // Delete existing embeddings for this entity
  await prisma.embedding.deleteMany({ where: { entityId, entityType } });

  // Insert new embeddings using raw SQL for vector type
  for (const chunk of chunks) {
    const vectorStr = `[${chunk.vector.join(',')}]`;
    await prisma.$executeRaw`
      INSERT INTO "Embedding" (id, "entityType", "entityId", "chunkText", "chunkIndex", vector, metadata, "campaignId", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${entityType},
        ${entityId},
        ${chunk.text},
        ${chunk.index},
        ${vectorStr}::vector,
        ${JSON.stringify(metadata)}::jsonb,
        ${campaignId ?? null},
        NOW()
      )
    `;
  }
}

export async function semanticSearch(
  queryVector: number[],
  campaignId: string,
  entityTypes: string[],
  limit = 10
): Promise<Array<{ entityId: string; entityType: string; chunkText: string; metadata: any; score: number }>> {
  const vectorStr = `[${queryVector.join(',')}]`;
  const typeFilter = entityTypes.length > 0 ? entityTypes : ['transcript', 'npc', 'quest'];

  const results = await prisma.$queryRaw<any[]>`
    SELECT
      "entityId",
      "entityType",
      "chunkText",
      metadata,
      1 - (vector <=> ${vectorStr}::vector) AS score
    FROM "Embedding"
    WHERE "campaignId" = ${campaignId}
      AND "entityType" = ANY(${typeFilter}::text[])
    ORDER BY vector <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results.map((r) => ({ ...r, score: parseFloat(r.score) }));
}

export async function deleteEntityEmbeddings(entityId: string, entityType: string) {
  return prisma.embedding.deleteMany({ where: { entityId, entityType } });
}
```

**Step 2: Commit**

```bash
git add src/server/repositories/embedding.repository.ts
git commit -m "feat(repo): add embedding repository with upsert + semantic search"
```

---

## Task 4: Embeddings BullMQ Queue + Worker

**Files:**
- Create: `src/lib/queue/embeddings-queue.ts`
- Create: `src/lib/queue/embeddings-worker.ts`

**Step 1: Create queue**

```typescript
// src/lib/queue/embeddings-queue.ts
import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6380'), password: process.env.REDIS_PASSWORD, maxRetriesPerRequest: null, lazyConnect: true };
}

export interface EmbeddingJobData {
  entityId: string;
  entityType: 'transcript' | 'npc' | 'quest' | 'rules';
  text: string;
  metadata: object;
  campaignId?: string;
}

export const embeddingsQueue = new Queue<EmbeddingJobData>('embeddings', {
  connection: getRedisConnection() as any,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { age: 3600 }, removeOnFail: { age: 7 * 24 * 3600 } },
});

export async function addEmbeddingJob(data: EmbeddingJobData) {
  return embeddingsQueue.add(`embed-${data.entityType}-${data.entityId}`, data, { jobId: `${data.entityType}-${data.entityId}` });
}
```

**Step 2: Create worker**

```typescript
// src/lib/queue/embeddings-worker.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { generateEmbedding, chunkText } from '@/lib/ai/embeddings';
import { upsertEmbeddings } from '@/server/repositories/embedding.repository';
import type { EmbeddingJobData } from './embeddings-queue';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6380'), password: process.env.REDIS_PASSWORD, maxRetriesPerRequest: null, lazyConnect: true };
}

const worker = new Worker<EmbeddingJobData>(
  'embeddings',
  async (job) => {
    const { entityId, entityType, text, metadata, campaignId } = job.data;
    const chunks = chunkText(text);
    const embeddedChunks = await Promise.all(
      chunks.map(async (chunk, index) => ({
        text: chunk,
        index,
        vector: await generateEmbedding(chunk),
      }))
    );
    await upsertEmbeddings(entityId, entityType, embeddedChunks, metadata, campaignId);
    console.log(`[embeddings] Indexed ${embeddedChunks.length} chunks for ${entityType}:${entityId}`);
  },
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('failed', (job, err) => console.error(`[embeddings] Job ${job?.id} failed:`, err.message));
console.log('[embeddings] Worker started');
```

**Step 3: Add script to package.json**

```json
"worker:embeddings": "tsx src/lib/queue/embeddings-worker.ts"
```

**Step 4: Commit**

```bash
git add src/lib/queue/embeddings-queue.ts src/lib/queue/embeddings-worker.ts package.json
git commit -m "feat(queue): add embeddings BullMQ queue and worker"
```

---

## Task 5: Wire embedding jobs into Transcript + NPC saves

**Files:**
- Modify: `src/server/services/session.service.ts` (or transcript service)
- Modify: `src/server/services/npc.service.ts`

**Step 1: Add embedding trigger after transcript save**

In the transcript router or service, after saving a transcript, add (fire-and-forget):

```typescript
import { addEmbeddingJob } from '@/lib/queue/embeddings-queue';

// After transcript is saved/updated:
addEmbeddingJob({
  entityId: transcript.id,
  entityType: 'transcript',
  text: transcript.correctedText || transcript.rawText,
  metadata: { sessionId: transcript.sessionId, sessionNumber: session.sessionNumber, title: session.title, date: session.date },
  campaignId: session.campaignId,
}).catch((err) => console.error('[embeddings] Failed to enqueue transcript:', err));
```

**Step 2: Add embedding trigger after NPC save**

In `src/server/services/npc.service.ts`, after NPC create/update:

```typescript
import { addEmbeddingJob } from '@/lib/queue/embeddings-queue';

// After NPC save:
addEmbeddingJob({
  entityId: npc.id,
  entityType: 'npc',
  text: [npc.name, npc.description, npc.notes].filter(Boolean).join('\n\n'),
  metadata: { name: npc.name, campaignId: npc.campaignId },
  campaignId: npc.campaignId,
}).catch((err) => console.error('[embeddings] Failed to enqueue NPC:', err));
```

**Step 3: Commit**

```bash
git add src/server/services/
git commit -m "feat(service): trigger embedding jobs after transcript + NPC saves"
```

---

## Task 6: Search tRPC Router + Service

**Files:**
- Create: `src/server/routers/search.ts`
- Create: `src/server/services/search.service.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create search service**

```typescript
// src/server/services/search.service.ts
import { generateEmbedding } from '@/lib/ai/embeddings';
import { semanticSearch } from '@/server/repositories/embedding.repository';
import { authz } from './authorization.service';

export class SearchService {
  async semantic(
    query: string,
    campaignId: string,
    userId: string,
    entityTypes: string[] = [],
    limit = 10
  ) {
    await authz.campaign(campaignId, userId).verify();
    const queryVector = await generateEmbedding(query);
    const results = await semanticSearch(queryVector, campaignId, entityTypes, limit);
    return results;
  }
}

export const searchService = new SearchService();
```

**Step 2: Create search router**

```typescript
// src/server/routers/search.ts
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { searchService } from '../services/search.service';

export const searchRouter = router({
  semantic: protectedProcedure
    .input(z.object({
      query: z.string().min(2).max(500),
      campaignId: z.string(),
      entityTypes: z.array(z.enum(['transcript', 'npc', 'quest', 'rules'])).optional().default([]),
      limit: z.number().int().min(1).max(20).optional().default(10),
    }))
    .query(({ input, ctx }) =>
      searchService.semantic(input.query, input.campaignId, ctx.session.user.id, input.entityTypes, input.limit)
    ),
});
```

**Step 3: Register in _app.ts**

```typescript
import { searchRouter } from './search';
// add to appRouter:
search: searchRouter,
```

**Step 4: Commit**

```bash
git add src/server/routers/search.ts src/server/services/search.service.ts src/server/routers/_app.ts
git commit -m "feat(router): add semantic search tRPC router and service"
```

---

## Task 7: Search UI Page

**Files:**
- Create: `src/app/(app)/campaigns/[slug]/search/page.tsx`

**Step 1: Create search page**

```tsx
'use client';

import { useState } from 'react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileText, User, BookOpen } from 'lucide-react';
import Link from 'next/link';

const ENTITY_ICONS: Record<string, React.ElementType> = {
  transcript: FileText, npc: User, quest: BookOpen, rules: BookOpen,
};
const ENTITY_LABELS: Record<string, string> = {
  transcript: 'Transcript', npc: 'NPC', quest: 'Quest', rules: 'Rules',
};

export default function SearchPage() {
  const { campaignId, slug } = useCampaign();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const { data: results, isFetching } = trpc.search.semantic.useQuery(
    { query: submittedQuery, campaignId, entityTypes: selectedTypes as any, limit: 12 },
    { enabled: submittedQuery.length >= 2 }
  );

  const toggleType = (type: string) =>
    setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Search className="h-5 w-5" /> Search</h1>

      <div className="flex gap-2">
        <Input
          placeholder="Search across transcripts, NPCs, quests…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSubmittedQuery(query)}
          className="flex-1"
        />
        <Button onClick={() => setSubmittedQuery(query)} disabled={query.length < 2}>Search</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['transcript', 'npc', 'quest'] as const).map((type) => (
          <Badge
            key={type}
            variant={selectedTypes.includes(type) ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggleType(type)}
          >
            {ENTITY_LABELS[type]}
          </Badge>
        ))}
      </div>

      {isFetching && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-muted rounded-lg" />)}</div>}

      {results && results.length === 0 && <p className="text-muted-foreground text-sm">No results found for "{submittedQuery}"</p>}

      <div className="space-y-3">
        {results?.map((result: any, i: number) => {
          const Icon = ENTITY_ICONS[result.entityType] ?? FileText;
          const href = result.entityType === 'npc'
            ? `/campaigns/${slug}/npcs/${result.entityId}`
            : result.metadata?.sessionId
            ? `/campaigns/${slug}/sessions/${result.metadata.sessionId}`
            : '#';
          return (
            <Link key={i} href={href}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{ENTITY_LABELS[result.entityType]}</Badge>
                        {result.metadata?.title && <span className="text-xs text-muted-foreground truncate">{result.metadata.title}</span>}
                        <span className="text-xs text-muted-foreground ml-auto">{Math.round(result.score * 100)}% match</span>
                      </div>
                      <p className="text-sm line-clamp-3">{result.chunkText}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Add "Search" to campaign nav**

Add nav link in campaign layout/sidebar:
```tsx
{ href: `/campaigns/${slug}/search`, label: 'Search', icon: Search }
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/search/
git commit -m "feat(ui): add semantic search page with entity type filters"
```

---

## Task 8: Type check and smoke test

**Step 1:**
```bash
npx tsc --noEmit
```

**Step 2: Start embeddings worker**
```bash
npm run worker:embeddings
```
Expected: `[embeddings] Worker started`

**Step 3: Manual test**
- Pull up Ollama: `ollama pull nomic-embed-text`
- Navigate to a campaign session and save/re-save a transcript to trigger embedding
- Navigate to `/campaigns/[slug]/search`, type a query, verify results appear

**Step 4:**
```bash
git add -A && git commit -m "feat: Feature 2 — narrative search + timeline complete"
```
