import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
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

  getTranscriptionProgress: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      void userId;
      const progress = await getTranscriptionProgress(input.jobId);
      if (!progress) {
        throw new Error('Transcription job not found');
      }
      return progress;
    }),

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

  saveWebSpeechTranscript: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        segments: z.array(
          z.object({
            text: z.string(),
            timestamp: z.number(),
          })
        ),
        durationSeconds: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const access = await authz.session(input.sessionId, userId).verify();
      if (!access.isDM) {
        throw new ForbiddenError('Only DMs can save transcripts');
      }

      const rawText = input.segments.map((s) => s.text).join(' ');
      if (!rawText.trim()) {
        return { transcriptId: null };
      }

      const transcript = await prisma.transcript.create({
        data: {
          sessionId: input.sessionId,
          rawText,
          source: 'web_speech',
          durationSeconds: input.durationSeconds ?? null,
          hasSpeakers: false,
          timestamps: input.segments.map((s, i) => ({
            index: i,
            text: s.text,
            timestamp: s.timestamp,
          })),
        },
      });

      return { transcriptId: transcript.id };
    }),
});
