# Home Page Visuals via ComfyUI + Flux.2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Light up the V2 home page with real images for a Hameria-Ire test campaign, generated via local ComfyUI + Flux.2, with DM-only hover-to-regenerate overlays on the hero banner, campaign emblem, and world activity thumbnails.

**Architecture:** Three new schema fields (`Campaign.emblemUrl`, `WorldEntity.imageUrl`, `WorldEntry.imageUrl`); a ComfyUI-only invocation flag on `generateImage()`; a new `visual-asset-queue` + worker that builds Flux.2 prompts and writes URLs back to entity rows; three campaign-DM-procedure tRPC mutations that enqueue jobs; hover overlays in three home-page components that call those mutations and poll for the URL change.

**Tech Stack:** Next.js 15, tRPC v11, Prisma + PostgreSQL, BullMQ + Redis, ComfyUI (Flux.2), R2 storage, Tailwind + shadcn/ui, Next/Image.

---

## File Structure

**New files:**
- `prisma/migrations/20260510_home_visuals/migration.sql`
- `src/lib/ai/__tests__/comfyui-flux.test.ts`
- `src/lib/ai/__tests__/image-generation-providers-allowed.test.ts`
- `src/lib/queue/visual-asset-queue.ts`
- `src/lib/queue/visual-asset-worker.ts`
- `src/server/routers/__tests__/regenerate-visuals.test.ts`
- `src/components/home/RegenerateBannerButton.tsx`
- `src/components/home/RegenerateEmblemButton.tsx`
- `src/components/home/RegenerateActivityButton.tsx`
- `scripts/seed-hameria-ire-min.ts`
- `tests/workflows/home-visuals.workflow.spec.ts`

**Modified files:**
- `prisma/schema.prisma` — add 3 nullable string columns
- `src/lib/ai/comfyui.ts` — add `buildFluxTxt2ImgWorkflow` + parameterise `width/height`
- `src/lib/ai/image-generation.ts` — add `providersAllowed` field + `ProviderUnavailableError`
- `src/server/routers/campaigns.ts` — add `regenerateBanner`, `regenerateEmblem`
- `src/server/routers/world.ts` — add `regenerateActivityImage`; extend `getRecentActivity` to return `imageUrl`
- `src/components/home/HomeHero.tsx` — wire `RegenerateBannerButton`
- `src/components/home/ActiveCampaignSummary.tsx` — render `emblemUrl` image; wire `RegenerateEmblemButton`
- `src/app/(app)/page.tsx` — pass `emblemUrl` and `isDM` props
- `src/components/home/WorldActivityFeed.tsx` — render `imageUrl` thumbnail; wire `RegenerateActivityButton`
- `package.json` — add `worker:visual-assets` script
- `deploy/homelab/ecosystem.config.cjs` — register the new worker

---

## Task 1: Schema migration — image URL fields

**Files:**
- Modify: `prisma/schema.prisma:294`, `prisma/schema.prisma:1428`, `prisma/schema.prisma:1467` (WorldEntry)
- Create: migration via `npm run db:push`

- [ ] **Step 1: Add `Campaign.emblemUrl` to schema**

Find the existing `bannerUrl` line and add a sibling field below it:

```prisma
model Campaign {
  // ...
  bannerUrl   String?
  emblemUrl   String?  // home-page heraldic crest
  // ...
}
```

- [ ] **Step 2: Add `WorldEntity.imageUrl`**

Find `WorldEntity` and add `imageUrl` near the top:

```prisma
model WorldEntity {
  id                 String            @id @default(cuid())
  campaignId         String
  campaign           Campaign          @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  type               WorldEntityType
  name               String
  imageUrl           String?           // home-page activity thumbnail
  aliases            String[]
  // ...
}
```

- [ ] **Step 3: Add `WorldEntry.imageUrl`**

Locate `model WorldEntry` (search for `model WorldEntry {`) and add `imageUrl String?` near `name`:

```prisma
model WorldEntry {
  // ...
  name      String
  imageUrl  String?
  // ...
}
```

- [ ] **Step 4: Push migration**

Run: `npm run db:push`
Expected: Prisma announces the three new columns and applies them. No data loss because all are nullable.

- [ ] **Step 5: Verify columns exist**

Run:
```bash
python C:/Users/mail/.claude/skills/agent-skills/skills/read-only-postgres/scripts/query.py --db quiverdm-local --query "SELECT column_name FROM information_schema.columns WHERE table_name='Campaign' AND column_name='emblemUrl'"
```

Expected: one row returned. Repeat for `WorldEntity.imageUrl` and `WorldEntry.imageUrl`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add emblemUrl + imageUrl for home page visuals"
git push origin main
```

---

## Task 2: ComfyUI Flux.2 workflow builder

**Files:**
- Modify: `src/lib/ai/comfyui.ts`
- Create: `src/lib/ai/__tests__/comfyui-flux.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/comfyui-flux.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFluxTxt2ImgWorkflow } from '../comfyui';

describe('buildFluxTxt2ImgWorkflow', () => {
  it('generates a Flux node graph with UNET, dual CLIP, and SD3 latent', () => {
    const wf = buildFluxTxt2ImgWorkflow('a hero portrait', 12345, 1024, 1024);
    const nodes = Object.values(wf) as Array<{ class_type: string }>;
    const types = nodes.map((n) => n.class_type);
    expect(types).toContain('UNETLoader');
    expect(types).toContain('DualCLIPLoader');
    expect(types).toContain('VAELoader');
    expect(types).toContain('EmptySD3LatentImage');
    expect(types).toContain('SamplerCustomAdvanced');
    expect(types).toContain('SaveImage');
  });

  it('respects width and height in the latent image node', () => {
    const wf = buildFluxTxt2ImgWorkflow('test', 1, 1280, 640);
    const latent = Object.values(wf).find(
      (n: any) => n.class_type === 'EmptySD3LatentImage',
    ) as { inputs: { width: number; height: number } };
    expect(latent.inputs.width).toBe(1280);
    expect(latent.inputs.height).toBe(640);
  });

  it('reads checkpoint name from COMFYUI_MODEL env', () => {
    process.env.COMFYUI_MODEL = 'flux2-custom.safetensors';
    const wf = buildFluxTxt2ImgWorkflow('test', 1, 1024, 1024);
    const unet = Object.values(wf).find(
      (n: any) => n.class_type === 'UNETLoader',
    ) as { inputs: { unet_name: string } };
    expect(unet.inputs.unet_name).toBe('flux2-custom.safetensors');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/comfyui-flux.test.ts`
Expected: FAIL with "buildFluxTxt2ImgWorkflow is not exported".

- [ ] **Step 3: Implement the Flux workflow builder**

Add to `src/lib/ai/comfyui.ts` (alongside the existing `buildTxt2ImgWorkflow`):

```ts
/**
 * Build a Flux.2 text-to-image workflow.
 * Requires the matching CLIP-L, T5-XXL, and Flux VAE files in the ComfyUI
 * models volume — see deploy/comfyui/README for the file layout.
 */
export function buildFluxTxt2ImgWorkflow(
  prompt: string,
  seed: number,
  width: number,
  height: number,
): Record<string, unknown> {
  const checkpoint = process.env.COMFYUI_MODEL || 'flux2-dev.safetensors';
  return {
    '10': {
      inputs: { unet_name: checkpoint, weight_dtype: 'default' },
      class_type: 'UNETLoader',
    },
    '11': {
      inputs: {
        clip_name1: 't5xxl_fp8_e4m3fn.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux',
      },
      class_type: 'DualCLIPLoader',
    },
    '12': {
      inputs: { vae_name: 'flux_vae.safetensors' },
      class_type: 'VAELoader',
    },
    '6': {
      inputs: { text: prompt, clip: ['11', 0] },
      class_type: 'CLIPTextEncode',
    },
    '5': {
      inputs: { width, height, batch_size: 1 },
      class_type: 'EmptySD3LatentImage',
    },
    '13': {
      inputs: { noise_seed: seed },
      class_type: 'RandomNoise',
    },
    '14': {
      inputs: { sampler_name: 'euler' },
      class_type: 'KSamplerSelect',
    },
    '15': {
      inputs: { scheduler: 'simple', steps: 28, denoise: 1.0, model: ['10', 0] },
      class_type: 'BasicScheduler',
    },
    '16': {
      inputs: { conditioning: ['6', 0], guidance: 3.5 },
      class_type: 'FluxGuidance',
    },
    '17': {
      inputs: { model: ['10', 0], conditioning: ['16', 0] },
      class_type: 'BasicGuider',
    },
    '3': {
      inputs: {
        noise: ['13', 0],
        guider: ['17', 0],
        sampler: ['14', 0],
        sigmas: ['15', 0],
        latent_image: ['5', 0],
      },
      class_type: 'SamplerCustomAdvanced',
    },
    '8': {
      inputs: { samples: ['3', 0], vae: ['12', 0] },
      class_type: 'VAEDecode',
    },
    '9': {
      inputs: { filename_prefix: 'quiverdm-flux', images: ['8', 0] },
      class_type: 'SaveImage',
    },
  };
}
```

- [ ] **Step 4: Extend `queueComfyUIPrompt` with optional workflow + dimensions**

Replace the `queueComfyUIPrompt` function in `src/lib/ai/comfyui.ts` with a version that accepts an explicit workflow:

```ts
export interface ComfyUIQueueOptions {
  workflow?: 'sdxl' | 'flux';
  width?: number;
  height?: number;
}

export async function queueComfyUIPrompt(
  prompt: string,
  negativePrompt = 'nsfw, gore, violence, low quality, blurry, watermark',
  options: ComfyUIQueueOptions = {},
): Promise<{ promptId: string; seed: number }> {
  const seed = Math.floor(Math.random() * 2 ** 32);
  const width = options.width ?? 1024;
  const height = options.height ?? 1024;
  const workflow =
    options.workflow === 'flux'
      ? buildFluxTxt2ImgWorkflow(prompt, seed, width, height)
      : buildTxt2ImgWorkflowSized(prompt, negativePrompt, seed, width, height);

  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ComfyUI queue failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { prompt_id: string };
  return { promptId: data.prompt_id, seed };
}
```

- [ ] **Step 5: Add a sized SDXL builder for back-compat**

In the same file, rename the original `buildTxt2ImgWorkflow` to `buildTxt2ImgWorkflowSized` and add `width`/`height` parameters. Provide a 1024×1024 wrapper that delegates so existing callers don't break:

```ts
function buildTxt2ImgWorkflowSized(
  prompt: string,
  negativePrompt: string,
  seed: number,
  width: number,
  height: number,
): Record<string, unknown> {
  return {
    // ... existing nodes 3,4,6,7,8,9 unchanged ...
    '5': {
      inputs: { width, height, batch_size: 1 },
      class_type: 'EmptyLatentImage',
    },
    // ... rest unchanged ...
  };
}

function buildTxt2ImgWorkflow(
  prompt: string,
  negativePrompt: string,
  seed: number,
): Record<string, unknown> {
  return buildTxt2ImgWorkflowSized(prompt, negativePrompt, seed, 1024, 1024);
}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/lib/ai/__tests__/comfyui-flux.test.ts`
Expected: PASS (3/3).

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/comfyui.ts src/lib/ai/__tests__/comfyui-flux.test.ts
git commit -m "feat(comfyui): add Flux.2 workflow builder + sized SDXL"
git push origin main
```

---

## Task 3: `providersAllowed` flag + `ProviderUnavailableError`

**Files:**
- Modify: `src/lib/ai/image-generation.ts`
- Create: `src/lib/ai/__tests__/image-generation-providers-allowed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/image-generation-providers-allowed.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateImage, ProviderUnavailableError } from '../image-generation';
import * as comfy from '../comfyui';

describe('generateImage providersAllowed', () => {
  beforeEach(() => {
    vi.spyOn(comfy, 'isComfyUIAvailable').mockResolvedValue(false);
    process.env.COMFYUI_URL = 'http://localhost:8188';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws ProviderUnavailableError naming ComfyUI when ComfyUI is offline and only ComfyUI is allowed', async () => {
    await expect(
      generateImage({
        userId: 'u1',
        homebrewId: 'h1',
        type: 'character',
        name: 'Test',
        providersAllowed: ['comfyui'],
      }),
    ).rejects.toThrow(ProviderUnavailableError);

    await expect(
      generateImage({
        userId: 'u1',
        homebrewId: 'h1',
        type: 'character',
        name: 'Test',
        providersAllowed: ['comfyui'],
      }),
    ).rejects.toThrow(/ComfyUI/);
  });

  it('does not fall back to other providers when providersAllowed restricts the set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    await expect(
      generateImage({
        userId: 'u1',
        homebrewId: 'h1',
        type: 'character',
        name: 'Test',
        providersAllowed: ['comfyui'],
      }),
    ).rejects.toThrow(ProviderUnavailableError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/image-generation-providers-allowed.test.ts`
Expected: FAIL with `ProviderUnavailableError is not exported`.

- [ ] **Step 3: Add the error class and `providersAllowed` field**

At the top of `src/lib/ai/image-generation.ts`, add:

```ts
export class ProviderUnavailableError extends Error {
  constructor(public readonly providers: string[]) {
    super(
      `Image generation provider unavailable. Required: ${providers.join(', ')}. ` +
      `Make sure ComfyUI is running (docker compose up -d comfyui) and ` +
      `COMFYUI_URL is reachable.`,
    );
    this.name = 'ProviderUnavailableError';
  }
}
```

Extend `ImageGenerationRequest`:

```ts
export interface ImageGenerationRequest {
  // ... existing fields ...
  providersAllowed?: ImageGenerationResult['provider'][];
  width?: number;   // NEW — used by ComfyUI/Flux callers
  height?: number;  // NEW
  workflow?: 'sdxl' | 'flux';  // NEW — picks the ComfyUI workflow
}
```

In `generateImage()`, filter the providers list and throw the typed error when nothing is left:

```ts
export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const allowed = request.providersAllowed;
  const providers: Array<{
    name: string;
    enabled: boolean;
    fn: () => Promise<ImageGenerationResult>;
  }> = [
    // ... existing list unchanged ...
  ];

  const filtered = allowed
    ? providers.filter((p) => allowed.includes(p.name as ImageGenerationResult['provider']))
    : providers;

  const errors: string[] = [];
  let attempted = 0;

  for (const p of filtered) {
    if (!p.enabled) continue;
    if (p.name === 'comfyui' && !(await isComfyUIAvailable())) {
      console.log('[ImageGen] ComfyUI not available, skipping');
      continue;
    }
    attempted++;
    try {
      console.log(`[ImageGen] Trying provider: ${p.name}`);
      return await p.fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ImageGen] ${p.name} failed: ${msg}`);
      errors.push(`${p.name}: ${msg}`);
    }
  }

  if (allowed && attempted === 0) {
    throw new ProviderUnavailableError(allowed);
  }
  throw new Error(`All image generation providers failed. ${errors.join(' | ')}`);
}
```

- [ ] **Step 4: Wire the new fields through `generateWithComfyUI`**

Modify `generateWithComfyUI` to accept optional dimensions and workflow choice from the request:

```ts
async function generateWithComfyUI(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);
  const workflow = request.workflow ?? 'sdxl';
  const width = request.width ?? 1024;
  const height = request.height ?? 1024;

  const { promptId, seed } = await queueComfyUIPrompt(prompt, NEGATIVE_PROMPT, { workflow, width, height });
  const imageBuffer = await waitForComfyUIResult(promptId);

  const key = storageKey(request.userId, resolveEntityId(request));
  const url = await storage.upload(key, imageBuffer, 'image/png');
  const model = process.env.COMFYUI_MODEL || (workflow === 'flux' ? 'flux2-dev.safetensors' : 'sd_xl_base_1.0.safetensors');

  return {
    url,
    provider: 'comfyui',
    metadata: { prompt, generationTimeMs: Date.now() - start, model, seed, width, height, cfg: workflow === 'flux' ? 3.5 : 7, steps: workflow === 'flux' ? 28 : 20 },
  };
}
```

- [ ] **Step 5: Relax `resolveEntityId` for non-entity callers**

The visual-asset worker will pass `campaignId` instead of `homebrewId`/`npcId`. Allow that by extending `ImageGenerationRequest`:

```ts
export interface ImageGenerationRequest {
  homebrewId?: string;
  npcId?: string;
  campaignId?: string;     // NEW
  worldEntityId?: string;  // NEW
  worldEntryId?: string;   // NEW
  // ... rest unchanged ...
}
```

And update `resolveEntityId`:

```ts
function resolveEntityId(request: ImageGenerationRequest): string {
  const entityId = request.homebrewId ?? request.npcId ?? request.worldEntityId ?? request.worldEntryId ?? request.campaignId;
  if (!entityId) {
    throw new Error('Image generation requires one of: homebrewId, npcId, worldEntityId, worldEntryId, campaignId');
  }
  return entityId;
}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/lib/ai/__tests__/image-generation-providers-allowed.test.ts`
Expected: PASS (2/2).

- [ ] **Step 7: Verify no other unit tests broke**

Run: `npx vitest run src/lib/ai/`
Expected: all tests in the dir pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/image-generation.ts src/lib/ai/__tests__/image-generation-providers-allowed.test.ts
git commit -m "feat(image-gen): providersAllowed flag + ProviderUnavailableError + dimension/workflow passthrough"
git push origin main
```

---

## Task 4: `visual-asset-queue`

**Files:**
- Create: `src/lib/queue/visual-asset-queue.ts`

- [ ] **Step 1: Implement the queue**

Create `src/lib/queue/visual-asset-queue.ts`:

```ts
/**
 * Visual Asset Queue
 *
 * Background generation of home-page-visible images:
 * - campaign banner
 * - campaign emblem
 * - world activity thumbnails (WorldEntity / NPC / WorldEntry)
 *
 * ComfyUI-only (no fallback to paid providers). Single attempt — these are
 * user-initiated, so retries should come from the user clicking again rather
 * than from BullMQ.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export type VisualAssetSource = 'WorldEntity' | 'NPC' | 'WorldEntry';

export type VisualAssetJob =
  | { kind: 'campaign-banner';  campaignId: string; userId: string }
  | { kind: 'campaign-emblem';  campaignId: string; userId: string }
  | { kind: 'world-activity-thumb'; source: VisualAssetSource; id: string; campaignId: string; userId: string };

export const VISUAL_ASSET_QUEUE_NAME = 'visual-assets';

export const visualAssetQueue = new Queue<VisualAssetJob>(VISUAL_ASSET_QUEUE_NAME, {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueueVisualAsset(data: VisualAssetJob) {
  const id =
    data.kind === 'world-activity-thumb'
      ? `${data.kind}-${data.source}-${data.id}-${Date.now()}`
      : `${data.kind}-${data.campaignId}-${Date.now()}`;
  return visualAssetQueue.add(id, data, { jobId: id });
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue/visual-asset-queue.ts
git commit -m "feat(queue): visual-asset queue for home page image generation"
git push origin main
```

---

## Task 5: `visual-asset-worker`

**Files:**
- Create: `src/lib/queue/visual-asset-worker.ts`
- Modify: `package.json` — add `worker:visual-assets` script

- [ ] **Step 1: Write the worker**

Create `src/lib/queue/visual-asset-worker.ts`:

```ts
/**
 * BullMQ Worker for Visual Asset Generation
 * Run: npm run worker:visual-assets
 *
 * ComfyUI/Flux.2 only — fails fast if ComfyUI is offline.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { generateImage, ProviderUnavailableError } from '../ai/image-generation';
import { VISUAL_ASSET_QUEUE_NAME, type VisualAssetJob } from './visual-asset-queue';

const prisma = new PrismaClient();

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

function buildBannerPrompt(campaignName: string, description: string | null): string {
  const desc = description ? `, ${description.slice(0, 200)}` : '';
  return `D&D 5e fantasy art, atmospheric landscape, ${campaignName}${desc}, dramatic lighting, deep indigo and amber palette, cinematic wide composition, high quality digital painting`;
}

function buildEmblemPrompt(campaignName: string): string {
  return `heraldic shield emblem, fantasy crest, ornate metalwork, gold and dark steel, ${campaignName} sigil, centered composition, plain background, vector-style illustration, flat colors, symmetrical composition`;
}

function buildThumbPrompt(name: string, type: string, description: string | null): string {
  const desc = description ? `, ${description.slice(0, 150)}` : '';
  if (type === 'NPC' || type === 'PC') {
    return `D&D 5e character portrait, ${name}${desc}, dramatic lighting, square crop, head-and-shoulders framing`;
  }
  if (type === 'LOCATION') {
    return `D&D 5e fantasy environment, ${name}${desc}, moody lighting, square crop, establishing shot`;
  }
  return `D&D 5e fantasy concept art, ${type.toLowerCase()} sigil for ${name}${desc}, dramatic lighting, square crop`;
}

async function handleCampaignBanner(data: Extract<VisualAssetJob, { kind: 'campaign-banner' }>) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    select: { id: true, name: true, description: true },
  });
  if (!campaign) throw new Error(`Campaign ${data.campaignId} not found`);

  const result = await generateImage({
    userId: data.userId,
    campaignId: campaign.id,
    type: 'banner',
    name: campaign.name,
    description: campaign.description ?? undefined,
    prompt: buildBannerPrompt(campaign.name, campaign.description),
    providersAllowed: ['comfyui'],
    workflow: 'flux',
    width: 1280,
    height: 640,
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { bannerUrl: result.url },
  });
  console.log(`[VisualAssets] banner -> ${result.url}`);
}

async function handleCampaignEmblem(data: Extract<VisualAssetJob, { kind: 'campaign-emblem' }>) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    select: { id: true, name: true },
  });
  if (!campaign) throw new Error(`Campaign ${data.campaignId} not found`);

  const result = await generateImage({
    userId: data.userId,
    campaignId: campaign.id,
    type: 'emblem',
    name: campaign.name,
    prompt: buildEmblemPrompt(campaign.name),
    providersAllowed: ['comfyui'],
    workflow: 'flux',
    width: 512,
    height: 512,
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { emblemUrl: result.url },
  });
  console.log(`[VisualAssets] emblem -> ${result.url}`);
}

async function handleActivityThumb(data: Extract<VisualAssetJob, { kind: 'world-activity-thumb' }>) {
  if (data.source === 'WorldEntity') {
    const e = await prisma.worldEntity.findUnique({
      where: { id: data.id },
      select: { id: true, name: true, type: true, description: true, campaignId: true },
    });
    if (!e || e.campaignId !== data.campaignId) throw new Error(`WorldEntity ${data.id} not in campaign`);
    const result = await generateImage({
      userId: data.userId,
      worldEntityId: e.id,
      type: 'thumb',
      name: e.name,
      description: e.description ?? undefined,
      prompt: buildThumbPrompt(e.name, e.type, e.description),
      providersAllowed: ['comfyui'],
      workflow: 'flux',
      width: 256,
      height: 256,
    });
    await prisma.worldEntity.update({ where: { id: e.id }, data: { imageUrl: result.url } });
    console.log(`[VisualAssets] worldEntity ${e.name} -> ${result.url}`);
    return;
  }

  if (data.source === 'NPC') {
    const n = await prisma.nPC.findUnique({
      where: { id: data.id },
      select: { id: true, name: true, description: true, campaignId: true },
    });
    if (!n || n.campaignId !== data.campaignId) throw new Error(`NPC ${data.id} not in campaign`);
    const result = await generateImage({
      userId: data.userId,
      npcId: n.id,
      type: 'thumb',
      name: n.name,
      description: n.description ?? undefined,
      prompt: buildThumbPrompt(n.name, 'NPC', n.description),
      providersAllowed: ['comfyui'],
      workflow: 'flux',
      width: 256,
      height: 256,
    });
    await prisma.nPC.update({ where: { id: n.id }, data: { imageUrl: result.url } });
    console.log(`[VisualAssets] npc ${n.name} -> ${result.url}`);
    return;
  }

  if (data.source === 'WorldEntry') {
    const e = await prisma.worldEntry.findUnique({
      where: { id: data.id },
      select: { id: true, name: true, type: true, campaignId: true },
    });
    if (!e || e.campaignId !== data.campaignId) throw new Error(`WorldEntry ${data.id} not in campaign`);
    const result = await generateImage({
      userId: data.userId,
      worldEntryId: e.id,
      type: 'thumb',
      name: e.name,
      prompt: buildThumbPrompt(e.name, e.type, null),
      providersAllowed: ['comfyui'],
      workflow: 'flux',
      width: 256,
      height: 256,
    });
    await prisma.worldEntry.update({ where: { id: e.id }, data: { imageUrl: result.url } });
    console.log(`[VisualAssets] worldEntry ${e.name} -> ${result.url}`);
    return;
  }
}

const worker = new Worker<VisualAssetJob>(
  VISUAL_ASSET_QUEUE_NAME,
  async (job: Job<VisualAssetJob>) => {
    console.log(`[VisualAssets] Processing ${job.id}: ${JSON.stringify(job.data)}`);
    try {
      switch (job.data.kind) {
        case 'campaign-banner':
          await handleCampaignBanner(job.data);
          break;
        case 'campaign-emblem':
          await handleCampaignEmblem(job.data);
          break;
        case 'world-activity-thumb':
          await handleActivityThumb(job.data);
          break;
      }
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        console.error(`[VisualAssets] ComfyUI unavailable: ${err.message}`);
      }
      throw err;
    }
  },
  { connection: getRedisConnection() as any },
);

worker.on('completed', (job) => console.log(`[VisualAssets] completed ${job.id}`));
worker.on('failed',    (job, err) => console.error(`[VisualAssets] failed ${job?.id}: ${err.message}`));

console.log('[VisualAssets] Worker started, listening on queue', VISUAL_ASSET_QUEUE_NAME);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `worker:image` line, add:

```json
"worker:visual-assets": "tsx src/lib/queue/visual-asset-worker.ts",
```

- [ ] **Step 3: Verify the worker loads**

Run: `npm run worker:visual-assets` (background it or run for 5s and Ctrl+C).
Expected: prints `[VisualAssets] Worker started, listening on queue visual-assets` without crashing. Cancel with Ctrl+C.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue/visual-asset-worker.ts package.json
git commit -m "feat(worker): visual-asset worker — ComfyUI/Flux.2 only, ban+emblem+thumb"
git push origin main
```

---

## Task 6: tRPC mutations — `regenerateBanner`, `regenerateEmblem`, `regenerateActivityImage`

**Files:**
- Modify: `src/server/routers/campaigns.ts`
- Modify: `src/server/routers/world.ts`
- Create: `src/server/routers/__tests__/regenerate-visuals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/routers/__tests__/regenerate-visuals.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueVisualAsset } from '@/lib/queue/visual-asset-queue';
import { campaignsRouter } from '../campaigns';
import { worldRouter } from '../world';

vi.mock('@/lib/queue/visual-asset-queue', () => ({
  enqueueVisualAsset: vi.fn().mockResolvedValue({ id: 'job-mock-id' }),
}));

const mockCtx = {
  session: { user: { id: 'user-1', email: 'admin@test' } },
  membership: { campaignId: 'camp-1', role: 'OWNER' },
} as any;

describe('regenerate visual mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regenerateBanner enqueues a campaign-banner job', async () => {
    const caller = campaignsRouter.createCaller(mockCtx);
    const res = await caller.regenerateBanner({ campaignId: 'camp-1' });
    expect(enqueueVisualAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'campaign-banner', campaignId: 'camp-1', userId: 'user-1' }),
    );
    expect(res.jobId).toBe('job-mock-id');
  });

  it('regenerateEmblem enqueues a campaign-emblem job', async () => {
    const caller = campaignsRouter.createCaller(mockCtx);
    await caller.regenerateEmblem({ campaignId: 'camp-1' });
    expect(enqueueVisualAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'campaign-emblem' }),
    );
  });

  it('regenerateActivityImage enqueues a world-activity-thumb job', async () => {
    const caller = worldRouter.createCaller(mockCtx);
    await caller.regenerateActivityImage({
      campaignId: 'camp-1',
      source: 'WorldEntity',
      id: 'we-1',
    });
    expect(enqueueVisualAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'world-activity-thumb', source: 'WorldEntity', id: 'we-1' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/regenerate-visuals.test.ts`
Expected: FAIL with "regenerateBanner is not a function".

- [ ] **Step 3: Add the campaign mutations**

In `src/server/routers/campaigns.ts`, import the queue and add two mutations using `campaignDMProcedure`:

```ts
import { enqueueVisualAsset } from '@/lib/queue/visual-asset-queue';
// ...

regenerateBanner: campaignDMProcedure
  .input(z.object({ campaignId: z.string().min(1) }))
  .mutation(async ({ input, ctx }) => {
    if (process.env.NODE_ENV === 'production') {
      const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
      if (!adminEmails.includes(ctx.session.user.email ?? '')) {
        throw new ForbiddenError('Visual asset regeneration is not yet available in production');
      }
    }
    const job = await enqueueVisualAsset({
      kind: 'campaign-banner',
      campaignId: input.campaignId,
      userId: ctx.session.user.id,
    });
    return { jobId: String(job.id) };
  }),

regenerateEmblem: campaignDMProcedure
  .input(z.object({ campaignId: z.string().min(1) }))
  .mutation(async ({ input, ctx }) => {
    if (process.env.NODE_ENV === 'production') {
      const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
      if (!adminEmails.includes(ctx.session.user.email ?? '')) {
        throw new ForbiddenError('Visual asset regeneration is not yet available in production');
      }
    }
    const job = await enqueueVisualAsset({
      kind: 'campaign-emblem',
      campaignId: input.campaignId,
      userId: ctx.session.user.id,
    });
    return { jobId: String(job.id) };
  }),
```

- [ ] **Step 4: Add the world mutation**

In `src/server/routers/world.ts`, add the mutation alongside `getRecentActivity`:

```ts
import { enqueueVisualAsset } from '@/lib/queue/visual-asset-queue';

regenerateActivityImage: campaignDMProcedure
  .input(
    z.object({
      campaignId: z.string().min(1),
      source: z.enum(['WorldEntity', 'NPC', 'WorldEntry']),
      id: z.string().min(1),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (process.env.NODE_ENV === 'production') {
      const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
      if (!adminEmails.includes(ctx.session.user.email ?? '')) {
        throw new ForbiddenError('Visual asset regeneration is not yet available in production');
      }
    }
    const job = await enqueueVisualAsset({
      kind: 'world-activity-thumb',
      source: input.source,
      id: input.id,
      campaignId: input.campaignId,
      userId: ctx.session.user.id,
    });
    return { jobId: String(job.id) };
  }),
```

- [ ] **Step 5: Run test**

Run: `npx vitest run src/server/routers/__tests__/regenerate-visuals.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/server/routers/campaigns.ts src/server/routers/world.ts src/server/routers/__tests__/regenerate-visuals.test.ts
git commit -m "feat(trpc): regenerateBanner/Emblem + regenerateActivityImage mutations"
git push origin main
```

---

## Task 7: Extend `getRecentActivity` to return `imageUrl`

**Files:**
- Modify: `src/server/routers/world.ts`

- [ ] **Step 1: Extend each select clause**

In `src/server/routers/world.ts:71-110`, add `imageUrl: true` to each `select`:

```ts
prisma.worldEntity.findMany({
  // ...
  select: {
    id: true,
    name: true,
    type: true,
    imageUrl: true,
    createdAt: true,
    updatedAt: true,
  },
}),
prisma.nPC.findMany({
  // ...
  select: {
    id: true,
    name: true,
    imageUrl: true,
    createdAt: true,
    updatedAt: true,
  },
}),
prisma.worldEntry
  .findMany({
    // ...
    select: {
      id: true,
      name: true,
      type: true,
      slug: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  })
```

- [ ] **Step 2: Forward `imageUrl` on each item mapper**

Find where the `WorldActivityItem` shape is built (search for `source: 'WorldEntity' as const`) and add `imageUrl` to all three branches:

```ts
...entities.map((e) => ({
  id: e.id,
  source: 'WorldEntity' as const,
  type: e.type as string,
  name: e.name,
  imageUrl: e.imageUrl ?? null,
  // ... rest unchanged
})),
...npcs.map((n) => ({
  // ...
  imageUrl: n.imageUrl ?? null,
})),
...entries.map((e) => ({
  // ...
  imageUrl: e.imageUrl ?? null,
})),
```

- [ ] **Step 3: Update the `WorldActivityItem` type**

Find the type definition (top of `world.ts` or in `src/server/types`) and add `imageUrl: string | null`:

```ts
export interface WorldActivityItem {
  id: string;
  source: 'WorldEntity' | 'NPC' | 'WorldEntry';
  type: string;
  name: string;
  imageUrl: string | null;  // NEW
  status: 'Added' | 'Updated';
  changedAt: Date;
  href: string;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. The `WorldActivityFeed` component will type-error on the new field once consumed; that's fixed in Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/world.ts
git commit -m "feat(world): expose imageUrl on getRecentActivity items"
git push origin main
```

---

## Task 8: `RegenerateBannerButton` + wire into `HomeHero`

**Files:**
- Create: `src/components/home/RegenerateBannerButton.tsx`
- Modify: `src/components/home/HomeHero.tsx`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Create the button component**

Create `src/components/home/RegenerateBannerButton.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface RegenerateBannerButtonProps {
  campaignId: string
  currentBannerUrl: string | null | undefined
  onComplete?: () => void
}

export function RegenerateBannerButton({
  campaignId,
  currentBannerUrl,
  onComplete,
}: RegenerateBannerButtonProps) {
  const utils = trpc.useUtils()
  const [pending, setPending] = useState(false)
  const [bannerAtClick, setBannerAtClick] = useState<string | null | undefined>(null)

  const mutate = trpc.campaigns.regenerateBanner.useMutation({
    onSuccess: () => {
      setPending(true)
      setBannerAtClick(currentBannerUrl)
    },
    onError: (err) => {
      console.error('regenerateBanner failed', err)
      setPending(false)
    },
  })

  useEffect(() => {
    if (!pending) return
    const interval = setInterval(() => {
      void utils.campaigns.getMyMemberships.invalidate()
    }, 5000)
    const timeout = setTimeout(() => {
      setPending(false)
    }, 180_000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pending, utils])

  useEffect(() => {
    if (pending && currentBannerUrl && currentBannerUrl !== bannerAtClick) {
      setPending(false)
      onComplete?.()
    }
  }, [currentBannerUrl, bannerAtClick, pending, onComplete])

  return (
    <button
      type="button"
      disabled={pending || mutate.isLoading}
      onClick={() => mutate.mutate({ campaignId })}
      className={cn(
        'absolute right-4 top-4 z-20 inline-flex items-center gap-1.5',
        'rounded-sm border border-[var(--q-amber-dim)] bg-black/60 backdrop-blur',
        'px-2.5 py-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber)]',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        pending && 'opacity-100',
      )}
      data-testid="regenerate-banner"
    >
      {pending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
      {pending ? 'Generating' : 'Regenerate'}
    </button>
  )
}
```

- [ ] **Step 2: Wire into `HomeHero`**

Modify `src/components/home/HomeHero.tsx`:

1. Add `campaignId: string` and `isDM?: boolean` to `HomeHeroProps`.
2. Import the button: `import { RegenerateBannerButton } from './RegenerateBannerButton'`.
3. On the outer `Card`, ensure the className includes `group` (alongside the existing `relative overflow-hidden ...`):
   ```tsx
   className="!p-0 relative overflow-hidden group [clip-path:..."
   ```
4. Inside the right-column `<div className="relative hidden md:block min-h-full">`, add a shimmer overlay when generating. Add a sibling for the button at the Card root (not inside the right column):
   ```tsx
   {isDM && <RegenerateBannerButton campaignId={campaignId} currentBannerUrl={bannerUrl} />}
   ```

- [ ] **Step 3: Pass props from the page**

In `src/app/(app)/page.tsx:89-95`, change the `<HomeHero>` call:

```tsx
<HomeHero
  campaignId={active.id}
  campaignName={active.name}
  campaignSlug={active.slug}
  bannerUrl={active.bannerUrl}
  nextSession={active.nextSession}
  planningSession={planningSession}
  isDM={active.role === 'OWNER' || active.role === 'CO_DM'}
/>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/RegenerateBannerButton.tsx src/components/home/HomeHero.tsx src/app/(app)/page.tsx
git commit -m "feat(home): hover-reveal Regenerate Banner button on hero"
git push origin main
```

---

## Task 9: `RegenerateEmblemButton` + emblem rendering in `ActiveCampaignSummary`

**Files:**
- Create: `src/components/home/RegenerateEmblemButton.tsx`
- Modify: `src/components/home/ActiveCampaignSummary.tsx`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Create the emblem button**

Create `src/components/home/RegenerateEmblemButton.tsx` — same shape as `RegenerateBannerButton` but smaller and positioned over the 14×14 emblem slot:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface RegenerateEmblemButtonProps {
  campaignId: string
  currentEmblemUrl: string | null | undefined
}

export function RegenerateEmblemButton({
  campaignId,
  currentEmblemUrl,
}: RegenerateEmblemButtonProps) {
  const utils = trpc.useUtils()
  const [pending, setPending] = useState(false)
  const [emblemAtClick, setEmblemAtClick] = useState<string | null | undefined>(null)

  const mutate = trpc.campaigns.regenerateEmblem.useMutation({
    onSuccess: () => {
      setPending(true)
      setEmblemAtClick(currentEmblemUrl)
    },
    onError: (err) => {
      console.error('regenerateEmblem failed', err)
      setPending(false)
    },
  })

  useEffect(() => {
    if (!pending) return
    const interval = setInterval(() => {
      void utils.campaigns.getMyMemberships.invalidate()
    }, 5000)
    const timeout = setTimeout(() => setPending(false), 180_000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pending, utils])

  useEffect(() => {
    if (pending && currentEmblemUrl && currentEmblemUrl !== emblemAtClick) {
      setPending(false)
    }
  }, [currentEmblemUrl, emblemAtClick, pending])

  return (
    <button
      type="button"
      disabled={pending || mutate.isLoading}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        mutate.mutate({ campaignId })
      }}
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center',
        'bg-black/60 text-[var(--q-amber)] rounded-sm',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        pending && 'opacity-100',
      )}
      data-testid="regenerate-emblem"
      title={pending ? 'Generating emblem' : 'Regenerate emblem'}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
    </button>
  )
}
```

- [ ] **Step 2: Render emblem image + wire button in `ActiveCampaignSummary`**

Modify `src/components/home/ActiveCampaignSummary.tsx`:

1. Add to props:
   ```ts
   emblemUrl?: string | null
   campaignId?: string
   isDM?: boolean
   ```
2. Import: `import Image from 'next/image'` and `import { RegenerateEmblemButton } from './RegenerateEmblemButton'`.
3. Replace the existing 14×14 shield slot (`<div className="flex h-14 w-14 ...">`) with:

```tsx
<div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-[var(--q-amber-dim)] bg-[linear-gradient(160deg,var(--q-amber-trace),transparent)] group">
  {emblemUrl ? (
    <Image src={emblemUrl} alt="" fill sizes="56px" className="object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <Shield size={24} className="text-[var(--q-amber)]" />
    </div>
  )}
  {isDM && campaignId && (
    <RegenerateEmblemButton campaignId={campaignId} currentEmblemUrl={emblemUrl} />
  )}
</div>
```

- [ ] **Step 3: Pass props from the page**

In `src/app/(app)/page.tsx:98-103`, update:

```tsx
<ActiveCampaignSummary
  campaignId={active.id}
  name={active.name}
  slug={active.slug}
  ongoingSince={active.createdAt}
  sessionCount={active.sessionCount}
  emblemUrl={active.emblemUrl}
  isDM={active.role === 'OWNER' || active.role === 'CO_DM'}
/>
```

- [ ] **Step 4: Verify `emblemUrl` is included on `getMyMemberships` payload**

Open `src/server/routers/campaigns.ts`, find `getMyMemberships`, and confirm `emblemUrl: true` is in the campaign select. If missing, add it. Same for `bannerUrl` (should already be there).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/RegenerateEmblemButton.tsx src/components/home/ActiveCampaignSummary.tsx src/app/(app)/page.tsx src/server/routers/campaigns.ts
git commit -m "feat(home): emblem image + hover Regenerate button"
git push origin main
```

---

## Task 10: `RegenerateActivityButton` + thumbnails in `WorldActivityFeed`

**Files:**
- Create: `src/components/home/RegenerateActivityButton.tsx`
- Modify: `src/components/home/WorldActivityFeed.tsx`

- [ ] **Step 1: Create the activity button**

Create `src/components/home/RegenerateActivityButton.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface RegenerateActivityButtonProps {
  campaignId: string
  source: 'WorldEntity' | 'NPC' | 'WorldEntry'
  id: string
  currentImageUrl: string | null
}

export function RegenerateActivityButton({
  campaignId,
  source,
  id,
  currentImageUrl,
}: RegenerateActivityButtonProps) {
  const utils = trpc.useUtils()
  const [pending, setPending] = useState(false)
  const [urlAtClick, setUrlAtClick] = useState<string | null>(null)

  const mutate = trpc.world.regenerateActivityImage.useMutation({
    onSuccess: () => {
      setPending(true)
      setUrlAtClick(currentImageUrl)
    },
    onError: (err) => {
      console.error('regenerateActivityImage failed', err)
      setPending(false)
    },
  })

  useEffect(() => {
    if (!pending) return
    const interval = setInterval(() => {
      void utils.world.getRecentActivity.invalidate({ campaignId })
    }, 5000)
    const timeout = setTimeout(() => setPending(false), 180_000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pending, campaignId, utils])

  useEffect(() => {
    if (pending && currentImageUrl && currentImageUrl !== urlAtClick) {
      setPending(false)
    }
  }, [currentImageUrl, urlAtClick, pending])

  return (
    <button
      type="button"
      disabled={pending || mutate.isLoading}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        mutate.mutate({ campaignId, source, id })
      }}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-sm',
        'text-[var(--q-text-faint)] hover:text-[var(--q-amber)] hover:bg-white/[0.05]',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        pending && 'opacity-100',
      )}
      data-testid={`regenerate-activity-${id}`}
      title={pending ? 'Generating thumbnail' : 'Regenerate thumbnail'}
    >
      {pending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
    </button>
  )
}
```

- [ ] **Step 2: Render thumbnail + wire button in `WorldActivityFeed`**

Modify `src/components/home/WorldActivityFeed.tsx`:

1. Import: `import Image from 'next/image'`, `import { useCampaign } from '@/components/campaign/campaign-context'`, `import { RegenerateActivityButton } from './RegenerateActivityButton'`.
2. Inside the component, near the top, add: `const { isDM } = useCampaign()`.
3. Replace the row's `<Link>` block. The icon `<span>` becomes a thumbnail-or-fallback container; add the button to the right of the `Pill`:

```tsx
<li key={`${item.source}:${item.id}`}>
  <Link
    href={item.href}
    className="group flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-white/[0.03]"
  >
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/5 bg-[var(--q-amber-trace)]/30 text-[var(--q-amber-dim)]">
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt="" fill sizes="32px" className="object-cover" />
      ) : (
        <Icon size={14} />
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm text-[var(--q-text)]">{item.name}</span>
      <span className="block text-[10px] text-[var(--q-text-faint)]">{dateLabel(changed)}</span>
    </span>
    <Pill variant={item.status === 'Added' ? 'info' : 'neutral'}>{item.status}</Pill>
    {isDM && (
      <RegenerateActivityButton
        campaignId={campaignId}
        source={item.source}
        id={item.id}
        currentImageUrl={item.imageUrl}
      />
    )}
    <ChevronRight
      size={12}
      className="shrink-0 text-[var(--q-text-faint)] transition-colors group-hover:text-[var(--q-amber-dim)]"
    />
  </Link>
</li>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/RegenerateActivityButton.tsx src/components/home/WorldActivityFeed.tsx
git commit -m "feat(home): thumbnails + hover Regenerate on World Activity rows"
git push origin main
```

---

## Task 11: Hameria-Ire minimal seed

**Files:**
- Create: `scripts/seed-hameria-ire-min.ts`

- [ ] **Step 1: Write the seed**

Create `scripts/seed-hameria-ire-min.ts`:

```ts
// Usage: npx tsx scripts/seed-hameria-ire-min.ts
// Idempotent. Creates the Hameria-Ire campaign with a small set of NPCs
// and World Entities so the home page has content to render.
//
// Pulls names + descriptions from docs/hameria-ire-jsons/{NPCs,Locations,Factions}.json.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, WorldEntityType } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'tales-from-the-bonfire-keep';
const NAME = 'Tales from the Bonfire Keep';
const DESCRIPTION =
  'A campaign of frozen ash and dwindling embers — the Hameria Ire saga.';

const JSON_DIR = path.resolve(process.cwd(), 'docs/hameria-ire-jsons');

interface JsonRecord {
  name?: string;
  title?: string;
  description?: string;
  summary?: string;
  role?: string;
}

function loadJson(file: string): JsonRecord[] {
  const full = path.join(JSON_DIR, file);
  if (!fs.existsSync(full)) {
    console.warn(`[seed] Missing ${file}, skipping`);
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.entries)) return raw.entries;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

function nameOf(r: JsonRecord): string | null {
  return (r.name ?? r.title ?? '').trim() || null;
}

function descOf(r: JsonRecord): string | null {
  return (r.description ?? r.summary ?? '').trim() || null;
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAILS ?? '').split(',')[0]?.trim();
  if (!adminEmail) {
    throw new Error('Set ADMIN_EMAILS in .env.local — first email becomes the campaign owner.');
  }
  const owner = await prisma.user.findFirst({ where: { email: adminEmail } });
  if (!owner) {
    throw new Error(`No User row matches ADMIN_EMAILS[0] (${adminEmail}). Sign in once first.`);
  }

  const campaign = await prisma.campaign.upsert({
    where: { slug: SLUG },
    create: {
      name: NAME,
      slug: SLUG,
      description: DESCRIPTION,
      userId: owner.id,
      status: 'active',
      members: { create: { userId: owner.id, role: 'OWNER' } },
    },
    update: { name: NAME, description: DESCRIPTION },
    select: { id: true, name: true },
  });
  console.log(`[seed] Campaign: ${campaign.name} (${campaign.id})`);

  const npcs = loadJson('NPCs.json').slice(0, 5);
  for (const r of npcs) {
    const name = nameOf(r);
    if (!name) continue;
    await prisma.nPC.upsert({
      where: { campaignId_name: { campaignId: campaign.id, name } },
      create: {
        campaignId: campaign.id,
        name,
        description: descOf(r),
        role: r.role ?? null,
      },
      update: { description: descOf(r) },
    });
  }
  console.log(`[seed] NPCs upserted: ${npcs.length}`);

  const locations = loadJson('Locations.json').slice(0, 4);
  for (const r of locations) {
    const name = nameOf(r);
    if (!name) continue;
    await prisma.worldEntity.upsert({
      where: { campaignId_name_type: { campaignId: campaign.id, name, type: WorldEntityType.LOCATION } },
      create: {
        campaignId: campaign.id,
        name,
        type: WorldEntityType.LOCATION,
        description: descOf(r),
      },
      update: { description: descOf(r) },
    });
  }
  console.log(`[seed] Locations upserted: ${locations.length}`);

  const factions = loadJson('Factions.json').slice(0, 2);
  for (const r of factions) {
    const name = nameOf(r);
    if (!name) continue;
    await prisma.worldEntity.upsert({
      where: { campaignId_name_type: { campaignId: campaign.id, name, type: WorldEntityType.FACTION } },
      create: {
        campaignId: campaign.id,
        name,
        type: WorldEntityType.FACTION,
        description: descOf(r),
      },
      update: { description: descOf(r) },
    });
  }
  console.log(`[seed] Factions upserted: ${factions.length}`);

  console.log('[seed] Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify NPC has the unique `campaignId_name` index**

Run:
```bash
grep -n "@@unique" prisma/schema.prisma | grep -A0 "campaignId, name"
```

Expected: includes a line like `@@unique([campaignId, name])` on `NPC`. If not, the upsert key needs adjustment — fall back to `findFirst` + `create`/`update` pair.

- [ ] **Step 3: Run the seed**

Run: `npx tsx scripts/seed-hameria-ire-min.ts`
Expected: prints campaign id, then counts for NPCs/Locations/Factions, exits 0.

- [ ] **Step 4: Verify the rows exist**

Run:
```bash
python C:/Users/mail/.claude/skills/agent-skills/skills/read-only-postgres/scripts/query.py --db quiverdm-local --query "SELECT name FROM \"Campaign\" WHERE slug = 'tales-from-the-bonfire-keep'"
```
Expected: one row.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-hameria-ire-min.ts
git commit -m "feat(seed): minimal Hameria-Ire campaign + NPCs/Locations/Factions"
git push origin main
```

---

## Task 12: Workflow spec — DM-only buttons + optimistic state

**Files:**
- Create: `tests/workflows/home-visuals.workflow.spec.ts`

- [ ] **Step 1: Write the workflow spec**

Create `tests/workflows/home-visuals.workflow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestDM } from './_helpers/auth';

test.describe('Home page visual regeneration', () => {
  test('DM sees regenerate buttons on hover; non-DM does not', async ({ page }) => {
    await signInAsTestDM(page);
    await page.goto('/');

    await page.getByTestId('next-session-hero').hover();
    await expect(page.getByTestId('regenerate-banner')).toBeVisible();

    const emblemSlot = page.getByTestId('regenerate-emblem');
    expect(await emblemSlot.count()).toBeGreaterThan(0);
  });

  test('clicking regenerate-banner shows generating state', async ({ page }) => {
    await signInAsTestDM(page);
    await page.goto('/');

    await page.getByTestId('next-session-hero').hover();
    await page.getByTestId('regenerate-banner').click();

    await expect(page.getByTestId('regenerate-banner')).toContainText(/generating/i);
  });

  test('regenerate buttons are absent for non-DM viewer', async ({ page }) => {
    // Signed-in player on a campaign where they are PLAYER role
    // (helper sets up a fixture campaign accordingly)
    const { signInAsTestPlayer } = await import('./_helpers/auth');
    await signInAsTestPlayer(page);
    await page.goto('/');

    expect(await page.getByTestId('regenerate-banner').count()).toBe(0);
    expect(await page.getByTestId('regenerate-emblem').count()).toBe(0);
  });
});
```

- [ ] **Step 2: Verify `signInAsTestDM` and `signInAsTestPlayer` helpers exist**

Run: `grep -rn "signInAsTestDM\|signInAsTestPlayer" tests/workflows/_helpers/`
Expected: both helpers exist. If `signInAsTestPlayer` is missing, copy the `signInAsTestDM` pattern but assign PLAYER role to the seeded membership.

- [ ] **Step 3: Run the spec**

Run: `npm run test:workflows -- home-visuals.workflow.spec.ts`
Expected: PASS for all three tests.

- [ ] **Step 4: Commit**

```bash
git add tests/workflows/home-visuals.workflow.spec.ts
git commit -m "test(home-visuals): workflow spec for DM-only regenerate buttons"
git push origin main
```

---

## Task 13: Homelab worker registration

**Files:**
- Modify: `deploy/homelab/ecosystem.config.cjs`

- [ ] **Step 1: Find the existing PM2 worker entries**

Run: `grep -n "name:\|script:" deploy/homelab/ecosystem.config.cjs | head -30`
Expected: a list of `name: 'worker-...'` entries. Note the `script:` path pattern they use (`tsx src/lib/queue/...-worker.ts`).

- [ ] **Step 2: Add the new worker**

Add an entry following the pattern of `worker-meili-sync` (or `worker-image`):

```js
{
  name: 'worker-visual-assets',
  script: 'npx',
  args: 'tsx src/lib/queue/visual-asset-worker.ts',
  cwd: '/opt/quiverdm',
  env: { NODE_ENV: 'production' },
  max_restarts: 10,
  restart_delay: 5000,
},
```

(adjust the keys to match the exact shape used by surrounding entries — copy the closest existing one and rename.)

- [ ] **Step 3: Deploy**

Run:
```bash
ssh root@192.168.1.220 "pct exec 206 -- bash /opt/quiverdm/deploy/homelab/deploy.sh"
```
Expected: deploy script pulls the latest code and `pm2 restart all` brings up `worker-visual-assets`.

- [ ] **Step 4: Verify it's running**

Run:
```bash
ssh root@192.168.1.220 "pct exec 206 -- bash -c 'pm2 list | grep visual-assets'"
```
Expected: one row with `online` status.

- [ ] **Step 5: Commit**

```bash
git add deploy/homelab/ecosystem.config.cjs
git commit -m "deploy(homelab): register worker-visual-assets in PM2"
git push origin main
```

---

## Task 14: Manual smoke test + memory update

**Files:**
- Modify: `C:\Users\mail\.claude\projects\E--Projects-QuiverDM\memory\MEMORY.md`

- [ ] **Step 1: Run the local smoke test**

Sequence on the local dev machine:

```bash
docker compose up -d comfyui   # if not already running on homelab
npm run worker:visual-assets   # start the worker locally
npm run dev                    # start Next.js
```

Then in the browser:

1. Visit `http://localhost:3847`, sign in as the seed-owner user.
2. Switch to the `tales-from-the-bonfire-keep` campaign.
3. Hover the hero → click `Regenerate` → wait ~30-90s for Flux.2 to finish; the banner image should swap in.
4. Hover the emblem (left of the active campaign card title) → click `↻` → wait → emblem image appears.
5. Hover any World Activity row → click `↻` → wait → row thumbnail appears.

Expected: all three images render. Worker logs print prompt + URL.

- [ ] **Step 2: Verify ComfyUI-only failure mode**

```bash
docker compose stop comfyui
```

Click any regenerate button. Expected: the worker logs a `ProviderUnavailableError`; the UI shows the spinner for 3 minutes then resets (no fallback to a paid provider was attempted).

```bash
docker compose start comfyui
```

- [ ] **Step 3: Update MEMORY.md**

Add a one-liner to `MEMORY.md` under "Completed Features":

```
- Home Page Visuals via ComfyUI/Flux.2 (2026-05-10) — DM-only hover-regenerate on hero/emblem/activity. Plan: docs/superpowers/plans/2026-05-10-home-visuals-comfyui-impl.md
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/mail/.claude/projects/E--Projects-QuiverDM/memory
git add MEMORY.md  # if memory dir is git-tracked, otherwise just save
```

(Memory dir is typically not git-tracked — just save the file.)

---

## Self-Review

**Spec coverage check:**
- ✓ Schema additions (Campaign.emblemUrl, WorldEntity.imageUrl, WorldEntry.imageUrl) — Task 1
- ✓ Hameria-Ire bootstrap — Task 11
- ✓ ComfyUI-only generation flag — Task 3
- ✓ Flux.2 workflow — Task 2
- ✓ visual-asset queue + worker — Tasks 4, 5
- ✓ Three tRPC mutations — Task 6
- ✓ getRecentActivity returns imageUrl — Task 7
- ✓ HomeHero overlay — Task 8
- ✓ ActiveCampaignSummary emblem + overlay — Task 9
- ✓ WorldActivityFeed thumbnail + overlay — Task 10
- ✓ Storage keys (delegated to existing `storage.upload()` — no spec gap)
- ✓ Production gating — embedded in Task 6 mutations
- ✓ Test plan (workflow spec + unit tests) — Tasks 2, 3, 6, 12
- ✓ Deploy notes — Task 13

**Naming consistency:** `regenerateBanner`, `regenerateEmblem`, `regenerateActivityImage` — used identically in Tasks 6, 8, 9, 10, 12. `enqueueVisualAsset`, `VISUAL_ASSET_QUEUE_NAME`, `VisualAssetJob` — consistent across Tasks 4, 5, 6.

**No placeholders:** every code block is concrete; every command names exact files; no "TBD" or "similar to above" — all repeated patterns are spelled out.
