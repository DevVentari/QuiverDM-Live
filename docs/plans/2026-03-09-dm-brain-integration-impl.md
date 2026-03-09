# DM Brain Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build DM Brain — a persistent world-state entity graph that absorbs campaign data post-session and surfaces enriched state across the app and via voice.

**Architecture:** Hybrid ingestion (automated post-session AI extraction + DM manual input) → entity graph in Postgres → enriched NPC/homebrew pages + Campaign Brain tab + Cockpit panel + global voice query layer.

**Design doc:** `docs/plans/2026-03-09-dm-brain-integration-design.md`

**Tech Stack:** Prisma (new models), BullMQ (2 new workers), tRPC (new `brain` router), React (Brain tab, World State section, Cockpit panel, VoiceProvider), Web Speech API + ElevenLabs (STT/TTS), Gemini Flash (intent classification)

---

## Task 1: Prisma Schema — 4 New Models

**Files:**
- Modify: `prisma/schema.prisma`

### Step 1: Add models to schema

Append to the end of `prisma/schema.prisma`:

```prisma
enum WorldEntityType {
  NPC
  PC
  FACTION
  LOCATION
  ITEM
  EVENT
  THREAT
  SECRET
  ARC
}

enum ChangeSource {
  TRANSCRIPT
  SUMMARY
  ENCOUNTER
  MANUAL
  INFERENCE
}

model WorldEntity {
  id                    String          @id @default(cuid())
  campaignId            String
  type                  WorldEntityType
  name                  String
  status                String          @default("active")
  data                  Json            @default("{}")
  lastSeenSessionId     String?

  npcId                 String?
  characterId           String?
  homebrewId            String?

  campaign              Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  npc                   NPC?            @relation(fields: [npcId], references: [id])
  character             Character?      @relation(fields: [characterId], references: [id])
  homebrew              HomebrewContent? @relation(fields: [homebrewId], references: [id])
  lastSeenSession       Session?        @relation(fields: [lastSeenSessionId], references: [id])

  outgoingRelationships WorldRelationship[] @relation("FromEntity")
  incomingRelationships WorldRelationship[] @relation("ToEntity")
  stateChanges          WorldStateChange[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([campaignId])
  @@index([npcId])
  @@index([homebrewId])
  @@index([campaignId, type])
  @@index([campaignId, name])
}

model WorldRelationship {
  id           String      @id @default(cuid())
  fromEntityId String
  toEntityId   String
  type         String
  strength     Float       @default(0.5)
  history      Json        @default("[]")

  fromEntity   WorldEntity @relation("FromEntity", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntity     WorldEntity @relation("ToEntity", fields: [toEntityId], references: [id], onDelete: Cascade)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([fromEntityId, toEntityId, type])
  @@index([fromEntityId])
  @@index([toEntityId])
}

model WorldStateChange {
  id          String       @id @default(cuid())
  entityId    String
  field       String
  oldValue    Json?
  newValue    Json
  source      ChangeSource
  sessionId   String?
  triggeredBy String?

  entity      WorldEntity  @relation(fields: [entityId], references: [id], onDelete: Cascade)
  session     Session?     @relation(fields: [sessionId], references: [id])

  createdAt   DateTime @default(now())

  @@index([entityId])
  @@index([sessionId])
  @@index([entityId, createdAt])
}

model WorldState {
  id               String   @id @default(cuid())
  campaignId       String   @unique
  factionInfluence Json     @default("{}")
  pressureTracks   Json     @default("{}")
  unresolvedHooks  Json     @default("[]")

  campaign         Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  updatedAt        DateTime @updatedAt
}
```

Also add back-relations to existing models. In the `Campaign` model block, add:
```prisma
  worldEntities  WorldEntity[]
  worldState     WorldState?
```

In the `NPC` model block, add:
```prisma
  worldEntity    WorldEntity?
```

In the `Character` model block, add:
```prisma
  worldEntities  WorldEntity[]
```

In the `HomebrewContent` model block, add:
```prisma
  worldEntities  WorldEntity[]
```

In the `Session` model block, add:
```prisma
  worldStateChanges WorldStateChange[]
  worldEntitiesLastSeen WorldEntity[]
```

### Step 2: Push schema

```bash
npm run db:push
```

Expected: Prisma prints "Your database is now in sync with your schema."

### Step 3: Verify types generated

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to the new models.

### Step 4: Commit

```bash
git add prisma/schema.prisma
git commit -m "feat(brain): add WorldEntity, WorldRelationship, WorldStateChange, WorldState schema"
```

---

## Task 2: Brain Repository

**Files:**
- Create: `src/server/repositories/brain.repository.ts`
- Modify: `src/server/repositories/index.ts`

### Step 1: Create repository

```ts
// src/server/repositories/brain.repository.ts
import { prisma } from '../db';
import type { WorldEntityType, ChangeSource, Prisma } from '@prisma/client';

export async function findEntitiesByCampaign(
  campaignId: string,
  opts?: { search?: string; type?: WorldEntityType; limit?: number; offset?: number }
) {
  const where: Prisma.WorldEntityWhereInput = {
    campaignId,
    ...(opts?.type ? { type: opts.type } : {}),
    ...(opts?.search
      ? { name: { contains: opts.search, mode: 'insensitive' } }
      : {}),
  };
  return prisma.worldEntity.findMany({
    where,
    orderBy: { name: 'asc' },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
    include: {
      outgoingRelationships: { include: { toEntity: true } },
      incomingRelationships: { include: { fromEntity: true } },
    },
  });
}

export async function findEntityById(id: string) {
  return prisma.worldEntity.findUnique({
    where: { id },
    include: {
      outgoingRelationships: { include: { toEntity: true } },
      incomingRelationships: { include: { fromEntity: true } },
      stateChanges: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
}

export async function findEntityByNpcId(npcId: string) {
  return prisma.worldEntity.findFirst({ where: { npcId } });
}

export async function findEntityByHomebrewId(homebrewId: string) {
  return prisma.worldEntity.findFirst({ where: { homebrewId } });
}

export async function upsertEntity(data: {
  campaignId: string;
  type: WorldEntityType;
  name: string;
  status?: string;
  entityData?: Record<string, unknown>;
  npcId?: string;
  characterId?: string;
  homebrewId?: string;
  lastSeenSessionId?: string;
}) {
  const existing = data.npcId
    ? await findEntityByNpcId(data.npcId)
    : data.homebrewId
    ? await findEntityByHomebrewId(data.homebrewId)
    : null;

  if (existing) {
    return prisma.worldEntity.update({
      where: { id: existing.id },
      data: {
        status: data.status ?? existing.status,
        data: data.entityData
          ? { ...(existing.data as object), ...data.entityData }
          : existing.data,
        lastSeenSessionId: data.lastSeenSessionId ?? existing.lastSeenSessionId,
        updatedAt: new Date(),
      },
    });
  }

  return prisma.worldEntity.create({
    data: {
      campaignId: data.campaignId,
      type: data.type,
      name: data.name,
      status: data.status ?? 'active',
      data: data.entityData ?? {},
      npcId: data.npcId,
      characterId: data.characterId,
      homebrewId: data.homebrewId,
      lastSeenSessionId: data.lastSeenSessionId,
    },
  });
}

export async function upsertRelationship(data: {
  fromEntityId: string;
  toEntityId: string;
  type: string;
  strength?: number;
  historyEntry?: { description: string; sessionId?: string };
}) {
  const existing = await prisma.worldRelationship.findUnique({
    where: {
      fromEntityId_toEntityId_type: {
        fromEntityId: data.fromEntityId,
        toEntityId: data.toEntityId,
        type: data.type,
      },
    },
  });

  if (existing) {
    const history = Array.isArray(existing.history) ? existing.history : [];
    return prisma.worldRelationship.update({
      where: { id: existing.id },
      data: {
        strength: data.strength ?? existing.strength,
        history: data.historyEntry ? [...history, data.historyEntry] : history,
        updatedAt: new Date(),
      },
    });
  }

  return prisma.worldRelationship.create({
    data: {
      fromEntityId: data.fromEntityId,
      toEntityId: data.toEntityId,
      type: data.type,
      strength: data.strength ?? 0.5,
      history: data.historyEntry ? [data.historyEntry] : [],
    },
  });
}

export async function appendStateChange(data: {
  entityId: string;
  field: string;
  oldValue?: unknown;
  newValue: unknown;
  source: ChangeSource;
  sessionId?: string;
  triggeredBy?: string;
}) {
  return prisma.worldStateChange.create({
    data: {
      entityId: data.entityId,
      field: data.field,
      oldValue: data.oldValue !== undefined ? (data.oldValue as Prisma.InputJsonValue) : Prisma.JsonNull,
      newValue: data.newValue as Prisma.InputJsonValue,
      source: data.source,
      sessionId: data.sessionId,
      triggeredBy: data.triggeredBy,
    },
  });
}

export async function getEntityTimeline(entityId: string, limitSessions?: number) {
  return prisma.worldStateChange.findMany({
    where: { entityId },
    orderBy: { createdAt: 'desc' },
    take: limitSessions ? limitSessions * 5 : 100,
    include: { session: { select: { id: true, title: true, sessionNumber: true } } },
  });
}

export async function getWorldState(campaignId: string) {
  return prisma.worldState.upsert({
    where: { campaignId },
    update: {},
    create: { campaignId },
  });
}

export async function updateWorldState(
  campaignId: string,
  data: Partial<{
    factionInfluence: Record<string, number>;
    pressureTracks: Record<string, number>;
    unresolvedHooks: Array<{ id: string; description: string; age: number; urgency: number }>;
  }>
) {
  return prisma.worldState.upsert({
    where: { campaignId },
    update: { ...data, updatedAt: new Date() },
    create: { campaignId, ...data },
  });
}

export async function getUnresolvedHooks(campaignId: string) {
  const state = await getWorldState(campaignId);
  const hooks = Array.isArray(state.unresolvedHooks) ? state.unresolvedHooks : [];
  return hooks.sort((a: any, b: any) => b.urgency - a.urgency);
}
```

### Step 2: Export from index

In `src/server/repositories/index.ts`, add:

```ts
export * as brainRepository from './brain.repository';
```

### Step 3: Type check

```bash
npx tsc --noEmit 2>&1 | grep -i brain
```

Expected: No output (no errors).

### Step 4: Commit

```bash
git add src/server/repositories/brain.repository.ts src/server/repositories/index.ts
git commit -m "feat(brain): add brain repository with entity/relationship/state functions"
```

---

## Task 3: Brain Ingestion Queue

**Files:**
- Create: `src/lib/queue/brain-ingestion-queue.ts`

### Step 1: Create queue file

```ts
// src/lib/queue/brain-ingestion-queue.ts
import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface BrainIngestionJobData {
  campaignId: string;
  sessionId: string;
  summaryText: string;
  transcriptText?: string;
  isBackfill?: boolean;
}

export interface BrainIngestionJobResult {
  success: boolean;
  entitiesUpserted: number;
  relationshipsUpserted: number;
  error?: string;
}

export const brainIngestionQueue = new Queue<BrainIngestionJobData, BrainIngestionJobResult>(
  'brain-ingestion',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addBrainIngestionJob(data: BrainIngestionJobData) {
  return brainIngestionQueue.add(`ingest-${data.sessionId}`, data, {
    jobId: `brain-${data.sessionId}`,
  });
}
```

### Step 2: Commit

```bash
git add src/lib/queue/brain-ingestion-queue.ts
git commit -m "feat(brain): add brain-ingestion BullMQ queue"
```

---

## Task 4: Brain Ingestion Worker

**Files:**
- Create: `src/lib/queue/brain-ingestion-worker.ts`
- Modify: `package.json`

### Step 1: Create worker

```ts
// src/lib/queue/brain-ingestion-worker.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '../prisma';
import { chatWithAI } from '../ai/chat';
import type { BrainIngestionJobData, BrainIngestionJobResult } from './brain-ingestion-queue';
import * as brainRepo from '../../server/repositories/brain.repository';

const EXTRACTION_PROMPT = `You are a D&D world-state extractor. Given a session summary (and optional transcript), extract all named entities and their relationships.

Respond ONLY with valid JSON in this exact shape:
{
  "entities": [
    {
      "name": "string — canonical name",
      "type": "NPC|FACTION|LOCATION|ITEM|EVENT|THREAT|SECRET|ARC",
      "status": "active|dead|unknown|resolved",
      "data": {
        "stress": 0.0,
        "motivation": "string or null",
        "fear": "string or null",
        "loyalty": {},
        "secrets": [],
        "location": "string or null",
        "lastKnownAction": "string or null"
      }
    }
  ],
  "relationships": [
    {
      "from": "entity name",
      "to": "entity name",
      "type": "ally|rival|tense_alliance|member_of|located_at|possesses|controls|fears|loyal_to",
      "strength": 0.5,
      "description": "one sentence describing this relationship as of this session"
    }
  ],
  "hooks": [
    {
      "id": "unique_snake_case_id",
      "description": "string",
      "urgency": 0.5
    }
  ]
}

Only extract entities that are meaningfully present in the session. NPC stress ranges 0.0 (calm) to 1.0 (crisis). Relationship strength ranges 0.0 (broken) to 1.0 (unbreakable).`;

function getRedisConn() {
  return getRedisConnection();
}

const worker = new Worker<BrainIngestionJobData, BrainIngestionJobResult>(
  'brain-ingestion',
  async (job) => {
    const { campaignId, sessionId, summaryText, transcriptText } = job.data;

    console.log(`[brain-ingestion] Processing session ${sessionId}`);

    const userContent = [
      `SESSION SUMMARY:\n${summaryText}`,
      transcriptText ? `\nTRANSCRIPT EXCERPT:\n${transcriptText.slice(0, 3000)}` : '',
    ].join('');

    let extracted: {
      entities: Array<{ name: string; type: string; status: string; data: Record<string, unknown> }>;
      relationships: Array<{ from: string; to: string; type: string; strength: number; description: string }>;
      hooks: Array<{ id: string; description: string; urgency: number }>;
    };

    try {
      const raw = await chatWithAI({
        system: EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        maxTokens: 2000,
      });
      extracted = JSON.parse(raw);
    } catch (e) {
      console.error('[brain-ingestion] AI extraction failed:', e);
      return { success: false, entitiesUpserted: 0, relationshipsUpserted: 0, error: String(e) };
    }

    // Upsert entities
    const entityMap = new Map<string, string>(); // name → id
    let entitiesUpserted = 0;

    for (const e of extracted.entities) {
      try {
        // Try to match existing NPC by name in this campaign
        const existingNpc = await prisma.nPC.findFirst({
          where: {
            campaignId,
            name: { equals: e.name, mode: 'insensitive' },
          },
        });

        const entity = await brainRepo.upsertEntity({
          campaignId,
          type: e.type as any,
          name: e.name,
          status: e.status,
          entityData: e.data,
          npcId: existingNpc?.id,
          lastSeenSessionId: sessionId,
        });

        entityMap.set(e.name.toLowerCase(), entity.id);

        await brainRepo.appendStateChange({
          entityId: entity.id,
          field: 'data',
          newValue: e.data,
          source: 'SUMMARY',
          sessionId,
          triggeredBy: `Session ingestion`,
        });

        entitiesUpserted++;
      } catch (err) {
        console.error(`[brain-ingestion] Failed to upsert entity ${e.name}:`, err);
      }
    }

    // Upsert relationships
    let relationshipsUpserted = 0;
    for (const r of extracted.relationships) {
      const fromId = entityMap.get(r.from.toLowerCase());
      const toId = entityMap.get(r.to.toLowerCase());
      if (!fromId || !toId) continue;

      try {
        await brainRepo.upsertRelationship({
          fromEntityId: fromId,
          toEntityId: toId,
          type: r.type,
          strength: r.strength,
          historyEntry: { description: r.description, sessionId },
        });
        relationshipsUpserted++;
      } catch (err) {
        console.error(`[brain-ingestion] Failed to upsert relationship:`, err);
      }
    }

    // Merge hooks into WorldState
    if (extracted.hooks.length > 0) {
      const state = await brainRepo.getWorldState(campaignId);
      const existing = Array.isArray(state.unresolvedHooks) ? state.unresolvedHooks as any[] : [];
      const merged = [...existing];
      for (const hook of extracted.hooks) {
        const idx = merged.findIndex((h: any) => h.id === hook.id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], urgency: hook.urgency };
        } else {
          merged.push({ ...hook, age: 0 });
        }
      }
      await brainRepo.updateWorldState(campaignId, { unresolvedHooks: merged });
    }

    console.log(`[brain-ingestion] Done: ${entitiesUpserted} entities, ${relationshipsUpserted} relationships`);
    return { success: true, entitiesUpserted, relationshipsUpserted };
  },
  {
    connection: getRedisConn() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[brain-ingestion] Job ${job.id} complete:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[brain-ingestion] Job ${job?.id} failed:`, err.message);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
```

### Step 2: Add npm script

In `package.json`, inside `"scripts"`, add after `worker:obsidian-import`:

```json
"worker:brain-ingestion": "tsx src/lib/queue/brain-ingestion-worker.ts",
```

Also add it to `worker:all` — append `& npm run worker:brain-ingestion` before the `& wait`.

### Step 3: Type check

```bash
npx tsc --noEmit 2>&1 | grep -i brain
```

Expected: No errors.

### Step 4: Commit

```bash
git add src/lib/queue/brain-ingestion-worker.ts package.json
git commit -m "feat(brain): add brain-ingestion worker with AI entity extraction"
```

---

## Task 5: Trigger Ingestion After Session Summary

**Files:**
- Modify: `src/lib/queue/ai-summary-worker.ts`

### Step 1: Read the end of the summary worker to find where it completes

```bash
grep -n "success\|return\|result" src/lib/queue/ai-summary-worker.ts | tail -20
```

### Step 2: Add import + trigger at the end of successful summary processing

After the worker writes the summary to the DB and before it returns, add:

```ts
import { addBrainIngestionJob } from './brain-ingestion-queue';

// After summary is saved to DB, trigger brain ingestion:
await addBrainIngestionJob({
  campaignId: job.data.campaignId ?? '', // add campaignId to AiSummaryJobData if missing
  sessionId: job.data.sessionId,
  summaryText: summary,
  transcriptText: job.data.transcriptText,
}).catch((err) => console.warn('[brain] Failed to queue ingestion job:', err));
```

> **Note:** If `AiSummaryJobData` does not have `campaignId`, add it to the interface in `ai-summary-queue.ts` and to all callers. Search with `addAiSummaryJob` to find callers.

### Step 3: Type check

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 4: Commit

```bash
git add src/lib/queue/ai-summary-worker.ts src/lib/queue/ai-summary-queue.ts
git commit -m "feat(brain): trigger brain-ingestion after session summary completes"
```

---

## Task 6: Brain Inference Worker

**Files:**
- Create: `src/lib/queue/brain-inference-worker.ts`
- Modify: `package.json`

### Step 1: Create worker

```ts
// src/lib/queue/brain-inference-worker.ts
/**
 * Brain Inference Worker
 * Runs after ingestion: projects threat trajectories, decays hooks, detects loyalty drift.
 * Triggered manually or on schedule — not a queue consumer, runs as a one-shot process.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { prisma } from '../prisma';
import * as brainRepo from '../../server/repositories/brain.repository';

async function runInference(campaignId: string) {
  console.log(`[brain-inference] Running for campaign ${campaignId}`);

  const state = await brainRepo.getWorldState(campaignId);

  // Age unresolved hooks by 1 session each run
  const hooks = Array.isArray(state.unresolvedHooks) ? state.unresolvedHooks as any[] : [];
  const agedHooks = hooks.map((h: any) => ({
    ...h,
    age: (h.age ?? 0) + 1,
    urgency: Math.min(1.0, (h.urgency ?? 0.5) + 0.05), // urgency escalates
  }));

  await brainRepo.updateWorldState(campaignId, { unresolvedHooks: agedHooks });

  // Detect loyalty/stress drift for NPC entities
  const entities = await prisma.worldEntity.findMany({
    where: { campaignId, type: 'NPC', status: 'active' },
    include: {
      stateChanges: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  for (const entity of entities) {
    const stressChanges = entity.stateChanges
      .filter((c) => c.field === 'data')
      .map((c) => {
        const val = c.newValue as any;
        return typeof val?.stress === 'number' ? val.stress : null;
      })
      .filter((v): v is number => v !== null);

    if (stressChanges.length >= 3) {
      const trend = stressChanges[0] - stressChanges[stressChanges.length - 1];
      if (Math.abs(trend) > 0.15) {
        await brainRepo.appendStateChange({
          entityId: entity.id,
          field: 'inference_stress_trend',
          newValue: { trend: trend > 0 ? 'rising' : 'falling', delta: trend },
          source: 'INFERENCE',
          triggeredBy: `Stress ${trend > 0 ? 'rising' : 'falling'} over last ${stressChanges.length} observations`,
        });
      }
    }
  }

  console.log(`[brain-inference] Done for campaign ${campaignId}`);
}

async function main() {
  const campaigns = await prisma.campaign.findMany({ select: { id: true } });
  for (const c of campaigns) {
    await runInference(c.id).catch((err) =>
      console.error(`[brain-inference] Error for ${c.id}:`, err)
    );
  }
  await prisma.$disconnect();
}

main();
```

### Step 2: Add npm script

In `package.json` scripts:

```json
"worker:brain-inference": "tsx src/lib/queue/brain-inference-worker.ts",
```

### Step 3: Commit

```bash
git add src/lib/queue/brain-inference-worker.ts package.json
git commit -m "feat(brain): add brain-inference worker for hook aging and drift detection"
```

---

## Task 7: Brain tRPC Router

**Files:**
- Create: `src/server/routers/brain.ts`
- Modify: `src/server/routers/_app.ts`

### Step 1: Create router

```ts
// src/server/routers/brain.ts
import { z } from 'zod';
import { router, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import * as brainRepo from '../repositories/brain.repository';
import { prisma } from '../db';
import { addBrainIngestionJob } from '../../lib/queue/brain-ingestion-queue';
import { chatWithAI } from '../../lib/ai/chat';
import { TRPCError } from '@trpc/server';

export const brainRouter = router({
  // Get world state registers for a campaign
  state: campaignMemberProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      return brainRepo.getWorldState(input.campaignId);
    }),

  // List entities with optional filter/search
  entities: router({
    list: campaignMemberProcedure
      .input(
        z.object({
          campaignId: z.string(),
          search: z.string().optional(),
          type: z.enum(['NPC', 'PC', 'FACTION', 'LOCATION', 'ITEM', 'EVENT', 'THREAT', 'SECRET', 'ARC']).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return brainRepo.findEntitiesByCampaign(input.campaignId, {
          search: input.search,
          type: input.type as any,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    get: campaignMemberProcedure
      .input(z.object({ entityId: z.string() }))
      .query(async ({ input }) => {
        const entity = await brainRepo.findEntityById(input.entityId);
        if (!entity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
        return entity;
      }),

    upsert: campaignDMProcedure
      .input(
        z.object({
          campaignId: z.string(),
          type: z.enum(['NPC', 'PC', 'FACTION', 'LOCATION', 'ITEM', 'EVENT', 'THREAT', 'SECRET', 'ARC']),
          name: z.string().min(1),
          status: z.string().optional(),
          data: z.record(z.unknown()).optional(),
          npcId: z.string().optional(),
          homebrewId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const entity = await brainRepo.upsertEntity({
          campaignId: input.campaignId,
          type: input.type as any,
          name: input.name,
          status: input.status,
          entityData: input.data as Record<string, unknown>,
          npcId: input.npcId,
          homebrewId: input.homebrewId,
        });

        if (input.data) {
          await brainRepo.appendStateChange({
            entityId: entity.id,
            field: 'data',
            newValue: input.data,
            source: 'MANUAL',
            triggeredBy: `Manual update by DM`,
          });
        }

        return entity;
      }),
  }),

  // Natural language query → structured response
  query: campaignMemberProcedure
    .input(
      z.object({
        campaignId: z.string(),
        query: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const entities = await brainRepo.findEntitiesByCampaign(input.campaignId, { limit: 100 });
      const hooks = await brainRepo.getUnresolvedHooks(input.campaignId);
      const state = await brainRepo.getWorldState(input.campaignId);

      const context = JSON.stringify({ entities: entities.slice(0, 30), hooks, state }, null, 2);

      const answer = await chatWithAI({
        system: `You are the DM Brain for a D&D campaign. Answer the DM's question concisely using the world state provided. Be specific and reference entity names. Max 3 sentences.`,
        messages: [
          { role: 'user', content: `World state:\n${context}\n\nQuestion: ${input.query}` },
        ],
        maxTokens: 300,
      });

      return { answer, entities: entities.slice(0, 5) };
    }),

  // State change timeline for an entity
  timeline: campaignMemberProcedure
    .input(
      z.object({
        entityId: z.string(),
        lastNSessions: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return brainRepo.getEntityTimeline(input.entityId, input.lastNSessions);
    }),

  // Unresolved hooks sorted by urgency
  hooks: campaignMemberProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      return brainRepo.getUnresolvedHooks(input.campaignId);
    }),

  // Trigger backfill ingestion over all past summaries for a campaign
  seed: campaignDMProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input }) => {
      const sessions = await prisma.session.findMany({
        where: { campaignId: input.campaignId, summary: { not: null } },
        orderBy: { sessionNumber: 'asc' },
        select: { id: true, summary: true },
      });

      let queued = 0;
      for (const session of sessions) {
        if (!session.summary) continue;
        await addBrainIngestionJob({
          campaignId: input.campaignId,
          sessionId: session.id,
          summaryText: session.summary,
          isBackfill: true,
        }).catch(() => {});
        queued++;
      }

      return { queued };
    }),
});
```

### Step 2: Register in app router

In `src/server/routers/_app.ts`, add:

```ts
import { brainRouter } from './brain';
```

And in the `appRouter` object:

```ts
brain: brainRouter,
```

### Step 3: Type check

```bash
npx tsc --noEmit 2>&1 | grep -i brain
```

Expected: No errors.

### Step 4: Commit

```bash
git add src/server/routers/brain.ts src/server/routers/_app.ts
git commit -m "feat(brain): add brain tRPC router with entities/query/timeline/hooks/seed"
```

---

## Task 8: Campaign Overview — Brain Tab

**Files:**
- Create: `src/components/brain/brain-tab.tsx`
- Create: `src/components/brain/entity-card.tsx`
- Create: `src/components/brain/hooks-list.tsx`
- Create: `src/components/brain/pressure-gauges.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/page.tsx`

### Step 1: Create `entity-card.tsx`

```tsx
// src/components/brain/entity-card.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';

type Entity = inferRouterOutputs<AppRouter>['brain']['entities']['list'][number];

interface EntityCardProps {
  entity: Entity;
  expanded?: boolean;
}

export function EntityCard({ entity, expanded }: EntityCardProps) {
  const data = entity.data as Record<string, unknown>;

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{entity.name}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {entity.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status: {entity.status}</span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="text-xs space-y-1">
          {typeof data.stress === 'number' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16">Stress</span>
              <div className="flex-1 bg-muted h-1.5 rounded-full">
                <div
                  className="h-1.5 rounded-full bg-amber-500"
                  style={{ width: `${data.stress * 100}%` }}
                />
              </div>
              <span>{Math.round((data.stress as number) * 100)}%</span>
            </div>
          )}
          {data.motivation && <p><span className="text-muted-foreground">Motivation:</span> {String(data.motivation)}</p>}
          {data.fear && <p><span className="text-muted-foreground">Fear:</span> {String(data.fear)}</p>}
          {data.lastKnownAction && <p><span className="text-muted-foreground">Last action:</span> {String(data.lastKnownAction)}</p>}
          {entity.outgoingRelationships.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1">Relationships:</p>
              {entity.outgoingRelationships.map((r) => (
                <p key={r.id} className="ml-2">
                  → {r.toEntity.name} <span className="text-muted-foreground">({r.type}, {Math.round(r.strength * 100)}%)</span>
                </p>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
```

### Step 2: Create `hooks-list.tsx`

```tsx
// src/components/brain/hooks-list.tsx
'use client';

interface Hook {
  id: string;
  description: string;
  age: number;
  urgency: number;
}

export function HooksList({ hooks }: { hooks: Hook[] }) {
  if (hooks.length === 0) {
    return <p className="text-sm text-muted-foreground">No unresolved hooks.</p>;
  }

  return (
    <ul className="space-y-2">
      {hooks.map((hook) => (
        <li key={hook.id} className="flex items-start gap-3 text-sm">
          <div
            className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: hook.urgency > 0.7 ? '#ef4444' : hook.urgency > 0.4 ? '#f59e0b' : '#6b7280',
            }}
          />
          <div>
            <p>{hook.description}</p>
            <p className="text-xs text-muted-foreground">
              {hook.age} session{hook.age !== 1 ? 's' : ''} unresolved · urgency {Math.round(hook.urgency * 100)}%
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

### Step 3: Create `pressure-gauges.tsx`

```tsx
// src/components/brain/pressure-gauges.tsx
'use client';

const TRACKS = ['political', 'supernatural', 'economic', 'cosmic', 'social'] as const;

export function PressureGauges({ tracks }: { tracks: Record<string, number> }) {
  return (
    <div className="space-y-2">
      {TRACKS.map((track) => {
        const value = tracks[track] ?? 0;
        return (
          <div key={track} className="flex items-center gap-3 text-sm">
            <span className="capitalize w-28 text-muted-foreground">{track}</span>
            <div className="flex-1 bg-muted h-2 rounded-full">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${value * 100}%`,
                  backgroundColor: value > 0.75 ? '#ef4444' : value > 0.5 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
            <span className="text-xs w-8 text-right">{Math.round(value * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}
```

### Step 4: Create `brain-tab.tsx`

```tsx
// src/components/brain/brain-tab.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityCard } from './entity-card';
import { HooksList } from './hooks-list';
import { PressureGauges } from './pressure-gauges';
import { Brain, RefreshCw } from 'lucide-react';

export function BrainTab() {
  const { campaignId } = useCampaign();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const entitiesQuery = trpc.brain.entities.list.useQuery(
    { campaignId, search: search || undefined, limit: 50 },
    { staleTime: 30_000 }
  );
  const hooksQuery = trpc.brain.hooks.useQuery({ campaignId }, { staleTime: 30_000 });
  const stateQuery = trpc.brain.state.useQuery({ campaignId }, { staleTime: 30_000 });
  const seedMutation = trpc.brain.seed.useMutation();

  const pressureTracks = (stateQuery.data?.pressureTracks as Record<string, number>) ?? {};

  async function handleSeed() {
    setSeeding(true);
    await seedMutation.mutateAsync({ campaignId });
    setSeeding(false);
    entitiesQuery.refetch();
    hooksQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">DM Brain — World State</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSeed}
          disabled={seeding}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${seeding ? 'animate-spin' : ''}`} />
          {seeding ? 'Seeding…' : 'Seed from history'}
        </Button>
      </div>

      <Tabs defaultValue="entities">
        <TabsList className="w-full">
          <TabsTrigger value="entities" className="flex-1">Entities</TabsTrigger>
          <TabsTrigger value="hooks" className="flex-1">Hooks</TabsTrigger>
          <TabsTrigger value="pressure" className="flex-1">Pressure</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-3 mt-3">
          <Input
            placeholder="Search entities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {entitiesQuery.data?.map((entity) => (
              <div
                key={entity.id}
                onClick={() => setExpandedId(expandedId === entity.id ? null : entity.id)}
                className="cursor-pointer"
              >
                <EntityCard entity={entity} expanded={expandedId === entity.id} />
              </div>
            ))}
            {entitiesQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No entities yet. Click "Seed from history" to build the world graph.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="hooks" className="mt-3">
          <HooksList hooks={(hooksQuery.data as any[]) ?? []} />
        </TabsContent>

        <TabsContent value="pressure" className="mt-3">
          <PressureGauges tracks={pressureTracks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 5: Add Brain tab to campaign overview

In `src/app/(app)/campaigns/[slug]/page.tsx`, read the file first. Find where the existing tabs or sections are rendered. Add a "Brain" tab entry that renders `<BrainTab />`.

The campaign overview uses a single page component — wrap it with `Tabs` if not already tabbed, or add a new section with a `<BrainTab />` below the existing content conditionally rendered with `isDM`.

```tsx
import { BrainTab } from '@/components/brain/brain-tab';

// Add after existing sections, inside isDM guard:
{isDM && (
  <section>
    <BrainTab />
  </section>
)}
```

### Step 6: Type check

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 7: Commit

```bash
git add src/components/brain/ src/app/(app)/campaigns/[slug]/page.tsx
git commit -m "feat(brain): add Campaign Overview Brain tab with entities, hooks, pressure gauges"
```

---

## Task 9: NPC Detail — World State Section

**Files:**
- Create: `src/components/brain/npc-world-state.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`

### Step 1: Create `npc-world-state.tsx`

```tsx
// src/components/brain/npc-world-state.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { EntityCard } from './entity-card';

interface NpcWorldStateProps {
  npcId: string;
  campaignId: string;
  isDM: boolean;
}

export function NpcWorldState({ npcId, campaignId, isDM }: NpcWorldStateProps) {
  const [open, setOpen] = useState(false);

  const entitiesQuery = trpc.brain.entities.list.useQuery(
    { campaignId },
    { staleTime: 60_000, enabled: open }
  );

  // Find entity linked to this NPC
  const entity = entitiesQuery.data?.find(
    (e) => e.npcId === npcId
  );

  if (!isDM) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs">World State</span>
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {entitiesQuery.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {entity ? (
          <EntityCard entity={entity} expanded />
        ) : (
          <p className="text-xs text-muted-foreground">
            No Brain data for this NPC yet. Run "Seed from history" on the Brain tab.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Step 2: Modify NPC detail page

Read `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx` first, then add after the NPC fields:

```tsx
import { NpcWorldState } from '@/components/brain/npc-world-state';

// Add inside the NPC detail layout, after existing fields:
<NpcWorldState npcId={npcId} campaignId={campaignId} isDM={isDM} />
```

### Step 3: Commit

```bash
git add src/components/brain/npc-world-state.tsx src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx
git commit -m "feat(brain): add World State section to NPC detail page"
```

---

## Task 10: Homebrew Auto-Seeding

**Files:**
- Modify: `src/server/routers/homebrew.ts`

### Step 1: Find where homebrew is saved

```bash
grep -n "create\|update\|upsert" src/server/routers/homebrew.ts | head -20
```

### Step 2: After homebrew create/update mutation, add auto-seed

In the homebrew create and update mutations, after the DB write succeeds, add:

```ts
import * as brainRepo from '../repositories/brain.repository';

// After prisma.homebrewContent.create/update:
const BRAIN_TYPES = ['MONSTER', 'FACTION', 'LOCATION', 'ITEM'];
if (BRAIN_TYPES.includes(result.type)) {
  await brainRepo.upsertEntity({
    campaignId: result.campaignId,
    type: result.type === 'MONSTER' ? 'NPC' : result.type as any,
    name: result.name,
    homebrewId: result.id,
    entityData: { source: 'homebrew', description: result.description ?? '' },
  }).catch((err) => console.warn('[brain] Homebrew seed failed:', err));
}
```

### Step 3: Type check + commit

```bash
npx tsc --noEmit 2>&1 | head -10
git add src/server/routers/homebrew.ts
git commit -m "feat(brain): auto-seed WorldEntity on homebrew monster/faction/location/item save"
```

---

## Task 11: Session Cockpit — Brain Tab

**Files:**
- Create: `src/components/cockpit/brain-cockpit-panel.tsx`
- Modify: The session cockpit right panel component (find with: `grep -rn "right.*panel\|cockpit.*panel\|CockpitPrep" src/components/cockpit/ | head -10`)

### Step 1: Create Brain cockpit panel

```tsx
// src/components/cockpit/brain-cockpit-panel.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Brain, Mic } from 'lucide-react';
import { EntityCard } from '@/components/brain/entity-card';
import { HooksList } from '@/components/brain/hooks-list';

interface BrainCockpitPanelProps {
  campaignId: string;
  sessionId: string;
}

export function BrainCockpitPanel({ campaignId, sessionId }: BrainCockpitPanelProps) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  const hooksQuery = trpc.brain.hooks.useQuery({ campaignId }, { staleTime: 60_000 });
  const entitiesQuery = trpc.brain.entities.list.useQuery(
    { campaignId, limit: 10 },
    { staleTime: 60_000 }
  );
  const queryMutation = trpc.brain.query.useMutation();

  const urgentHooks = ((hooksQuery.data as any[]) ?? []).filter((h: any) => h.urgency > 0.5).slice(0, 3);

  async function handleQuery() {
    if (!query.trim()) return;
    setQuerying(true);
    const result = await queryMutation.mutateAsync({ campaignId, query });
    setAnswer(result.answer);
    setQuerying(false);
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-amber-500" />
        <span className="font-medium">DM Brain</span>
      </div>

      {/* Voice/text query */}
      <div className="flex gap-2">
        <Input
          placeholder="Ask the Brain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={handleQuery} disabled={querying} className="h-8 px-2">
          {querying ? '…' : '→'}
        </Button>
      </div>

      {answer && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed">
          {answer}
        </div>
      )}

      {/* Urgent hooks */}
      {urgentHooks.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Urgent hooks</p>
          <HooksList hooks={urgentHooks} />
        </div>
      )}

      {/* Recent entities */}
      {entitiesQuery.data && entitiesQuery.data.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">World actors</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {entitiesQuery.data.slice(0, 8).map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 2: Find and modify the cockpit right panel

```bash
grep -rn "CockpitPrep\|prep.*panel\|right.*panel" src/components/cockpit/ | head -10
```

Read the file found, then add a new tab or section for `<BrainCockpitPanel>`.

### Step 3: Commit

```bash
git add src/components/cockpit/brain-cockpit-panel.tsx
git commit -m "feat(brain): add Brain panel to Session Cockpit with query + urgent hooks + entities"
```

---

## Task 12: VoiceProvider (Phase 5 — Brain Query Mode)

**Files:**
- Create: `src/components/voice/voice-provider.tsx`
- Create: `src/components/voice/voice-button.tsx`
- Modify: `src/app/(app)/layout.tsx` (add VoiceProvider + VoiceButton to shell)

### Step 1: Create VoiceProvider

```tsx
// src/components/voice/voice-provider.tsx
'use client';

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

interface VoiceContextValue {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  lastResponse: string | null;
}

const VoiceContext = createContext<VoiceContextValue>({
  isListening: false,
  transcript: '',
  startListening: () => {},
  stopListening: () => {},
  speak: () => {},
  lastResponse: null,
});

export function useVoice() {
  return useContext(VoiceContext);
}

interface VoiceProviderProps {
  children: ReactNode;
  onBrainQuery?: (query: string) => Promise<string>;
}

export function VoiceProvider({ children, onBrainQuery }: VoiceProviderProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Voice] SpeechRecognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);

      if (onBrainQuery) {
        const response = await onBrainQuery(text).catch(() => 'I could not find an answer.');
        setLastResponse(response);
        speak(response);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onBrainQuery, speak]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return (
    <VoiceContext.Provider value={{ isListening, transcript, startListening, stopListening, speak, lastResponse }}>
      {children}
    </VoiceContext.Provider>
  );
}
```

### Step 2: Create VoiceButton

```tsx
// src/components/voice/voice-button.tsx
'use client';

import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoice } from './voice-provider';
import { cn } from '@/lib/utils';

export function VoiceButton() {
  const { isListening, startListening, stopListening, lastResponse } = useVoice();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 rounded-full transition-all',
          isListening && 'bg-amber-500/20 text-amber-500 ring-2 ring-amber-500/50'
        )}
        onClick={isListening ? stopListening : startListening}
        title="Ask DM Brain (voice)"
      >
        {isListening ? (
          <MicOff className="h-4 w-4 animate-pulse" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {lastResponse && (
        <div className="absolute bottom-10 right-0 w-64 rounded border border-amber-500/30 bg-card p-2 text-xs shadow-lg z-50">
          {lastResponse}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Wire into app shell

Find `src/app/(app)/layout.tsx` or the app shell component. Read it first, then:

1. Wrap children with `<VoiceProvider>` where `onBrainQuery` calls `trpc.brain.query.mutate` (use a client component wrapper).
2. Add `<VoiceButton />` to the top-right toolbar area.

Since the layout needs tRPC, create a client component wrapper:

```tsx
// src/components/voice/voice-shell.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { VoiceProvider } from './voice-provider';
import { VoiceButton } from './voice-button';
import { useCampaign } from '@/components/campaign/campaign-context';
import type { ReactNode } from 'react';

export function VoiceShell({ children }: { children: ReactNode }) {
  const queryMutation = trpc.brain.query.useMutation();

  // campaignId may not be available outside campaign routes — guard gracefully
  let campaignId: string | null = null;
  try {
    const ctx = useCampaign();
    campaignId = ctx.campaignId;
  } catch {
    // Not in a campaign context — voice query unavailable
  }

  async function handleBrainQuery(query: string): Promise<string> {
    if (!campaignId) return 'Voice Brain queries are available inside a campaign.';
    const result = await queryMutation.mutateAsync({ campaignId, query });
    return result.answer;
  }

  return (
    <VoiceProvider onBrainQuery={handleBrainQuery}>
      {children}
      <div className="fixed bottom-4 right-4 z-50">
        <VoiceButton />
      </div>
    </VoiceProvider>
  );
}
```

> **Note:** `useCampaign` throws outside campaign routes — the try/catch degrades gracefully.

### Step 4: Add VoiceShell to app shell

Read `src/app/(app)/app-shell.tsx` (or equivalent), then wrap the children with `<VoiceShell>`.

### Step 5: Type check

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 6: Commit

```bash
git add src/components/voice/
git commit -m "feat(brain): add VoiceProvider + VoiceButton with Web Speech API Brain query mode"
```

---

## Task 13: E2E Workflow Test

**Files:**
- Create: `tests/workflows/brain.workflow.spec.ts`

### Step 1: Write workflow test

```ts
// tests/workflows/brain.workflow.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsVic } from '../helpers/auth';
import { getFirstCampaignSlug } from '../helpers/campaign';

test.describe('DM Brain workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVic(page);
  });

  test('Brain tab appears on campaign overview for DM', async ({ page }) => {
    const slug = await getFirstCampaignSlug(page);
    await page.goto(`/campaigns/${slug}`);
    await expect(page.getByRole('tab', { name: /brain/i })).toBeVisible();
  });

  test('Brain tab shows entity list and seed button', async ({ page }) => {
    const slug = await getFirstCampaignSlug(page);
    await page.goto(`/campaigns/${slug}`);
    await page.getByRole('tab', { name: /brain/i }).click();
    await expect(page.getByText(/seed from history/i)).toBeVisible();
    await expect(page.getByText(/entities/i)).toBeVisible();
  });

  test('Seed from history button triggers without error', async ({ page }) => {
    const slug = await getFirstCampaignSlug(page);
    await page.goto(`/campaigns/${slug}`);
    await page.getByRole('tab', { name: /brain/i }).click();
    await page.getByRole('button', { name: /seed from history/i }).click();
    await expect(page.getByText(/seeding/i)).toBeVisible();
  });

  test('NPC detail page shows World State section for DM', async ({ page }) => {
    const slug = await getFirstCampaignSlug(page);
    await page.goto(`/campaigns/${slug}/npcs`);
    const firstNpc = page.locator('a[href*="/npcs/"]').first();
    await firstNpc.click();
    await expect(page.getByText(/world state/i)).toBeVisible();
  });

  test('Voice mic button is visible in app', async ({ page }) => {
    const slug = await getFirstCampaignSlug(page);
    await page.goto(`/campaigns/${slug}`);
    await expect(page.locator('[title="Ask DM Brain (voice)"]')).toBeVisible();
  });
});
```

### Step 2: Run tests (expect some to pass, some may need auth helpers)

```bash
npx playwright test tests/workflows/brain.workflow.spec.ts --reporter=list 2>&1 | head -40
```

### Step 3: Fix any failures, commit

```bash
git add tests/workflows/brain.workflow.spec.ts
git commit -m "test(brain): add E2E workflow tests for Brain tab, NPC World State, voice button"
```

---

## Task 14: Build Verification

### Step 1: Full type check

```bash
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

### Step 2: Lint

```bash
npm run lint 2>&1 | tail -20
```

Expected: No errors.

### Step 3: Build

```bash
npm run build 2>&1 | tail -30
```

Expected: Build succeeds.

### Step 4: Final commit

```bash
git add -A
git commit -m "feat(brain): DM Brain integration complete — entity graph, voice query, cockpit panel"
```

---

## Completion Checklist

- [ ] Task 1: Prisma schema (4 models)
- [ ] Task 2: Brain repository
- [ ] Task 3: Brain ingestion queue
- [ ] Task 4: Brain ingestion worker
- [ ] Task 5: Auto-trigger after summary
- [ ] Task 6: Brain inference worker
- [ ] Task 7: Brain tRPC router
- [ ] Task 8: Campaign overview Brain tab
- [ ] Task 9: NPC detail World State section
- [ ] Task 10: Homebrew auto-seeding
- [ ] Task 11: Cockpit Brain panel
- [ ] Task 12: VoiceProvider + VoiceButton
- [ ] Task 13: E2E workflow tests
- [ ] Task 14: Build verification
