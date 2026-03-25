import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface BrainIngestionJobData {
  sessionId: string | null;
  campaignId: string;
  summary: string;
  highlights?: Array<{ type: string; text: string }>;
  source?: string;
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
  const jobKey = data.sessionId
    ? `brain-ingest-${data.sessionId}`
    : `brain-ingest-campaign-${data.campaignId}`;
  return brainIngestionQueue.add(jobKey, data, {
    jobId: data.sessionId
      ? `brain-${data.sessionId}`
      : `brain-campaign-${data.campaignId}`,
  });
}
