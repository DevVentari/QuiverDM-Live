import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import type { ObsidianImportJobData } from './obsidian-import-queue';
import { processJob } from './obsidian-import-process';

function getRedisConnection() {
  // BullMQ workers require persistent blocking connections (LMPOP/BLMOVE).
  // Upstash serverless Redis doesn't support these — always use local Redis.
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

const worker = new Worker<ObsidianImportJobData>(
  'obsidian-import',
  async (job: Job<ObsidianImportJobData>) => {
    await processJob(job.data);
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('failed', async (job, err) => {
  if (job) {
    await prisma.obsidianImportJob
      .update({
        where: { id: job.data.jobId },
        data: {
          status: 'error',
          progress: { total: 0, done: 0, currentFile: '', errors: [err.message] },
        },
      })
      .catch(() => {});
  }
  console.error('[obsidian-import] job failed:', err);
});

console.log('[obsidian-import-worker] listening...');
