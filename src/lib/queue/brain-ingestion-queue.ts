import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface BrainIngestionJobData {
  sessionId: string;
  campaignId: string;
  summary: string;
  highlights?: Array<{ type: string; text: string }>;
}

export interface BrainIngestionJobResult {
  success: boolean;
  entitiesCreated: number;
  entitiesUpdated: number;
  relationshipsUpserted: number;
  hooksAdded: number;
  error?: string;
}

export const brainIngestionQueue = new Queue<BrainIngestionJobData, BrainIngestionJobResult>(
  'brain-ingestion',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addBrainIngestionJob(data: BrainIngestionJobData) {
  return brainIngestionQueue.add(`brain-ingest-${data.sessionId}`, data, {
    jobId: `brain-${data.sessionId}`,
  });
}
