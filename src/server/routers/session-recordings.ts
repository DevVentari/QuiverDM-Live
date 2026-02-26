import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';
import { deleteFromLocal, extractKeyFromLocalUrl } from '@/lib/storage/local-storage';
import { deleteFromR2, extractKeyFromUrl } from '@/lib/storage/r2';
import { authz } from '../services/authorization.service';
import { usageService } from '../services/usage.service';

export const sessionRecordingsRouter = router({
  /**
   * Create a new session recording entry in the database
   */
  create: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        type: z.enum(['audio', 'video']),
        url: z.string(),
        fileSize: z.number(),
        durationSeconds: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();
      await usageService.incrementSessionUploads(userId);
      const recording = await prisma.sessionRecording.create({
        data: {
          sessionId: input.sessionId,
          type: input.type,
          originalUrl: input.url,
          fileSize: input.fileSize,
          durationSeconds: input.durationSeconds,
          processingStatus: 'queued',
        },
      });

      return recording;
    }),

  /**
   * Get all recordings for a session
   */
  getBySessionId: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();
      return await prisma.sessionRecording.findMany({
        where: {
          sessionId: input.sessionId,
        },
        include: {
          transcripts: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }),

  /**
   * Get a single recording by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.recording(input.id, userId);
      const recording = await prisma.sessionRecording.findUnique({
        where: {
          id: input.id,
        },
        include: {
          transcripts: true,
          session: true,
        },
      });

      if (!recording) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recording not found',
        });
      }

      return recording;
    }),

  /**
   * Update recording status and metadata
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        processingStatus: z.enum(['queued', 'processing', 'completed', 'failed']),
        errorMessage: z.string().optional(),
        extractedAudioUrl: z.string().optional(),
        originalDeleted: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.recording(input.id, userId);
      const { id, ...data } = input;

      return await prisma.sessionRecording.update({
        where: { id },
        data,
      });
    }),

  /**
   * Delete a recording and its associated files
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        deleteFiles: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.recording(input.id, userId);
      const recording = await prisma.sessionRecording.findUnique({
        where: { id: input.id },
      });

      if (!recording) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recording not found',
        });
      }

      // Delete files if requested
      if (input.deleteFiles) {
        const filesToDelete: string[] = [];

        // Add original file if not already deleted
        if (!recording.originalDeleted) {
          filesToDelete.push(recording.originalUrl);
        }

        // Add extracted audio if exists
        if (recording.extractedAudioUrl) {
          filesToDelete.push(recording.extractedAudioUrl);
        }

        // Delete files
        for (const fileUrl of filesToDelete) {
          try {
            if (fileUrl.startsWith('/api/storage/')) {
              const key = extractKeyFromLocalUrl(fileUrl);
              await deleteFromLocal(key);
              console.log('Deleted file from local storage:', key);
            } else if (fileUrl.includes('.r2.cloudflarestorage.com')) {
              const key = extractKeyFromUrl(fileUrl);
              await deleteFromR2(key);
              console.log('Deleted file from R2:', key);
            }
          } catch (error) {
            console.error('Failed to delete file:', fileUrl, error);
            // Continue with other files
          }
        }
      }

      // Delete database record
      await prisma.sessionRecording.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Get storage statistics for a session
   */
  getStorageStats: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();
      const recordings = await prisma.sessionRecording.findMany({
        where: {
          sessionId: input.sessionId,
        },
      });

      const totalSize = recordings.reduce((sum, r) => sum + r.fileSize, 0);
      const originalDeletedCount = recordings.filter((r) => r.originalDeleted).length;
      const totalRecordings = recordings.length;

      return {
        totalSize,
        totalRecordings,
        originalDeletedCount,
        originalKeptCount: totalRecordings - originalDeletedCount,
        averageSize: totalRecordings > 0 ? totalSize / totalRecordings : 0,
      };
    }),
});
