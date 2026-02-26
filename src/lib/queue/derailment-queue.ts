/**
 * BullMQ Queue for Derailment Detection
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