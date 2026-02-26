/**
 * BullMQ Queue for Combat Copilot Extraction
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

export interface CombatCopilotJobData {
  sessionId: string;
  transcriptText: string;
}

export interface CombatCopilotJobResult {
  success: boolean;
  error?: string;
}

export const combatCopilotQueue = new Queue<
  CombatCopilotJobData,
  CombatCopilotJobResult
>('combat-copilot', {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 15000 },
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});
