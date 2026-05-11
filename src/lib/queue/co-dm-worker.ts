import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { chatWithAI } from '../ai/chat';
import { buildCoDMPrompt } from '../ai/co-dm-prompts';
import { getConfidenceLevel } from '../co-dm/decision-engine';
import { brainRepository } from '../../server/repositories/brain.repository';
import { coDMQueue } from './co-dm-queue';
import { getRedisConnection } from './queue';
import Redis from 'ioredis';
import type { CoDMAnalysisJobData, CoDMAnalysisJobResult } from './co-dm-queue';
import type { CoDMSuggestion } from '../co-dm/types';

const SUGGESTIONS_TTL = 60 * 60; // 1 hour

function getRedisClient(): Redis {
  const conn = getRedisConnection();
  return new Redis(conn as any);
}

function parseCoDMResponse(raw: string): Array<{
  type: CoDMSuggestion['type'];
  score: number;
  message: string;
  detail?: string;
  entityId?: string;
}> {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

async function processCoDMJob(data: CoDMAnalysisJobData): Promise<CoDMAnalysisJobResult> {
  const redisClient = getRedisClient();

  try {
    const entities = await brainRepository.findEntities(data.campaignId, { limit: 50 });

    const suggestionsKey = `co-dm:${data.sessionId}:suggestions`;
    const existingRaw = await redisClient.get(suggestionsKey);
    const existingSuggestions: CoDMSuggestion[] = existingRaw ? JSON.parse(existingRaw) : [];

    const prompt = buildCoDMPrompt(data.transcriptChunk, {
      entities,
      recentSuggestions: existingSuggestions,
    });

    const raw = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.3 });

    let parsed: Array<{ type: CoDMSuggestion['type']; score: number; message: string; detail?: string; entityId?: string }>;
    try {
      parsed = parseCoDMResponse(raw);
    } catch {
      console.warn('[co-dm] Failed to parse AI response, skipping');
      return { success: true, suggestionsCreated: 0 };
    }

    const newSuggestions: CoDMSuggestion[] = parsed
      .filter((s) => s.score >= 0.3)
      .map((s) => ({
        id: randomUUID(),
        type: s.type,
        confidence: getConfidenceLevel(s.score),
        message: s.message,
        detail: s.detail,
        entityId: s.entityId,
        sessionId: data.sessionId,
        createdAt: new Date(),
        dismissed: false,
      }));

    const merged = [...existingSuggestions, ...newSuggestions].slice(-50);
    await redisClient.set(suggestionsKey, JSON.stringify(merged), 'EX', SUGGESTIONS_TTL);

    return { success: true, suggestionsCreated: newSuggestions.length };
  } finally {
    await redisClient.quit();
  }
}

const worker = new Worker<CoDMAnalysisJobData, CoDMAnalysisJobResult>(
  coDMQueue.name,
  async (job) => {
    try {
      return await processCoDMJob(job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[co-dm] Job failed for session ${job.data.sessionId}:`, message);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[co-dm] Job ${job.id} completed: ${result.suggestionsCreated} suggestions created`);
});

worker.on('failed', (job, err) => {
  console.error(`[co-dm] Job ${job?.id} failed:`, err.message);
});

console.log('[co-dm] Worker started');

async function shutdown() {
  console.log('[co-dm] Shutting down...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
