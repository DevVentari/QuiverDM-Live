import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from './queue';
import OpenAI from 'openai';
import type { TranscriptCleanupJobData, TranscriptCleanupJobResult } from './transcript-cleanup-queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient() as any;

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

  let entries: Entry[] = rawTimestamps.map(t => ({
    speaker: t.speaker,
    start: t.start,
    end: t.end,
    start_formatted: formatTimestamp(t.start),
    end_formatted: formatTimestamp(t.end),
    text: t.text,
  }));

  const globalCorrections = loadGlobalCorrections();
  const campaignCorrections = await prisma.transcriptCorrection.findMany({
    where: { campaignId },
    select: { wrong: true, correct: true },
  });
  const allCorrections: Record<string, string> = {
    ...globalCorrections,
    ...Object.fromEntries(campaignCorrections.map((c: { wrong: string; correct: string }) => [c.wrong, c.correct])),
  };

  entries = applyCorrections(entries, allCorrections);
  entries = trimPreSessionNoise(entries);
  entries = runMergePasses(entries);
  entries = dropStandaloneFillers(entries);

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

  const sessionNameMatch = transcript.correctedText.match(/^# (.+) — Session Transcript/m);
  const sessionName = sessionNameMatch?.[1] ?? 'Session';
  const correctedText = buildMarkdown(cleanedEntries, sessionName);

  await prisma.transcript.update({
    where: { id: transcriptId },
    data: {
      correctedText,
      oocReviewItems: reviewItems.length > 0 ? reviewItems : null,
      cleanupStatus: reviewItems.length > 0 ? 'ooc_pending_review' : 'complete',
    },
  });

  console.log(`[CleanupWorker] ooc done — dropped ${dropIndices.size}, flagged ${reviewItems.length}`);
  return { oocFlagged: reviewItems.length };
}

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
