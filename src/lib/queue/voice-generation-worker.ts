/**
 * BullMQ Worker for Voice Clip Generation
 * Run: npm run worker:voice-generation
 */
import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from './queue';
import { storage } from '../storage';
import { getTtsProvider } from '../voice/tts';
import { processVoiceClipJob } from './voice-generation-processor';
import type { VoiceGenerationJobData } from './voice-generation-queue';

const prisma = new PrismaClient();

const worker = new Worker<VoiceGenerationJobData>(
  'voice-generation',
  async (job: Job<VoiceGenerationJobData>) => {
    const { clipId } = job.data;
    console.log(`[VoiceWorker] Processing clip ${clipId}`);

    await processVoiceClipJob(clipId, {
      getClip: (id) =>
        prisma.voiceClip.findUnique({
          where: { id },
          select: { id: true, campaignId: true, entityId: true, text: true, voiceId: true, status: true },
        }),
      updateClip: async (id, data) => {
        await prisma.voiceClip.update({ where: { id }, data: data as any });
      },
      synthesize: (input) => getTtsProvider().synthesize(input),
      uploadAudio: (id, audio, contentType) =>
        storage.upload(`voice/${id}.mp3`, audio, contentType),
    });
  },
  { connection: getRedisConnection() as any, concurrency: 3 }
);

worker.on('completed', (job) => console.log(`[VoiceWorker] Completed ${job.id}`));
worker.on('failed', (job, err) => console.error(`[VoiceWorker] Failed ${job?.id}:`, err.message));

console.log('[VoiceWorker] Listening on queue "voice-generation"');
