/**
 * BullMQ Worker for Map Generation
 * Run: npm run worker:map-generation
 */
import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from './queue';
import { generateImage } from '../ai/image-generation';
import type { MapGenerationJobData, MapGenerationJobResult } from './map-generation-queue';

const prisma = new PrismaClient();

async function processMapGenerationJob(job: Job<MapGenerationJobData>): Promise<MapGenerationJobResult> {
  const { target, campaignId, prompt } = job.data;

  // Higgsfield-first via the shared image pipeline (Higgsfield → ComfyUI → RunPod → fal → …).
  // generateImage uploads to storage itself; we just persist the resulting URL.
  const result = await generateImage({
    userId: `map-gen:${campaignId}`,
    type: 'location',
    name: `map-${target.kind}-${target.id}`,
    prompt,
    width: 1024,
    height: 768,
    storageKeyPrefix: `maps/${target.kind}/${target.id}`,
  });

  const backgroundUrl = result.url;

  if (target.kind === 'campaignMap') {
    await prisma.campaignMap.update({
      where: { id: target.id },
      data: { backgroundType: 'GENERATED', backgroundUrl },
    });
  } else {
    await prisma.encounter.update({
      where: { id: target.id },
      data: { mapImageUrl: backgroundUrl },
    });
  }

  return { success: true, backgroundUrl };
}

const worker = new Worker<MapGenerationJobData, MapGenerationJobResult>(
  'map-generation',
  processMapGenerationJob,
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('completed', (job) => console.log(`[map-generation] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[map-generation] Job ${job?.id} failed:`, err));

console.log('[map-generation] Worker started');

async function shutdown() {
  console.log('[map-generation] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
