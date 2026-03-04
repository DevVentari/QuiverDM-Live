/**
 * Player Recap Worker
 * Processes player-recap queue jobs: generates player-safe recaps via Ollama.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import { chatWithOllama } from '../ai/ollama';
import type { PlayerRecapJobData, PlayerRecapJobResult } from './player-recap-queue';

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

const PLAYER_RECAP_SYSTEM_PROMPT = `You are a narrator writing a session recap for D&D players.
Write a player-safe, 120-150 word narrative recap in second person past tense.
Focus on what the party experienced - no DM secrets, no metagame, no NPC motivations they haven't discovered.
Use exciting, immersive language. Start mid-action if possible.
Return ONLY the recap text - no title, no markdown headers, just the narrative paragraph(s).`;

async function processPlayerRecapJob(data: PlayerRecapJobData): Promise<PlayerRecapJobResult> {
  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: { playerRecapStatus: 'pending' },
  });

  const userPrompt = `Write a player recap for this session summary:\n\nSession: ${data.sessionTitle ?? `Session ${data.sessionNumber}`}\n\n${data.aiSummary}`;
  const recapText = await chatWithOllama(
    [
      { role: 'system', content: PLAYER_RECAP_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.3 }
  );

  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: {
      playerRecapStatus: 'done',
      playerRecap: recapText,
    },
  });

  return { success: true, recap: recapText };
}

const worker = new Worker<PlayerRecapJobData, PlayerRecapJobResult>(
  'player-recap',
  async (job) => {
    try {
      return await processPlayerRecapJob(job.data);
    } catch (error) {
      await prisma.gameSession
        .update({
          where: { id: job.data.sessionId },
          data: { playerRecapStatus: 'error' },
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
  console.log(`[player-recap] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[player-recap] Job ${job?.id} failed:`, err.message);
});

console.log('[player-recap] Worker started');
