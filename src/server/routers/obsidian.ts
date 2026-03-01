import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { NotFoundError, ForbiddenError } from '../errors';
import { prisma } from '../db';

export const obsidianRouter = router({
  getImportStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await prisma.obsidianImportJob.findUnique({
        where: { id: input.jobId },
        select: { status: true, progress: true, campaignId: true, userId: true },
      });
      if (!job) throw new NotFoundError('obsidian import job', input.jobId);
      if (job.userId !== ctx.session.user.id) throw ForbiddenError.forPermission('view', 'import job');
      return job;
    }),
});
