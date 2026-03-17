import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { brainService } from '../services/brain.service';
import { prisma } from '../db';
import { brainRepository } from '../repositories/brain.repository';
import { worldSimulationService } from '../services/world-simulation.service';
import { answerBrainQuery } from '@/lib/voice/brain-query';
import { WorldEntityType, WorldEntityStatus } from '@prisma/client';
import { redis } from '@/lib/queue/queue';
import { coDMQueue } from '@/lib/queue/co-dm-queue';
import type { CoDMSuggestion } from '@/lib/co-dm/types';
import { addBrainIngestionJob } from '@/lib/queue/brain-ingestion-queue';

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

  seedFromCreation: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      worldSetup: z.object({
        startingLocation: z.string().max(200).optional(),
        antagonistName: z.string().max(200).optional(),
        antagonistMotivation: z.string().max(200).optional(),
        openingHook: z.string().max(200).optional(),
        factions: z.array(z.object({
          name: z.string().max(100),
          stance: z.enum(['ally', 'neutral', 'hostile']),
        })).max(3).optional(),
      }).optional(),
      storyText: z.string().max(20000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const campaign = await prisma.campaign.findFirst({
        where: { id: input.campaignId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!campaign) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
      }

      const { worldSetup, storyText, campaignId } = input;

      if (worldSetup?.startingLocation?.trim()) {
        await brainService.createOrUpdateEntity(campaignId, ctx.session.user.id, {
          type: WorldEntityType.LOCATION,
          name: worldSetup.startingLocation.trim(),
          sourceType: 'campaign_creation',
        });
      }

      if (worldSetup?.antagonistName?.trim()) {
        await brainService.createOrUpdateEntity(campaignId, ctx.session.user.id, {
          type: WorldEntityType.THREAT,
          name: worldSetup.antagonistName.trim(),
          description: worldSetup.antagonistMotivation?.trim() || undefined,
          sourceType: 'campaign_creation',
        });
      }

      if (worldSetup?.factions) {
        for (const faction of worldSetup.factions) {
          if (faction.name.trim()) {
            await brainService.createOrUpdateEntity(campaignId, ctx.session.user.id, {
              type: WorldEntityType.FACTION,
              name: faction.name.trim(),
              properties: { stance: faction.stance },
              sourceType: 'campaign_creation',
            });
          }
        }
      }

      if (worldSetup?.openingHook?.trim()) {
        const state = await brainRepository.getOrCreateState(campaignId);
        const existingHooks = Array.isArray(state.hooks) ? state.hooks as Record<string, unknown>[] : [];
        await brainRepository.updateState(campaignId, {
          hooks: [...existingHooks, {
            id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: worldSetup.openingHook.trim(),
            createdSessionId: null,
            ageInSessions: 0,
            urgency: 'medium',
            status: 'open',
            linkedEntityNames: [],
          }],
        });
      }

      if (storyText?.trim()) {
        await addBrainIngestionJob({
          campaignId,
          sessionId: null,
          summary: storyText.trim(),
          highlights: [],
          source: 'campaign_creation',
        });
      }

      return { success: true };
    }),

  coDM: router({
    suggestions: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .query(async ({ input }) => {
        if (!redis) return [] as CoDMSuggestion[];
        const raw = await redis.get(`co-dm:${input.sessionId}:suggestions`);
        if (!raw) return [] as CoDMSuggestion[];
        const suggestions = JSON.parse(raw) as CoDMSuggestion[];
        return suggestions.filter((s) => !s.dismissed);
      }),

    dismiss: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1), suggestionId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        if (!redis) return { success: false };
        const key = `co-dm:${input.sessionId}:suggestions`;
        const raw = await redis.get(key);
        if (!raw) return { success: false };
        const suggestions = JSON.parse(raw) as CoDMSuggestion[];
        const updated = suggestions.map((s) =>
          s.id === input.suggestionId ? { ...s, dismissed: true } : s
        );
        const ttl = await redis.ttl(key);
        await redis.set(key, JSON.stringify(updated), 'EX', ttl > 0 ? ttl : 3600);
        return { success: true };
      }),

    submitChunk: protectedProcedure
      .input(z.object({
        sessionId: z.string().min(1),
        campaignId: z.string().min(1),
        transcriptChunk: z.string().min(1),
        chunkIndex: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        const job = await coDMQueue.add(
          `co-dm-chunk-${input.sessionId}-${input.chunkIndex}`,
          input
        );
        return { jobId: job.id };
      }),

    prepSuggestions: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(async ({ input }) => {
        if (!redis) return null;
        const raw = await redis.get(`co-dm:prep:${input.campaignId}`);
        if (!raw) return null;
        return JSON.parse(raw) as {
          npcMotivationUpdates: Array<{ entityName: string; motivation: string }>;
          factionShifts: Array<{ factionName: string; shift: string }>;
          nextSessionFocus: string[];
          generatedAt: string;
        };
      }),
  }),

  voiceQuery: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), query: z.string().min(1).max(500) }))
    .mutation(({ input, ctx: _ctx }) =>
      answerBrainQuery(input.query, input.campaignId)
    ),

  worldSimulation: router({
    sessionSeed: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(({ input, ctx }) => worldSimulationService.getSessionSeed(input.campaignId, ctx.session.user.id)),

    actors: router({
      list: protectedProcedure
        .input(z.object({ campaignId: z.string().min(1) }))
        .query(({ input, ctx }) => worldSimulationService.listActors(input.campaignId, ctx.session.user.id)),

      upsert: protectedProcedure
        .input(z.object({
          campaignId: z.string().min(1),
          entityId: z.string().min(1),
          goals: z.array(z.string()).optional(),
          urgency: z.number().min(0).max(1).optional(),
          resources: z.record(z.unknown()).optional(),
          riskTolerance: z.number().min(0).max(1).optional(),
        }))
        .mutation(({ input, ctx }) => {
          const { campaignId, entityId, ...data } = input;
          return worldSimulationService.upsertActor(campaignId, entityId, ctx.session.user.id, data);
        }),

      delete: protectedProcedure
        .input(z.object({ campaignId: z.string().min(1), actorId: z.string().min(1) }))
        .mutation(({ input, ctx }) => worldSimulationService.deleteActor(input.campaignId, input.actorId, ctx.session.user.id)),
    }),

    runTick: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .mutation(({ input, ctx }) => worldSimulationService.runWorldTick(input.campaignId, ctx.session.user.id)),
  }),
});
