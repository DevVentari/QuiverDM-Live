import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { encounterPlanService } from '../services/encounter-plan.service';
import { searchMonsters } from '../../lib/srd/monsters';

const difficultySchema = z.enum(['easy', 'medium', 'hard', 'deadly']);

const sourceTypeSchema = z.enum(['srd', 'npc', 'homebrew', 'custom']);

export const encounterPlansRouter = router({
  getByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input, ctx }) =>
      encounterPlanService.getByCampaign(input.campaignId, ctx.session.user.id)
    ),

  getById: protectedProcedure
    .input(z.object({ planId: z.string() }))
    .query(({ input, ctx }) =>
      encounterPlanService.getById(input.planId, ctx.session.user.id)
    ),

  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().trim().min(1).max(150),
        partySize: z.number().int().min(1).max(12).optional(),
        partyLevel: z.number().int().min(1).max(20).optional(),
        difficulty: difficultySchema.optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { campaignId, ...data } = input;
      return encounterPlanService.create(campaignId, ctx.session.user.id, data);
    }),

  generate: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().trim().min(1).max(150),
        userPrompt: z.string().trim().min(10).max(500),
        partySize: z.number().int().min(1).max(12),
        partyLevel: z.number().int().min(1).max(20),
        difficulty: difficultySchema,
      })
    )
    .mutation(({ input, ctx }) => {
      const { campaignId, ...rest } = input;
      return encounterPlanService.generate(campaignId, ctx.session.user.id, rest);
    }),

  update: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        name: z.string().trim().min(1).max(150).optional(),
        sceneDescription: z.string().max(2000).optional(),
        tacticalNotes: z.string().max(2000).optional(),
        difficulty: difficultySchema.optional(),
        partySize: z.number().int().min(1).max(12).optional(),
        partyLevel: z.number().int().min(1).max(20).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { planId, ...data } = input;
      return encounterPlanService.update(planId, ctx.session.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ planId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterPlanService.delete(input.planId, ctx.session.user.id)
    ),

  addCreature: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        name: z.string().trim().min(1).max(150),
        count: z.number().int().min(1).max(20),
        cr: z.string().optional(),
        xp: z.number().int().min(0).optional(),
        sourceType: sourceTypeSchema,
        sourceId: z.string().optional(),
        statBlock: z.record(z.unknown()).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { planId, ...data } = input;
      return encounterPlanService.addCreature(planId, ctx.session.user.id, data);
    }),

  removeCreature: protectedProcedure
    .input(z.object({ creatureId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterPlanService.removeCreature(input.creatureId, ctx.session.user.id)
    ),

  updateCreature: protectedProcedure
    .input(
      z.object({
        creatureId: z.string(),
        count: z.number().int().min(1).max(20).optional(),
        name: z.string().trim().min(1).max(150).optional(),
        cr: z.string().optional(),
        xp: z.number().int().min(0).optional(),
        statBlock: z.record(z.unknown()).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { creatureId, ...data } = input;
      return encounterPlanService.updateCreature(creatureId, ctx.session.user.id, data);
    }),

  launchToTracker: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      encounterPlanService.launchToTracker(input.planId, input.sessionId, ctx.session.user.id)
    ),

  searchSrdMonsters: protectedProcedure
    .input(
      z.object({
        query: z.string().default(''),
        crMin: z.number().min(0).max(30).optional(),
        crMax: z.number().min(0).max(30).optional(),
        type: z.string().optional(),
        size: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(({ input }) => {
      const results = searchMonsters(input.query, {
        crMin: input.crMin,
        crMax: input.crMax,
        type: input.type,
        size: input.size,
      });
      return results.slice(0, input.limit);
    }),
});
