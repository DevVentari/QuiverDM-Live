/**
 * BullMQ Worker for Image Generation
 * Run: npm run worker:image
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { storage } from '../storage';
import type { ImageGenerationJobData } from './image-generation-queue';

// This module is created by Agent E
import { generateImage } from '../ai/image-generation';

const prisma = new PrismaClient();

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

async function updateJobStatus(jobId: string, update: {
  status?: string;
  progress?: number;
  resultUrl?: string;
  errorMessage?: string;
  workflowId?: string;
  provider?: string;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  await prisma.imageGenerationJob.update({
    where: { id: jobId },
    data: update as any,
  });
}

const worker = new Worker<ImageGenerationJobData>(
  'image-generation',
  async (job: Job<ImageGenerationJobData>) => {
    const { jobId, homebrewId, npcId, userId, type, name, description, imagePromptHint, customPrompt } = job.data;
    const targetId = homebrewId ?? npcId;
    if (!targetId) {
      throw new Error(`Job ${jobId} is missing both homebrewId and npcId`);
    }

    console.log(`[ImageWorker] Processing job ${jobId} for targetId=${targetId}`);

    await updateJobStatus(jobId, { status: 'processing', progress: 10 });

    try {
      const comfyUrl = process.env.COMFYUI_URL;
      if (comfyUrl) {
        process.env.COMFYUI_ENABLED = 'true';
        console.log(`[ImageWorker] COMFYUI_URL is set (${comfyUrl}); prioritizing ComfyUI`);
      }

      const result = await generateImage({
        homebrewId,
        npcId,
        userId,
        type,
        name,
        description,
        imagePromptHint,
        prompt: customPrompt,
      });

      await updateJobStatus(jobId, {
        status: 'completed',
        progress: 100,
        resultUrl: result.url,
        provider: result.provider,
        completedAt: new Date(),
        metadata: result.metadata as any,
      });

      if (type === 'npc') {
        await prisma.nPC.update({
          where: { id: targetId },
          data: {
            imageUrl: result.url,
            imageJobId: null,
          },
        });
      } else if (homebrewId) {
        // Keep existing image history while also tracking latest generated image.
        await prisma.homebrewContent.update({
          where: { id: homebrewId },
          data: {
            images: { push: result.url },
            imageUrl: result.url,
            imageJobId: null,
          },
        });
      }

      console.log(`[ImageWorker] Job ${jobId} complete -> ${result.url}`);
      return { url: result.url, provider: result.provider };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ImageWorker] Job ${jobId} failed:`, errorMessage);

      await updateJobStatus(jobId, {
        status: 'failed',
        errorMessage,
      });

      if (type === 'npc' && targetId) {
        await prisma.nPC.update({
          where: { id: targetId },
          data: { imageJobId: null },
        }).catch(() => undefined);
      }

      if (homebrewId) {
        await prisma.homebrewContent.update({
          where: { id: homebrewId },
          data: { imageJobId: null },
        }).catch(() => undefined);
      }

      throw error; // Let BullMQ handle retries
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 2, // Process up to 2 images simultaneously
  }
);

worker.on('completed', (job) => {
  console.log(`[ImageWorker] ✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[ImageWorker] ❌ Job ${job?.id} failed:`, err.message);
});

console.log('[ImageWorker] Image generation worker started');

// Graceful shutdown
async function shutdown() {
  console.log('[ImageWorker] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
