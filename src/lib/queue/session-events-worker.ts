import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { chatWithOllama } from '@/lib/ai/ollama';
import { sessionEventsQueue } from './session-events-queue';
import {
  SESSION_EVENT_EXTRACTION_PROMPT,
  parseEventExtractionResponse,
} from '@/lib/ai/session-event-extractor';
import type { SessionEventsJobData, SessionEventsJobResult } from './session-events-queue';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatchCharacter(
  name: string | null,
  characters: { id: string; name: string }[]
): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  let best: { id: string; dist: number } | null = null;
  for (const c of characters) {
    const dist = levenshtein(lower, c.name.toLowerCase());
    const threshold = Math.max(2, Math.floor(c.name.length * 0.3));
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { id: c.id, dist };
    }
  }
  return best?.id ?? null;
}

async function applyEventToSessionState(
  sessionId: string,
  characterId: string,
  eventType: string,
  eventData: Record<string, unknown>
) {
  const state = await prisma.characterSessionState.findUnique({
    where: { sessionId_characterId: { sessionId, characterId } },
  });
  if (!state) return;

  const updates: Record<string, unknown> = {};

  if (eventType === 'damage' && typeof eventData.amount === 'number') {
    updates.currentHp = Math.max(0, state.currentHp - eventData.amount);
  } else if (eventType === 'healing' && typeof eventData.amount === 'number') {
    const char = await prisma.character.findUnique({
      where: { id: characterId },
      select: { hitPoints: true },
    });
    const maxHp = (char?.hitPoints as any)?.max ?? state.currentHp + eventData.amount;
    updates.currentHp = Math.min(maxHp, state.currentHp + (eventData.amount as number));
  } else if (eventType === 'condition_applied' && typeof eventData.condition === 'string') {
    const conditions = state.conditionsActive as string[];
    if (!conditions.includes(eventData.condition)) {
      updates.conditionsActive = [...conditions, eventData.condition];
    }
  } else if (eventType === 'condition_removed' && typeof eventData.condition === 'string') {
    const conditions = state.conditionsActive as string[];
    updates.conditionsActive = conditions.filter((c) => c !== eventData.condition);
  } else if (eventType === 'spell_slot_used' && typeof eventData.level === 'number') {
    const slots = state.spellSlotsUsed as Record<string, number>;
    const level = String(eventData.level);
    updates.spellSlotsUsed = { ...slots, [level]: (slots[level] ?? 0) + 1 };
  } else if (eventType === 'spell_applied') {
    const spells = state.activeSpells as any[];
    updates.activeSpells = [
      ...spells,
      {
        spellName: eventData.spellName,
        casterName: eventData.casterName,
        concentration: eventData.concentration,
        duration: eventData.duration,
      },
    ];
  }

  if (Object.keys(updates).length > 0) {
    await prisma.characterSessionState.update({
      where: { sessionId_characterId: { sessionId, characterId } },
      data: updates,
    });
  }
}

async function processSessionEventsJob(
  data: SessionEventsJobData
): Promise<SessionEventsJobResult> {
  // Fetch the transcript for this session — schema has Transcript model (not TranscriptSegment)
  const transcript = await prisma.transcript.findFirst({
    where: { sessionId: data.sessionId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, rawText: true, correctedText: true },
  });

  if (!transcript) return { success: true, eventsExtracted: 0 };

  const transcriptText = (transcript.correctedText ?? transcript.rawText).slice(0, 10000);

  const campaignCharacters = await prisma.character.findMany({
    where: { campaignCharacters: { some: { campaignId: data.campaignId } } },
    select: { id: true, name: true },
  });

  const content = await chatWithOllama(
    [{ role: 'user', content: SESSION_EVENT_EXTRACTION_PROMPT + transcriptText }],
    { temperature: 0.1 }
  );

  const extracted = parseEventExtractionResponse(content);
  if (extracted.length === 0) return { success: true, eventsExtracted: 0 };

  let eventsExtracted = 0;
  for (const event of extracted) {
    const characterId = fuzzyMatchCharacter(event.characterName, campaignCharacters);
    const status = event.confidence >= 0.9 ? 'auto_applied' : 'pending';

    await prisma.sessionMechanicalEvent.create({
      data: {
        sessionId: data.sessionId,
        characterId,
        characterName: event.characterName,
        transcriptSegmentId: transcript.id,
        eventType: event.eventType,
        eventData: event.eventData as any,
        confidence: event.confidence,
        status,
        ...(status === 'auto_applied' ? { appliedAt: new Date() } : {}),
      },
    });

    if (status === 'auto_applied' && characterId) {
      await applyEventToSessionState(data.sessionId, characterId, event.eventType, event.eventData);
    }

    eventsExtracted++;
  }

  return { success: true, eventsExtracted };
}

const worker = new Worker<SessionEventsJobData, SessionEventsJobResult>(
  sessionEventsQueue.name,
  async (job) => {
    try {
      return await processSessionEventsJob(job.data);
    } catch (error) {
      console.error('[session-events] Job failed:', error);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[session-events] Job ${job.id} completed — ${result.eventsExtracted} events extracted`);
});

worker.on('failed', (job, err) => {
  console.error(`[session-events] Job ${job?.id} failed:`, err.message);
});

console.log('[session-events] Worker started');
