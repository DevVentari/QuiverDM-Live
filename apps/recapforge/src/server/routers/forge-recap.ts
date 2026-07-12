import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { RecapContentSchema } from '@quiverdm/shared';
import { enqueueRecap, getRecap, updateRecap, renderPreview } from '../services/recap.service';
import { publishRecap } from '../services/publish.service';

export const forgeRecapRouter = router({
  get: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1) }))
    .query(({ ctx, input }) => getRecap(ctx.prisma, ctx.session.user.id, input)),
  generate: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => { await enqueueRecap(ctx.prisma, ctx.session.user.id, input); return { ok: true as const }; }),
  update: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1), content: RecapContentSchema }))
    .mutation(async ({ ctx, input }) => { await updateRecap(ctx.prisma, ctx.session.user.id, input); return { ok: true as const }; }),
  previewHtml: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1) }))
    .query(({ ctx, input }) => renderPreview(ctx.prisma, ctx.session.user.id, input)),
  publish: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1) }))
    .mutation(({ ctx, input }) => publishRecap(ctx.prisma, ctx.session.user.id, input)),
});
