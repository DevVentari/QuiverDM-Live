import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkImageGenerationLimit } from '../services/usage-tracking.service';
import { addImageGenerationJob } from '@/lib/queue/image-generation-queue';
import { NotFoundError } from '../errors';
import { TRPCError } from '@trpc/server';

export const homebrewImageRouter = router({
  /**
   * Queue an image generation job for a homebrew item
   */
  generateImage: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string(),
        prompt: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
        select: { userId: true, type: true, name: true, data: true },
      });
      if (!homebrew) throw new NotFoundError('homebrew content', input.homebrewId);
      if (homebrew.userId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this content' });
      }

      // Check tier limits
      const { allowed, remaining, limit } = await checkImageGenerationLimit(userId);
      if (!allowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Image generation limit reached (${limit}/month). Upgrade your plan for more.`,
        });
      }

      // Create DB job record
      const description = (homebrew.data as Record<string, unknown>)?.description as string | undefined;
      const job = await prisma.imageGenerationJob.create({
        data: {
          homebrewId: input.homebrewId,
          userId,
          prompt: input.prompt || '',
          provider: 'auto',
          status: 'queued',
        },
      });

      // Enqueue BullMQ job
      await addImageGenerationJob({
        jobId: job.id,
        homebrewId: input.homebrewId,
        userId,
        type: homebrew.type,
        name: homebrew.name,
        description,
        customPrompt: input.prompt,
      });

      return { jobId: job.id, remaining: remaining - 1, limit };
    }),

  /**
   * Poll job status for progress display
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await prisma.imageGenerationJob.findUnique({
        where: { id: input.jobId },
        select: {
          id: true,
          status: true,
          progress: true,
          resultUrl: true,
          errorMessage: true,
          provider: true,
          createdAt: true,
          completedAt: true,
        },
      });
      if (!job) throw new NotFoundError('generation job', input.jobId);
      return job;
    }),

  /**
   * Get remaining generation quota for current user
   */
  getQuota: protectedProcedure.query(({ ctx }) => checkImageGenerationLimit(ctx.session.user.id)),
});
