import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import { processChapterJob } from './ddb-chapter-extract';
import { PrismaWriteSink } from './ddb-write-sink';
import type { DdbChapterExtractJobData } from './ddb-sync-queue';

const sink = new PrismaWriteSink();

const worker = new Worker<DdbChapterExtractJobData>(
  'ddb-chapter-extract',
  async (job: Job<DdbChapterExtractJobData>) => processChapterJob(job.data, { sink }),
  { connection: getRedisConnection() as any, concurrency: 3 }
);

worker.on('failed', async (job, err) => {
  if (job) await ddbSyncRepository.setChapterSyncStatus(job.data.chapterId, 'error').catch(() => {});
  console.error('[ddb-chapter-extract] failed:', err);
});

console.log('[ddb-chapter-extract-worker] listening...');
