/**
 * BullMQ Queue for AI Session Summary Generation
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

export interface AiHighlight {
  type: 'decision' | 'npc_change' | 'cliffhanger' | 'combat' | 'loot';
  text: string;
  timestampMs?: number;
  speakerLabel?: string;
}

export interface AiSummaryJobData {
  jobId: string; // GameSession.id
  sessionId: string;
  userId: string;
  transcriptText: string;
  sessionTitle: string;
  sessionNumber: number;
}

export interface AiSummaryJobResult {
  success: boolean;
  summary?: string;
  highlights?: AiHighlight[];
  error?: string;
}

export const aiSummaryQueue = new Queue<AiSummaryJobData, AiSummaryJobResult>(
  'ai-summary',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addAiSummaryJob(data: AiSummaryJobData) {
  return aiSummaryQueue.add(`summarize-${data.sessionId}`, data, {
    jobId: data.jobId,
  });
}

