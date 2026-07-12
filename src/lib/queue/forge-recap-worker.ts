/**
 * Forge Recap Worker
 *
 * Consumes forge-recap-generation jobs and generates a RecapForge session
 * recap via generateSessionRecap.
 *
 * Run with: npx tsx src/lib/queue/forge-recap-worker.ts
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { QUEUE_NAMES, type ForgeRecapJobData } from '@quiverdm/shared';
import { generateSessionRecap } from '@/lib/recapforge/generate-recap';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});
const prisma = new PrismaClient();

const worker = new Worker<ForgeRecapJobData>(
  QUEUE_NAMES.forgeRecap,
  async (job) => {
    const { campaignId, sessionId } = job.data;
    await generateSessionRecap(prisma, { campaignId, sessionId });
  },
  { connection, concurrency: 2 },
);

worker.on('completed', (job) => console.log(`[forge-recap] ${job.id} done`));
worker.on('failed', (job, err) => console.error(`[forge-recap] ${job?.id} failed:`, err));
console.log(`[forge-recap] worker up on ${QUEUE_NAMES.forgeRecap}`);
