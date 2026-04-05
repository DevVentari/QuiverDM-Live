import { router } from '../trpc';
import { campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';
import { getPresignedUploadUrl } from '@/lib/storage/r2';
import { getStorageMode } from '@/lib/storage';
import { addMultiTrackJob } from '@/lib/queue/multi-track-queue';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm',
  'audio/flac', 'audio/x-m4a', 'audio/aac',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const multiTrackUploadRouter = router({
  initiate: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string(),
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
        contentType: z.string(),
        uploadGroupId: z.string().min(1).max(50),
        speakerTag: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!ALLOWED_AUDIO_TYPES.includes(input.contentType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only audio files are supported for multi-track upload',
        });
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: { campaignId: true },
      });

      if (!session || session.campaignId !== input.campaignId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }

      const r2Key = `session-recordings/${input.sessionId}/${input.uploadGroupId}/${Date.now()}-${input.fileName}`;

      let uploadUrl: string;
      if (getStorageMode() === 'r2') {
        uploadUrl = await getPresignedUploadUrl(r2Key, input.contentType, 3600);
      } else {
        uploadUrl = `/api/recordings/upload`;
      }

      const recording = await prisma.sessionRecording.create({
        data: {
          sessionId: input.sessionId,
          type: 'audio',
          originalUrl: r2Key,
          fileSize: input.fileSize,
          processingStatus: 'queued',
          isMultiTrack: true,
          uploadGroupId: input.uploadGroupId,
          speakerTag: input.speakerTag ?? null,
          mergeStatus: 'pending',
          trackFiles: [
            {
              filename: input.fileName,
              r2Key,
              speakerTag: input.speakerTag ?? null,
            },
          ],
        },
      });

      return { uploadUrl, r2Key, recordingId: recording.id };
    }),

  process: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string(),
        uploadGroupId: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const recordings = await prisma.sessionRecording.findMany({
        where: { uploadGroupId: input.uploadGroupId },
        select: { id: true, mergeStatus: true },
      });

      if (recordings.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No recordings found for this upload group',
        });
      }

      const alreadyProcessing = recordings.some((r) =>
        ['processing', 'complete'].includes(r.mergeStatus)
      );
      if (alreadyProcessing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This upload group is already being processed',
        });
      }

      await addMultiTrackJob({
        uploadGroupId: input.uploadGroupId,
        sessionId: input.sessionId,
        campaignId: input.campaignId,
      });

      return { queued: true, trackCount: recordings.length };
    }),

  getStatus: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        uploadGroupId: z.string().min(1).max(50),
      })
    )
    .query(async ({ input }) => {
      const recordings = await prisma.sessionRecording.findMany({
        where: { uploadGroupId: input.uploadGroupId },
        select: {
          id: true,
          mergeStatus: true,
          speakerTag: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const total = recordings.length;
      const done = recordings.filter((r) => r.mergeStatus === 'complete').length;
      const failed = recordings.filter((r) => r.mergeStatus === 'failed').length;

      const overallStatus =
        failed > 0 ? 'failed'
        : done === total && total > 0 ? 'complete'
        : recordings.some((r) => r.mergeStatus === 'processing') ? 'processing'
        : 'pending';

      return { recordings, total, done, failed, overallStatus };
    }),
});
