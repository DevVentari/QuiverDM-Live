import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { campaignMechanicsService } from '../services/campaign-mechanics.service';

export const campaignMechanicsRouter = router({
  list: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      kind: z.string().optional(),
      sourcebook: z.string().optional(),
    }))
    .query(({ input, ctx }) => campaignMechanicsService.list(input, ctx.session.user.id)),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input, ctx }) => campaignMechanicsService.getById(input.id, ctx.session.user.id)),

  create: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      kind: z.string().min(1),
      name: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      content: z.unknown(),
      sourcebook: z.string().max(64).optional(),
      externalKey: z.string().max(128).optional(),
      playerVisible: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) =>
      campaignMechanicsService.create({ ...input, content: input.content }, ctx.session.user.id),
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      content: z.any().optional(),
      playerVisible: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => campaignMechanicsService.update(input, ctx.session.user.id)),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input, ctx }) => campaignMechanicsService.delete(input.id, ctx.session.user.id)),

  assignToCharacter: protectedProcedure
    .input(z.object({
      id: z.string().min(1),
      characterId: z.string().min(1).nullable(),
    }))
    .mutation(({ input, ctx }) =>
      campaignMechanicsService.assignToCharacter(input.id, input.characterId, ctx.session.user.id),
    ),

  markRevealed: protectedProcedure
    .input(z.object({ id: z.string().min(1), sessionId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      campaignMechanicsService.markRevealed(input.id, input.sessionId, ctx.session.user.id),
    ),
});
