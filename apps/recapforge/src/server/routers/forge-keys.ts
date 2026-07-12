import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getCobaltStatus, setCobalt, clearCobalt } from '../services/keys.service';

export const forgeKeysRouter = router({
  cobaltStatus: protectedProcedure.query(({ ctx }) => getCobaltStatus(ctx.prisma, ctx.session.user.id)),
  setCobalt: protectedProcedure
    .input(z.object({ cookie: z.string().min(20).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      await setCobalt(ctx.prisma, ctx.session.user.id, input.cookie);
      return getCobaltStatus(ctx.prisma, ctx.session.user.id);
    }),
  clearCobalt: protectedProcedure.mutation(async ({ ctx }) => {
    await clearCobalt(ctx.prisma, ctx.session.user.id);
    return { set: false as const };
  }),
});
