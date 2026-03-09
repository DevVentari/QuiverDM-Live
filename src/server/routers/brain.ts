import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { brainService } from '../services/brain.service';
import { answerBrainQuery } from '@/lib/voice/brain-query';
import { WorldEntityType, WorldEntityStatus } from '@prisma/client';

const entityTypeSchema = z.nativeEnum(WorldEntityType);
const entityStatusSchema = z.nativeEnum(WorldEntityStatus);

export const brainRouter = router({
  entities: router({
    list: protectedProcedure
      .input(z.object({
        campaignId: z.string().min(1),
        type: entityTypeSchema.optional(),
        status: entityStatusSchema.optional(),
        search: z.string().max(255).optional(),
      }))
      .query(({ input, ctx }) =>
        brainService.listEntities(input.campaignId, ctx.session.user.id, {
          type: input.type,
          status: input.status,
          search: input.search,
        })
      ),

    get: protectedProcedure
      .input(z.object({ entityId: z.string().min(1), campaignId: z.string().min(1) }))
      .query(({ input, ctx }) =>
        brainService.getEntity(input.entityId, input.campaignId, ctx.session.user.id)
      ),

    upsert: protectedProcedure
      .input(z.object({
        campaignId: z.string().min(1),
        type: entityTypeSchema,
        name: z.string().min(1).max(255),
        aliases: z.array(z.string()).optional(),
        description: z.string().max(10000).optional(),
        properties: z.record(z.unknown()).optional(),
        status: entityStatusSchema.optional(),
        sourceType: z.string().optional(),
        sourceId: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }))
      .mutation(({ input, ctx }) => {
        const { campaignId, ...data } = input;
        return brainService.createOrUpdateEntity(campaignId, ctx.session.user.id, data);
      }),

    update: protectedProcedure
      .input(z.object({
        entityId: z.string().min(1),
        campaignId: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        aliases: z.array(z.string()).optional(),
        description: z.string().max(10000).optional(),
        properties: z.record(z.unknown()).optional(),
        status: entityStatusSchema.optional(),
        confidence: z.number().min(0).max(1).optional(),
      }))
      .mutation(({ input, ctx }) => {
        const { entityId, campaignId, ...data } = input;
        return brainService.updateEntity(entityId, campaignId, ctx.session.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ entityId: z.string().min(1), campaignId: z.string().min(1) }))
      .mutation(({ input, ctx }) =>
        brainService.deleteEntity(input.entityId, input.campaignId, ctx.session.user.id)
      ),

    sessionHistory: protectedProcedure
      .input(z.object({ entityId: z.string().min(1), campaignId: z.string().min(1) }))
      .query(({ input, ctx }) =>
        brainService.getEntitySessionHistory(input.entityId, input.campaignId, ctx.session.user.id)
      ),
  }),

  relationships: router({
    list: protectedProcedure
      .input(z.object({
        campaignId: z.string().min(1),
        entityId: z.string().optional(),
      }))
      .query(({ input, ctx }) =>
        brainService.listRelationships(input.campaignId, ctx.session.user.id, input.entityId)
      ),

    upsert: protectedProcedure
      .input(z.object({
        campaignId: z.string().min(1),
        fromEntityId: z.string().min(1),
        toEntityId: z.string().min(1),
        type: z.string().min(1).max(100),
        strength: z.number().min(0).max(1).optional(),
        description: z.string().max(1000).optional(),
      }))
      .mutation(({ input, ctx }) => {
        const { campaignId, ...data } = input;
        return brainService.upsertRelationship(campaignId, ctx.session.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ relationshipId: z.string().min(1), campaignId: z.string().min(1) }))
      .mutation(({ input, ctx }) =>
        brainService.deleteRelationship(input.relationshipId, input.campaignId, ctx.session.user.id)
      ),
  }),

  state: router({
    get: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(({ input, ctx }) =>
        brainService.getState(input.campaignId, ctx.session.user.id)
      ),

    update: protectedProcedure
      .input(z.object({
        campaignId: z.string().min(1),
        pressurePolitical: z.number().min(0).max(1).optional(),
        pressureSupernatural: z.number().min(0).max(1).optional(),
        pressureEconomic: z.number().min(0).max(1).optional(),
        pressureCosmic: z.number().min(0).max(1).optional(),
        pressureSocial: z.number().min(0).max(1).optional(),
        hooks: z.array(z.record(z.unknown())).optional(),
        threats: z.array(z.record(z.unknown())).optional(),
      }))
      .mutation(({ input, ctx }) => {
        const { campaignId, ...data } = input;
        return brainService.updateState(campaignId, ctx.session.user.id, data);
      }),
  }),

  timeline: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), limit: z.number().int().min(1).max(200).optional(), entityId: z.string().optional() }))
    .query(({ input, ctx }) =>
      brainService.getTimeline(input.campaignId, ctx.session.user.id, input.limit, input.entityId)
    ),

  sessions: router({
    entities: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1), campaignId: z.string().min(1) }))
      .query(({ input, ctx }) =>
        brainService.getSessionEntities(input.sessionId, input.campaignId, ctx.session.user.id)
      ),
  }),

  continuityWarnings: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(({ input, ctx }) =>
      brainService.getContinuityWarnings(input.campaignId, ctx.session.user.id)
    ),

  seedFromExisting: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      brainService.seedFromExisting(input.campaignId, ctx.session.user.id)
    ),

  voiceQuery: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), query: z.string().min(1).max(500) }))
    .mutation(({ input, ctx: _ctx }) =>
      answerBrainQuery(input.query, input.campaignId)
    ),
});
