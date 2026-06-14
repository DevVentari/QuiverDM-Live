/**
 * BullMQ Queue for Voice Clip Generation Jobs
 */
import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

const redisConnection = getRedisConnection();

export interface VoiceGenerationJobData {
  clipId: string; // VoiceClip.id from Prisma
}

export const voiceGenerationQueue = new Queue<VoiceGenerationJobData>(
  'voice-generation',
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

export async function addVoiceGenerationJob(data: VoiceGenerationJobData) {
  return voiceGenerationQueue.add(`generate-${data.clipId}`, data, {
    jobId: data.clipId,
  });
}
