# World Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-campaign interactive world map canvas where DMs place location pins, drill into sub-location maps, and view AI + DM-authored event timelines per location.

**Architecture:** React Flow canvas (`@xyflow/react`) renders location/note nodes over an optional map image background. Locations are `WorldEntity(type=LOCATION)` records positioned by `MapPin` records. Event history comes from existing `WorldStateChange` records. DM Brain ingestion worker auto-updates pin badges after sessions. Map generation is a new `map-generation` BullMQ queue with ComfyUI/fal.ai worker.

**Tech Stack:** `@xyflow/react`, Prisma (CampaignMap + MapPin models), tRPC (`worldMap` router), BullMQ (`map-generation` queue), Framer Motion, shadcn Sheet/Dialog/Tabs, R2 storage.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/queue/map-generation-queue.ts` | BullMQ queue + job data types |
| `src/lib/queue/map-generation-worker.ts` | Worker: ComfyUI/fal.ai → R2 → update CampaignMap |
| `src/server/routers/world-map.ts` | tRPC worldMap router (all procedures) |
| `src/app/(app)/campaigns/[slug]/world-map/page.tsx` | Route page |
| `src/components/world/world-map-canvas.tsx` | React Flow canvas, background layer, node registry |
| `src/components/world/location-node.tsx` | Custom RF node: pin + label + event badge |
| `src/components/world/note-node.tsx` | Custom RF node: sticky note card |
| `src/components/world/map-toolbar.tsx` | Floating toolbar (place pin, place note, settings, generate) |
| `src/components/world/location-panel.tsx` | Right Sheet: event timeline + add note + sub-map button |
| `src/components/world/map-background-picker.tsx` | Dialog: Upload / Generate / Blank tabs |
| `src/components/world/map-breadcrumb.tsx` | Hierarchy nav breadcrumb |
| `tests/workflows/world-map.workflow.spec.ts` | E2E workflow spec |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add NOTE to WorldEntityType; add CampaignMap, MapPin models; add inverse relations to WorldEntity |
| `src/server/routers/_app.ts` | Register worldMapRouter |
| `src/lib/queue/brain-ingestion-worker.ts` | Map notification pass at end of job |
| `package.json` | Add `worker:map-generation` script |

---

## Task 1: Prisma schema — CampaignMap, MapPin, NOTE type

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add NOTE to WorldEntityType enum**

In `prisma/schema.prisma`, find the `WorldEntityType` enum (line ~216) and add `NOTE`:

```prisma
enum WorldEntityType {
  NPC
  PC
  FACTION
  LOCATION
  ITEM
  EVENT
  ARC
  THREAT
  SECRET
  CUSTOM
  NOTE
}
```

- [ ] **Step 2: Add MapBgType enum**

After the `WorldEntityType` enum block, add:

```prisma
enum MapBgType {
  UPLOADED
  GENERATED
  BLANK
}
```

- [ ] **Step 3: Add CampaignMap model**

After the `MapBgType` enum, add:

```prisma
model CampaignMap {
  id               String      @id @default(cuid())
  campaignId       String
  name             String
  backgroundType   MapBgType   @default(BLANK)
  backgroundUrl    String?
  parentLocationId String?
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  campaign         Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  parentLocation   WorldEntity? @relation("LocationMap", fields: [parentLocationId], references: [id])
  pins             MapPin[]

  @@index([campaignId])
}
```

- [ ] **Step 4: Add MapPin model**

Immediately after CampaignMap:

```prisma
model MapPin {
  id          String      @id @default(cuid())
  mapId       String
  entityId    String
  x           Float
  y           Float
  unplaced    Boolean     @default(false)
  lastEventAt DateTime?
  createdAt   DateTime    @default(now())

  map         CampaignMap @relation(fields: [mapId], references: [id], onDelete: Cascade)
  entity      WorldEntity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([mapId, entityId])
  @@index([mapId])
  @@index([entityId])
}
```

- [ ] **Step 5: Add inverse relations to WorldEntity**

In the `WorldEntity` model (line ~1402), add two relations inside the model body after the existing relations:

```prisma
  mapPins          MapPin[]
  locationMaps     CampaignMap[]   @relation("LocationMap")
```

- [ ] **Step 6: Add Campaign → CampaignMap relation**

In the `Campaign` model, find where other relation arrays are listed and add:

```prisma
  maps             CampaignMap[]
```

- [ ] **Step 7: Push schema and verify**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

Then verify the tables exist:

```bash
python3 C:/Users/mail/.claude/skills/agent-skills/skills/read-only-postgres/scripts/query.py --db quiverdm-local --query "SELECT table_name FROM information_schema.tables WHERE table_name IN ('CampaignMap','MapPin') ORDER BY table_name;"
```

Expected: two rows — `CampaignMap` and `MapPin`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(world-map): add CampaignMap, MapPin models and NOTE entity type"
```

---

## Task 2: worldMap tRPC router — read procedures

**Files:**
- Create: `src/server/routers/world-map.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create the router file with getOrCreateRoot and getMap**

Create `src/server/routers/world-map.ts`:

```typescript
import { router, campaignDMProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';
import { MapBgType, WorldEntityType } from '@prisma/client';

async function getAncestorPath(mapId: string): Promise<Array<{ mapId: string; name: string; entityId: string | null }>> {
  const path: Array<{ mapId: string; name: string; entityId: string | null }> = [];
  let current = await prisma.campaignMap.findUnique({
    where: { id: mapId },
    select: { id: true, name: true, parentLocationId: true },
  });
  while (current) {
    path.unshift({ mapId: current.id, name: current.name, entityId: current.parentLocationId });
    if (!current.parentLocationId) break;
    const parent = await prisma.campaignMap.findFirst({
      where: { parentLocationId: current.parentLocationId },
      select: { id: true, name: true, parentLocationId: true },
    });
    // Walk up via the parent location's own map
    if (!parent || parent.id === current.id) break;
    current = parent;
  }
  return path;
}

export const worldMapRouter = router({
  getOrCreateRoot: campaignDMProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ input }) => {
      let map = await prisma.campaignMap.findFirst({
        where: { campaignId: input.campaignId, parentLocationId: null },
        include: { pins: { include: { entity: { select: { id: true, name: true, type: true } } } } },
      });
      return map;
    }),

  getMap: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1) }))
    .query(async ({ input }) => {
      const map = await prisma.campaignMap.findUnique({
        where: { id: input.mapId },
        include: {
          pins: {
            include: {
              entity: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  _count: { select: { stateChanges: true } },
                },
              },
            },
          },
        },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const ancestorPath = await getAncestorPath(input.mapId);
      return { ...map, ancestorPath };
    }),

  getLocationEvents: protectedProcedure
    .input(z.object({ entityId: z.string().min(1) }))
    .query(async ({ input }) => {
      return prisma.worldStateChange.findMany({
        where: { entityId: input.entityId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          changeType: true,
          newValue: true,
          source: true,
          createdAt: true,
          sessionId: true,
          session: { select: { title: true, sessionNumber: true } },
        },
      });
    }),
});
```

- [ ] **Step 2: Register in _app.ts**

In `src/server/routers/_app.ts`, add:

```typescript
import { worldMapRouter } from './world-map';
```

And in the `appRouter` object:

```typescript
  worldMap: worldMapRouter,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `world-map.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/world-map.ts src/server/routers/_app.ts
git commit -m "feat(world-map): add worldMap tRPC router with read procedures"
```

---

## Task 3: worldMap tRPC router — write procedures

**Files:**
- Modify: `src/server/routers/world-map.ts`

- [ ] **Step 1: Add createRoot procedure**

Inside the `worldMapRouter` object, after `getMap`, add:

```typescript
  createRoot: campaignDMProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      name: z.string().min(1).max(100).default('World Map'),
      backgroundType: z.nativeEnum(MapBgType).default('BLANK'),
      backgroundUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await prisma.campaignMap.findFirst({
        where: { campaignId: input.campaignId, parentLocationId: null },
      });
      if (existing) return existing;
      return prisma.campaignMap.create({
        data: {
          campaignId: input.campaignId,
          name: input.name,
          backgroundType: input.backgroundType,
          backgroundUrl: input.backgroundUrl ?? null,
          parentLocationId: null,
        },
      });
    }),
```

- [ ] **Step 2: Add pin write procedures**

After `createRoot`, add:

```typescript
  createLocationPin: campaignDMProcedure
    .input(z.object({
      mapId: z.string().min(1),
      name: z.string().min(1).max(255),
      x: z.number(),
      y: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const map = await prisma.campaignMap.findUnique({ where: { id: input.mapId }, select: { campaignId: true } });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const entity = await prisma.worldEntity.create({
        data: {
          campaignId: map.campaignId,
          type: WorldEntityType.LOCATION,
          name: input.name,
          aliases: [],
          properties: {},
        },
      });
      const pin = await prisma.mapPin.create({
        data: { mapId: input.mapId, entityId: entity.id, x: input.x, y: input.y },
        include: { entity: { select: { id: true, name: true, type: true } } },
      });
      return pin;
    }),

  createNotePin: campaignDMProcedure
    .input(z.object({
      mapId: z.string().min(1),
      content: z.string().min(1).max(2000),
      x: z.number(),
      y: z.number(),
    }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findUnique({ where: { id: input.mapId }, select: { campaignId: true } });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const entity = await prisma.worldEntity.create({
        data: {
          campaignId: map.campaignId,
          type: WorldEntityType.NOTE,
          name: input.content.slice(0, 60),
          aliases: [],
          properties: { content: input.content },
        },
      });
      return prisma.mapPin.create({
        data: { mapId: input.mapId, entityId: entity.id, x: input.x, y: input.y },
        include: { entity: { select: { id: true, name: true, type: true } } },
      });
    }),

  updatePinPosition: campaignDMProcedure
    .input(z.object({ pinId: z.string().min(1), x: z.number(), y: z.number() }))
    .mutation(async ({ input }) => {
      return prisma.mapPin.update({
        where: { id: input.pinId },
        data: { x: input.x, y: input.y, unplaced: false },
      });
    }),

  deletePin: campaignDMProcedure
    .input(z.object({ pinId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await prisma.mapPin.delete({ where: { id: input.pinId } });
      return { success: true };
    }),

  uploadMapBackground: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1), backgroundUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      return prisma.campaignMap.update({
        where: { id: input.mapId },
        data: { backgroundType: 'UPLOADED', backgroundUrl: input.backgroundUrl },
      });
    }),

  setBlankBackground: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return prisma.campaignMap.update({
        where: { id: input.mapId },
        data: { backgroundType: 'BLANK', backgroundUrl: null },
      });
    }),

  createSubMap: campaignDMProcedure
    .input(z.object({
      parentLocationEntityId: z.string().min(1),
      name: z.string().min(1).max(100),
      backgroundType: z.nativeEnum(MapBgType).default('BLANK'),
    }))
    .mutation(async ({ input }) => {
      const entity = await prisma.worldEntity.findUnique({
        where: { id: input.parentLocationEntityId },
        select: { campaignId: true },
      });
      if (!entity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
      const existing = await prisma.campaignMap.findFirst({
        where: { parentLocationId: input.parentLocationEntityId },
      });
      if (existing) return existing;
      return prisma.campaignMap.create({
        data: {
          campaignId: entity.campaignId,
          name: input.name,
          backgroundType: input.backgroundType,
          parentLocationId: input.parentLocationEntityId,
        },
      });
    }),

  addLocationNote: protectedProcedure
    .input(z.object({
      entityId: z.string().min(1),
      campaignId: z.string().min(1),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      return prisma.worldStateChange.create({
        data: {
          campaignId: input.campaignId,
          entityId: input.entityId,
          changeType: 'note',
          newValue: { content: input.content },
          source: 'dm',
        },
      });
    }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/world-map.ts
git commit -m "feat(world-map): add worldMap write procedures"
```

---

## Task 4: map-generation BullMQ queue + worker

**Files:**
- Create: `src/lib/queue/map-generation-queue.ts`
- Create: `src/lib/queue/map-generation-worker.ts`
- Modify: `src/server/routers/world-map.ts`
- Modify: `package.json`

- [ ] **Step 1: Create map-generation-queue.ts**

Create `src/lib/queue/map-generation-queue.ts`:

```typescript
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface MapGenerationJobData {
  mapId: string;
  campaignId: string;
  prompt: string;
}

export interface MapGenerationJobResult {
  success: boolean;
  backgroundUrl?: string;
  error?: string;
}

export const mapGenerationQueue = new Queue<MapGenerationJobData, MapGenerationJobResult>(
  'map-generation',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addMapGenerationJob(data: MapGenerationJobData) {
  return mapGenerationQueue.add(`map-gen-${data.mapId}`, data, {
    jobId: `map-gen-${data.mapId}`,
  });
}
```

- [ ] **Step 2: Create map-generation-worker.ts**

Create `src/lib/queue/map-generation-worker.ts`:

```typescript
/**
 * BullMQ Worker for Map Generation
 * Run: npm run worker:map-generation
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from './queue';
import type { MapGenerationJobData, MapGenerationJobResult } from './map-generation-queue';

const prisma = new PrismaClient();

async function generateMapViaComfyUI(prompt: string): Promise<Buffer> {
  const comfyUrl = process.env.COMFYUI_URL;
  if (!comfyUrl) throw new Error('COMFYUI_URL not set');
  // ComfyUI workflow: POST /prompt with a simple txt2img workflow
  const workflow = {
    prompt: {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 1e9),
          steps: 20,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5-pruned-emaonly.ckpt' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { batch_size: 1, height: 768, width: 1024 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'text, labels, watermark, modern, realistic photo', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'map', images: ['8', 0] } },
    },
  };
  const promptRes = await fetch(`${comfyUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!promptRes.ok) throw new Error(`ComfyUI /prompt failed: ${promptRes.status}`);
  const { prompt_id } = await promptRes.json() as { prompt_id: string };

  // Poll history until complete
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const histRes = await fetch(`${comfyUrl}/history/${prompt_id}`);
    const hist = await histRes.json() as Record<string, any>;
    if (hist[prompt_id]?.status?.completed) {
      const outputs = hist[prompt_id].outputs;
      const imageNode = Object.values(outputs).find((n: any) => n.images?.length > 0) as any;
      if (!imageNode) throw new Error('No image output from ComfyUI');
      const img = imageNode.images[0];
      const imgRes = await fetch(`${comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
      return Buffer.from(await imgRes.arrayBuffer());
    }
  }
  throw new Error('ComfyUI timed out after 180s');
}

async function generateMapViaFal(prompt: string): Promise<Buffer> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error('FAL_KEY not set');
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 768 },
      num_images: 1,
    }),
  });
  if (!res.ok) throw new Error(`fal.ai failed: ${res.status}`);
  const data = await res.json() as { images: Array<{ url: string }> };
  const imgRes = await fetch(data.images[0].url);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function uploadToR2(buffer: Buffer, mapId: string): Promise<string> {
  const { storage } = await import('../storage');
  const key = `maps/${mapId}/background.png`;
  await storage.put(key, buffer, 'image/png');
  return storage.getPublicUrl(key);
}

async function processMapGenerationJob(job: Job<MapGenerationJobData>): Promise<MapGenerationJobResult> {
  const { mapId, prompt } = job.data;
  let imageBuffer: Buffer;

  try {
    imageBuffer = await generateMapViaComfyUI(prompt);
    console.log(`[map-generation] ComfyUI succeeded for map ${mapId}`);
  } catch (comfyErr) {
    console.warn(`[map-generation] ComfyUI failed, trying fal.ai:`, comfyErr);
    imageBuffer = await generateMapViaFal(prompt);
  }

  const backgroundUrl = await uploadToR2(imageBuffer, mapId);
  await prisma.campaignMap.update({
    where: { id: mapId },
    data: { backgroundType: 'GENERATED', backgroundUrl },
  });

  return { success: true, backgroundUrl };
}

const worker = new Worker<MapGenerationJobData, MapGenerationJobResult>(
  'map-generation',
  processMapGenerationJob,
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('completed', (job) => console.log(`[map-generation] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[map-generation] Job ${job?.id} failed:`, err));

process.on('SIGTERM', () => worker.close());
```

- [ ] **Step 3: Add generateMapBackground procedure to worldMap router**

In `src/server/routers/world-map.ts`, add the import at the top:

```typescript
import { addMapGenerationJob } from '@/lib/queue/map-generation-queue';
```

Then add the procedure inside `worldMapRouter`:

```typescript
  generateMapBackground: campaignDMProcedure
    .input(z.object({
      mapId: z.string().min(1),
      campaignId: z.string().min(1),
      customPrompt: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findUnique({
        where: { id: input.mapId },
        include: { campaign: { select: { name: true, description: true } } },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const settingContext = map.campaign.description ?? map.campaign.name;
      const prompt = input.customPrompt ??
        `Fantasy world map, ${settingContext}, top-down cartographic style, parchment, ink lines, no labels, no text`;
      await addMapGenerationJob({ mapId: input.mapId, campaignId: input.campaignId, prompt });
      return { queued: true };
    }),
```

- [ ] **Step 4: Add npm script**

In `package.json`, in the `scripts` section, after `"worker:co-dm-prep"`:

```json
"worker:map-generation": "tsx src/lib/queue/map-generation-worker.ts",
```

- [ ] **Step 5: Add COMFYUI_URL to .env.local**

Open `.env.local` and add:

```
COMFYUI_URL=http://192.168.1.21:8188
```

(Port 8188 is ComfyUI's default. Adjust if your homelab instance uses a different port.)

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/queue/map-generation-queue.ts src/lib/queue/map-generation-worker.ts src/server/routers/world-map.ts package.json
git commit -m "feat(world-map): add map-generation BullMQ queue, worker, and generateMapBackground procedure"
```

---

## Task 5: Install React Flow + route page

**Files:**
- Modify: `package.json` (npm install)
- Create: `src/app/(app)/campaigns/[slug]/world-map/page.tsx`

- [ ] **Step 1: Install @xyflow/react**

```bash
npm install @xyflow/react
```

Expected: `added N packages` with no peer dependency errors.

- [ ] **Step 2: Create the route page**

Create `src/app/(app)/campaigns/[slug]/world-map/page.tsx`:

```tsx
import { WorldMapCanvas } from '@/components/world/world-map-canvas';
import { BentoCanvas } from '@/components/layout/bento-canvas';

interface WorldMapPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorldMapPage({ params }: WorldMapPageProps) {
  const { slug } = await params;
  return (
    <BentoCanvas overline="Campaign" title="World Map">
      <WorldMapCanvas slug={slug} />
    </BentoCanvas>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/app/\(app\)/campaigns/\[slug\]/world-map/page.tsx
git commit -m "feat(world-map): install @xyflow/react, add world-map route page"
```

---

## Task 6: WorldMapCanvas — base canvas

**Files:**
- Create: `src/components/world/world-map-canvas.tsx`

- [ ] **Step 1: Create WorldMapCanvas**

Create `src/components/world/world-map-canvas.tsx`:

```tsx
'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { LocationNode } from './location-node';
import { NoteNode } from './note-node';
import { MapToolbar } from './map-toolbar';
import { LocationPanel } from './location-panel';
import { MapBackgroundPicker } from './map-background-picker';
import { MapBreadcrumb } from './map-breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter } from 'next/navigation';

const nodeTypes: NodeTypes = {
  location: LocationNode,
  note: NoteNode,
};

interface WorldMapCanvasProps {
  slug: string;
}

export function WorldMapCanvas({ slug }: WorldMapCanvasProps) {
  const { campaignId } = useCampaign();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeMapId = searchParams.get('map');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<'location' | 'note' | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const rootQuery = trpc.worldMap.getOrCreateRoot.useQuery(
    { campaignId },
    { enabled: !activeMapId }
  );
  const mapQuery = trpc.worldMap.getMap.useQuery(
    { mapId: activeMapId! },
    { enabled: !!activeMapId }
  );

  const mapData = activeMapId ? mapQuery.data : rootQuery.data;
  const isLoading = activeMapId ? mapQuery.isLoading : rootQuery.isLoading;

  // Sync React Flow nodes from mapData
  const syncNodes = useCallback(() => {
    if (!mapData?.pins) return;
    setNodes(
      mapData.pins.map((pin) => ({
        id: pin.id,
        type: pin.entity.type === 'NOTE' ? 'note' : 'location',
        position: { x: pin.x, y: pin.y },
        data: {
          entityId: pin.entity.id,
          label: pin.entity.name,
          type: pin.entity.type,
          lastEventAt: pin.lastEventAt,
          unplaced: pin.unplaced,
          onSelect: () => setSelectedEntityId(pin.entity.id),
        },
      }))
    );
  }, [mapData, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  // No map yet — show picker
  if (!isLoading && !mapData) {
    return <MapBackgroundPicker open onDone={() => {}} campaignId={campaignId} slug={slug} />;
  }

  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-lg" />;
  }

  const bgStyle = mapData?.backgroundUrl
    ? { backgroundImage: `url(${mapData.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div className="relative h-full w-full">
      {mapData?.ancestorPath && mapData.ancestorPath.length > 1 && (
        <MapBreadcrumb path={mapData.ancestorPath} slug={slug} />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={syncNodes}
        nodeTypes={nodeTypes}
        fitView
        style={bgStyle}
        className="bg-[var(--background)]"
      >
        {!mapData?.backgroundUrl && (
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(240 20% 80% / 0.08)" />
        )}
        <Controls className="!bg-card !border-border" />
        <MiniMap className="!bg-card !border-border" />
      </ReactFlow>
      <MapToolbar
        onPlaceLocation={() => setPlacingType('location')}
        onPlaceNote={() => setPlacingType('note')}
        onOpenSettings={() => setShowPicker(true)}
        mapId={mapData!.id}
        campaignId={campaignId}
      />
      {selectedEntityId && (
        <LocationPanel
          entityId={selectedEntityId}
          campaignId={campaignId}
          mapId={mapData!.id}
          slug={slug}
          onClose={() => setSelectedEntityId(null)}
        />
      )}
      {showPicker && (
        <MapBackgroundPicker
          open
          onDone={() => setShowPicker(false)}
          campaignId={campaignId}
          mapId={mapData!.id}
          slug={slug}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `world-map-canvas.tsx` (child component stubs not yet created will error — proceed).

- [ ] **Step 3: Commit**

```bash
git add src/components/world/world-map-canvas.tsx
git commit -m "feat(world-map): add WorldMapCanvas base with React Flow"
```

---

## Task 7: LocationNode + NoteNode

**Files:**
- Create: `src/components/world/location-node.tsx`
- Create: `src/components/world/note-node.tsx`

- [ ] **Step 1: Create LocationNode**

Create `src/components/world/location-node.tsx`:

```tsx
'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationNodeData {
  entityId: string;
  label: string;
  type: string;
  lastEventAt?: string | null;
  unplaced?: boolean;
  onSelect: () => void;
}

export const LocationNode = memo(function LocationNode({ data, selected }: NodeProps) {
  const d = data as LocationNodeData;
  return (
    <motion.div
      className={cn(
        'group relative flex flex-col items-center gap-1 cursor-pointer select-none',
        d.unplaced && 'opacity-60'
      )}
      onClick={d.onSelect}
      whileHover={{ scale: 1.08 }}
      animate={d.lastEventAt ? { filter: ['drop-shadow(0 0 6px hsl(35 80% 55%))', 'drop-shadow(0 0 0px transparent)'] } : {}}
      transition={d.lastEventAt ? { duration: 1.5, repeat: 2 } : {}}
    >
      <div className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
        selected
          ? 'border-primary bg-primary/20 text-primary'
          : 'border-border bg-card text-muted-foreground group-hover:border-primary group-hover:text-primary'
      )}>
        <MapPin className="h-4 w-4" />
        <AnimatePresence>
          {d.lastEventAt && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground"
            />
          )}
        </AnimatePresence>
      </div>
      <span className="max-w-[100px] truncate rounded bg-card/80 px-1.5 py-0.5 text-center text-[11px] font-medium text-foreground backdrop-blur-sm">
        {d.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-border !bg-muted" />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-border !bg-muted" />
    </motion.div>
  );
});
```

- [ ] **Step 2: Create NoteNode**

Create `src/components/world/note-node.tsx`:

```tsx
'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface NoteNodeData {
  entityId: string;
  label: string;
  type: string;
  onSelect: () => void;
  source?: 'dm' | 'brain';
}

export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps) {
  const d = data as NoteNodeData;
  const isBrain = d.source === 'brain';
  return (
    <div
      className={cn(
        'max-w-[160px] cursor-pointer rounded border p-2 text-[11px] leading-snug transition-colors',
        isBrain
          ? 'border-[hsl(258_60%_50%/0.4)] bg-[hsl(258_60%_10%/0.7)] text-[hsl(258_80%_85%)]'
          : 'border-[hsl(35_60%_40%/0.4)] bg-[hsl(35_30%_10%/0.7)] text-[hsl(35_60%_85%)]',
        selected && 'ring-1 ring-primary'
      )}
      onClick={d.onSelect}
    >
      {d.label}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-border !bg-muted" />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-border !bg-muted" />
    </div>
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/world/location-node.tsx src/components/world/note-node.tsx
git commit -m "feat(world-map): add LocationNode and NoteNode custom React Flow nodes"
```

---

## Task 8: MapToolbar

**Files:**
- Create: `src/components/world/map-toolbar.tsx`

- [ ] **Step 1: Create MapToolbar**

Create `src/components/world/map-toolbar.tsx`:

```tsx
'use client';

import { MapPin, StickyNote, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface MapToolbarProps {
  onPlaceLocation: () => void;
  onPlaceNote: () => void;
  onOpenSettings: () => void;
  mapId: string;
  campaignId: string;
}

export function MapToolbar({ onPlaceLocation, onPlaceNote, onOpenSettings, mapId, campaignId }: MapToolbarProps) {
  const generateMutation = trpc.worldMap.generateMapBackground.useMutation({
    onSuccess: () => toast.info('Map generation queued — background will update when ready'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <TooltipProvider>
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-lg border border-border bg-card/80 p-1 backdrop-blur-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlaceLocation}>
              <MapPin className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Place location</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlaceNote}>
              <StickyNote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Place note</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => generateMutation.mutate({ mapId, campaignId })}
              disabled={generateMutation.isPending}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Generate map with AI</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Map settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/world/map-toolbar.tsx
git commit -m "feat(world-map): add MapToolbar"
```

---

## Task 9: LocationPanel

**Files:**
- Create: `src/components/world/location-panel.tsx`

- [ ] **Step 1: Create LocationPanel**

Create `src/components/world/location-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';
import { formatDistanceToNow } from 'date-fns';
import { Map, Brain, User } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface LocationPanelProps {
  entityId: string;
  campaignId: string;
  mapId: string;
  slug: string;
  onClose: () => void;
}

export function LocationPanel({ entityId, campaignId, mapId, slug, onClose }: LocationPanelProps) {
  const router = useRouter();
  const [note, setNote] = useState('');

  const eventsQuery = trpc.worldMap.getLocationEvents.useQuery({ entityId });
  const addNoteMutation = trpc.worldMap.addLocationNote.useMutation({
    onSuccess: () => {
      setNote('');
      eventsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const createSubMapMutation = trpc.worldMap.createSubMap.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${slug}/world-map?map=${data.id}`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const events = eventsQuery.data ?? [];
  const entityName = events[0]?.session?.title ?? 'Location';

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[380px] overflow-y-auto border-l border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-base">{entityName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-5">
          {/* Event timeline */}
          <div className="flex flex-col gap-3">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet. Add a note or play a session to see history appear.</p>
            )}
            {events.map((event) => {
              const isBrain = event.source === 'ingestion' || event.source === 'inference';
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                    {isBrain
                      ? <Brain className="h-3 w-3 text-[hsl(258_60%_65%)]" />
                      : <User className="h-3 w-3 text-primary" />
                    }
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm leading-snug text-foreground">
                      {typeof event.newValue === 'object' && event.newValue !== null
                        ? (event.newValue as any).content ?? JSON.stringify(event.newValue)
                        : String(event.newValue)}
                    </p>
                    <div className="flex items-center gap-2">
                      {event.session && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          {event.session.title ?? `Session ${event.session.sessionNumber}`}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Add note */}
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Add a note about this location…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
            />
            <Button
              size="sm"
              disabled={!note.trim() || addNoteMutation.isPending}
              onClick={() => addNoteMutation.mutate({ entityId, campaignId, content: note.trim() })}
            >
              Add note
            </Button>
          </div>

          <Separator />

          {/* Sub-map */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={createSubMapMutation.isPending}
            onClick={() => createSubMapMutation.mutate({ parentLocationEntityId: entityId, name: 'Location Map' })}
          >
            <Map className="h-4 w-4" />
            Open sub-map
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/world/location-panel.tsx
git commit -m "feat(world-map): add LocationPanel with event timeline and sub-map button"
```

---

## Task 10: MapBackgroundPicker

**Files:**
- Create: `src/components/world/map-background-picker.tsx`

- [ ] **Step 1: Create MapBackgroundPicker**

Create `src/components/world/map-background-picker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Upload, Sparkles, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MapBackgroundPickerProps {
  open: boolean;
  onDone: () => void;
  campaignId: string;
  mapId?: string;
  slug: string;
}

export function MapBackgroundPicker({ open, onDone, campaignId, mapId, slug }: MapBackgroundPickerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'upload' | 'generate' | 'blank'>('blank');
  const [customPrompt, setCustomPrompt] = useState('');

  const createRootMutation = trpc.worldMap.createRoot.useMutation({
    onSuccess: (data) => {
      router.refresh();
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const setBlankMutation = trpc.worldMap.setBlankBackground.useMutation({
    onSuccess: () => { router.refresh(); onDone(); },
    onError: (err) => toast.error(err.message),
  });

  const generateMutation = trpc.worldMap.generateMapBackground.useMutation({
    onSuccess: () => { toast.info('Map generation queued — background will update when ready'); onDone(); },
    onError: (err) => toast.error(err.message),
  });

  const handleStartBlank = () => {
    if (!mapId) {
      createRootMutation.mutate({ campaignId, backgroundType: 'BLANK' });
    } else {
      setBlankMutation.mutate({ mapId });
    }
  };

  const handleGenerate = () => {
    if (!mapId) {
      createRootMutation.mutate({ campaignId, backgroundType: 'BLANK' });
    }
    generateMutation.mutate({ mapId: mapId!, campaignId, customPrompt: customPrompt || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">Set map background</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="blank" className="flex-1 gap-1.5"><Square className="h-3.5 w-3.5" />Blank</TabsTrigger>
            <TabsTrigger value="generate" className="flex-1 gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="blank" className="mt-4">
            <p className="mb-4 text-sm text-muted-foreground">Start with a clean canvas. Add a background later.</p>
            <Button className="w-full" onClick={handleStartBlank} disabled={createRootMutation.isPending || setBlankMutation.isPending}>
              Start blank
            </Button>
          </TabsContent>
          <TabsContent value="generate" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">AI will generate a map based on your campaign. Optionally describe the style.</p>
            <Input
              placeholder="e.g. northern tundra, ruined empire, dense jungle archipelago"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <Button className="w-full gap-2" onClick={handleGenerate} disabled={generateMutation.isPending}>
              <Sparkles className="h-4 w-4" />
              Generate map
            </Button>
          </TabsContent>
          <TabsContent value="upload" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Upload a PNG or JPG (Inkarnate export, hand-drawn scan, etc.).</p>
            <p className="text-sm text-muted-foreground">Use the campaign file uploader to get an R2 URL, then paste it below.</p>
            <Input placeholder="https://..." id="bg-url-input" />
            <Button
              className="w-full"
              onClick={() => {
                const url = (document.getElementById('bg-url-input') as HTMLInputElement).value;
                if (!url) return;
                if (mapId) {
                  trpc.worldMap.uploadMapBackground.useMutation().mutate({ mapId, backgroundUrl: url });
                }
                onDone();
              }}
            >
              Set background
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/world/map-background-picker.tsx
git commit -m "feat(world-map): add MapBackgroundPicker dialog"
```

---

## Task 11: MapBreadcrumb

**Files:**
- Create: `src/components/world/map-breadcrumb.tsx`

- [ ] **Step 1: Create MapBreadcrumb**

Create `src/components/world/map-breadcrumb.tsx`:

```tsx
'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface BreadcrumbSegment {
  mapId: string;
  name: string;
  entityId: string | null;
}

interface MapBreadcrumbProps {
  path: BreadcrumbSegment[];
  slug: string;
}

export function MapBreadcrumb({ path, slug }: MapBreadcrumbProps) {
  const router = useRouter();
  return (
    <div className="absolute left-16 top-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/80 px-2 py-1 backdrop-blur-sm">
      {path.map((segment, i) => (
        <div key={segment.mapId} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1 py-0.5 text-xs"
            disabled={i === path.length - 1}
            onClick={() => {
              if (i === 0) {
                router.push(`/campaigns/${slug}/world-map`);
              } else {
                router.push(`/campaigns/${slug}/world-map?map=${segment.mapId}`);
              }
            }}
          >
            {segment.name}
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/world/map-breadcrumb.tsx
git commit -m "feat(world-map): add MapBreadcrumb hierarchy navigation"
```

---

## Task 12: Wire canvas — node placement + drag-to-reposition

**Files:**
- Modify: `src/components/world/world-map-canvas.tsx`

The canvas currently renders static nodes from DB. This task wires up click-to-place and drag-to-update-position.

- [ ] **Step 1: Add useMutation hooks and placement handler**

In `src/components/world/world-map-canvas.tsx`, add the following inside `WorldMapCanvas` after the existing state declarations:

```tsx
  const utils = trpc.useUtils();

  const createLocationPin = trpc.worldMap.createLocationPin.useMutation({
    onSuccess: () => utils.worldMap.getMap.invalidate(),
  });
  const createNotePin = trpc.worldMap.createNotePin.useMutation({
    onSuccess: () => utils.worldMap.getMap.invalidate(),
  });
  const updatePinPosition = trpc.worldMap.updatePinPosition.useMutation();

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!placingType || !mapData) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (placingType === 'location') {
        const name = prompt('Location name:');
        if (!name) { setPlacingType(null); return; }
        createLocationPin.mutate({ mapId: mapData.id, name, x, y });
      } else {
        const content = prompt('Note:');
        if (!content) { setPlacingType(null); return; }
        createNotePin.mutate({ mapId: mapData.id, content, x, y });
      }
      setPlacingType(null);
    },
    [placingType, mapData, createLocationPin, createNotePin]
  );

  const onNodeDragStop = useCallback(
    (_: any, node: any) => {
      updatePinPosition.mutate({ pinId: node.id, x: node.position.x, y: node.position.y });
    },
    [updatePinPosition]
  );
```

- [ ] **Step 2: Wire handlers onto ReactFlow**

In the same file, update the `<ReactFlow>` element to include:

```tsx
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        style={{ cursor: placingType ? 'crosshair' : 'default', ...bgStyle }}
```

Remove the existing `style={bgStyle}` and replace with this combined style.

- [ ] **Step 3: Sync nodes when mapData changes**

Replace the `onInit={syncNodes}` callback with a `useEffect` that syncs when `mapData` changes:

```tsx
  // Add this import at top if not present: import { useEffect } from 'react';
  useEffect(() => {
    syncNodes();
  }, [syncNodes]);
```

Remove `onInit={syncNodes}` from the `<ReactFlow>` element.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/world/world-map-canvas.tsx
git commit -m "feat(world-map): wire node placement and drag-to-reposition on canvas"
```

---

## Task 13: DM Brain integration — map notification pass

**Files:**
- Modify: `src/lib/queue/brain-ingestion-worker.ts`

- [ ] **Step 1: Read the end of brain-ingestion-worker.ts**

The worker's main `processBrainIngestionJob` function ends around line 397 with `result.success = true`. Add the map notification pass after the threat trajectory block and before `result.success = true`.

- [ ] **Step 2: Add map notification pass**

In `src/lib/queue/brain-ingestion-worker.ts`, locate the line `result.success = true;` (near end of `processBrainIngestionJob`) and insert before it:

```typescript
  // Map notification pass — update lastEventAt for any pins touched in this job
  try {
    const touchedEntityIds = [
      ...extracted.entities.map((e: any) => e.name),
      ...extracted.entityUpdates.map((e: any) => e.name),
    ];

    if (touchedEntityIds.length > 0) {
      const touchedEntities = await prisma.worldEntity.findMany({
        where: {
          campaignId: data.campaignId,
          name: { in: touchedEntityIds },
        },
        select: { id: true, type: true, name: true },
      });
      const touchedIds = touchedEntities.map(e => e.id);

      if (touchedIds.length > 0) {
        await prisma.mapPin.updateMany({
          where: { entityId: { in: touchedIds } },
          data: { lastEventAt: new Date() },
        });
      }

      // Auto-create unplaced pins for new LOCATION entities
      const rootMap = await prisma.campaignMap.findFirst({
        where: { campaignId: data.campaignId, parentLocationId: null },
        select: { id: true },
      });
      if (rootMap) {
        const locationEntities = touchedEntities.filter(e => e.type === WorldEntityType.LOCATION);
        for (const loc of locationEntities) {
          const existingPin = await prisma.mapPin.findFirst({ where: { mapId: rootMap.id, entityId: loc.id } });
          if (!existingPin) {
            await prisma.mapPin.create({
              data: { mapId: rootMap.id, entityId: loc.id, x: 50, y: 50, unplaced: true },
            });
          }
        }
      }
    }
  } catch (mapErr) {
    console.warn('[brain-ingestion] Map notification pass failed (non-fatal):', mapErr);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/queue/brain-ingestion-worker.ts
git commit -m "feat(world-map): add map notification pass to brain ingestion worker"
```

---

## Task 14: E2E workflow spec

**Files:**
- Create: `tests/workflows/world-map.workflow.spec.ts`

- [ ] **Step 1: Create the workflow spec**

Create `tests/workflows/world-map.workflow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('World Map workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('first visit shows background picker', async ({ page }) => {
    await page.goto('/campaigns/test-campaign/world-map');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Set map background')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Blank' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Generate' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Upload' })).toBeVisible();
  });

  test('start blank creates map and shows canvas', async ({ page }) => {
    await page.goto('/campaigns/test-campaign/world-map');
    await page.getByRole('button', { name: 'Start blank' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    // React Flow canvas container
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('map toolbar is visible on canvas', async ({ page }) => {
    await page.goto('/campaigns/test-campaign/world-map');
    await page.getByRole('button', { name: 'Start blank' }).click();
    await expect(page.getByRole('button', { name: 'Place location' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place note' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate map with AI' })).toBeVisible();
  });

  test('navigate to world map via campaign nav', async ({ page }) => {
    await page.goto('/campaigns/test-campaign');
    await page.getByRole('link', { name: /world map/i }).click();
    await expect(page).toHaveURL(/\/world-map/);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/workflows/world-map.workflow.spec.ts
git commit -m "test(world-map): add world map workflow E2E spec"
```

---

## Task 15: Add World Map to campaign nav

**Files:**
- Modify: `src/components/layout/command-rail.tsx` (or wherever campaign nav links live)

- [ ] **Step 1: Find where campaign nav links are defined**

```bash
grep -rn "sessions\|homebrew\|npcs" src/components/layout/ --include="*.tsx" | head -10
```

Note the file and pattern.

- [ ] **Step 2: Add World Map nav link**

In the campaign nav link list, add a World Map entry following the same pattern as existing links:

```tsx
{ href: `/campaigns/${slug}/world-map`, label: 'World Map', icon: Map }
```

Import `Map` from `lucide-react` if not already imported.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/command-rail.tsx  # or whichever file
git commit -m "feat(world-map): add World Map link to campaign nav"
```

---

## Self-Review Checklist

- [x] Spec section "Data Model" → Task 1
- [x] Spec section "Routes" → Task 5 + Task 11
- [x] Spec section "Components" → Tasks 6–11
- [x] Spec section "User Flows" → Tasks 6, 12, 10
- [x] Spec section "DM Brain Integration" → Task 13
- [x] Spec section "Map Generation" → Task 4
- [x] Spec section "worldMap tRPC router" → Tasks 2–3
- [x] Spec section "BullMQ queue" → Task 4
- [x] Nav link → Task 15
- [x] E2E spec → Task 14
- [x] No TBD or placeholders remaining
- [x] `MapPin` uses `id` as React Flow node ID consistently across Tasks 6 and 12
- [x] `WorldEntityType.NOTE` added in Task 1 before router uses it in Task 3
- [x] `ancestorPath` returned by `getMap` in Task 2, consumed by `MapBreadcrumb` in Task 11
