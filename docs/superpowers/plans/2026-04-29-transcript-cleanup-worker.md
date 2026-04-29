# Transcript Cleanup Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a BullMQ worker that automatically cleans multi-track transcripts (term corrections, utterance merging, filler drop) and adds a DM-triggered AI OOC filter with a session hub review UI.

**Architecture:** Single `transcript-cleanup` queue with two job phases (`basic` auto-fires after multi-track; `ooc` is DM-triggered). The worker extracts logic from `scripts/cleanup-transcript.ts` and operates on `Transcript.timestamps` JSON. The session hub gains a status badge and a Sheet for reviewing AI-flagged OOC lines.

**Tech Stack:** BullMQ, Prisma, OpenAI (gpt-4o-mini for OOC), tRPC, React, shadcn Sheet

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `TranscriptCorrection` model; add `cleanupStatus`, `oocReviewItems` to `Transcript`; add `transcriptCorrections` relation to `Campaign` |
| `src/lib/queue/transcript-cleanup-queue.ts` | **Create** — queue instance + job type definitions |
| `src/lib/queue/transcript-cleanup-worker.ts` | **Create** — worker handling `basic` and `ooc` phases |
| `src/lib/queue/multi-track-worker.ts` | **Modify** — enqueue `basic` cleanup job after broadcast |
| `src/server/routers/sessions.ts` | **Modify** — add `triggerOocCleanup` + `confirmOocReview` procedures |
| `src/components/session/transcript-cleanup-badge.tsx` | **Create** — status badge + "Run OOC filter" button |
| `src/components/session/ooc-review-sheet.tsx` | **Create** — keep/drop review Sheet |
| `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | **Modify** — include `cleanupStatus` + `oocReviewItems` in transcript query; render badge + sheet |
| `package.json` | **Modify** — add `worker:transcript-cleanup` script and add to `worker:all` |

---

### Task 1: Schema — add `TranscriptCorrection` model and `Transcript` fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `TranscriptCorrection` model**

Open `prisma/schema.prisma`. After the `SpeakerMapping` model (search for `model SpeakerMapping`), add:

```prisma
model TranscriptCorrection {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  wrong      String
  correct    String
  createdAt  DateTime @default(now())

  @@index([campaignId])
}
```

- [ ] **Step 2: Add `transcriptCorrections` relation to `Campaign` model**

In the `Campaign` model block (around line 323, near `speakerMappings`), add:

```prisma
  transcriptCorrections TranscriptCorrection[]
```

- [ ] **Step 3: Add fields to `Transcript` model**

In the `Transcript` model, after the `hasSpeakers` field, add:

```prisma
  cleanupStatus  String?  // pending | processing | complete | ooc_pending_review | failed
  oocReviewItems Json?
```

- [ ] **Step 4: Push schema and generate client**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add TranscriptCorrection model and Transcript cleanup fields"
```

---

### Task 2: Create the cleanup queue file

**Files:**
- Create: `src/lib/queue/transcript-cleanup-queue.ts`

- [ ] **Step 1: Create the queue file**

```ts
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface TranscriptCleanupJobData {
  transcriptId: string;
  sessionId: string;
  campaignId: string;
  phase: 'basic' | 'ooc';
}

export interface TranscriptCleanupJobResult {
  success: boolean;
  phase: 'basic' | 'ooc';
  utterancesOut?: number;
  oocFlagged?: number;
  error?: string;
}

export const transcriptCleanupQueue = new Queue<TranscriptCleanupJobData, TranscriptCleanupJobResult>(
  'transcript-cleanup',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addTranscriptCleanupJob(data: TranscriptCleanupJobData) {
  return transcriptCleanupQueue.add(
    `cleanup-${data.phase}-${data.transcriptId}`,
    data,
    { jobId: `cleanup-${data.phase}-${data.transcriptId}` }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queue/transcript-cleanup-queue.ts
git commit -m "feat(queue): add transcript-cleanup queue"
```

---

### Task 3: Create the cleanup worker — shared helpers

**Files:**
- Create: `src/lib/queue/transcript-cleanup-worker.ts`

The worker is large; build it in steps. This task creates the file with all pure helper functions extracted from `scripts/cleanup-transcript.ts`.

- [ ] **Step 1: Create the worker file with imports and helpers**

Create `src/lib/queue/transcript-cleanup-worker.ts`:

```ts
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { Worker, Job } from 'bullmq';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import OpenAI from 'openai';
import type { TranscriptCleanupJobData, TranscriptCleanupJobResult } from './transcript-cleanup-queue';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  speaker: string;
  start: number;
  end: number;
  start_formatted: string;
  end_formatted: string;
  text: string;
}

interface OOCResult {
  index: number;
  classification: 'gameplay' | 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}

export interface OocReviewItem {
  index: number;
  speaker: string;
  text: string;
  start_formatted: string;
  classification: 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SHORT_WORD_THRESHOLD = 4;
const MERGE_GAP_MS = 8000;
const MAX_MERGE_PASSES = 10;
const OOC_AUTO_DROP_THRESHOLD = 0.92;
const OOC_BATCH_SIZE = 100;

const GLOBAL_CORRECTIONS_PATH = path.resolve(
  process.cwd(),
  'docs/transcription-tools/corrections-global.json'
);

const FILLER_WORDS = new Set([
  'yeah', 'yep', 'yup', 'uh', 'um', 'hmm', 'hm', 'mm', 'ah', 'aw', 'huh',
  'ha', 'haha', 'lol',
]);

const SESSION_START_PHRASES = [
  'last session', 'last time', 'where we left', 'left off',
  'picking up', 'previously on', 'where we pick up',
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isFiller(text: string): boolean {
  return FILLER_WORDS.has(text.trim().toLowerCase().replace(/[^a-z]/g, ''));
}

function mergeEntries(a: Entry, b: Entry): Entry {
  return {
    speaker: a.speaker,
    start: a.start,
    end: b.end,
    start_formatted: a.start_formatted,
    end_formatted: b.end_formatted,
    text: `${a.text} ${b.text}`.trim(),
  };
}

function forwardPass(entries: Entry[]): { entries: Entry[]; changed: boolean } {
  const out: Entry[] = [];
  let changed = false;
  let i = 0;
  while (i < entries.length) {
    const cur = entries[i];
    if (wordCount(cur.text) <= SHORT_WORD_THRESHOLD) {
      const nextIdx = entries.findIndex((e, j) => j > i && e.speaker === cur.speaker);
      if (nextIdx !== -1 && entries[nextIdx].start - cur.end <= MERGE_GAP_MS) {
        entries[nextIdx] = mergeEntries(cur, entries[nextIdx]);
        changed = true;
        i++;
        continue;
      }
    }
    out.push(cur);
    i++;
  }
  return { entries: out, changed };
}

function backwardPass(entries: Entry[]): { entries: Entry[]; changed: boolean } {
  const out: (Entry | null)[] = [...entries];
  let changed = false;
  for (let i = entries.length - 1; i >= 0; i--) {
    const cur = out[i];
    if (!cur) continue;
    if (wordCount(cur.text) <= SHORT_WORD_THRESHOLD) {
      let prevIdx = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (out[j]) { prevIdx = j; break; }
      }
      if (prevIdx !== -1 && out[prevIdx] && cur.start - out[prevIdx]!.end <= MERGE_GAP_MS && out[prevIdx]!.speaker === cur.speaker) {
        out[prevIdx] = mergeEntries(out[prevIdx]!, cur);
        out[i] = null;
        changed = true;
      }
    }
  }
  return { entries: out.filter(Boolean) as Entry[], changed };
}

function runMergePasses(entries: Entry[]): Entry[] {
  let current = [...entries];
  for (let pass = 0; pass < MAX_MERGE_PASSES; pass++) {
    const fwd = forwardPass(current);
    current = fwd.entries;
    const bwd = backwardPass(current);
    current = bwd.entries;
    if (!fwd.changed && !bwd.changed) break;
  }
  return current;
}

function trimPreSessionNoise(entries: Entry[]): Entry[] {
  const idx = entries.findIndex(e =>
    SESSION_START_PHRASES.some(p => e.text.toLowerCase().includes(p))
  );
  return idx > 0 ? entries.slice(idx) : entries;
}

function dropStandaloneFillers(entries: Entry[]): Entry[] {
  return entries.filter(e => !(wordCount(e.text) === 1 && isFiller(e.text)));
}

function applyCorrections(entries: Entry[], corrections: Record<string, string>): Entry[] {
  const rules = Object.entries(corrections)
    .filter(([k, v]) => !k.startsWith('_') && v && v !== 'TODO')
    .map(([wrong, correct]) => ({
      pattern: new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      correct,
    }));
  return entries.map(e => ({
    ...e,
    text: rules.reduce((t, { pattern, correct }) => t.replace(pattern, correct), e.text),
  }));
}

function buildMarkdown(entries: Entry[], sessionName: string): string {
  const speakerOrder: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!seen.has(e.speaker)) { speakerOrder.push(e.speaker); seen.add(e.speaker); }
  }
  return [
    `# ${sessionName} — Session Transcript`,
    '',
    `**Participants:** ${speakerOrder.join(', ')}`,
    `**Utterances:** ${entries.length}`,
    '',
    '---',
    '',
    ...entries.map(e => [`**[${e.start_formatted}] ${e.speaker}:** ${e.text.trim()}`, '']).flat(),
  ].join('\n');
}

function loadGlobalCorrections(): Record<string, string> {
  if (!fs.existsSync(GLOBAL_CORRECTIONS_PATH)) {
    console.warn('[CleanupWorker] Global corrections file not found, continuing without');
    return {};
  }
  return JSON.parse(fs.readFileSync(GLOBAL_CORRECTIONS_PATH, 'utf8'));
}

function parseMarkdownToEntries(md: string): Entry[] {
  return md
    .split('\n')
    .filter(l => l.startsWith('**['))
    .map(l => {
      const m = l.match(/^\*\*\[([^\]]+)\] ([^:]+):\*\*\s(.+)$/);
      if (!m) return null;
      return {
        speaker: m[2],
        text: m[3],
        start: 0,
        end: 0,
        start_formatted: m[1],
        end_formatted: m[1],
      } as Entry;
    })
    .filter(Boolean) as Entry[];
}
```

- [ ] **Step 2: Commit helpers**

```bash
git add src/lib/queue/transcript-cleanup-worker.ts
git commit -m "feat(worker): transcript-cleanup worker — shared helpers"
```

---

### Task 4: Cleanup worker — `basic` phase handler

**Files:**
- Modify: `src/lib/queue/transcript-cleanup-worker.ts`

- [ ] **Step 1: Append `processBasic` function to the worker file**

Add after the helpers in `src/lib/queue/transcript-cleanup-worker.ts`:

```ts
// ─── Basic phase ─────────────────────────────────────────────────────────────

async function processBasic(
  job: Job<TranscriptCleanupJobData, TranscriptCleanupJobResult>
): Promise<void> {
  const { transcriptId, sessionId, campaignId } = job.data;

  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    select: { timestamps: true, cleanupStatus: true },
  });

  if (!transcript) throw new Error(`Transcript ${transcriptId} not found`);

  // Only applies to multi-track sessions that have structured timestamps
  const rawTimestamps = transcript.timestamps as Array<{
    speaker: string; start: number; end: number; text: string;
  }> | null;

  if (!rawTimestamps || rawTimestamps.length === 0) {
    console.log(`[CleanupWorker] No timestamps on transcript ${transcriptId} — skipping`);
    return;
  }

  await prisma.transcript.update({
    where: { id: transcriptId },
    data: { cleanupStatus: 'processing' },
  });

  // Convert timestamps to Entry shape (add formatted timestamps)
  let entries: Entry[] = rawTimestamps.map(t => ({
    speaker: t.speaker,
    start: t.start,
    end: t.end,
    start_formatted: formatTimestamp(t.start),
    end_formatted: formatTimestamp(t.end),
    text: t.text,
  }));

  // Load corrections
  const globalCorrections = loadGlobalCorrections();
  const campaignCorrections = await prisma.transcriptCorrection.findMany({
    where: { campaignId },
    select: { wrong: true, correct: true },
  });
  const allCorrections: Record<string, string> = {
    ...globalCorrections,
    ...Object.fromEntries(campaignCorrections.map(c => [c.wrong, c.correct])),
  };

  entries = applyCorrections(entries, allCorrections);
  entries = trimPreSessionNoise(entries);
  entries = runMergePasses(entries);
  entries = dropStandaloneFillers(entries);

  // Rebuild formatted timestamps after merge
  entries = entries.map(e => ({
    ...e,
    start_formatted: formatTimestamp(e.start),
    end_formatted: formatTimestamp(e.end),
  }));

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { title: true, sessionNumber: true },
  });
  const sessionName = session?.title ?? `Session ${session?.sessionNumber ?? ''}`;

  const correctedText = buildMarkdown(entries, sessionName);

  await prisma.transcript.update({
    where: { id: transcriptId },
    data: { correctedText, cleanupStatus: 'complete' },
  });

  console.log(`[CleanupWorker] basic done — ${entries.length} utterances → transcript ${transcriptId}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queue/transcript-cleanup-worker.ts
git commit -m "feat(worker): transcript-cleanup basic phase"
```

---

### Task 5: Cleanup worker — `ooc` phase handler

**Files:**
- Modify: `src/lib/queue/transcript-cleanup-worker.ts`

- [ ] **Step 1: Add the OOC system prompt constant and `runOocBatches` function**

Append to `src/lib/queue/transcript-cleanup-worker.ts`:

```ts
// ─── OOC phase ────────────────────────────────────────────────────────────────

const OOC_SYSTEM_PROMPT = `You are reviewing a D&D tabletop session transcript.

Return ONLY utterances that are out-of-character (OOC) or uncertain. Skip all gameplay lines.

ALWAYS gameplay — never flag these:
- DM narration of any kind: locations, scene transitions, NPC actions, descriptions
- Player declared actions: "I attack", "I cast", "I move", "I investigate"
- In-character roleplay: a player speaking AS their character
- Combat mechanics: initiative, attack rolls, damage, HP, spell slots, conditions
- Rules questions about the current encounter or action in play
- In-game questions about NPCs, plot, or events

OOC = clearly non-session:
- Tech issues: mic problems, audio/connection drops, "can you hear me?"
- Real-world breaks: bathroom, food delivery, "brb", people arriving/leaving IRL
- Personal conversations completely unrelated to the session
- Session scheduling: "next week?", "who's here?"
- Platform meta: Discord settings, DnDBeyond login issues

Uncertain = plausibly gameplay but context is ambiguous — flag for human review.
Short fragments should be "uncertain", not "ooc".
Be extremely conservative with DM lines — DM narration is always gameplay.

Return a JSON array of flagged lines only (empty array [] if none):
[{"index": <n>, "c": "ooc|uncertain", "confidence": 0.0-1.0, "reason": "brief note"}]`;

async function runOocBatches(
  client: OpenAI,
  entries: Entry[],
): Promise<OOCResult[]> {
  const allResults: OOCResult[] = [];
  const totalBatches = Math.ceil(entries.length / OOC_BATCH_SIZE);

  for (let i = 0; i < entries.length; i += OOC_BATCH_SIZE) {
    const batch = entries.slice(i, i + OOC_BATCH_SIZE);
    const batchNum = Math.floor(i / OOC_BATCH_SIZE) + 1;
    const batchText = batch
      .map((e, j) => `${i + j}: [${e.speaker}] ${e.text}`)
      .join('\n');

    console.log(`[CleanupWorker] OOC batch ${batchNum}/${totalBatches}...`);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0,
      messages: [
        { role: 'system', content: OOC_SYSTEM_PROMPT },
        { role: 'user', content: batchText },
      ],
    });

    let raw = (response.choices[0]?.message?.content ?? '').trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    const batchResults: Array<{ index: number; c: string; confidence: number; reason: string }> =
      JSON.parse(raw);

    allResults.push(...batchResults.map(r => ({
      index: r.index,
      classification: (r.c === 'ooc' ? 'ooc' : 'uncertain') as OOCResult['classification'],
      confidence: r.confidence,
      reason: r.reason,
    })));
  }

  return allResults;
}

async function processOoc(
  job: Job<TranscriptCleanupJobData, TranscriptCleanupJobResult>
): Promise<{ oocFlagged: number }> {
  const { transcriptId } = job.data;

  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    select: { correctedText: true },
  });

  if (!transcript?.correctedText) {
    throw new Error(`Transcript ${transcriptId} has no correctedText to run OOC on`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  await prisma.transcript.update({
    where: { id: transcriptId },
    data: { cleanupStatus: 'processing' },
  });

  const entries = parseMarkdownToEntries(transcript.correctedText);
  const client = new OpenAI({ apiKey });
  const results = await runOocBatches(client, entries);

  const dropIndices = new Set(
    results
      .filter(r => r.classification === 'ooc' && r.confidence >= OOC_AUTO_DROP_THRESHOLD)
      .map(r => r.index)
  );

  const reviewItems: OocReviewItem[] = results
    .filter(r => r.classification === 'uncertain' || (r.classification === 'ooc' && r.confidence < OOC_AUTO_DROP_THRESHOLD))
    .map(r => ({
      index: r.index,
      speaker: entries[r.index]?.speaker ?? '',
      text: entries[r.index]?.text ?? '',
      start_formatted: entries[r.index]?.start_formatted ?? '',
      classification: r.classification as 'ooc' | 'uncertain',
      confidence: r.confidence,
      reason: r.reason,
    }));

  const cleanedEntries = entries.filter((_, i) => !dropIndices.has(i));

  // Re-render correctedText with auto-dropped lines removed
  const sessionNameMatch = transcript.correctedText.match(/^# (.+) — Session Transcript/m);
  const sessionName = sessionNameMatch?.[1] ?? 'Session';
  const correctedText = buildMarkdown(cleanedEntries, sessionName);

  await prisma.transcript.update({
    where: { id: transcriptId },
    data: {
      correctedText,
      oocReviewItems: reviewItems.length > 0 ? (reviewItems as any) : null,
      cleanupStatus: reviewItems.length > 0 ? 'ooc_pending_review' : 'complete',
    },
  });

  console.log(`[CleanupWorker] ooc done — dropped ${dropIndices.size}, flagged ${reviewItems.length}`);
  return { oocFlagged: reviewItems.length };
}
```

- [ ] **Step 2: Append the worker bootstrap**

```ts
// ─── Worker bootstrap ────────────────────────────────────────────────────────

async function processCleanup(
  job: Job<TranscriptCleanupJobData, TranscriptCleanupJobResult>
): Promise<TranscriptCleanupJobResult> {
  const { phase, transcriptId } = job.data;
  console.log(`[CleanupWorker] ${phase} job for transcript ${transcriptId}`);

  try {
    if (phase === 'basic') {
      await processBasic(job);
      return { success: true, phase: 'basic' };
    } else {
      const { oocFlagged } = await processOoc(job);
      return { success: true, phase: 'ooc', oocFlagged };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // On failure: set status based on phase
    // basic failure → 'failed'; ooc failure → fall back to 'complete'
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: { cleanupStatus: phase === 'basic' ? 'failed' : 'complete' },
    }).catch(() => {});
    throw err;
  }
}

const worker = new Worker<TranscriptCleanupJobData, TranscriptCleanupJobResult>(
  'transcript-cleanup',
  processCleanup,
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[CleanupWorker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[CleanupWorker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[CleanupWorker] Worker error:', err);
});

console.log('[CleanupWorker] Started — listening on transcript-cleanup queue');

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue/transcript-cleanup-worker.ts
git commit -m "feat(worker): transcript-cleanup ooc phase and bootstrap"
```

---

### Task 6: Wire cleanup into multi-track worker + add npm script

**Files:**
- Modify: `src/lib/queue/multi-track-worker.ts`
- Modify: `package.json`

- [ ] **Step 1: Import cleanup queue in multi-track worker**

In `src/lib/queue/multi-track-worker.ts`, add to the existing imports block (near line 30 where `contextExtractionQueue` is imported):

```ts
import { addTranscriptCleanupJob } from './transcript-cleanup-queue';
```

- [ ] **Step 2: Enqueue cleanup basic job after broadcast**

In `multi-track-worker.ts`, after the `contextExtractionQueue.add(...)` block (around line 223), add:

```ts
  try {
    await addTranscriptCleanupJob({
      transcriptId: transcript.id,
      sessionId,
      campaignId,
      phase: 'basic',
    });
  } catch (err) {
    console.warn('[MultiTrackWorker] Failed to enqueue transcript cleanup (non-fatal):', err);
  }
```

- [ ] **Step 3: Add npm script to package.json**

In `package.json`, in the `scripts` object, add after `worker:multi-track`:

```json
"worker:transcript-cleanup": "tsx src/lib/queue/transcript-cleanup-worker.ts",
```

Also add `npm run worker:transcript-cleanup &` to the `worker:all` script (append before `wait`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/queue/multi-track-worker.ts package.json
git commit -m "feat(worker): auto-enqueue transcript cleanup after multi-track"
```

---

### Task 7: tRPC procedures — `triggerOocCleanup` and `confirmOocReview`

**Files:**
- Modify: `src/server/routers/sessions.ts`

- [ ] **Step 1: Import cleanup queue in sessions router**

At the top of `src/server/routers/sessions.ts`, add:

```ts
import { addTranscriptCleanupJob } from '@/lib/queue/transcript-cleanup-queue';
```

Also define the `OocReviewItem` type locally in `sessions.ts` (don't import from the worker — server code shouldn't depend on worker files):

```ts
interface OocReviewItem {
  index: number;
  speaker: string;
  text: string;
  start_formatted: string;
  classification: 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}
```

- [ ] **Step 2: Add `triggerOocCleanup` procedure**

Inside the `sessionsRouter` definition in `sessions.ts`, add:

```ts
triggerOocCleanup: campaignDMProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const session = await prisma.gameSession.findFirst({
      where: { id: input.sessionId, campaignId: ctx.campaignId },
      include: { transcripts: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (!session) throw new NotFoundError('session', input.sessionId);

    const transcript = session.transcripts[0];
    if (!transcript) throw new ValidationError.forField('transcript', 'No transcript found for this session');

    await prisma.transcript.update({
      where: { id: transcript.id },
      data: { cleanupStatus: 'processing' },
    });

    await addTranscriptCleanupJob({
      transcriptId: transcript.id,
      sessionId: input.sessionId,
      campaignId: ctx.campaignId,
      phase: 'ooc',
    });

    return { transcriptId: transcript.id };
  }),
```

- [ ] **Step 3: Add `confirmOocReview` procedure**

```ts
confirmOocReview: campaignDMProcedure
  .input(z.object({
    sessionId: z.string(),
    drops: z.array(z.number()),
  }))
  .mutation(async ({ input, ctx }) => {
    const session = await prisma.gameSession.findFirst({
      where: { id: input.sessionId, campaignId: ctx.campaignId },
      include: { transcripts: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (!session) throw new NotFoundError('session', input.sessionId);

    const transcript = session.transcripts[0];
    if (!transcript) throw new ValidationError.forField('transcript', 'No transcript found');

    const reviewItems = (transcript.oocReviewItems ?? []) as OocReviewItem[];

    if (input.drops.length > 0 && transcript.correctedText) {
      const dropSet = new Set(input.drops);
      const dropTexts = reviewItems
        .filter(item => dropSet.has(item.index))
        .map(item => item.text);

      // Remove dropped lines from correctedText
      const lines = transcript.correctedText.split('\n');
      const cleaned = lines.filter(line => {
        if (!line.startsWith('**[')) return true;
        const m = line.match(/^\*\*\[[^\]]+\] [^:]+:\*\*\s(.+)$/);
        return !m || !dropTexts.includes(m[1]);
      });

      await prisma.transcript.update({
        where: { id: transcript.id },
        data: {
          correctedText: cleaned.join('\n'),
          oocReviewItems: null,
          cleanupStatus: 'complete',
        },
      });
    } else {
      await prisma.transcript.update({
        where: { id: transcript.id },
        data: { oocReviewItems: null, cleanupStatus: 'complete' },
      });
    }

    return { success: true };
  }),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to these procedures.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/sessions.ts
git commit -m "feat(api): add triggerOocCleanup and confirmOocReview tRPC procedures"
```

---

### Task 8: Update session detail page query to include cleanup fields

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

- [ ] **Step 1: Read the current page file**

Read `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` to find where `transcripts` are fetched and passed as props.

- [ ] **Step 2: Add `cleanupStatus` and `oocReviewItems` to the transcript select**

Find the section where the page queries the session (likely calls `sessionService.getById` or a tRPC query). The transcript object currently selects `id`, `correctedText`, `rawText`. Add the two new fields:

```ts
{ id: true, correctedText: true, rawText: true, cleanupStatus: true, oocReviewItems: true }
```

- [ ] **Step 3: Pass the fields down to the session hub component**

In the same file, find where `transcripts` is passed as a prop. Update the type/spread to include `cleanupStatus` and `oocReviewItems`:

```ts
transcripts: session.transcripts.map(t => ({
  id: t.id,
  correctedText: t.correctedText,
  rawText: t.rawText,
  cleanupStatus: t.cleanupStatus,
  oocReviewItems: t.oocReviewItems,
})),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): pass transcript cleanup fields to session hub"
```

---

### Task 9: Create `TranscriptCleanupBadge` component

**Files:**
- Create: `src/components/session/transcript-cleanup-badge.tsx`

- [ ] **Step 1: Create the badge component**

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TranscriptCleanupBadgeProps {
  sessionId: string;
  transcriptId: string;
  cleanupStatus: string | null;
  oocReviewItemCount: number;
  onReviewOpen: () => void;
}

export function TranscriptCleanupBadge({
  sessionId,
  transcriptId,
  cleanupStatus,
  oocReviewItemCount,
  onReviewOpen,
}: TranscriptCleanupBadgeProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const triggerOoc = trpc.sessions.triggerOocCleanup.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      toast({ title: 'OOC filter running', description: 'Results will appear shortly.' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (!cleanupStatus) return null;

  if (cleanupStatus === 'pending' || cleanupStatus === 'processing') {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'hsl(35 10% 50%)' }}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Cleaning transcript…
      </div>
    );
  }

  if (cleanupStatus === 'failed') {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'hsl(0 70% 65%)' }}>
        <XCircle className="h-3 w-3" />
        Cleanup failed
      </div>
    );
  }

  if (cleanupStatus === 'ooc_pending_review') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        style={{ borderColor: 'hsl(35 80% 55% / 0.4)', color: 'hsl(35 80% 62%)' }}
        onClick={onReviewOpen}
      >
        <AlertTriangle className="h-3 w-3" />
        {oocReviewItemCount} line{oocReviewItemCount !== 1 ? 's' : ''} flagged — Review
      </Button>
    );
  }

  // complete
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'hsl(35 10% 50%)' }}>
        <CheckCircle className="h-3 w-3" style={{ color: 'hsl(35 80% 55%)' }} />
        Transcript ready
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        style={{ color: 'hsl(35 10% 50%)' }}
        disabled={triggerOoc.isPending}
        onClick={() => triggerOoc.mutate({ sessionId })}
      >
        {triggerOoc.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Run OOC filter'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session/transcript-cleanup-badge.tsx
git commit -m "feat(ui): TranscriptCleanupBadge component"
```

---

### Task 10: Create `OocReviewSheet` component

**Files:**
- Create: `src/components/session/ooc-review-sheet.tsx`

- [ ] **Step 1: Create the sheet component**

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface OocReviewItem {
  index: number;
  speaker: string;
  text: string;
  start_formatted: string;
  classification: 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}

interface OocReviewSheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  items: OocReviewItem[];
}

export function OocReviewSheet({ open, onClose, sessionId, items }: OocReviewSheetProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // dropped = set of item.index values the DM wants to remove
  const [dropped, setDropped] = useState<Set<number>>(new Set());

  const confirmReview = trpc.sessions.confirmOocReview.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      toast({ title: 'Review saved', description: 'Transcript updated.' });
      onClose();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  function toggle(index: number) {
    setDropped(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto glass-shell">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="font-display text-base">
            Review Flagged Lines — {items.length} uncertain
          </SheetTitle>
          <p className="text-xs" style={{ color: 'hsl(35 10% 50%)' }}>
            Lines the AI flagged as possibly out-of-character. Keep or drop each one.
          </p>
        </SheetHeader>

        <div className="py-4 space-y-3">
          {items.map(item => {
            const isDrop = dropped.has(item.index);
            return (
              <div
                key={item.index}
                className="rounded-sm p-3 space-y-2"
                style={{
                  background: isDrop
                    ? 'hsl(0 60% 15% / 0.3)'
                    : 'hsl(240 10% 8% / 0.6)',
                  border: `1px solid ${isDrop ? 'hsl(0 60% 35% / 0.3)' : 'hsl(35 35% 15%)'}`,
                  opacity: isDrop ? 0.6 : 1,
                }}
              >
                <p className="text-sm" style={{ color: 'hsl(35 15% 80%)' }}>
                  <span style={{ color: 'hsl(35 80% 55%)' }}>[{item.start_formatted}] {item.speaker}:</span>{' '}
                  {item.text}
                </p>
                <p className="text-xs italic" style={{ color: 'hsl(35 10% 40%)' }}>
                  {item.classification} — {item.reason} ({Math.round(item.confidence * 100)}%)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={!isDrop ? 'default' : 'outline'}
                    className="h-6 text-xs px-3"
                    onClick={() => isDrop && toggle(item.index)}
                  >
                    Keep
                  </Button>
                  <Button
                    size="sm"
                    variant={isDrop ? 'destructive' : 'outline'}
                    className="h-6 text-xs px-3"
                    onClick={() => !isDrop && toggle(item.index)}
                  >
                    Drop
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 pt-4 border-t border-border bg-background/80 backdrop-blur-sm">
          <Button
            className="w-full"
            disabled={confirmReview.isPending}
            onClick={() => confirmReview.mutate({ sessionId, drops: Array.from(dropped) })}
          >
            {confirmReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Review ({dropped.size} line{dropped.size !== 1 ? 's' : ''} dropped)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session/ooc-review-sheet.tsx
git commit -m "feat(ui): OocReviewSheet component"
```

---

### Task 11: Wire badge and sheet into session hub

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` (or the session hub client component it renders)

- [ ] **Step 1: Read the session hub component to find the transcript card**

Read `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` (and any child component it renders that shows transcript data) to find where to insert the badge.

- [ ] **Step 2: Add imports**

In the component that renders the transcript card, add:

```tsx
import { TranscriptCleanupBadge } from '@/components/session/transcript-cleanup-badge';
import { OocReviewSheet } from '@/components/session/ooc-review-sheet';
```

- [ ] **Step 3: Add state for sheet**

```tsx
const [oocSheetOpen, setOocSheetOpen] = useState(false);
```

- [ ] **Step 4: Render the badge + sheet near the transcript card**

Find the transcript section in the component and add:

```tsx
{transcript && (
  <>
    <TranscriptCleanupBadge
      sessionId={session.id}
      transcriptId={transcript.id}
      cleanupStatus={transcript.cleanupStatus ?? null}
      oocReviewItemCount={
        Array.isArray(transcript.oocReviewItems)
          ? transcript.oocReviewItems.length
          : 0
      }
      onReviewOpen={() => setOocSheetOpen(true)}
    />
    {Array.isArray(transcript.oocReviewItems) && transcript.oocReviewItems.length > 0 && (
      <OocReviewSheet
        open={oocSheetOpen}
        onClose={() => setOocSheetOpen(false)}
        sessionId={session.id}
        items={transcript.oocReviewItems as any}
      />
    )}
  </>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): wire TranscriptCleanupBadge and OocReviewSheet into session hub"
```

---

### Task 12: Smoke test end-to-end

- [ ] **Step 1: Start dev server and worker**

```bash
npm run dev
# In a separate terminal:
npm run worker:transcript-cleanup
```

- [ ] **Step 2: Verify worker starts without errors**

Expected output:
```
[CleanupWorker] Started — listening on transcript-cleanup queue
```

- [ ] **Step 3: Check TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup — transcript cleanup worker complete"
git push origin main
```
