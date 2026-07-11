import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { createSession, listSessions } from '../services/sessions.service';

export const forgeSessionsRouter = router({
  create: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), title: z.string().max(200).optional() }))
    .mutation(({ ctx, input }) => createSession(ctx.prisma, ctx.session.user.id, input)),
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(({ ctx, input }) => listSessions(ctx.prisma, ctx.session.user.id, input.campaignId)),
});
