import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import type { DdbSyncReviewJobData } from './ddb-sync-queue';

async function processReviewJob(data: DdbSyncReviewJobData) {
  const { sourcebookId } = data;
  await ddbSyncRepository.setSyncStatus(sourcebookId, 'idle');

  const chaptersWithChanges = await ddbSyncRepository.getChaptersWithChanges(sourcebookId);
  if (chaptersWithChanges > 0) {
    console.log(`[ddb-review] ${sourcebookId}: ${chaptersWithChanges} chapters have pending changes`);
  }
}

const worker = new Worker<DdbSyncReviewJobData>(
  'ddb-sync-review',
  async (job: Job<DdbSyncReviewJobData>) => processReviewJob(job.data),
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('failed', (job, err) => console.error('[ddb-sync-review] failed:', err));
console.log('[ddb-sync-review-worker] listening...');
