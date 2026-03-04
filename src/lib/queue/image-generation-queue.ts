/**
 * BullMQ Queue for Image Generation Jobs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

const redisConnection = getRedisConnection();

export interface ImageGenerationJobData {
  jobId: string;       // ImageGenerationJob.id from Prisma
  homebrewId?: string;
  npcId?: string;
  userId: string;
  type: string;        // 'item', 'creature', 'spell', etc.
  name: string;
  description?: string;
  imagePromptHint?: string; // Visual description extracted from source PDF
  customPrompt?: string;
}

export const imageGenerationQueue = new Queue<ImageGenerationJobData>(
  'image-generation',
  {
    connection: redisConnection as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addImageGenerationJob(data: ImageGenerationJobData) {
  return imageGenerationQueue.add(`generate-${data.jobId}`, data, {
    jobId: data.jobId,
  });
}
