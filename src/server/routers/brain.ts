import { router, protectedProcedure, campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { brainService } from '../services/brain.service';
import { prisma } from '../db';
import { worldSimulationService } from '../services/world-simulation.service';
import { answerBrainQuery } from '@/lib/voice/brain-query';
import { WorldEntityType, WorldEntityStatus } from '@prisma/client';
import { redis } from '@/lib/queue/queue';
import { coDMQueue } from '@/lib/queue/co-dm-queue';
import type { CoDMSuggestion } from '@/lib/co-dm/types';
import { buildBrainSectionPrompt } from '@/lib/ai/prep-prompts';
import { chatWithAI } from '@/lib/ai/chat';

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
    .mutation(({ input, ctx }) =>
      brainService.seedFromCreation(input.campaignId, ctx.session.user.id, {
        worldSetup: input.worldSetup,
        storyText: input.storyText,
      })
    ),

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

  sectionSuggest: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      section: z.enum(['characters', 'strong-start', 'scenes', 'secrets', 'npcs', 'monsters', 'rewards', 'threads']),
      currentContent: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const campaign = await prisma.campaign.findFirst({
        where: { id: input.campaignId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!campaign) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
      }

      const [state, timeline] = await Promise.all([
        brainRepository.getOrCreateState(input.campaignId),
        brainRepository.getTimeline(input.campaignId, 20),
      ]);

      const hooks = Array.isArray(state.hooks)
        ? (state.hooks as Array<{ text: string; urgency: string; status?: string }>).filter(
            (h) => h.status === 'open' || !h.status
          )
        : [];

      const threats = Array.isArray(state.threats)
        ? (state.threats as Array<{ name?: string; description?: string }>)
        : [];

      const recentChanges = (() => {
        const seen = new Map<string, { entityName: string; entityType: string; changeType: string }>();
        for (const change of timeline) {
          if (change.entityId && change.entity && !seen.has(change.entityId)) {
            seen.set(change.entityId, {
              entityName: change.entity.name,
              entityType: change.entity.type,
              changeType: change.changeType,
            });
          }
        }
        return [...seen.values()].slice(0, 10);
      })();

      const elevatedPressure = [
        { name: 'Political', value: state.pressurePolitical },
        { name: 'Supernatural', value: state.pressureSupernatural },
        { name: 'Economic', value: state.pressureEconomic },
        { name: 'Cosmic', value: state.pressureCosmic },
        { name: 'Social', value: state.pressureSocial },
      ].filter((p) => p.value > 0.5);

      const brainContext = {
        worldState: {
          pressurePolitical: state.pressurePolitical,
          pressureSupernatural: state.pressureSupernatural,
          pressureEconomic: state.pressureEconomic,
          pressureCosmic: state.pressureCosmic,
          pressureSocial: state.pressureSocial,
          hooks,
          threats,
        },
        recentChanges,
        openHooks: hooks,
        elevatedPressure,
      };

      const prompt = buildBrainSectionPrompt(input.section, brainContext, input.currentContent);
      const suggestion = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.7 });

      return { suggestion: suggestion.trim() };
    }),

  pressureHistory: router({
    list: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }))
      .query(async ({ input, ctx }) => {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!campaign) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
        return prisma.worldPressureHistory.findMany({
          where: { campaignId: input.campaignId },
          orderBy: { recordedAt: 'desc' },
          take: input.limit ?? 7,
        });
      }),
  }),

  hooks: router({
    resolve: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1), hookId: z.string().min(1), reason: z.string().min(10) }))
      .mutation(async ({ input, ctx }) => {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!campaign) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
        const state = await brainRepository.getOrCreateState(input.campaignId);
        const hooks = Array.isArray(state.hooks) ? state.hooks as Record<string, unknown>[] : [];
        const updated = hooks.map(h => h['id'] === input.hookId ? { ...h, status: 'resolved' } : h);
        await brainRepository.updateState(input.campaignId, { hooks: updated });
        await brainRepository.logChange({
          campaignId: input.campaignId,
          changeType: 'property_update',
          newValue: { hookId: input.hookId, action: 'resolved', reason: input.reason },
          source: 'manual',
        });
        return { success: true };
      }),

    escalate: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1), hookId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!campaign) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
        const state = await brainRepository.getOrCreateState(input.campaignId);
        const hooks = Array.isArray(state.hooks) ? state.hooks as Record<string, unknown>[] : [];
        const urgencyUp: Record<string, string> = { low: 'medium', medium: 'high', high: 'high' };
        const updated = hooks.map(h =>
          h['id'] === input.hookId
            ? { ...h, urgency: urgencyUp[h['urgency'] as string] ?? 'high' }
            : h
        );
        await brainRepository.updateState(input.campaignId, { hooks: updated });
        await brainRepository.logChange({
          campaignId: input.campaignId,
          changeType: 'property_update',
          newValue: { hookId: input.hookId, action: 'escalated' },
          source: 'manual',
        });
        return { success: true };
      }),

    reopen: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1), hookId: z.string().min(1), reason: z.string().min(10) }))
      .mutation(async ({ input, ctx }) => {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!campaign) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
        const state = await brainRepository.getOrCreateState(input.campaignId);
        const hooks = Array.isArray(state.hooks) ? state.hooks as Record<string, unknown>[] : [];
        const updated = hooks.map(h => h['id'] === input.hookId ? { ...h, status: 'open' } : h);
        await brainRepository.updateState(input.campaignId, { hooks: updated });
        await brainRepository.logChange({
          campaignId: input.campaignId,
          changeType: 'property_update',
          newValue: { hookId: input.hookId, action: 'reopened', reason: input.reason },
          source: 'manual',
        });
        return { success: true };
      }),
  }),

  events: router({
    pending: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!campaign) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
        const [proposals, mergeCandidates] = await Promise.all([
          prisma.worldEventProposal.findMany({
            where: { campaignId: input.campaignId, status: 'pending' },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.entityMergeCandidate.findMany({
            where: { campaignId: input.campaignId, status: 'pending' },
            include: { entityA: true, entityB: true },
          }),
        ]);
        return { proposals, mergeCandidates };
      }),
  }),

  query: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), question: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const campaign = await prisma.campaign.findFirst({
        where: { id: input.campaignId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!campaign) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not campaign owner' });
      const [answer, allEntities] = await Promise.all([
        answerBrainQuery(input.question, input.campaignId),
        brainRepository.findEntities(input.campaignId, { limit: 200 }),
      ]);
      const q = input.question.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t.length > 2);
      const relatedEntities = allEntities.filter(e => {
        const haystack = [e.name, e.description ?? ''].join(' ').toLowerCase();
        return terms.some(t => haystack.includes(t));
      }).slice(0, 5);
      return { answer, relatedEntities };
    }),

  ingest: router({
    document: protectedProcedure
      .input(z.object({
        campaignId: z.string().min(1),
        type: z.enum(['pdf', 'image', 'text']),
        url: z.string().optional(),
        content: z.string().optional(),
        sourceLabel: z.string().min(1).max(255),
      }))
      .mutation(({ input, ctx }) =>
        brainService.ingestDocument(input.campaignId, ctx.session.user.id, {
          type: input.type,
          url: input.url,
          content: input.content,
          sourceLabel: input.sourceLabel,
        })
      ),

    sources: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(({ input, ctx }) =>
        brainService.listIngestSources(input.campaignId, ctx.session.user.id)
      ),
  }),

  mergeCandidates: router({
    list: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(({ input, ctx }) =>
        brainService.listMergeCandidates(input.campaignId, ctx.session.user.id)
      ),

    approve: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1), candidateId: z.string().min(1) }))
      .mutation(({ input, ctx }) =>
        brainService.approveMergeCandidate(input.candidateId, input.campaignId, ctx.session.user.id)
      ),

    reject: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1), candidateId: z.string().min(1) }))
      .mutation(({ input, ctx }) =>
        brainService.rejectMergeCandidate(input.candidateId, input.campaignId, ctx.session.user.id)
      ),
  }),

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

    proposals: router({
      list: protectedProcedure
        .input(z.object({ campaignId: z.string().min(1) }))
        .query(({ input, ctx }) =>
          brainService.listProposals(input.campaignId, ctx.session.user.id)
        ),

      approve: protectedProcedure
        .input(z.object({ campaignId: z.string().min(1), proposalId: z.string().min(1), eventIds: z.array(z.string()) }))
        .mutation(({ input, ctx }) =>
          brainService.approveProposal(input.proposalId, input.campaignId, ctx.session.user.id, input.eventIds)
        ),

      reject: protectedProcedure
        .input(z.object({ campaignId: z.string().min(1), proposalId: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          brainService.rejectProposal(input.proposalId, input.campaignId, ctx.session.user.id)
        ),
    }),
  }),
});
