import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getGalleyTranscript, resolveOoc } from '../services/transcript.service';

export const forgeTranscriptRouter = router({
  get: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1) }))
    .query(({ ctx, input }) => getGalleyTranscript(ctx.prisma, ctx.session.user.id, input)),
  resolveOoc: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1), transcriptId: z.string().min(1),
      index: z.number().int().nonnegative(), verdict: z.enum(['strike', 'stet']),
    }))
    .mutation(async ({ ctx, input }) => {
      await resolveOoc(ctx.prisma, ctx.session.user.id, input);
      return { ok: true as const };
    }),
});
