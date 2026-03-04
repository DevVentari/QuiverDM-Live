/**
 * BullMQ Queue for Combat Copilot Extraction
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

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

export async function addCombatCopilotJob(data: CombatCopilotJobData) {
  return combatCopilotQueue.add('extract-combat', data);
}
