import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface MultiTrackJobData {
  uploadGroupId: string;
  sessionId: string;
  campaignId: string;
}

export interface MultiTrackJobResult {
  success: boolean;
  transcriptId?: string;
  tracksProcessed?: number;
  error?: string;
}

export const multiTrackQueue = new Queue<MultiTrackJobData, MultiTrackJobResult>(
  'multi-track-processing',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addMultiTrackJob(data: MultiTrackJobData) {
  return multiTrackQueue.add(
    `multi-track-${data.uploadGroupId}`,
    data,
    { jobId: `multi-track-${data.uploadGroupId}` }
  );
}
