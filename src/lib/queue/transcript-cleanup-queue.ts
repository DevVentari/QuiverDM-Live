import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface TranscriptCleanupJobData {
  transcriptId: string;
  sessionId: string;
  campaignId: string;
  phase: 'basic' | 'ooc';
}

export interface TranscriptCleanupJobResult {
  success: boolean;
  phase: 'basic' | 'ooc';
  utterancesOut?: number;
  oocFlagged?: number;
  error?: string;
}

export const transcriptCleanupQueue = new Queue<TranscriptCleanupJobData, TranscriptCleanupJobResult>(
  'transcript-cleanup',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addTranscriptCleanupJob(data: TranscriptCleanupJobData) {
  return transcriptCleanupQueue.add(
    `cleanup-${data.phase}-${data.transcriptId}`,
    data,
    { jobId: `cleanup-${data.phase}-${data.transcriptId}` }
  );
}
