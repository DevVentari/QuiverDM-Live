/**
 * BullMQ Queue for Derailment Detection
 */
import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface DerailmentJobData {
  sessionId: string;
  transcriptText: string;
  quickNotes: string;
}

export interface DerailmentJobResult {
  success: boolean;
  error?: string;
}

export const derailmentQueue = new Queue<DerailmentJobData, DerailmentJobResult>(
  'derailment-detection',
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

export async function addDerailmentJob(data: DerailmentJobData) {
  return derailmentQueue.add('detect-derailment', data);
}