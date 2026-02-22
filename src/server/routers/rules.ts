import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ForbiddenError } from '../errors';
import { rulesService } from '../services/rules.service';
import { protectedProcedure, router } from '../trpc';

function requireAdmin(userEmail: string | null | undefined) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    throw ForbiddenError.forPermission('manage', 'rules sources');
  }

  if (!userEmail || !adminEmails.includes(userEmail.toLowerCase())) {
    throw ForbiddenError.forPermission('manage', 'rules sources');
  }
}

export const rulesRouter = router({
  lookup: protectedProcedure
    .input(
      z.object({
        question: z.string().min(3).max(500),
        limit: z.number().int().min(1).max(10).default(5),
      })
    )
    .query(({ input }) => rulesService.lookup(input.question, input.limit)),

  listSources: protectedProcedure.query(() => rulesService.listSources()),

  listAllPdfs: protectedProcedure.query(({ ctx }) => {
    requireAdmin(ctx.session.user.email);
    return rulesService.listAllPdfs();
  }),

  indexSource: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.email);
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

  removeSource: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.email);
      await rulesService.removeSource(input.pdfId);
      return { success: true };
    }),
});
