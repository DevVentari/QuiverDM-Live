# AI Scene Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn scene creation into a two-phase experience — the DM describes a moment and tags compendium entities; the AI writes player-facing narration + secret DM prep and assembles a board of the tagged entities, revealed in an audience-split two-column layout with async scene art.

**Architecture:** A new AI service (`generate-scene.ts`, mirroring `generate-statblock.ts`) returns validated JSON from `chatWithAI`. A context-gathering service loads tagged `WorldEntity`s + party `Character`s. The `scenes` tRPC router gains `generate`/`regenerate`/`taggableEntities`/`getStage` and becomes DM-scoped. Scene art reuses the existing `image-generation` BullMQ pipeline, extended with a `sceneId` target. The v3 Scenes page orchestrates a Compose → Loading → Reveal flow with Framer Motion.

**Tech Stack:** Next.js 15 App Router, tRPC v11 + Zod, Prisma/PostgreSQL, BullMQ/Redis, `chatWithAI` multi-provider, Framer Motion, Playwright (workflow spec).

**Source spec:** `docs/superpowers/specs/2026-06-16-ai-scene-creation-design.md`

---

## File Structure

**Create:**
- `src/lib/ai/generate-scene.ts` — AI call + Zod schema + JSON parse (pure, testable)
- `src/lib/ai/__tests__/generate-scene.test.ts`
- `src/server/services/scene-generation.service.ts` — context gather + regenerate-merge helper
- `src/server/services/__tests__/scene-generation.service.test.ts`
- `src/components/scenes/SceneCreateForm.tsx` — Phase 1 compose form
- `src/components/scenes/SceneStage.tsx` — Phase 2 two-column reveal
- `src/components/scenes/SceneLoading.tsx` — atmospheric loading state
- `src/components/scenes/scene-types.ts` — shared client types/constants
- `tests/workflows/scenes.workflow.spec.ts` — acceptance gate

**Modify:**
- `prisma/schema.prisma` — `Scene` new columns + `ImageGenerationJob.sceneId`
- `src/lib/queue/image-generation-queue.ts` — `sceneId` in payload type
- `src/lib/queue/image-generation-worker.ts` — scene writeback branch
- `src/server/routers/scenes.ts` — new procedures, DM scoping
- `src/app/v3/campaigns/[slug]/scenes/page.tsx` — orchestrate phases

---

## Task 1: Schema — extend Scene and ImageGenerationJob

**Files:**
- Modify: `prisma/schema.prisma:1009-1026` (Scene), `ImageGenerationJob` model
- Create (scratch, delete after): `scripts/sql/2026-06-16-scenes.sql`

- [ ] **Step 1: Edit the `Scene` model** — add new columns after `linkedEntityIds` (line 1021):

```prisma
  linkedEntityIds Json     @default("[]") // string[] of WorldEntity ids
  partyPresentIds Json     @default("[]") // string[] of Character ids present
  suggestedChecks Json     @default("[]") // [{ skill, dc, note }]
  entityBeats     Json     @default("{}") // { [entityId]: { wantsInScene, secret } }
  imageJobId      String?               // async scene-art ImageGenerationJob id
  generatedAt     DateTime?             // null = hand-authored / not AI-generated
  promptInput     Json?                 // raw form input, replayed by regenerate
```

- [ ] **Step 2: Edit the `ImageGenerationJob` model** — add `sceneId` field and index. After `npcId String?`:

```prisma
  npcId        String?
  sceneId      String?
```

And add to the `@@index` block:

```prisma
  @@index([sceneId, userId, status])
```

- [ ] **Step 3: Write the migration SQL** to `scripts/sql/2026-06-16-scenes.sql`:

```sql
ALTER TABLE "Scene" ADD COLUMN "partyPresentIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Scene" ADD COLUMN "suggestedChecks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Scene" ADD COLUMN "entityBeats" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Scene" ADD COLUMN "imageJobId" TEXT;
ALTER TABLE "Scene" ADD COLUMN "generatedAt" TIMESTAMP(3);
ALTER TABLE "Scene" ADD COLUMN "promptInput" JSONB;
ALTER TABLE "ImageGenerationJob" ADD COLUMN "sceneId" TEXT;
CREATE INDEX "ImageGenerationJob_sceneId_userId_status_idx" ON "ImageGenerationJob"("sceneId", "userId", "status");
```

- [ ] **Step 4: Apply the migration to the homelab DB.** Read `DATABASE_URL` from `.env.local` (the live homelab DB — `prisma db push` targets the dead `.env` DB, per CLAUDE.md):

Run:
```bash
npx prisma db execute --url "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" --file scripts/sql/2026-06-16-scenes.sql
```
Expected: `Script executed successfully.`

- [ ] **Step 5: Regenerate the Prisma client and typecheck.**

Run:
```bash
npx prisma generate && npx tsc --noEmit
```
Expected: client regenerates; tsc passes (the new fields are now on the `Scene` type — no errors from existing code).

- [ ] **Step 6: Delete the scratch SQL and commit.**

```bash
rm scripts/sql/2026-06-16-scenes.sql
git add prisma/schema.prisma
git commit -m "feat(scenes): schema for AI scene generation (board fields + scene art job)"
```

---

## Task 2: AI scene generation service (`generate-scene.ts`)

**Files:**
- Create: `src/lib/ai/generate-scene.ts`
- Test: `src/lib/ai/__tests__/generate-scene.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/ai/__tests__/generate-scene.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScene, type SceneContext } from '../generate-scene';
import * as chat from '../chat';

const CONTEXT: SceneContext = {
  intent: 'Party reaches the castle gates at dusk; Strahd watches unseen.',
  mood: 'theatre',
  tagged: [{ id: 'e1', name: 'Strahd', type: 'NPC', description: 'The vampire lord.', statSummary: 'CR 15' }],
  party: [{ name: 'Tharivol', summary: 'Elf wizard, lvl 7' }],
  campaignName: 'Curse of Strahd',
};

const VALID = JSON.stringify({
  title: 'The Gates of Ravenloft',
  type: 'theatre',
  readAloud: 'The portcullis groans...',
  dmNotes: 'Strahd is testing them.',
  musicCue: 'low dread strings',
  suggestedChecks: [{ skill: 'Perception', dc: 15, note: 'Spot the watcher.' }],
  entityBeats: { e1: { wantsInScene: 'Measure the party', secret: 'He already knows their names' } },
});

beforeEach(() => vi.restoreAllMocks());

describe('generateScene', () => {
  it('parses and validates a well-formed model response', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(VALID);
    const result = await generateScene(CONTEXT);
    expect(result.title).toBe('The Gates of Ravenloft');
    expect(result.suggestedChecks[0].dc).toBe(15);
    expect(result.entityBeats.e1.secret).toContain('names');
  });

  it('tolerates code fences around the JSON', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('```json\n' + VALID + '\n```');
    const result = await generateScene(CONTEXT);
    expect(result.type).toBe('theatre');
  });

  it('throws a readable error on malformed output', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('the vision faded');
    await expect(generateScene(CONTEXT)).rejects.toThrow(/could not be read/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run src/lib/ai/__tests__/generate-scene.test.ts`
Expected: FAIL — `Cannot find module '../generate-scene'`.

- [ ] **Step 3: Implement** `src/lib/ai/generate-scene.ts`:

```ts
/**
 * AI scene generation. Turns a DM's short description + tagged compendium
 * entities into a structured scene: player-facing read-aloud, secret DM prep,
 * a music cue, suggested checks, and per-entity beats. Mirrors the defensive
 * JSON-parse pattern in generate-statblock.ts. Validated, never trusted raw.
 */
import { z } from 'zod';
import { chatWithAI, type ChatMessage } from './chat';

export type SceneType = 'rp' | 'description' | 'tavern' | 'battle' | 'theatre';

export interface SceneContext {
  intent: string;
  mood?: SceneType;
  tagged: Array<{ id: string; name: string; type: string; description?: string; statSummary?: string }>;
  party: Array<{ name: string; summary: string }>;
  campaignName?: string;
}

const sceneSchema = z.object({
  title: z.string().min(1).max(160),
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']),
  readAloud: z.string().max(4000),
  dmNotes: z.string().max(4000),
  musicCue: z.string().max(160),
  suggestedChecks: z
    .array(z.object({ skill: z.string().max(40), dc: z.number().int().min(1).max(40), note: z.string().max(300) }))
    .max(8)
    .default([]),
  entityBeats: z
    .record(z.object({ wantsInScene: z.string().max(400), secret: z.string().max(400).nullable() }))
    .default({}),
});

export type GeneratedScene = z.infer<typeof sceneSchema>;

const SYSTEM_PROMPT = `You are a Dungeons & Dragons 5e co-DM. Given a scene description and the cast/locations present, write a single scene as STRICT JSON — no prose, no markdown fences.

Return exactly:
{
  "title": short evocative scene title,
  "type": one of "rp" | "description" | "tavern" | "battle" | "theatre",
  "readAloud": 2-4 sentences of PLAYER-FACING narration. Atmospheric, second person, NO secrets or hidden info,
  "dmNotes": secret DM prep — what is really going on, complications, how it could turn,
  "musicCue": a short evocative audio cue, e.g. "low dread strings",
  "suggestedChecks": array of { "skill": string, "dc": integer 1-30, "note": what it reveals },
  "entityBeats": object keyed by the EXACT entity id given, each { "wantsInScene": what they want here, "secret": a hidden fact or null }
}

Weave every tagged entity into the scene. Keep readAloud safe to read at the table. Put all hidden material in dmNotes / entityBeats.secret. Return ONLY the JSON object.`;

function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The vision returned nothing usable.');
  return JSON.parse(match[0]);
}

function buildUserMessage(ctx: SceneContext): string {
  const cast = ctx.tagged.length
    ? ctx.tagged
        .map((e) => `- [${e.id}] ${e.name} (${e.type})${e.statSummary ? ` — ${e.statSummary}` : ''}${e.description ? `: ${e.description}` : ''}`)
        .join('\n')
    : '- (none tagged)';
  const party = ctx.party.length ? ctx.party.map((p) => `- ${p.name}: ${p.summary}`).join('\n') : '- (none specified)';
  return [
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : '',
    ctx.mood ? `Mood: ${ctx.mood}` : '',
    `Scene description: ${ctx.intent.trim()}`,
    `Cast & locations present (use these exact ids in entityBeats):\n${cast}`,
    `Party present:\n${party}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateScene(
  ctx: SceneContext,
  options: { userId?: string } = {},
): Promise<GeneratedScene> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(ctx) },
  ];

  // Per CLAUDE.md: scenes are creative writing — force Claude for voice quality.
  const raw = await chatWithAI(messages, { temperature: 0.8, forceProvider: 'claude', userId: options.userId });

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    throw new Error('The generated scene could not be read. Try again or rephrase.');
  }

  const result = sceneSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('The generated scene could not be read. Try again or rephrase.');
  }
  return result.data;
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run src/lib/ai/__tests__/generate-scene.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/ai/generate-scene.ts src/lib/ai/__tests__/generate-scene.test.ts
git commit -m "feat(scenes): AI scene generation service with validated JSON output"
```

---

## Task 3: Scene-generation service — context gather + regenerate merge

**Files:**
- Create: `src/server/services/scene-generation.service.ts`
- Test: `src/server/services/__tests__/scene-generation.service.test.ts`

- [ ] **Step 1: Write the failing test** at `src/server/services/__tests__/scene-generation.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyRegeneration } from '../scene-generation.service';
import type { GeneratedScene } from '@/lib/ai/generate-scene';

const GEN: GeneratedScene = {
  title: 'New Title', type: 'rp', readAloud: 'NEW read', dmNotes: 'NEW notes',
  musicCue: 'NEW cue', suggestedChecks: [{ skill: 'Insight', dc: 12, note: 'lie' }],
  entityBeats: {},
};

const CURRENT = {
  title: 'Old Title', type: 'theatre', description: 'OLD read', dmNotes: 'OLD notes',
  musicCue: 'OLD cue', suggestedChecks: [{ skill: 'Perception', dc: 15, note: 'see' }],
};

describe('applyRegeneration', () => {
  it('section "all" replaces every generated field', () => {
    const patch = applyRegeneration(CURRENT, GEN, 'all');
    expect(patch.description).toBe('NEW read');
    expect(patch.dmNotes).toBe('NEW notes');
    expect(patch.musicCue).toBe('NEW cue');
  });

  it('section "readAloud" only overwrites the read-aloud', () => {
    const patch = applyRegeneration(CURRENT, GEN, 'readAloud');
    expect(patch.description).toBe('NEW read');
    expect(patch.dmNotes).toBeUndefined(); // untouched
    expect(patch.musicCue).toBeUndefined();
  });

  it('section "checks" only overwrites suggestedChecks', () => {
    const patch = applyRegeneration(CURRENT, GEN, 'checks');
    expect(patch.suggestedChecks).toEqual(GEN.suggestedChecks);
    expect(patch.description).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run src/server/services/__tests__/scene-generation.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/server/services/scene-generation.service.ts`:

```ts
/**
 * Server-side glue for AI scene generation: gathers prompt context from the
 * compendium + party, and merges (re)generated output into a Scene update.
 */
import { prisma } from '@/lib/prisma';
import type { GeneratedScene, SceneContext, SceneType } from '@/lib/ai/generate-scene';
import { Prisma } from '@prisma/client';

export type RegenSection = 'all' | 'readAloud' | 'dmNotes' | 'checks' | 'music';

export interface SceneFormInput {
  intent: string;            // the "describe the scene" text
  mood?: SceneType;
  linkedEntityIds: string[];
  partyPresentIds: string[];
}

/** Load tagged WorldEntities + party characters into a prompt context. */
export async function gatherSceneContext(
  campaignId: string,
  input: SceneFormInput,
): Promise<SceneContext> {
  const [campaign, entities, party] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } }),
    input.linkedEntityIds.length
      ? prisma.worldEntity.findMany({
          where: { id: { in: input.linkedEntityIds }, campaignId },
          select: {
            id: true, name: true, type: true, description: true,
            statBlock: { select: { name: true, data: true } },
          },
        })
      : Promise.resolve([]),
    input.partyPresentIds.length
      ? prisma.character.findMany({
          where: { id: { in: input.partyPresentIds } },
          select: { id: true, name: true, race: true, class: true, level: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    intent: input.intent,
    mood: input.mood,
    campaignName: campaign?.name,
    tagged: entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: String(e.type),
      description: e.description ?? undefined,
      statSummary: e.statBlock ? statSummary(e.statBlock.data) : undefined,
    })),
    party: party.map((c) => ({
      name: c.name,
      summary: [c.race, c.class, c.level ? `lvl ${c.level}` : null].filter(Boolean).join(' '),
    })),
  };
}

function statSummary(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const cr = d.cr ?? d.challengeRating;
  return cr != null ? `CR ${cr}` : undefined;
}

/** Build a Prisma Scene update patch for the chosen regenerate section. */
export function applyRegeneration(
  _current: unknown,
  gen: GeneratedScene,
  section: RegenSection,
): Prisma.SceneUpdateInput {
  const all: Prisma.SceneUpdateInput = {
    title: gen.title,
    type: gen.type,
    description: gen.readAloud,
    dmNotes: gen.dmNotes,
    musicCue: gen.musicCue,
    suggestedChecks: gen.suggestedChecks as Prisma.InputJsonValue,
    entityBeats: gen.entityBeats as Prisma.InputJsonValue,
  };
  switch (section) {
    case 'all': return all;
    case 'readAloud': return { description: gen.readAloud };
    case 'dmNotes': return { dmNotes: gen.dmNotes, entityBeats: gen.entityBeats as Prisma.InputJsonValue };
    case 'checks': return { suggestedChecks: gen.suggestedChecks as Prisma.InputJsonValue };
    case 'music': return { musicCue: gen.musicCue };
  }
}
```

> **Note on `Character` fields:** confirm `race`/`class`/`level` exist on the `Character` model (`prisma/schema.prisma:559`). If a field is named differently (e.g. `className`), adjust the `select` and `summary` accordingly — keep the join compact.

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run src/server/services/__tests__/scene-generation.service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/server/services/scene-generation.service.ts src/server/services/__tests__/scene-generation.service.test.ts
git commit -m "feat(scenes): scene context gatherer + regenerate-merge helper"
```

---

## Task 4: Scene art via the image pipeline (sceneId target)

**Files:**
- Modify: `src/lib/queue/image-generation-queue.ts:12-22`
- Modify: `src/lib/queue/image-generation-worker.ts:60-134`

- [ ] **Step 1: Add `sceneId` to the job payload type** — `image-generation-queue.ts`, inside `ImageGenerationJobData`:

```ts
export interface ImageGenerationJobData {
  jobId: string;
  homebrewId?: string;
  npcId?: string;
  sceneId?: string;
  userId: string;
  type: string;
  name: string;
  description?: string;
  imagePromptHint?: string;
  customPrompt?: string;
}
```

- [ ] **Step 2: Handle the scene target in the worker** — `image-generation-worker.ts`. Update the destructure + `targetId` (line 60-61):

```ts
    const { jobId, homebrewId, npcId, sceneId, userId, type, name, description, imagePromptHint, customPrompt } = job.data;
    const targetId = homebrewId ?? npcId ?? sceneId;
    if (!targetId) {
      throw new Error(`Job ${jobId} is missing homebrewId, npcId, and sceneId`);
    }
```

Add a scene success writeback after the `else if (homebrewId)` block (line 109):

```ts
      } else if (sceneId) {
        await prisma.scene.update({
          where: { id: sceneId },
          data: { imageUrl: result.url, imageJobId: null },
        });
      }
```

Add a scene failure writeback after the `if (homebrewId)` failure block (line 134):

```ts
      if (sceneId) {
        await prisma.scene.update({
          where: { id: sceneId },
          data: { imageJobId: null },
        }).catch(() => undefined);
      }
```

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit.** (Worker code — deploy to homelab after merge per CLAUDE.md.)

```bash
git add src/lib/queue/image-generation-queue.ts src/lib/queue/image-generation-worker.ts
git commit -m "feat(scenes): route image-generation jobs to Scene.imageUrl via sceneId"
```

---

## Task 5: Scenes router — generate, regenerate, taggableEntities, getStage, DM scoping

**Files:**
- Modify: `src/server/routers/scenes.ts` (full rewrite of the router)

- [ ] **Step 1: Rewrite** `src/server/routers/scenes.ts`:

```ts
import { z } from 'zod';
import { router, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateScene } from '@/lib/ai/generate-scene';
import {
  gatherSceneContext,
  applyRegeneration,
  type RegenSection,
} from '../services/scene-generation.service';
import { addImageGenerationJob } from '@/lib/queue/image-generation-queue';
import { NotFoundError } from '../errors';

const sceneFields = z.object({
  title: z.string().min(1).max(160),
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']).default('rp'),
  description: z.string().optional(),
  dmNotes: z.string().optional(),
  imageUrl: z.string().optional(),
  musicCue: z.string().optional(),
  orderIndex: z.number().optional(),
});

const generateInput = z.object({
  campaignId: z.string(),
  title: z.string().max(160).optional(),
  description: z.string().min(1).max(4000), // the DM's intent text
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']).optional(),
  linkedEntityIds: z.array(z.string()).default([]),
  partyPresentIds: z.array(z.string()).default([]),
});

/** Queue a scene-art job (establishing-shot style) and return its id. */
async function enqueueSceneArt(args: { sceneId: string; userId: string; title: string; readAloud: string }) {
  const job = await prisma.imageGenerationJob.create({
    data: { sceneId: args.sceneId, userId: args.userId, provider: 'auto', status: 'queued',
      prompt: 'Fantasy environment concept art, wide establishing shot, atmospheric lighting' },
  });
  await prisma.scene.update({ where: { id: args.sceneId }, data: { imageJobId: job.id } });
  await addImageGenerationJob({
    jobId: job.id, sceneId: args.sceneId, userId: args.userId, type: 'location',
    name: args.title, description: args.readAloud,
  });
  return job.id;
}

export const scenesRouter = router({
  list: campaignMemberProcedure.query(({ input }) =>
    prisma.scene.findMany({
      where: { campaignId: input.campaignId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }),
  ),

  /** WorldEntities the DM can tag into a scene. */
  taggableEntities: campaignMemberProcedure.query(({ input }) =>
    prisma.worldEntity.findMany({
      where: { campaignId: input.campaignId },
      select: { id: true, name: true, type: true, imageUrl: true },
      orderBy: { name: 'asc' },
    }),
  ),

  /** A scene plus its resolved board: tagged entities (with stat blocks) + party. */
  getStage: campaignMemberProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.id } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
      const entityIds = (scene.linkedEntityIds as string[]) ?? [];
      const partyIds = (scene.partyPresentIds as string[]) ?? [];
      const [entities, party] = await Promise.all([
        entityIds.length
          ? prisma.worldEntity.findMany({
              where: { id: { in: entityIds } },
              select: { id: true, name: true, type: true, description: true, imageUrl: true,
                statBlock: { select: { id: true, name: true, data: true } } },
            })
          : Promise.resolve([]),
        partyIds.length
          ? prisma.character.findMany({
              where: { id: { in: partyIds } },
              select: { id: true, name: true, imageUrl: true },
            })
          : Promise.resolve([]),
      ]);
      return { scene, entities, party };
    }),

  /** AI-generate a new scene from the DM's description + tags. */
  generate: campaignDMProcedure
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const context = await gatherSceneContext(input.campaignId, {
        intent: input.description,
        mood: input.type,
        linkedEntityIds: input.linkedEntityIds,
        partyPresentIds: input.partyPresentIds,
      });
      const gen = await generateScene(context, { userId: ctx.session.user.id });

      const scene = await prisma.scene.create({
        data: {
          campaignId: input.campaignId,
          title: input.title?.trim() || gen.title,
          type: gen.type,
          description: gen.readAloud,
          dmNotes: gen.dmNotes,
          musicCue: gen.musicCue,
          linkedEntityIds: input.linkedEntityIds as Prisma.InputJsonValue,
          partyPresentIds: input.partyPresentIds as Prisma.InputJsonValue,
          suggestedChecks: gen.suggestedChecks as Prisma.InputJsonValue,
          entityBeats: gen.entityBeats as Prisma.InputJsonValue,
          generatedAt: new Date(),
          promptInput: {
            intent: input.description, mood: input.type ?? null,
            linkedEntityIds: input.linkedEntityIds, partyPresentIds: input.partyPresentIds,
          } as Prisma.InputJsonValue,
        },
      });

      // Fire-and-forget scene art; never block the reveal on it.
      enqueueSceneArt({ sceneId: scene.id, userId: ctx.session.user.id, title: scene.title, readAloud: gen.readAloud })
        .catch((e) => console.error('[scenes.generate] art enqueue failed', e));

      return scene;
    }),

  /** Re-roll the whole scene or a single section, replaying the stored prompt. */
  regenerate: campaignDMProcedure
    .input(z.object({ id: z.string(), section: z.enum(['all', 'readAloud', 'dmNotes', 'checks', 'music']).default('all') }))
    .mutation(async ({ input, ctx }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.id } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
      const p = scene.promptInput as { intent: string; mood?: string | null; linkedEntityIds: string[]; partyPresentIds: string[] } | null;
      if (!p) throw new NotFoundError('scene prompt', input.id);

      const context = await gatherSceneContext(scene.campaignId, {
        intent: p.intent,
        mood: (p.mood as any) ?? undefined,
        linkedEntityIds: p.linkedEntityIds ?? [],
        partyPresentIds: p.partyPresentIds ?? [],
      });
      const gen = await generateScene(context, { userId: ctx.session.user.id });
      const patch = applyRegeneration(scene, gen, input.section as RegenSection);
      return prisma.scene.update({ where: { id: input.id }, data: patch });
    }),

  /** Inline edits to read-aloud / DM notes. */
  update: campaignDMProcedure
    .input(z.object({ id: z.string() }).merge(sceneFields.partial()))
    .mutation(({ input }) => {
      const { id, campaignId: _c, ...data } = input as typeof input & { campaignId: string };
      return prisma.scene.update({ where: { id }, data });
    }),

  /** Hand-authored scene (no AI). */
  create: campaignDMProcedure
    .input(sceneFields)
    .mutation(({ input, ctx: _ctx }) => {
      const { campaignId: _c, ...rest } = input as typeof input & { campaignId: string };
      return prisma.scene.create({ data: { campaignId: (input as any).campaignId, ...rest } });
    }),

  present: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } });
      return prisma.scene.update({ where: { id: input.id }, data: { isPresented: true } });
    }),

  clearPresented: campaignDMProcedure.mutation(({ input }) =>
    prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } }),
  ),

  delete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => prisma.scene.delete({ where: { id: input.id } })),
});
```

> **Why this shape:** `campaignMemberProcedure`/`campaignDMProcedure` already inject `campaignId` into the input schema and verify membership (`src/server/trpc.ts:139-174`), which closes the old `TODO(authz)`. `generate` does context→AI→persist→art in one call so the client gets a created scene id back for the reveal; art is fire-and-forget so the reveal never waits on image latency.

- [ ] **Step 2: Verify the router compiles and is wired.**

Run: `npx tsc --noEmit`
Expected: PASS. (`scenesRouter` is already registered in `src/server/routers/_app.ts` — no change needed.)

- [ ] **Step 3: Manually sanity-check the generate path** against a real campaign id (dev server running):

Run: `npm run dev` then, in the app, confirm `trpc.scenes.taggableEntities` returns entities for a campaign with WorldEntities. (No automated test here — covered by the workflow spec in Task 9.)

- [ ] **Step 4: Commit.**

```bash
git add src/server/routers/scenes.ts
git commit -m "feat(scenes): generate/regenerate/getStage/taggableEntities + DM scoping"
```

---

## Task 6: Shared client types + the Compose form (Phase 1)

**Files:**
- Create: `src/components/scenes/scene-types.ts`
- Create: `src/components/scenes/SceneCreateForm.tsx`

- [ ] **Step 1: Create shared types** `src/components/scenes/scene-types.ts`:

```ts
export const SCENE_TYPES = ['rp', 'description', 'tavern', 'battle', 'theatre'] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const MOOD_LABELS: Record<SceneType, string> = {
  rp: 'RP',
  description: 'Description',
  tavern: 'Tavern',
  battle: 'Combat',
  theatre: 'Set-piece',
};

export interface SceneFormState {
  title: string;
  mood: SceneType | null;
  partyPresentIds: string[];
  linkedEntityIds: string[];
  description: string;
}

export const EMPTY_SCENE_FORM: SceneFormState = {
  title: '', mood: null, partyPresentIds: [], linkedEntityIds: [], description: '',
};
```

- [ ] **Step 2: Create the form** `src/components/scenes/SceneCreateForm.tsx`. It owns form state, fetches party + taggable entities, and calls back on submit. Chip pickers use simple multi-select toggles:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { SCENE_TYPES, MOOD_LABELS, EMPTY_SCENE_FORM, type SceneFormState, type SceneType } from './scene-types';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const lab = `${mono} mb-1.5 block text-[9px] uppercase tracking-wide text-qd-ink-muted`;

export function SceneCreateForm({
  campaignId, onCreate, onCancel, pending,
}: {
  campaignId: string;
  onCreate: (form: SceneFormState) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [form, setForm] = useState<SceneFormState>(EMPTY_SCENE_FORM);
  const party = trpc.characters.getCampaignCharacters.useQuery({ campaignId }, { staleTime: 60_000 });
  const entities = trpc.scenes.taggableEntities.useQuery({ campaignId }, { staleTime: 60_000 });

  const toggle = (key: 'partyPresentIds' | 'linkedEntityIds', id: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));

  const canSubmit = form.description.trim().length > 0 && !pending;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-1 font-qd-display text-2xl text-qd-ink-strong">New scene</div>
      <p className="mb-5 text-qd-body-sm text-qd-ink-muted">Describe the moment. The world fills in the rest.</p>

      <label className={lab}>Title <span className="lowercase tracking-normal text-qd-ink-faint">— optional</span></label>
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Leave blank — the world will name it"
        className="mb-4 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
      />

      <label className={lab}>Party present</label>
      <ChipRow loading={party.isLoading}>
        {(party.data ?? []).map((c: { id: string; name: string }) => (
          <Chip key={c.id} on={form.partyPresentIds.includes(c.id)} onClick={() => toggle('partyPresentIds', c.id)}>
            {c.name}
          </Chip>
        ))}
      </ChipRow>

      <label className={`${lab} mt-4`}>In this scene — tag from the compendium</label>
      <ChipRow loading={entities.isLoading}>
        {(entities.data ?? []).map((e: { id: string; name: string; type: string }) => (
          <Chip key={e.id} on={form.linkedEntityIds.includes(e.id)} onClick={() => toggle('linkedEntityIds', e.id)}>
            {e.name}
          </Chip>
        ))}
      </ChipRow>
      <p className={`${mono} mt-1.5 text-[10px] italic text-qd-ink-faint`}>Whatever you tag, the AI pulls in and weaves into the scene.</p>

      <label className={`${lab} mt-4`}>Describe the scene</label>
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={4}
        placeholder="The party reaches the castle gates at dusk. Strahd is watching but won't reveal himself yet…"
        className="mb-4 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
      />

      <label className={lab}>Mood <span className="lowercase tracking-normal text-qd-ink-faint">— optional, inferred if blank</span></label>
      <ChipRow>
        {SCENE_TYPES.map((t: SceneType) => (
          <Chip key={t} on={form.mood === t} onClick={() => setForm({ ...form, mood: form.mood === t ? null : t })}>
            {MOOD_LABELS[t]}
          </Chip>
        ))}
      </ChipRow>

      <div className="mt-6 flex items-center gap-2.5">
        <button
          disabled={!canSubmit}
          onClick={() => onCreate(form)}
          className="rounded-qd-md bg-qd-accent px-5 py-2.5 font-qd-display text-[13px] font-bold text-qd-on-accent disabled:opacity-50"
        >
          ✦ {pending ? 'Setting the stage…' : 'Create scene'}
        </button>
        <button onClick={onCancel} className="rounded-qd-md border border-qd-strong px-4 py-2 font-qd-display text-[13px] text-qd-ink-2">Cancel</button>
      </div>
    </div>
  );
}

function ChipRow({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  if (loading) return <div className="text-qd-body-sm text-qd-ink-faint">Gathering…</div>;
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
      style={on
        ? { borderColor: 'var(--qd-border-accent)', background: 'rgba(217,138,61,.12)', color: 'var(--qd-accent-text)' }
        : { borderColor: 'var(--qd-border-strong)', background: 'rgba(255,255,255,.02)', color: 'var(--qd-ink-2)' }}
    >
      {children}
    </button>
  );
}
```

> **Note:** confirm `characters.getCampaignCharacters` returns objects with `id`/`name` (it does — `src/server/routers/characters.ts:71`). If the shape differs, adjust the `.map` accessors only.

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/components/scenes/scene-types.ts src/components/scenes/SceneCreateForm.tsx
git commit -m "feat(scenes): compose form with party + compendium tag pickers"
```

---

## Task 7: Loading state + the two-column reveal (Phase 2)

**Files:**
- Create: `src/components/scenes/SceneLoading.tsx`
- Create: `src/components/scenes/SceneStage.tsx`

- [ ] **Step 1: Create the loading state** `src/components/scenes/SceneLoading.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

const mono = 'font-[family-name:var(--qd-font-mono)]';

export function SceneLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <motion.div
        aria-hidden
        className="h-16 w-16 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(217,138,61,.5), transparent 70%)' }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className={`${mono} text-[11px] uppercase tracking-[0.18em] text-qd-accent-text`}>The world takes shape…</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the reveal** `src/components/scenes/SceneStage.tsx`. Left = player-facing (editable read-aloud + stage + present + art slot); right = DM board (party, NPC mini-cards, secret beats, checks, regenerate). Inline edit saves via `scenes.update`; art polls `homebrewImage.getJobStatus`:

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import type { RegenSection } from '@/server/services/scene-generation.service';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const pl = `${mono} mb-2 text-[8px] uppercase tracking-[0.12em]`;

type Check = { skill: string; dc: number; note: string };

export function SceneStage({ campaignId, sceneId }: { campaignId: string; sceneId: string }) {
  const utils = trpc.useUtils();
  const stage = trpc.scenes.getStage.useQuery({ campaignId, id: sceneId });
  const invalidate = () => utils.scenes.getStage.invalidate({ campaignId, id: sceneId });

  const update = trpc.scenes.update.useMutation({ onSuccess: invalidate });
  const present = trpc.scenes.present.useMutation({ onSuccess: () => { invalidate(); utils.scenes.list.invalidate({ campaignId }); } });
  const clear = trpc.scenes.clearPresented.useMutation({ onSuccess: () => { invalidate(); utils.scenes.list.invalidate({ campaignId }); } });
  const regenerate = trpc.scenes.regenerate.useMutation({ onSuccess: invalidate });

  if (stage.isLoading) return <div className="px-6 py-12 text-qd-ink-muted">Drawing the scene…</div>;
  if (stage.error || !stage.data) return <div className="px-6 py-12 text-qd-ink-muted">The threads tangled. Try again.</div>;

  const { scene, entities, party } = stage.data;
  const checks = (scene.suggestedChecks as Check[]) ?? [];
  const beats = (scene.entityBeats as Record<string, { wantsInScene: string; secret: string | null }>) ?? {};
  const regenPending = regenerate.isPending;

  const reroll = (section: RegenSection) => regenerate.mutate({ campaignId, id: sceneId, section });

  return (
    <motion.div
      className="grid gap-4 p-6 md:grid-cols-2"
      initial="hidden" animate="show"
      variants={{ show: { transition: { staggerChildren: 0.12 } } }}
    >
      {/* LEFT — player-facing */}
      <Column>
        <span className={`${mono} text-[9px] uppercase tracking-[0.12em] text-qd-accent-text`}>{scene.type}</span>
        <h1 className="mt-1 font-qd-display text-[30px] leading-tight text-qd-ink-strong">{scene.title}</h1>

        <div className="mt-3 flex gap-2.5">
          {scene.isPresented ? (
            <button onClick={() => clear.mutate({ campaignId })} className="rounded-qd-md border border-qd-accent bg-[rgba(217,138,61,0.12)] px-4 py-2 font-qd-display text-[13px] font-bold text-qd-accent-text">● Live — clear</button>
          ) : (
            <button onClick={() => present.mutate({ campaignId, id: sceneId })} className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">Present to players ▸</button>
          )}
        </div>

        <SceneArt scene={scene} />

        <EditableBlock
          label="Read aloud"
          value={scene.description ?? ''}
          display={<p className="font-qd-display text-qd-narration italic leading-relaxed text-qd-ink">{scene.description || 'No narration set.'}</p>}
          onSave={(v) => update.mutate({ campaignId, id: sceneId, description: v })}
          onRegenerate={() => reroll('readAloud')}
          regenPending={regenPending}
        />

        {scene.musicCue && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`${mono} text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted`}>🎵 cue</span>
            <span className="text-qd-body-sm text-qd-ink-2">{scene.musicCue}</span>
            <button onClick={() => reroll('music')} disabled={regenPending} className="text-qd-ink-faint hover:text-qd-accent-text">⟳</button>
          </div>
        )}
      </Column>

      {/* RIGHT — DM only */}
      <Column amber>
        <div className="flex items-center justify-between">
          <div className={`${pl} text-qd-accent-text`}>▸ DM only — the board</div>
          <button onClick={() => reroll('all')} disabled={regenPending} className={`${mono} text-[10px] text-qd-ink-faint hover:text-qd-accent-text`}>
            {regenPending ? 'Re-rolling…' : '⟳ Regenerate all'}
          </button>
        </div>

        {party.length > 0 && (
          <div className="mb-3">
            <div className={`${pl} text-qd-ink-muted`}>Party present</div>
            <div className="flex flex-wrap gap-2">
              {party.map((p: { id: string; name: string }) => (
                <span key={p.id} className="rounded-full border border-qd-faint px-2.5 py-1 text-[12px] text-qd-ink-2">{p.name}</span>
              ))}
            </div>
          </div>
        )}

        {entities.length > 0 && (
          <div className="mb-3">
            <div className={`${pl} text-qd-ink-muted`}>Cast & locations</div>
            <div className="flex flex-col gap-2">
              {entities.map((e: { id: string; name: string; type: string; statBlock: { id: string } | null }) => (
                <NpcCard key={e.id} entity={e} beat={beats[e.id]} />
              ))}
            </div>
          </div>
        )}

        <EditableBlock
          label="Secret beats"
          value={scene.dmNotes ?? ''}
          display={<p className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">{scene.dmNotes || 'No secret notes.'}</p>}
          onSave={(v) => update.mutate({ campaignId, id: sceneId, dmNotes: v })}
          onRegenerate={() => reroll('dmNotes')}
          regenPending={regenPending}
        />

        {checks.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className={`${pl} text-qd-ink-muted`}>Possible checks</div>
              <button onClick={() => reroll('checks')} disabled={regenPending} className="mb-2 text-qd-ink-faint hover:text-qd-accent-text">⟳</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {checks.map((c, i) => (
                <span key={i} className="rounded-full border border-qd-faint px-2.5 py-1 text-[11px] text-qd-ink-2" title={c.note}>{c.skill} DC {c.dc}</span>
              ))}
            </div>
          </div>
        )}
      </Column>
    </motion.div>
  );
}

function Column({ children, amber }: { children: React.ReactNode; amber?: boolean }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      className="rounded-qd-xl border p-5"
      style={amber
        ? { borderColor: 'var(--qd-border-accent)', background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))' }
        : { borderColor: 'var(--qd-border-faint)', background: 'var(--qd-grad-card), var(--qd-card)' }}
    >
      {children}
    </motion.div>
  );
}

function SceneArt({ scene }: { scene: { imageUrl: string | null; imageJobId: string | null } }) {
  const job = trpc.homebrewImage.getJobStatus.useQuery(
    { jobId: scene.imageJobId ?? '' },
    { enabled: !scene.imageUrl && !!scene.imageJobId, refetchInterval: 4000 },
  );
  const url = scene.imageUrl ?? job.data?.resultUrl;
  if (url) return <img src={url} alt="" className="mt-4 w-full rounded-qd-lg border border-qd-faint object-cover" />;
  if (scene.imageJobId && job.data?.status !== 'failed')
    return <div className="mt-4 h-40 w-full animate-pulse rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,.03)]" />;
  return null;
}

function NpcCard({ entity, beat }: {
  entity: { id: string; name: string; type: string; description?: string | null; statBlock: { id: string } | null };
  beat?: { wantsInScene: string; secret: string | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-qd-md border border-qd-faint p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-qd-display text-sm text-qd-ink-strong">{entity.name}</span>
        <span className={`${mono} text-[8px] uppercase tracking-wide text-qd-ink-faint`}>{entity.type}</span>
        {entity.statBlock && (
          <button onClick={() => setOpen((o) => !o)} className="ml-auto text-[10px] text-qd-accent-text">
            {open ? 'hide statblock' : 'reveal statblock'}
          </button>
        )}
      </div>
      {beat?.wantsInScene && <p className="mt-1 text-[12px] text-qd-ink-2"><span className="text-qd-ink-faint">wants:</span> {beat.wantsInScene}</p>}
      {beat?.secret && <p className="mt-0.5 text-[12px] text-qd-accent-text">secret: {beat.secret}</p>}
      {open && entity.statBlock && <StatBlockInline id={entity.statBlock.id} />}
    </div>
  );
}

function StatBlockInline({ id }: { id: string }) {
  const sb = trpc.homebrew.getById.useQuery({ id }, { staleTime: 300_000 });
  if (sb.isLoading) return <p className="mt-2 text-[11px] text-qd-ink-faint">Summoning…</p>;
  const d = (sb.data?.data as Record<string, unknown> | undefined) ?? {};
  return (
    <div className={`${mono} mt-2 rounded bg-[rgba(0,0,0,.25)] p-2 text-[11px] text-qd-ink-2`}>
      {[['AC', d.ac], ['HP', d.hp], ['CR', d.cr]].filter(([, v]) => v != null).map(([k, v]) => (
        <span key={k as string} className="mr-3">{k} {String(v)}</span>
      ))}
    </div>
  );
}

function EditableBlock({ label, value, display, onSave, onRegenerate, regenPending }: {
  label: string; value: string; display: React.ReactNode;
  onSave: (v: string) => void; onRegenerate: () => void; regenPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center gap-2">
        <span className={`${mono} text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted`}>{label}</span>
        <button onClick={() => { setDraft(value); setEditing((e) => !e); }} className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text">✎ edit</button>
        <button onClick={onRegenerate} disabled={regenPending} className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text">⟳ regenerate</button>
      </div>
      {editing ? (
        <div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4}
            className="w-full rounded-qd-md border border-qd-accent bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink focus:outline-none" />
          <div className="mt-1.5 flex gap-2">
            <button onClick={() => { onSave(draft); setEditing(false); }} className="rounded-qd-md bg-qd-accent px-3 py-1.5 text-[12px] font-bold text-qd-on-accent">Save</button>
            <button onClick={() => setEditing(false)} className="rounded-qd-md border border-qd-strong px-3 py-1.5 text-[12px] text-qd-ink-2">Cancel</button>
          </div>
        </div>
      ) : display}
    </div>
  );
}
```

> **Note:** confirm `homebrew.getById` exists and returns `{ data }` (the homebrew router). If the accessor differs, the statblock reveal is non-critical — degrade to showing just the entity name + beats.

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/components/scenes/SceneLoading.tsx src/components/scenes/SceneStage.tsx
git commit -m "feat(scenes): two-column reveal — player-facing left, DM board right"
```

---

## Task 8: Wire the page — Compose → Loading → Reveal

**Files:**
- Modify: `src/app/v3/campaigns/[slug]/scenes/page.tsx`

- [ ] **Step 1: Rewrite** `src/app/v3/campaigns/[slug]/scenes/page.tsx` to orchestrate the three phases. The left gallery + header stay; the right pane switches between gallery-detail, the compose form, the loading state, and the stage:

```tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { SceneCreateForm } from '@/components/scenes/SceneCreateForm';
import { SceneLoading } from '@/components/scenes/SceneLoading';
import { SceneStage } from '@/components/scenes/SceneStage';
import type { SceneFormState } from '@/components/scenes/scene-types';

const mono = 'font-[family-name:var(--qd-font-mono)]';

type Phase = { kind: 'idle' } | { kind: 'compose' } | { kind: 'loading' } | { kind: 'stage'; id: string };

interface SceneRow { id: string; title: string; type: string; isPresented: boolean }

export default function ScenesPage() {
  const { campaignId, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const scenes = trpc.scenes.list.useQuery({ campaignId }, { staleTime: 30_000 });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const generate = trpc.scenes.generate.useMutation({
    onSuccess: (scene) => {
      utils.scenes.list.invalidate({ campaignId });
      setSelectedId(scene.id);
      setPhase({ kind: 'stage', id: scene.id });
    },
    onError: () => setPhase({ kind: 'compose' }), // keep the form; surface error below
  });

  const rows = (scenes.data as SceneRow[] | undefined) ?? [];
  const stageId = phase.kind === 'stage' ? phase.id : selectedId ?? rows[0]?.id ?? null;

  const onCreate = (form: SceneFormState) => {
    setPhase({ kind: 'loading' });
    generate.mutate({
      campaignId,
      title: form.title.trim() || undefined,
      description: form.description.trim(),
      type: form.mood ?? undefined,
      linkedEntityIds: form.linkedEntityIds,
      partyPresentIds: form.partyPresentIds,
    });
  };

  if (scenes.isLoading) return <div className="px-8 py-16 text-qd-ink-muted">Setting the stage…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Scenes</div>
          <div className={`${mono} text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted`}>{rows.length} scenes · Theatre of the Mind</div>
        </div>
        <span className="flex-1" />
        {isDM && (
          <button onClick={() => { setPhase({ kind: 'compose' }); setSelectedId(null); }}
            className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">+ New Scene</button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          {rows.length === 0 && <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">No scenes set. The stage is dark.</p>}
          {rows.map((s) => {
            const active = phase.kind === 'stage' ? phase.id === s.id : stageId === s.id && phase.kind === 'idle';
            return (
              <button key={s.id} onClick={() => { setSelectedId(s.id); setPhase({ kind: 'stage', id: s.id }); }}
                className="rounded-qd-lg border p-2.5 text-left transition-colors"
                style={active
                  ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                  : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-qd-ink-strong">{s.title}</span>
                  {s.isPresented && <span className={`${mono} flex-none text-[8px] uppercase tracking-wide text-qd-accent-text`}>● live</span>}
                </div>
                <span className={`${mono} mt-1 block text-[8px] uppercase tracking-[0.1em] text-qd-ink-muted`}>{s.type}</span>
              </button>
            );
          })}
        </aside>

        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {phase.kind === 'compose' ? (
              <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                {generate.isError && <p className="mx-auto mb-3 max-w-xl text-qd-body-sm text-qd-danger-bright">The vision wouldn't hold — try again.</p>}
                <SceneCreateForm campaignId={campaignId} pending={generate.isPending} onCreate={onCreate} onCancel={() => setPhase({ kind: 'idle' })} />
              </motion.div>
            ) : phase.kind === 'loading' ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SceneLoading />
              </motion.div>
            ) : stageId ? (
              <motion.div key={stageId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SceneStage campaignId={campaignId} sceneId={stageId} />
              </motion.div>
            ) : (
              <p key="empty" className="p-6 text-qd-ink-muted">Choose a scene, or set a new one.</p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + build.**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual smoke test** with `npm run dev` (port 3847): open a campaign's Scenes, click **+ New Scene**, tag an NPC + a party member, write a description, **Create** → confirm the loading state then the two-column reveal; edit the read-aloud and Save; click **Regenerate** on DM notes; **Present to players**.

- [ ] **Step 4: Commit.**

```bash
git add src/app/v3/campaigns/\[slug\]/scenes/page.tsx
git commit -m "feat(scenes): orchestrate compose -> loading -> reveal on the scenes page"
```

---

## Task 9: Workflow spec (acceptance gate)

**Files:**
- Create: `tests/workflows/scenes.workflow.spec.ts`

> **REQUIRED SUB-SKILL:** use `workflow-spec` for the project's Playwright conventions (auth helper, selectors, network mocking). Mock the `scenes.generate` tRPC call at the network boundary with a deterministic fixture so the test never hits a live AI provider.

- [ ] **Step 1: Write the spec** `tests/workflows/scenes.workflow.spec.ts`. Follow the existing pattern in `tests/workflows/v3-screens.workflow.spec.ts` for app navigation + the auth helper in `tests/helpers/auth.ts`. Structure:

```ts
import { test, expect } from '@playwright/test';
import { signInAsDM } from '../helpers/auth'; // match the helper actually exported

// Deterministic scene the mocked generate returns.
const FIXTURE_SCENE = {
  id: 'scene_test_1', title: 'The Gates of Ravenloft', type: 'theatre',
  description: 'The portcullis groans...', dmNotes: 'Strahd is testing them.',
  musicCue: 'low dread strings', isPresented: false,
  linkedEntityIds: [], partyPresentIds: [], suggestedChecks: [], entityBeats: {},
  imageUrl: null, imageJobId: null,
};

test.describe('Scenes — AI creation experience', () => {
  test('DM composes, generates, edits, and presents a scene', async ({ page }) => {
    await signInAsDM(page);

    // Mock the AI generate mutation so the test is deterministic + offline.
    await page.route('**/api/trpc/scenes.generate**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { json: FIXTURE_SCENE } } }]),
      });
    });
    await page.route('**/api/trpc/scenes.getStage**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { json: { scene: FIXTURE_SCENE, entities: [], party: [] } } } }]),
      });
    });

    await page.goto('/v3/campaigns/<seed-slug>/scenes'); // use the seeded campaign slug

    await page.getByRole('button', { name: '+ New Scene' }).click();
    await page.getByPlaceholder(/the party reaches/i).fill('Party reaches the castle gates at dusk.');
    await page.getByRole('button', { name: /create scene/i }).click();

    // Reveal: two-column stage with the generated title + read-aloud.
    await expect(page.getByRole('heading', { name: 'The Gates of Ravenloft' })).toBeVisible();
    await expect(page.getByText('The portcullis groans...')).toBeVisible();
    await expect(page.getByText('Strahd is testing them.')).toBeVisible(); // DM board (DM view)

    // Present to players toggles live state.
    await page.getByRole('button', { name: /present to players/i }).click();
    await expect(page.getByText(/Live — clear/i)).toBeVisible();
  });
});
```

> Replace `<seed-slug>`, `signInAsDM`, and the tRPC response envelope to match this repo's actual helpers and superjson batching (inspect a real `/api/trpc` response in `v3-screens.workflow.spec.ts`). The envelope above is the superjson `{ json: ... }` shape tRPC v11 uses.

- [ ] **Step 2: Run the spec.**

Run: `npx playwright test tests/workflows/scenes.workflow.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run the full gate.**

Run: `npm run qa:cycle`
Expected: PASS (no `test.fixme`, all personas + workflows green).

- [ ] **Step 4: Commit.**

```bash
git add tests/workflows/scenes.workflow.spec.ts
git commit -m "test(scenes): workflow spec for AI scene creation (acceptance gate)"
```

---

## Task 10: Persona update + deploy note

**Files:**
- Modify: `tests/personas/veteran-dm.persona.spec.ts` (or the closest existing veteran/power persona)

- [ ] **Step 1:** Add a rapid-prep step to the veteran-DM persona: create an AI scene mid-prep and present it. Reuse the mocking approach from Task 9. Keep it to the persona's existing structure.

- [ ] **Step 2: Run the persona.**

Run: `npx playwright test tests/personas/veteran-dm.persona.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add tests/personas/veteran-dm.persona.spec.ts
git commit -m "test(scenes): veteran-DM persona creates and presents an AI scene"
```

- [ ] **Step 4: Post-merge deploy.** The image worker changed (Task 4) — after merging, SSH to homelab and run `bash /opt/quiverdm/deploy/homelab/deploy.sh` so the `image-generation` worker picks up the `sceneId` writeback. (Per CLAUDE.md "After pushing worker code".)

---

## Self-Review (completed during planning)

- **Spec coverage:** Writer+Board (Tasks 2,5,7) ✓ · audience split (Task 7) ✓ · inline crafted loading (Tasks 7,8) ✓ · form fields incl. optional title/party/tags/mood (Task 6) ✓ · AI music cue + async art (Tasks 4,5,7) ✓ · editable draft + per-section regenerate (Tasks 3,5,7) ✓ · data-model deltas (Task 1) ✓ · authz (Task 5 closes the `TODO(authz)`) ✓ · workflow spec + persona (Tasks 9,10) ✓.
- **Placeholder scan:** the two `<seed-slug>` / helper-name markers in Task 9 are explicit "match the real repo" instructions, not unfilled TODOs — the surrounding code is complete.
- **Type consistency:** `GeneratedScene`/`SceneContext`/`RegenSection` defined in Tasks 2-3 are reused unchanged in Task 5; `SceneFormState` (Task 6) flows into `generate` input (Task 8); `scenes.generate`/`getStage`/`regenerate` signatures match between router (Task 5) and components (Tasks 6-8).

## Open verification points (flagged inline for the implementer)

1. `Character` field names (`race`/`class`/`level`) — Task 3.
2. `characters.getCampaignCharacters` return shape — Task 6.
3. `homebrew.getById` returning `{ data }` for the statblock reveal — Task 7 (non-critical; degrade gracefully).
4. tRPC/superjson response envelope + auth helper names for the Playwright mocks — Task 9.
