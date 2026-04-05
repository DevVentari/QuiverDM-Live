# RecapForge Phase 5 — Summary Generation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a BullMQ worker that generates session recaps in four styles via the Anthropic API, expose them through a tRPC router, and surface them as a tab preview on the session detail page plus a standalone full-screen recap page.

**Architecture:** The `recap.generate` mutation creates a `SessionRecap` record at `GENERATING` status and enqueues a BullMQ job. The worker fetches the transcript + campaign context, calls `claude-sonnet-4-6`, parses the sectioned JSON response, and updates the record to `AUTO_GENERATED`. Speaker mapping step auto-triggers a NARRATIVE recap after mappings are saved. UI uses polling (`refetchInterval: 3000`) while any recap is `GENERATING`.

**Tech Stack:** BullMQ, Anthropic SDK (`@anthropic-ai/sdk` — already in package.json), tRPC v11, Prisma, Next.js 15 App Router, React, shadcn/ui

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/recap/recap-prompts.ts` | Prompt templates + section shape constants for all 4 styles |
| Create | `tests/unit/recap/recap-prompts.test.ts` | Unit tests for prompt builder |
| Create | `src/lib/queue/recap-generation-queue.ts` | BullMQ queue definition + job types |
| Modify | `src/server/websocket.ts` | Add `broadcastRecapComplete` |
| Create | `src/server/routers/recap.ts` | tRPC router: `generate`, `getBySession`, `getById`, `regenerate`, `exportMarkdown` |
| Modify | `src/server/routers/_app.ts` | Register `recap` router |
| Create | `src/lib/queue/recap-generation-worker.ts` | Generation worker: Anthropic → parse → upsert → broadcast |
| Modify | `package.json` | Add `worker:recap-generation` script |
| Modify | `deploy/hetzner/start-workers.sh` | Add recap-generation worker process |
| Modify | `src/components/recap/speaker-mapping-step.tsx` | Add `sessionId` prop + auto-trigger `recap.generate` after save |
| Modify | `src/components/recap/multi-track-progress.tsx` | Pass `sessionId` to `SpeakerMappingStep` |
| Create | `src/components/recap/recap-card.tsx` | Compact recap preview card for session detail page |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | Add `RecapCard` after `TranscriptSection` |
| Create | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx` | Full-screen standalone recap page |
| Create | `tests/workflows/recapforge-generation.workflow.spec.ts` | E2E workflow stubs |

---

## Task 1: Prompt Templates + Unit Tests

**Files:**
- Create: `src/lib/recap/recap-prompts.ts`
- Create: `tests/unit/recap/recap-prompts.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/recap/recap-prompts.test.ts
import { describe, it, expect } from 'vitest';
import { buildRecapPrompt, SECTION_SHAPES } from '@/lib/recap/recap-prompts';

const BASE_CTX = {
  correctedText: 'The party fought a dragon.',
  speakersJson: '[{"name":"Aria"}]',
  campaignContext: 'Previously the party explored the dungeon.',
};

describe('buildRecapPrompt', () => {
  it('returns non-empty system and user strings for every style', () => {
    for (const style of Object.keys(SECTION_SHAPES) as Array<keyof typeof SECTION_SHAPES>) {
      const { system, user } = buildRecapPrompt({ ...BASE_CTX, style });
      expect(system.length).toBeGreaterThan(0);
      expect(user.length).toBeGreaterThan(0);
    }
  });

  it('includes all section keys and titles for NARRATIVE', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'NARRATIVE' });
    for (const section of SECTION_SHAPES.NARRATIVE) {
      expect(user).toContain(section.key);
      expect(user).toContain(section.title);
    }
  });

  it('includes all section keys and titles for SESSION_LOG', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'SESSION_LOG' });
    for (const section of SECTION_SHAPES.SESSION_LOG) {
      expect(user).toContain(section.key);
      expect(user).toContain(section.title);
    }
  });

  it('includes section key for BARDS_TALE', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'BARDS_TALE' });
    expect(user).toContain('tale');
  });

  it('includes section key for PREVIOUSLY_ON', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'PREVIOUSLY_ON' });
    expect(user).toContain('cold_open');
  });

  it('includes campaign context in user prompt', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'NARRATIVE' });
    expect(user).toContain('Previously the party explored the dungeon.');
  });

  it('falls back to placeholder when campaignContext is empty', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, campaignContext: '', style: 'NARRATIVE' });
    expect(user).toContain('No prior context available.');
  });

  it('includes JSON sections instruction in every style', () => {
    for (const style of Object.keys(SECTION_SHAPES) as Array<keyof typeof SECTION_SHAPES>) {
      const { user } = buildRecapPrompt({ ...BASE_CTX, style });
      expect(user).toContain('"sections"');
    }
  });

  it('system prompt instructs JSON-only response', () => {
    const { system } = buildRecapPrompt({ ...BASE_CTX, style: 'NARRATIVE' });
    expect(system).toContain('JSON');
    expect(system).toContain('no prose');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/recap/recap-prompts.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/recap/recap-prompts'"

- [ ] **Step 3: Implement the prompt templates**

```ts
// src/lib/recap/recap-prompts.ts

export const SECTION_SHAPES = {
  NARRATIVE: [
    { key: 'setup', title: 'Setting the Scene' },
    { key: 'key_events', title: 'What Unfolded' },
    { key: 'resolution', title: 'Resolution' },
    { key: 'cliffhanger', title: 'To Be Continued' },
  ],
  SESSION_LOG: [
    { key: 'key_events', title: 'Key Events' },
    { key: 'npcs_met', title: 'NPCs Met' },
    { key: 'decisions', title: 'Decisions Made' },
    { key: 'loot', title: 'Loot & Rewards' },
  ],
  BARDS_TALE: [
    { key: 'tale', title: "The Bard's Tale" },
  ],
  PREVIOUSLY_ON: [
    { key: 'cold_open', title: 'Previously On\u2026' },
  ],
} as const;

export type RecapStyleKey = keyof typeof SECTION_SHAPES;

const SYSTEM_PROMPT =
  'You are an expert D&D session recorder. Respond ONLY with valid JSON \u2014 no prose, no markdown fencing, no explanation.';

const STYLE_INSTRUCTIONS: Record<RecapStyleKey, string> = {
  NARRATIVE:
    'Write a dramatic third-person narrative (~150 words per section) that reads like a novel excerpt.',
  SESSION_LOG:
    'Write a structured session log. key_events as a numbered list. All other sections as bullet points (~80 words per section).',
  BARDS_TALE:
    "Write a first-person bard's account, theatrical and entertaining, as told at a tavern (~300 words).",
  PREVIOUSLY_ON:
    'Write a 3\u20134 sentence cold-open recap, punchy and dramatic, suitable for reading aloud at the start of the next session (~60 words total).',
};

export interface RecapPromptContext {
  correctedText: string;
  speakersJson: string;
  campaignContext: string;
  style: RecapStyleKey;
}

export function buildRecapPrompt(ctx: RecapPromptContext): { system: string; user: string } {
  const shapes = SECTION_SHAPES[ctx.style];
  const sectionSpec = shapes
    .map((s) => `  { "key": "${s.key}", "title": "${s.title}", "content": "..." }`)
    .join(',\n');

  const user = `Generate a D&D session recap in the "${ctx.style}" style.
${STYLE_INSTRUCTIONS[ctx.style]}

CAMPAIGN CONTEXT (prior sessions):
${ctx.campaignContext || 'No prior context available.'}

SPEAKERS:
${ctx.speakersJson}

TRANSCRIPT:
${ctx.correctedText}

Respond with this exact JSON structure \u2014 fill each "content" field, keep keys and titles verbatim:
{
  "sections": [
${sectionSpec}
  ]
}`;

  return { system: SYSTEM_PROMPT, user };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/recap/recap-prompts.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/recap/recap-prompts.ts tests/unit/recap/recap-prompts.test.ts
git commit -m "feat(recap): prompt templates and section shapes for all 4 styles"
```

---

## Task 2: Queue Definition + WebSocket Broadcast

**Files:**
- Create: `src/lib/queue/recap-generation-queue.ts`
- Modify: `src/server/websocket.ts` (append one export function)

- [ ] **Step 1: Create the queue file**

```ts
// src/lib/queue/recap-generation-queue.ts
import 'dotenv/config';
import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface RecapGenerationJobData {
  recapId: string;
  transcriptId: string;
  campaignId: string;
  sessionId: string;
  style: string;
}

export interface RecapGenerationJobResult {
  success: boolean;
  recapId: string;
  tokensUsed?: number;
}

export const recapGenerationQueue = new Queue<RecapGenerationJobData, RecapGenerationJobResult>(
  'recap-generation',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  }
);
```

- [ ] **Step 2: Add `broadcastRecapComplete` to websocket.ts**

Open `src/server/websocket.ts`. After the last `broadcastMultiTrackError` function (around line 645), append:

```ts
export function broadcastRecapComplete(sessionId: string, recapId: string) {
  broadcastToJobSubscribers(sessionId, {
    type: 'recap:complete',
    sessionId,
    recapId,
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors related to new files

- [ ] **Step 4: Commit**

```bash
git add src/lib/queue/recap-generation-queue.ts src/server/websocket.ts
git commit -m "feat(recap): queue definition and broadcastRecapComplete"
```

---

## Task 3: tRPC Router + Register in App Router

**Files:**
- Create: `src/server/routers/recap.ts`
- Modify: `src/server/routers/_app.ts`

Context: all campaign procedures are in `src/server/trpc.ts`. `campaignDMProcedure` requires `campaignId` in input and validates DM role via middleware. Project error types are in `src/server/errors/` — use `NotFoundError` (not `TRPCError`). Prisma client is `import { prisma } from '@/lib/prisma'`.

- [ ] **Step 1: Create the router**

```ts
// src/server/routers/recap.ts
import { z } from 'zod';
import { router } from '../trpc';
import { campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { recapGenerationQueue } from '@/lib/queue/recap-generation-queue';
import { NotFoundError } from '../errors';

const RecapStyleEnum = z.enum(['NARRATIVE', 'SESSION_LOG', 'BARDS_TALE', 'PREVIOUSLY_ON']);

export const recapRouter = router({
  generate: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string(),
        transcriptId: z.string(),
        style: RecapStyleEnum,
      })
    )
    .mutation(async ({ input }) => {
      const recap = await prisma.sessionRecap.create({
        data: {
          sessionId: input.sessionId,
          campaignId: input.campaignId,
          style: input.style,
          status: 'GENERATING',
          sections: [],
          rawContent: '',
          clarificationSkipped: true,
        },
      });
      await recapGenerationQueue.add('generate', {
        recapId: recap.id,
        transcriptId: input.transcriptId,
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        style: input.style,
      });
      return { recapId: recap.id };
    }),

  getBySession: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return prisma.sessionRecap.findMany({
        where: { campaignId: input.campaignId, sessionId: input.sessionId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getById: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);
      return recap;
    }),

  regenerate: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
        style: RecapStyleEnum,
      })
    )
    .mutation(async ({ input }) => {
      const source = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
      });
      if (!source) throw new NotFoundError('recap', input.recapId);

      const transcript = await prisma.transcript.findFirst({
        where: { sessionId: source.sessionId },
        orderBy: { createdAt: 'desc' },
      });
      if (!transcript) throw new NotFoundError('transcript', source.sessionId);

      const newRecap = await prisma.sessionRecap.create({
        data: {
          sessionId: source.sessionId,
          campaignId: input.campaignId,
          style: input.style,
          status: 'GENERATING',
          sections: [],
          rawContent: '',
          clarificationSkipped: true,
        },
      });
      await recapGenerationQueue.add('generate', {
        recapId: newRecap.id,
        transcriptId: transcript.id,
        campaignId: input.campaignId,
        sessionId: source.sessionId,
        style: input.style,
      });
      return { recapId: newRecap.id };
    }),

  exportMarkdown: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
        include: {
          session: { select: { title: true, sessionNumber: true } },
        },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);

      const title = recap.session.title ?? `Session ${recap.session.sessionNumber}`;
      const sections = recap.sections as Array<{ key: string; title: string; content: string }>;
      const markdown = [`# ${title}\n`]
        .concat(sections.map((s) => `## ${s.title}\n\n${s.content}`))
        .join('\n\n');
      return { markdown };
    }),
});
```

- [ ] **Step 2: Register in `_app.ts`**

In `src/server/routers/_app.ts`, add the import after `speakerMappingRouter`:

```ts
import { recapRouter } from './recap';
```

In the `appRouter` object, add after `speakerMapping`:

```ts
  recap: recapRouter,
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/recap.ts src/server/routers/_app.ts
git commit -m "feat(recap): tRPC router with generate, getBySession, getById, regenerate, exportMarkdown"
```

---

## Task 4: Generation Worker

**Files:**
- Create: `src/lib/queue/recap-generation-worker.ts`

Context: Anthropic SDK is `@anthropic-ai/sdk` (already installed). Worker pattern: see `src/lib/queue/multi-track-worker.ts` — `import 'dotenv/config'` at top, `Worker` from `bullmq`, `getRedisConnection()` for connection, `concurrency: 1`. The `broadcastRecapComplete` was added to `src/server/websocket.ts` in Task 2. `SECTION_SHAPES` and `buildRecapPrompt` are in `src/lib/recap/recap-prompts.ts`.

- [ ] **Step 1: Create the worker file**

```ts
// src/lib/queue/recap-generation-worker.ts
/**
 * Recap Generation Worker
 *
 * Generates session recaps in multiple styles using the Anthropic API.
 *
 * Run with: npm run worker:recap-generation
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import type { RecapGenerationJobData, RecapGenerationJobResult } from './recap-generation-queue';
import { buildRecapPrompt, SECTION_SHAPES } from '../recap/recap-prompts';
import { broadcastRecapComplete } from '../../server/websocket';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function processRecapGeneration(
  job: Job<RecapGenerationJobData, RecapGenerationJobResult>
): Promise<RecapGenerationJobResult> {
  const { recapId, transcriptId, campaignId, sessionId, style } = job.data;
  const startTime = Date.now();

  console.log(`[RecapWorker] Processing recap ${recapId} style=${style}`);

  // 1. Idempotency guard
  const recap = await prisma.sessionRecap.findUnique({ where: { id: recapId } });
  if (!recap || recap.status !== 'GENERATING') {
    console.log(`[RecapWorker] Recap ${recapId} is not GENERATING — skipping`);
    return { success: true, recapId };
  }

  // 2. Fetch transcript
  const transcript = await prisma.transcript.findUnique({ where: { id: transcriptId } });
  if (!transcript?.correctedText) {
    throw new Error(`No correctedText for transcript ${transcriptId}`);
  }
  const correctedText = transcript.correctedText.slice(0, 12000);
  const speakersJson = JSON.stringify(transcript.speakers ?? []);

  // 3. Fetch last 3 campaign context records
  const contextRecords = await prisma.campaignContext.findMany({
    where: { campaignId, type: 'SESSION_EXTRACT' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  const campaignContext = contextRecords.map((r) => r.content).join('\n\n');

  // 4. Build prompt
  const styleKey = style as keyof typeof SECTION_SHAPES;
  const { system, user } = buildRecapPrompt({ correctedText, speakersJson, campaignContext, style: styleKey });

  // 5. Call Anthropic
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  // 6. Parse response — strip markdown fencing if present
  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
  let json = rawText.trim();
  const fenceMatch = json.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (fenceMatch) json = fenceMatch[1].trim();

  let parsed: { sections: Array<{ key: string; title: string; content: string }> };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Failed to parse Anthropic response: ${rawText.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.sections)) {
    throw new Error('Anthropic response missing sections array');
  }

  // 7. Update SessionRecap
  const rawContent = parsed.sections.map((s) => s.content).join('\n\n');
  const generationTimeMs = Date.now() - startTime;
  const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

  await prisma.sessionRecap.update({
    where: { id: recapId },
    data: {
      sections: parsed.sections,
      rawContent,
      status: 'AUTO_GENERATED',
      modelUsed: 'claude-sonnet-4-6',
      tokensUsed,
      generationTimeMs,
      clarificationSkipped: true,
    },
  });

  // 8. Broadcast completion
  broadcastRecapComplete(sessionId, recapId);

  console.log(`[RecapWorker] Done — recap ${recapId} (${generationTimeMs}ms, ${tokensUsed} tokens)`);
  return { success: true, recapId, tokensUsed };
}

// ---------------------------------------------------------------------------
// Worker bootstrap
// ---------------------------------------------------------------------------

const worker = new Worker<RecapGenerationJobData, RecapGenerationJobResult>(
  'recap-generation',
  processRecapGeneration,
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[RecapWorker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[RecapWorker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[RecapWorker] Worker error:', err);
});

console.log('[RecapWorker] Started — listening on recap-generation queue');
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue/recap-generation-worker.ts
git commit -m "feat(recap): generation worker — Anthropic API integration"
```

---

## Task 5: Worker Infrastructure Scripts

**Files:**
- Modify: `package.json`
- Modify: `deploy/hetzner/start-workers.sh`

- [ ] **Step 1: Add npm script to package.json**

In `package.json`, find the `"scripts"` section. Add after `"worker:context-extraction"`:

```json
"worker:recap-generation": "tsx src/lib/queue/recap-generation-worker.ts",
```

- [ ] **Step 2: Add to start-workers.sh**

In `deploy/hetzner/start-workers.sh`, add the following line before the `wait` command at the end of the worker launch block (after the last worker line):

```bash
npx tsx src/lib/queue/recap-generation-worker.ts &
```

Also update the log line that says "All 18 workers" to "All 19 workers".

- [ ] **Step 3: Verify the script is syntactically correct**

```bash
bash -n deploy/hetzner/start-workers.sh
```

Expected: no output (syntax OK)

- [ ] **Step 4: Commit**

```bash
git add package.json deploy/hetzner/start-workers.sh
git commit -m "feat(recap): add worker:recap-generation npm script and Hetzner worker entry"
```

---

## Task 6: Auto-Trigger After Speaker Mapping

**Files:**
- Modify: `src/components/recap/speaker-mapping-step.tsx`
- Modify: `src/components/recap/multi-track-progress.tsx`

Context: `SpeakerMappingStep` is at `src/components/recap/speaker-mapping-step.tsx`. Its `handleSave` calls `onComplete()` at the end. We need to add a `sessionId` prop and fire `recap.generate` (best-effort, non-fatal) before `onComplete()`. `MultiTrackProgress` already has `sessionId` in its props and must pass it down.

- [ ] **Step 1: Add `sessionId` prop to `SpeakerMappingStepProps`**

In `src/components/recap/speaker-mapping-step.tsx`, update the interface and function signature:

```ts
// Replace the existing interface:
interface SpeakerMappingStepProps {
  campaignId: string;
  transcriptId: string;
  sessionId: string;   // NEW
  speakerLabels: string[];
  onComplete: () => void;
}

// Replace the function signature:
export function SpeakerMappingStep({
  campaignId,
  transcriptId,
  sessionId,         // NEW
  speakerLabels,
  onComplete,
}: SpeakerMappingStepProps) {
```

- [ ] **Step 2: Add `generateRecap` mutation and auto-trigger in `handleSave`**

In `src/components/recap/speaker-mapping-step.tsx`, add the mutation after the existing `applyToTranscript` mutation line:

```ts
const generateRecap = trpc.recap.generate.useMutation();
```

Replace the end of `handleSave` (the `setSaving(false); onComplete();` block) with:

```ts
    // Best-effort recap trigger — failure never blocks the user
    try {
      await generateRecap.mutateAsync({
        campaignId,
        sessionId,
        transcriptId,
        style: 'NARRATIVE',
      });
    } catch (err) {
      console.warn('[SpeakerMappingStep] Auto-recap trigger failed (non-fatal):', err);
    }

    setSaving(false);
    onComplete();
```

The full updated end of `handleSave` (after the `applyToTranscript` try/catch) should be:

```ts
    // Best-effort recap trigger — failure never blocks the user
    try {
      await generateRecap.mutateAsync({
        campaignId,
        sessionId,
        transcriptId,
        style: 'NARRATIVE',
      });
    } catch (err) {
      console.warn('[SpeakerMappingStep] Auto-recap trigger failed (non-fatal):', err);
    }

    setSaving(false);
    onComplete();
  };
```

- [ ] **Step 3: Pass `sessionId` from `MultiTrackProgress`**

In `src/components/recap/multi-track-progress.tsx`, find the `<SpeakerMappingStep` render (around line 47). Add `sessionId={sessionId}`:

```tsx
    return (
      <SpeakerMappingStep
        campaignId={campaignId}
        transcriptId={data.transcriptId}
        sessionId={sessionId}
        speakerLabels={speakerLabels}
        onComplete={onComplete}
      />
    );
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/recap/speaker-mapping-step.tsx src/components/recap/multi-track-progress.tsx
git commit -m "feat(recap): auto-trigger NARRATIVE recap after speaker mapping save"
```

---

## Task 7: RecapCard Component

**Files:**
- Create: `src/components/recap/recap-card.tsx`

Context: The session detail page uses stone-card style: `rounded-sm border border-border/40 overflow-hidden` with `background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)'`. Section overline labels use `text-[10px] uppercase tracking-widest font-semibold` in amber. Amber: `hsl(35 80% 48%)` for labels, `hsl(35 80% 55%)` for icons. Uses shadcn `Button` and `Skeleton` from `@/components/ui/`. Import `trpc` from `@/lib/trpc`. Import `useCampaign` from `@/components/campaign/campaign-context` — but `campaignId` is passed as prop here for reuse.

- [ ] **Step 1: Create the component**

```tsx
// src/components/recap/recap-card.tsx
'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { RefreshCw, ScrollText, ExternalLink } from 'lucide-react';

interface RecapCardProps {
  sessionId: string;
  campaignId: string;
  transcriptId: string | undefined;
  slug: string;
}

export function RecapCard({ sessionId, campaignId, transcriptId, slug }: RecapCardProps) {
  const utils = trpc.useUtils();

  const { data: recaps, isLoading } = trpc.recap.getBySession.useQuery(
    { campaignId, sessionId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as Array<{ status: string }> | undefined;
        return data?.some((r) => r.status === 'GENERATING') ? 3000 : false;
      },
    }
  );

  const generateMutation = trpc.recap.generate.useMutation({
    onSuccess: () => void utils.recap.getBySession.invalidate({ campaignId, sessionId }),
  });

  if (isLoading) return null;

  const latest = recaps?.[0];
  const isGenerating = latest?.status === 'GENERATING';
  const isStuck =
    isGenerating &&
    latest &&
    Date.now() - new Date(latest.createdAt as string).getTime() > 5 * 60 * 1000;

  const sections = latest?.sections as Array<{ key: string; title: string; content: string }> | undefined;
  const firstSection = sections?.[0];

  return (
    <div
      className="rounded-sm border border-border/40 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
    >
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <ScrollText className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(35 80% 55%)' }} />
          <span
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'hsl(35 80% 48%)' }}
          >
            Recap
          </span>
          {latest?.style && (
            <span className="text-[10px] capitalize" style={{ color: 'hsl(35 5% 38%)' }}>
              {(latest.style as string).toLowerCase().replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <Link href={`/campaigns/${slug}/sessions/${sessionId}/recap`}>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1.5 text-xs px-2"
            style={{ color: 'hsl(35 5% 45%)' }}
          >
            View full <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="px-6 py-5">
        {!latest && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>
              No recap yet.
            </p>
            {transcriptId ? (
              <Button
                size="sm"
                onClick={() =>
                  generateMutation.mutate({
                    campaignId,
                    sessionId,
                    transcriptId,
                    style: 'NARRATIVE',
                  })
                }
                disabled={generateMutation.isPending}
              >
                <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Generate Recap
              </Button>
            ) : (
              <p className="text-xs" style={{ color: 'hsl(35 5% 32%)' }}>
                Transcribe a recording first.
              </p>
            )}
          </div>
        )}

        {isStuck && (
          <div className="py-4 text-center">
            <p className="text-sm text-destructive">Generation timed out.</p>
            <Link href={`/campaigns/${slug}/sessions/${sessionId}/recap`}>
              <Button size="sm" variant="outline" className="mt-2">
                Retry on recap page
              </Button>
            </Link>
          </div>
        )}

        {isGenerating && !isStuck && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-sm" style={{ color: 'hsl(35 10% 48%)' }}>
              Generating recap\u2026
            </span>
          </div>
        )}

        {latest?.status === 'AUTO_GENERATED' && firstSection && (
          <div className="space-y-1.5">
            <p
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'hsl(35 60% 38%)' }}
            >
              {firstSection.title}
            </p>
            <p
              className="text-sm leading-relaxed line-clamp-4"
              style={{ color: 'hsl(35 15% 68%)' }}
            >
              {firstSection.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/recap-card.tsx
git commit -m "feat(recap): RecapCard component for session detail page"
```

---

## Task 8: Session Detail Page — Add RecapCard

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

Context: The session detail page renders `SummaryCard` and `TranscriptSection` inside the main column when `!isPlanning`. Add `RecapCard` after `TranscriptSection`. The session data comes from `trpc.sessions.getById` which includes `transcripts` array. The session variable is cast as `any` (named `s`). `campaignId` comes from `useCampaign()`. `slug` and `sessionId` come from `useParams()`.

- [ ] **Step 1: Add the import**

At the top of `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`, add after the existing recap component imports:

```ts
import { RecapCard } from '@/components/recap/recap-card';
```

Also ensure `ScrollText` is in the Lucide imports if not already present (the `RecapCard` uses it internally, but the page doesn't need it unless you add it to the page icons list — it does not).

- [ ] **Step 2: Add RecapCard to the render**

Find this block in the page component (around line 421):

```tsx
          <>
            <SummaryCard session={s} sessionId={sessionId} campaignId={campaignId} />
            <TranscriptSection session={s} />
          </>
```

Replace with:

```tsx
          <>
            <SummaryCard session={s} sessionId={sessionId} campaignId={campaignId} />
            <TranscriptSection session={s} />
            <RecapCard
              sessionId={sessionId}
              campaignId={campaignId}
              transcriptId={(s.transcripts as Array<{ id: string }> | undefined)?.[0]?.id}
              slug={slug}
            />
          </>
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx"
git commit -m "feat(recap): add RecapCard to session detail page"
```

---

## Task 9: Standalone Recap Page

**Files:**
- Create: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`

Context: Session data from `trpc.sessions.getById({ id: sessionId })` — includes `title`, `sessionNumber`, `date`, `transcripts`. Campaign context from `useCampaign()` — provides `campaignId`. Route params from `useParams<{ slug: string; sessionId: string }>()`. Design tokens: stone card `rounded-sm border border-border/40`, amber `hsl(35 80% 48%)`, body text `hsl(35 15% 72%)`, muted `hsl(35 10% 40%)`. Uses shadcn `Button`, `Skeleton` from `@/components/ui/`. Toast via `useToast` from `@/hooks/use-toast`.

- [ ] **Step 1: Create the page**

```tsx
// src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, ScrollText, Copy, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const STYLES = [
  { key: 'NARRATIVE' as const, label: 'Narrative' },
  { key: 'SESSION_LOG' as const, label: 'Session Log' },
  { key: 'BARDS_TALE' as const, label: "Bard's Tale" },
  { key: 'PREVIOUSLY_ON' as const, label: 'Previously On\u2026' },
];

type StyleKey = 'NARRATIVE' | 'SESSION_LOG' | 'BARDS_TALE' | 'PREVIOUSLY_ON';

export default function RecapPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const { campaignId } = useCampaign();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeStyle, setActiveStyle] = useState<StyleKey>('NARRATIVE');
  const [copied, setCopied] = useState(false);

  const { data: session } = trpc.sessions.getById.useQuery(
    { id: sessionId },
    { staleTime: 60_000 }
  );

  const { data: recaps } = trpc.recap.getBySession.useQuery(
    { campaignId, sessionId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as Array<{ status: string }> | undefined;
        return data?.some((r) => r.status === 'GENERATING') ? 3000 : false;
      },
    }
  );

  const generateMutation = trpc.recap.generate.useMutation({
    onSuccess: () => void utils.recap.getBySession.invalidate({ campaignId, sessionId }),
    onError: (e) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  const regenerateMutation = trpc.recap.regenerate.useMutation({
    onSuccess: () => void utils.recap.getBySession.invalidate({ campaignId, sessionId }),
    onError: (e) => toast({ title: 'Regeneration failed', description: e.message, variant: 'destructive' }),
  });

  const s = session as any;
  const transcriptId = (s?.transcripts as Array<{ id: string }> | undefined)?.[0]?.id;
  const sessionTitle = s?.title ?? `Session ${s?.sessionNumber}`;

  // Most recent AUTO_GENERATED recap for active style, falling back to any status
  const activeRecap =
    recaps?.find((r) => r.style === activeStyle && r.status === 'AUTO_GENERATED') ??
    recaps?.find((r) => r.style === activeStyle);

  const isGenerating = activeRecap?.status === 'GENERATING';
  const isStuck =
    isGenerating &&
    activeRecap &&
    Date.now() - new Date(activeRecap.createdAt as string).getTime() > 5 * 60 * 1000;

  const sections = activeRecap?.sections as
    | Array<{ key: string; title: string; content: string }>
    | undefined;

  const handleGenerate = () => {
    if (!transcriptId) return;
    generateMutation.mutate({ campaignId, sessionId, transcriptId, style: activeStyle });
  };

  const handleRegenerate = () => {
    if (!activeRecap) return;
    regenerateMutation.mutate({ campaignId, recapId: activeRecap.id as string, style: activeStyle });
  };

  const handleCopyMarkdown = async () => {
    if (!activeRecap) return;
    try {
      const result = await utils.recap.exportMarkdown.fetch({
        campaignId,
        recapId: activeRecap.id as string,
      });
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="px-6 py-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/campaigns/${slug}/sessions/${sessionId}`}
          className="inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: 'hsl(35 10% 42%)' }}
        >
          <ArrowLeft className="h-3 w-3" /> {sessionTitle}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'hsl(35 80% 48%)' }}
            >
              Session Recap
            </span>
            <h1
              className="font-display text-2xl font-bold mt-0.5"
              style={{ color: 'hsl(35 20% 90%)' }}
            >
              {sessionTitle}
            </h1>
            {s?.date && (
              <p className="text-xs mt-0.5" style={{ color: 'hsl(35 10% 45%)' }}>
                {format(new Date(s.date as string), 'd MMM yyyy')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-1">
            {activeRecap?.status === 'AUTO_GENERATED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => void handleCopyMarkdown()}
                  disabled={copied}
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied' : 'Export MD'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleRegenerate}
                  disabled={regenerateMutation.isPending || isGenerating}
                >
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </Button>
              </>
            )}
            {!activeRecap && transcriptId && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                <ScrollText className="h-3 w-3" /> Generate
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Amber rule */}
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, hsl(35 60% 28%) 0%, transparent 60%)' }}
      />

      {/* Style picker */}
      <div className="flex gap-2 flex-wrap">
        {STYLES.map((style) => {
          const hasRecap = recaps?.some(
            (r) => r.style === style.key && r.status === 'AUTO_GENERATED'
          );
          const isActive = activeStyle === style.key;
          return (
            <button
              key={style.key}
              onClick={() => setActiveStyle(style.key)}
              className="px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
              style={{
                background: isActive ? 'hsl(35 80% 18%)' : 'hsl(240 10% 11%)',
                border: `1px solid ${isActive ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
                color: isActive
                  ? 'hsl(35 80% 70%)'
                  : hasRecap
                  ? 'hsl(35 20% 60%)'
                  : 'hsl(35 5% 40%)',
              }}
            >
              {style.label}
              {hasRecap && !isActive && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-500/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Stuck state */}
      {isStuck && (
        <div className="rounded-sm border border-destructive/30 px-6 py-8 text-center">
          <p className="text-sm text-destructive">Generation timed out.</p>
          {transcriptId && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Generating skeletons */}
      {isGenerating && !isStuck && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-sm border border-border/40 px-6 py-5"
              style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
            >
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
          <div className="flex items-center gap-2 justify-center pt-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
              Generating recap\u2026
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeRecap && !isStuck && !generateMutation.isPending && (
        <div
          className="rounded-sm border border-border/40 px-6 py-12 text-center"
          style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
        >
          <ScrollText className="h-8 w-8 mx-auto mb-3" style={{ color: 'hsl(35 10% 30%)' }} />
          <p className="text-sm" style={{ color: 'hsl(35 10% 42%)' }}>
            No {STYLES.find((s) => s.key === activeStyle)?.label} recap yet.
          </p>
          {transcriptId ? (
            <Button size="sm" className="mt-4" onClick={handleGenerate}>
              <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Generate
            </Button>
          ) : (
            <p className="mt-2 text-xs" style={{ color: 'hsl(35 5% 30%)' }}>
              Transcribe a session recording first.
            </p>
          )}
        </div>
      )}

      {/* Recap sections */}
      {activeRecap?.status === 'AUTO_GENERATED' && sections && sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.key}
              className="rounded-sm border border-border/40 overflow-hidden"
              style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
            >
              <div className="px-6 py-3.5 border-b border-border/20">
                <span
                  className="text-[10px] uppercase tracking-widest font-semibold"
                  style={{ color: 'hsl(35 80% 48%)' }}
                >
                  {section.title}
                </span>
              </div>
              <div className="px-6 py-5">
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'hsl(35 15% 72%)' }}
                >
                  {section.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx"
git commit -m "feat(recap): standalone recap page with style picker and section viewer"
```

---

## Task 10: Workflow Test Stub

**Files:**
- Create: `tests/workflows/recapforge-generation.workflow.spec.ts`

- [ ] **Step 1: Create the stub file**

```ts
// tests/workflows/recapforge-generation.workflow.spec.ts
import { test } from '@playwright/test';

test.fixme('recap generates automatically after speaker mapping completes', async ({ page }) => {
  // Phase 5 — requires Anthropic API key in E2E env + full multi-track pipeline running
  void page;
});

test.fixme('DM can manually generate recap with style selection from recap page', async ({ page }) => {
  // Phase 5 — requires Anthropic API key in E2E env
  void page;
});

test.fixme('regenerate creates a new recap in a different style', async ({ page }) => {
  // Phase 5 — requires Anthropic API key in E2E env
  void page;
});
```

- [ ] **Step 2: Verify the file is valid TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Full type-check and build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds (or only pre-existing errors, none from new files)

- [ ] **Step 4: Run unit tests to confirm nothing broken**

```bash
npx vitest run tests/unit/recap/
```

Expected: 9 tests pass

- [ ] **Step 5: Commit and push**

```bash
git add tests/workflows/recapforge-generation.workflow.spec.ts
git commit -m "test(recap): workflow stubs for Phase 5 generation E2E"
git push origin main
```

---

## Self-Review Notes

- Spec requires: queue ✅, worker ✅, 5 tRPC procedures (`generate`, `getBySession`, `getById`, `regenerate`, `exportMarkdown`) ✅, `broadcastRecapComplete` ✅, auto-trigger after mapping ✅, session tab preview ✅, standalone recap page ✅, workflow stubs ✅
- `clarificationSkipped: true` set on every `SessionRecap.create` ✅
- `regenerate` fetches latest transcript for the session (not stored on recap) ✅
- Stuck detection: `> 5 min` age check in both `RecapCard` and recap page ✅
- `exportMarkdown` uses `utils.recap.exportMarkdown.fetch` (imperative query fetch, not `useQuery`) ✅
- Section content cast as `Array<{ key, title, content }>` in both UI components ✅
- Worker concurrency: 1 ✅
- `ANTHROPIC_API_KEY` consumed directly in worker — ensure it's in Hetzner `.env`
