/**
 * Derailment Detection Worker
 * Processes derailment-detection queue jobs: compares quick notes against transcript via Ollama.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { chatWithOllama } from '../ai/ollama';
import type { DerailmentJobData, DerailmentJobResult } from './derailment-queue';

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

const DERAILMENT_SYSTEM_PROMPT = `You are a D&D session analysis assistant. Analyze whether the party derailed from the DM's planned objectives.
Return ONLY valid JSON matching exactly this schema - no markdown, no explanation:
{
  "isDerailed": true or false,
  "driftScore": 0 to 10,
  "driftDescription": "one sentence describing what happened if derailed, or 'Session stayed on track.' if not",
  "recoveryOptions": ["option 1", "option 2", "option 3"]
}

driftScore: 0=perfectly on track, 5=significant drift, 10=completely off rails
recoveryOptions: 2-3 specific in-world story hooks the DM can use to steer back. If isDerailed=false, return [].`;

function parseDerailmentResponse(raw: string): Prisma.InputJsonValue {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(text) as {
    isDerailed?: unknown;
    driftScore?: unknown;
    driftDescription?: unknown;
    recoveryOptions?: unknown;
  };

  const normalized = {
    isDerailed: Boolean(parsed.isDerailed),
    driftScore:
      typeof parsed.driftScore === 'number' && Number.isFinite(parsed.driftScore)
        ? Math.max(0, Math.min(10, parsed.driftScore))
        : 0,
    driftDescription:
      typeof parsed.driftDescription === 'string' && parsed.driftDescription.trim()
        ? parsed.driftDescription.trim()
        : 'Session stayed on track.',
    recoveryOptions: Array.isArray(parsed.recoveryOptions)
      ? parsed.recoveryOptions
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 3)
      : [],
  };

  if (!normalized.isDerailed) {
    normalized.recoveryOptions = [];
  }

  return normalized as Prisma.InputJsonValue;
}

async function processDerailmentJob(data: DerailmentJobData): Promise<DerailmentJobResult> {
  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: { derailmentStatus: 'pending' },
  });

  const userPrompt = `DM's planned objectives for this session:\n${data.quickNotes || 'No objectives noted.'}\n\nSession transcript:\n${data.transcriptText.slice(0, 8000)}`;

  const content = await chatWithOllama(
    [
      { role: 'system', content: DERAILMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.2 }
  );

  let parsed: Prisma.InputJsonValue;
  try {
    parsed = parseDerailmentResponse(content);
  } catch (error) {
    await prisma.gameSession.update({
      where: { id: data.sessionId },
      data: { derailmentStatus: 'error' },
    });
    throw error;
  }

  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: {
      derailmentStatus: 'done',
      derailmentData: parsed,
    },
  });

  return { success: true };
}

const worker = new Worker<DerailmentJobData, DerailmentJobResult>(
  'derailment-detection',
  async (job) => {
    try {
      return await processDerailmentJob(job.data);
    } catch (error) {
      await prisma.gameSession
        .update({
          where: { id: job.data.sessionId },
          data: { derailmentStatus: 'error' },
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
  console.log(`[derailment-detection] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[derailment-detection] Job ${job?.id} failed:`, err.message);
});

console.log('[derailment-detection] Worker started');