import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface CoDMAnalysisJobData {
  sessionId: string;
  campaignId: string;
  transcriptChunk: string;
  chunkIndex: number;
}

export interface CoDMAnalysisJobResult {
  success: boolean;
  suggestionsCreated: number;
  error?: string;
}

export const coDMQueue = new Queue<CoDMAnalysisJobData, CoDMAnalysisJobResult>(
  'co-dm-analysis',
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

export async function addCoDMAnalysisJob(data: CoDMAnalysisJobData) {
  return coDMQueue.add(`co-dm-chunk-${data.sessionId}-${data.chunkIndex}`, data);
}
