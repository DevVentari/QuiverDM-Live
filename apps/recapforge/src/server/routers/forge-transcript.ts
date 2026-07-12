import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getGalleyTranscript } from '../services/transcript.service';

export const forgeTranscriptRouter = router({
  get: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1) }))
    .query(({ ctx, input }) => getGalleyTranscript(ctx.prisma, ctx.session.user.id, input)),
});
