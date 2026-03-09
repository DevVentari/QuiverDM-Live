/**
 * AI Summary Worker
 * Processes ai-summary queue jobs: generates session summaries + highlights via Ollama.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { chatWithAI } from '../ai/chat';
import type {
  AiSummaryJobData,
  AiSummaryJobResult,
  AiHighlight,
} from './ai-summary-queue';
import { addBrainIngestionJob } from './brain-ingestion-queue';

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

const SUMMARY_BASE_PROMPT = `You are a D&D session scribe. Given a session transcript, produce:
1. A markdown summary (3-5 paragraphs) covering key events, decisions, and story beats.
2. An array of highlight moments tagged by type.

Respond ONLY with valid JSON in this exact shape:
{
  "summary": "<markdown string>",
  "highlights": [
    { "type": "decision|npc_change|cliffhanger|combat|loot", "text": "<1-2 sentence description>", "speakerLabel": "<optional speaker name>" }
  ]
}`;

const WEB_SPEECH_ADDENDUM = `

IMPORTANT: This transcript was captured via browser speech recognition. It likely contains transcription errors, run-on sentences, missing punctuation, and gaps where audio was lost. Speaker attribution is not available — do not attempt to identify or label who said what. Focus on narrative events, key decisions, NPC interactions, and combat outcomes. Be tolerant of proper noun errors (character names, location names, spell names may be phonetically garbled). Do not include a speakerLabel field in any highlight.`;

function getSummarySystemPrompt(transcriptSource?: string): string {
  if (transcriptSource === 'web_speech') {
    return SUMMARY_BASE_PROMPT + WEB_SPEECH_ADDENDUM;
  }
  return SUMMARY_BASE_PROMPT;
}

function parseSummaryResponse(raw: string): {
  summary: string;
  highlights: AiHighlight[];
} {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(text) as {
    summary?: unknown;
    highlights?: unknown;
  };
  if (typeof parsed.summary !== 'string') {
    throw new Error('LLM response is missing summary');
  }

  const allowedTypes = new Set<AiHighlight['type']>([
    'decision',
    'npc_change',
    'cliffhanger',
    'combat',
    'loot',
  ]);

  const highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
  const normalized: AiHighlight[] = highlights
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const type = String(item.type ?? '').trim() as AiHighlight['type'];
      const textValue = String(item.text ?? '').trim();
      const highlight: AiHighlight = {
        type: allowedTypes.has(type) ? type : 'decision',
        text: textValue,
      };
      if (typeof item.timestampMs === 'number' && Number.isFinite(item.timestampMs)) {
        highlight.timestampMs = item.timestampMs;
      }
      if (typeof item.speakerLabel === 'string' && item.speakerLabel.trim()) {
        highlight.speakerLabel = item.speakerLabel.trim();
      }
      return highlight;
    })
    .filter((item) => item.text.length > 0);

  return {
    summary: parsed.summary,
    highlights: normalized,
  };
}

async function processSummaryJob(data: AiSummaryJobData): Promise<AiSummaryJobResult> {
  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: { aiSummaryStatus: 'processing', aiSummaryError: null },
  });

  const userPrompt = `Session ${data.sessionNumber}: "${data.sessionTitle}"\n\nTranscript:\n${data.transcriptText.slice(0, 12000)}`;
  const content = await chatWithAI(
    [
      { role: 'system', content: getSummarySystemPrompt(data.transcriptSource) },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.2 }
  );

  const parsed = parseSummaryResponse(content);

  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: {
      aiSummary: parsed.summary,
      aiHighlights: parsed.highlights as unknown as Prisma.InputJsonValue,
      aiSummaryStatus: 'done',
      aiSummaryAt: new Date(),
      aiSummaryError: null,
    },
  });

  const session = await prisma.gameSession.findUnique({
    where: { id: data.sessionId },
    select: { campaignId: true },
  });
  if (session?.campaignId) {
    await addBrainIngestionJob({
      sessionId: data.sessionId,
      campaignId: session.campaignId,
      summary: parsed.summary,
      highlights: parsed.highlights,
    }).catch(err => {
      console.warn('[ai-summary] Failed to queue brain ingestion:', err);
    });
  }

  return { success: true, summary: parsed.summary, highlights: parsed.highlights };
}

const worker = new Worker<AiSummaryJobData, AiSummaryJobResult>(
  'ai-summary',
  async (job) => {
    try {
      return await processSummaryJob(job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await prisma.gameSession
        .update({
          where: { id: job.data.sessionId },
          data: { aiSummaryStatus: 'error', aiSummaryError: message },
        })
        .catch(() => undefined);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`[ai-summary] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[ai-summary] Job ${job?.id} failed:`, err.message);
});

console.log('[ai-summary] Worker started');
