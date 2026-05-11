import dotenv from 'dotenv';
dotenv.config();

import { Worker, Queue } from 'bullmq';
import { getRedisConnection } from './queue';
import { chatWithAI } from '../ai/chat';
import { brainRepository } from '../../server/repositories/brain.repository';
import { prisma } from '../prisma';
import Redis from 'ioredis';

const PREP_TTL = 24 * 60 * 60; // 24 hours

export interface CoDMPrepJobData {
  campaignId: string;
  sessionId: string;
}

export interface CoDMPrepJobResult {
  success: boolean;
  error?: string;
}

export const coDMPrepQueue = new Queue<CoDMPrepJobData, CoDMPrepJobResult>(
  'co-dm-prep',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

function getRedisClient(): Redis {
  return new Redis(getRedisConnection() as any);
}

async function processCoDMPrepJob(data: CoDMPrepJobData): Promise<CoDMPrepJobResult> {
  const redisClient = getRedisClient();

  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: data.sessionId },
      select: { aiSummary: true, title: true, sessionNumber: true },
    });

    if (!session?.aiSummary) {
      console.warn(`[co-dm-prep] No aiSummary for session ${data.sessionId}, skipping`);
      return { success: true };
    }

    const entities = await brainRepository.findEntities(data.campaignId, { limit: 50 });
    const worldState = await brainRepository.getOrCreateState(data.campaignId);

    const entityList = entities
      .slice(0, 20)
      .map((e) => `- ${e.name} (${e.type}): ${e.description?.slice(0, 80) ?? ''}`)
      .join('\n');

    const hooks = Array.isArray(worldState.hooks)
      ? (worldState.hooks as Array<{ text: string; urgency: string }>)
          .filter((h) => h.urgency === 'high')
          .slice(0, 5)
          .map((h) => `- ${h.text}`)
          .join('\n')
      : '';

    const prompt = `You are an experienced Co-DM helping prepare for the next D&D session.

## Last Session Summary
${session.aiSummary.slice(0, 3000)}

## Active World Entities
${entityList || 'None tracked.'}

## Open High-Urgency Hooks
${hooks || 'None.'}

Based on this, provide between-session prep guidance as JSON:
{
  "npcMotivationUpdates": [
    { "entityName": "NPC name", "motivation": "updated motivation description" }
  ],
  "factionShifts": [
    { "factionName": "Faction name", "shift": "description of political/power shift" }
  ],
  "nextSessionFocus": [
    "focus item 1",
    "focus item 2",
    "focus item 3"
  ],
  "generatedAt": "ISO timestamp"
}

Return ONLY valid JSON — no markdown, no explanation.`;

    const raw = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.4 });

    let parsed: unknown;
    let text = raw.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    else if (text.startsWith('```')) text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');

    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn('[co-dm-prep] Failed to parse AI response');
      return { success: false, error: 'Failed to parse prep response' };
    }

    const prepKey = `co-dm:prep:${data.campaignId}`;
    await redisClient.set(prepKey, JSON.stringify(parsed), 'EX', PREP_TTL);

    return { success: true };
  } finally {
    await redisClient.quit();
  }
}

const worker = new Worker<CoDMPrepJobData, CoDMPrepJobResult>(
  coDMPrepQueue.name,
  async (job) => {
    try {
      return await processCoDMPrepJob(job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[co-dm-prep] Job failed for campaign ${job.data.campaignId}:`, message);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`[co-dm-prep] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[co-dm-prep] Job ${job?.id} failed:`, err.message);
});

console.log('[co-dm-prep] Worker started');

async function shutdown() {
  console.log('[co-dm-prep] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
