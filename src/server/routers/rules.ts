import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { rulesService } from '../services/rules.service';
import { protectedProcedure, wardenProcedure, router } from '../trpc';

export const rulesRouter = router({
  lookup: protectedProcedure
    .input(
      z.object({
        question: z.string().min(3).max(500),
        limit: z.number().int().min(1).max(10).default(5),
      })
    )
    .query(({ input, ctx }) => rulesService.lookup(input.question, input.limit, ctx.session.user.id)),

  listSources: protectedProcedure.query(() => rulesService.listSources()),

  listAllPdfs: wardenProcedure.query(() => {
    return rulesService.listAllPdfs();
  }),

  indexSource: wardenProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await rulesService.indexSource(input.pdfId);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to index rules source',
        });
      }
    }),

  removeSource: wardenProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(async ({ input }) => {
      await rulesService.removeSource(input.pdfId);
      return { success: true };
    }),
});
