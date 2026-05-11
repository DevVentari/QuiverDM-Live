import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface ContextExtractionJobData {
  transcriptId: string;
  sessionId: string;
  campaignId: string;
}

export interface ContextExtractionJobResult {
  success: boolean;
  chunksWritten: number;
  skipped?: boolean;
}

export const contextExtractionQueue = new Queue<ContextExtractionJobData, ContextExtractionJobResult>(
  'context-extraction',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);
