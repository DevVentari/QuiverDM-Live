import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { playService } from '@/server/services/play.service';

export const playRouter = router({
  getHome: protectedProcedure.query(({ ctx }) =>
    playService.getPlayerCampaigns(ctx.session.user.id)
  ),

  getCampaignHub: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ ctx, input }) =>
      playService.getCampaignHub(input.slug, ctx.session.user.id)
    ),

  getSessionRecap: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getSessionRecap(input.sessionId, ctx.session.user.id)
    ),

  getSharedNpcs: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getSharedNpcs(input.campaignId, ctx.session.user.id)
    ),

  getSharedLore: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getSharedLore(input.campaignId, ctx.session.user.id)
    ),

  getSessionState: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getPlayerSessionState(input.sessionId, ctx.session.user.id)
    ),

  updateSessionState: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      hp: z.number().int().min(0),
      maxHp: z.number().int().min(1),
      tempHp: z.number().int().min(0).optional(),
      conditions: z.array(z.string()).optional(),
      spellSlots: z.record(z.unknown()).optional(),
      hitDice: z.record(z.unknown()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { sessionId, ...data } = input;
      return playService.upsertPlayerSessionState(sessionId, ctx.session.user.id, data);
    }),
});
