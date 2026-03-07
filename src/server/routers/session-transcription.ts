import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import {
  createTranscriptionJob,
  getTranscriptionProgress,
  getTranscriptionProgressBySessionId,
} from '@/lib/transcription/progress';
import { addTranscriptionJob } from '@/lib/queue/transcription-queue';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/server/errors';
import { authz } from '../services/authorization.service';

export const sessionTranscriptionRouter = router({
  transcribeSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        recordingId: z.string().optional(),
        filePath: z.string(),
        fileUrl: z.string().optional(),
        modelSize: z
          .enum(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3'])
          .default('medium'),
        language: z.string().optional(),
        useGPU: z.boolean().default(true),
        useSpeakers: z.boolean().default(false),
        numSpeakers: z.number().optional(),
        speakerNames: z.array(z.string()).optional(),
        deleteOriginalFile: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();
      if (input.recordingId) {
        await authz.recording(input.recordingId, userId);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: { campaignId: true },
      });
      if (!session) {
        throw new NotFoundError('session', input.sessionId);
      }

      const jobId = await createTranscriptionJob({
        sessionId: input.sessionId,
        recordingId: input.recordingId,
        filePath: input.filePath,
        modelSize: input.modelSize,
        language: input.language,
        useGPU: input.useGPU,
        useSpeakers: input.useSpeakers,
        speakerNames: input.speakerNames,
        numSpeakers: input.numSpeakers,
      });

      await addTranscriptionJob({
        jobId,
        sessionId: input.sessionId,
        recordingId: input.recordingId,
        userId,
        audioUrl: input.filePath,
        isVideo: /\.(mp4|mkv|avi|mov|webm)$/i.test(input.filePath),
        speakerLabels: input.useSpeakers,
        language: input.language,
        deleteOriginalFile: input.deleteOriginalFile,
        fileUrl: input.fileUrl,
        campaignId: session.campaignId,
      });

      return { success: true, jobId };
    }),

  /**
   * Get transcription progress by job ID
   */
  getTranscriptionProgress: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const progress = await getTranscriptionProgress(input.jobId);
      if (!progress) {
        throw new Error('Transcription job not found');
      }
      return progress;
    }),

  /**
   * Get all transcription jobs for a session
   */
  getSessionTranscriptionJobs: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();
      return await getTranscriptionProgressBySessionId(input.sessionId);
    }),

  startLiveTranscription: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        sampleRate: z.number().default(16000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const access = await authz.session(input.sessionId, userId).verify();
      if (!access.isDM) {
        throw new ForbiddenError('Only DMs can start live transcription');
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: { campaignId: true },
      });

      if (!session) {
        throw new NotFoundError('session', input.sessionId);
      }

      const token = randomUUID();
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

      try {
        await redis.setex(
          `live-session-token:${token}`,
          60,
          JSON.stringify({
            userId,
            sessionId: input.sessionId,
            campaignId: session.campaignId,
            sampleRate: input.sampleRate,
          })
        );
      } finally {
        await redis.quit();
      }

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3004';
      return { wsUrl, token };
    }),

  stopLiveTranscription: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();

      const { liveSessionManager } = (await import('@/lib/transcription/live-session-manager')) as {
        liveSessionManager: {
          stopLiveSession: (sessionId: string) => Promise<string | null | undefined>;
        };
      };

      const transcriptId = await liveSessionManager.stopLiveSession(input.sessionId);
      return { transcriptId: transcriptId ?? null };
    }),

  getLiveTranscriptionStatus: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();

      const { liveSessionManager } = (await import('@/lib/transcription/live-session-manager')) as {
        liveSessionManager: {
          isSessionLive: (sessionId: string) => boolean;
          getSessionInfo: (sessionId: string) => unknown;
        };
      };

      const isLive = liveSessionManager.isSessionLive(input.sessionId);
      const info = isLive ? liveSessionManager.getSessionInfo(input.sessionId) : null;

      return { isLive, sessionId: input.sessionId, info };
    }),
});
