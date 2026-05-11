/**
 * Combat Copilot Worker
 * Processes combat-copilot queue jobs: extracts structured combat events via Ollama.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { chatWithOllama } from '@/lib/ai/ollama';
import { combatCopilotQueue } from './combat-copilot-queue';
import type {
  CombatCopilotJobData,
  CombatCopilotJobResult,
} from './combat-copilot-queue';

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

const COMBAT_COPILOT_SYSTEM_PROMPT = `You are a D&D 5e combat analyst. Extract structured combat data from this session transcript.
Return ONLY valid JSON matching exactly this schema - no markdown, no explanation:
{
  "participants": [
    {
      "name": "character or monster name",
      "hpChanges": [{"amount": -12, "cause": "fireball", "round": 2}],
      "conditions": [{"name": "Stunned", "applied": true, "round": 1}, {"name": "Stunned", "applied": false, "round": 3}],
      "concentration": [{"spell": "Hold Person", "started": true, "round": 2}]
    }
  ]
}`;

function parseCombatCopilotResponse(raw: string) {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  return JSON.parse(text);
}

async function processCombatCopilotJob(
  data: CombatCopilotJobData
): Promise<CombatCopilotJobResult> {
  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: { combatCopiloterStatus: 'pending' },
  });

  const transcriptText = data.transcriptText.slice(0, 10000);
  const userPrompt = `Extract all combat events from this transcript:\n\n${transcriptText}`;
  const content = await chatWithOllama(
    [
      { role: 'system', content: COMBAT_COPILOT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.1 }
  );

  let parsed: unknown;
  try {
    parsed = parseCombatCopilotResponse(content);
  } catch {
    await prisma.gameSession.update({
      where: { id: data.sessionId },
      data: { combatCopiloterStatus: 'error' },
    });
    return { success: false, error: 'Failed to parse combat copilot JSON response' };
  }

  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: {
      combatCopiloterStatus: 'done',
      combatCopiloterData: parsed as Prisma.InputJsonValue,
    },
  });

  return { success: true };
}

const worker = new Worker<CombatCopilotJobData, CombatCopilotJobResult>(
  combatCopilotQueue.name,
  async (job) => {
    try {
      return await processCombatCopilotJob(job.data);
    } catch (error) {
      await prisma.gameSession
        .update({
          where: { id: job.data.sessionId },
          data: { combatCopiloterStatus: 'error' },
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
  console.log(`[combat-copilot] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[combat-copilot] Job ${job?.id} failed:`, err.message);
});

console.log('[combat-copilot] Worker started');
