import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface RevelationSyncJobData {
  revelationId: string;
  prepSecretId: string;
  sessionId: string;
  campaignId: string;
}

export interface RevelationSyncJobResult {
  success: boolean;
  entityId?: string;
  relationshipId?: string;
  error?: string;
}

export const revelationSyncQueue = new Queue<RevelationSyncJobData, RevelationSyncJobResult>(
  'secret-revelation-sync',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addRevelationSyncJob(data: RevelationSyncJobData) {
  return revelationSyncQueue.add(
    `sync-revelation-${data.revelationId}`,
    data,
    { jobId: `revelation-${data.revelationId}` }
  );
}
