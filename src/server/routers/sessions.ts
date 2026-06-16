import {
  router,
  protectedProcedure,
  campaignDMProcedure,
  campaignMemberProcedure,
} from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { sessionService } from '../services/session.service';
import { prisma } from '../db';
import { authz } from '../services/authorization.service';
import { BadRequestError, NotFoundError } from '../errors';
import { derailmentQueue } from '@/lib/queue/derailment-queue';
import { combatCopilotQueue } from '@/lib/queue/combat-copilot-queue';
import { playerRecapQueue } from '@/lib/queue/player-recap-queue';
import { postSummaryToDiscord } from '@/lib/discord/post-summary';
import { SessionPrepDataSchema } from '@/lib/prep-types';
import { sessionStateService } from '../services/session-state.service';
import { extractPrepNotes } from '@/lib/ai/extract-prep-notes';
import { generateBriefingCards } from '@/lib/ai/generate-briefing';
import { brainRepository } from '../repositories/brain.repository';
import { addTranscriptCleanupJob } from '@/lib/queue/transcript-cleanup-queue';
import { addRevelationSyncJob } from '@/lib/queue/secret-revelation-sync-queue';
import { generatePrepBrief } from '@/lib/ai/generate-prep-brief';
import { generatePostSessionSummary } from '@/lib/ai/generate-post-session-summary';
import { extractSIDoc } from '@/lib/ai/extract-si-prep-doc';

interface OocReviewItem {
  index: number;
  speaker: string;
  text: string;
  start_formatted: string;
  classification: 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}

type NpcSuggestion = { worldEntityId: string; name: string; score: number };

async function fuzzyMatchNpc(name: string, campaignId: string): Promise<NpcSuggestion | null> {
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;

  const candidates = await prisma.worldEntity.findMany({
    where: {
      campaignId,
      type: 'NPC',
      OR: words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
    },
    take: 5,
    select: { id: true, name: true },
  });

  let best: NpcSuggestion | null = null;
  for (const c of candidates) {
    const cWords = c.name.toLowerCase().split(/\s+/);
    const nWords = name.toLowerCase().split(/\s+/);
    const shared = nWords.filter((w) => cWords.some((cw) => cw.includes(w) || w.includes(cw)));
    const score = shared.length / Math.max(cWords.length, nWords.length);
    if (score >= 0.7 && score > (best?.score ?? 0)) {
      best = { worldEntityId: c.id, name: c.name, score };
    }
  }
  return best;
}

const TriggeredBehaviorSchema = z.object({ condition: z.string(), behavior: z.string() });
const CriticalDialogueSchema = z.object({ line: z.string(), trigger: z.string() });

const SIConfirmPayloadSchema = z.object({
  campaignId: z.string().min(1),
  sessionId: z.string().min(1),
  intentBrief: z.string().optional(),
  secrets: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
      isCritical: z.boolean().default(false),
      knowledge: z.array(
        z.object({
          entityName: z.string(),
          worldEntityId: z.string().optional(),
          revealCondition: z.string().optional(),
        })
      ).default([]),
    })
  ).default([]),
  phases: z.array(
    z.object({
      name: z.string(),
      targetMinutes: z.number().int().default(30),
      notes: z.string().optional(),
    })
  ).default([]),
  routes: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      isActive: z.boolean().default(false),
    })
  ).default([]),
  npcProfiles: z.array(
    z.object({
      worldEntityId: z.string().optional(),
      name: z.string(),
      defaultBehavior: z.string(),
      triggeredBehaviors: z.array(TriggeredBehaviorSchema).default([]),
      criticalDialogue: z.array(CriticalDialogueSchema).default([]),
    })
  ).default([]),
});

export const sessionsRouter = router({
  /**
   * Get all sessions for a campaign
   * Supports multi-user: any campaign member can view sessions
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getByCampaignId(input.campaignId, ctx.session.user.id)
    ),

  /**
   * Get single session by ID
   * Supports multi-user: any campaign member can view
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getById(input.id, ctx.session.user.id)
    ),

  /**
   * Aggregate the party's live HP for a session. Prefers CharacterSessionState
   * (clean character names + maxHp from the sheet's hitPoints), and falls back to
   * PlayerSessionState (hp/maxHp per user) when no character states exist.
   * Returns [] when nothing is tracked yet. Any campaign member may read.
   */
  getPartyHp: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await authz.session(input.sessionId, ctx.session.user.id).verify();

      const charStates = await prisma.characterSessionState.findMany({
        where: { sessionId: input.sessionId },
        select: {
          currentHp: true,
          tempHp: true,
          character: { select: { id: true, name: true, hitPoints: true } },
        },
      });

      if (charStates.length > 0) {
        return charStates.map((s) => {
          const hp = s.character?.hitPoints as { max?: number } | null | undefined;
          const maxHp = typeof hp?.max === 'number' ? hp.max : s.currentHp;
          return {
            id: s.character?.id ?? '',
            name: s.character?.name ?? 'Unknown',
            hp: s.currentHp,
            maxHp,
            tempHp: s.tempHp,
          };
        });
      }

      // Fallback: PlayerSessionState carries maxHp directly but no character relation.
      const playerStates = await prisma.playerSessionState.findMany({
        where: { sessionId: input.sessionId },
        select: { hp: true, maxHp: true, tempHp: true, characterId: true },
      });
      if (playerStates.length === 0) return [];

      const charIds = playerStates.map((p) => p.characterId).filter((x): x is string => !!x);
      const names = charIds.length
        ? await prisma.character.findMany({ where: { id: { in: charIds } }, select: { id: true, name: true } })
        : [];
      const nameById = new Map(names.map((c) => [c.id, c.name]));

      return playerStates.map((p, i) => ({
        id: p.characterId ?? `player-${i}`,
        name: (p.characterId && nameById.get(p.characterId)) || `Adventurer ${i + 1}`,
        hp: p.hp,
        maxHp: p.maxHp,
        tempHp: p.tempHp,
      }));
    }),

  /**
   * Create new session (quick-create, no wizard)
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        title: z.string().max(500).optional(),
        quickNotes: z.string().max(10000).optional(),
        status: z.enum(['planning', 'in_progress']).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { campaignId, ...data } = input;
      return sessionService.create(campaignId, ctx.session.user.id, data);
    }),

  /**
   * Create a planning session for the Lazy DM wizard.
   * Returns a session in 'planning' status with empty prepData.
   */
  createPrepSession: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      sessionService.createPrepSession(input.campaignId, ctx.session.user.id)
    ),

  /**
   * Save prep wizard data (auto-save). Merges with existing prepData.
   */
  updatePrep: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        prepData: SessionPrepDataSchema.partial(),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.updatePrep(input.id, ctx.session.user.id, input.prepData)
    ),

  /**
   * Mark prep as complete. Session stays 'planning' until DM starts it.
   */
  completePrep: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const session = await prisma.gameSession.findUniqueOrThrow({
        where: { id: input.id },
        select: { prepData: true, campaignId: true },
      });

      const parsed = SessionPrepDataSchema.safeParse(session.prepData);
      if (parsed.success) {
        const acceptedSpatial = (parsed.data.briefingCards ?? []).filter(
          (c) => (c.status === 'accepted' || c.status === 'edited') && c.mapCoords
        );

        await Promise.all(
          acceptedSpatial.map(async (card) => {
            const coords = card.mapCoords!;
            if (!card.entityId) return;

            const existing = await prisma.mapPin.findFirst({
              where: { entityId: card.entityId, mapId: coords.mapId },
            });
            if (existing) {
              await prisma.mapPin.update({
                where: { id: existing.id },
                data: { lastEventAt: new Date() },
              });
            } else {
              await prisma.mapPin.create({
                data: {
                  mapId: coords.mapId,
                  entityId: card.entityId,
                  x: coords.x,
                  y: coords.y,
                  lastEventAt: new Date(),
                },
              });
            }

            await prisma.sessionEntityAppearance.upsert({
              where: { sessionId_entityId: { sessionId: input.id, entityId: card.entityId } },
              create: {
                sessionId: input.id,
                entityId: card.entityId,
                campaignId: session.campaignId,
                role: card.type,
              },
              update: {},
            });
          })
        );
      }

      return sessionService.completePrep(input.id, ctx.session.user.id);
    }),

  /**
   * Get context needed for the prep wizard (characters, NPCs, recent sessions, homebrew).
   */
  getPrepContext: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(({ input, ctx }) =>
      sessionService.getContextForPrep(input.campaignId, ctx.session.user.id)
    ),

  /**
   * AI: Suggest a strong start (step 2).
   */
  aiSuggestStrongStart: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      sessionService.aiSuggestStrongStart(input.sessionId, ctx.session.user.id)
    ),

  /**
   * AI: Suggest potential scenes (step 3).
   */
  aiSuggestScenes: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        strongStart: z.string().default(''),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.aiSuggestScenes(input.sessionId, ctx.session.user.id, input.strongStart)
    ),

  /**
   * AI: Suggest secrets & clues (step 4).
   */
  aiSuggestSecrets: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      sessionService.aiSuggestSecrets(input.sessionId, ctx.session.user.id)
    ),

  /**
   * AI: Detect loose threads from recent session recaps (step 8).
   */
  aiDetectLooseThreads: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      sessionService.aiDetectLooseThreads(input.sessionId, ctx.session.user.id)
    ),

  /**
   * Start a planned session (planning → in_progress)
   */
  startSession: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      sessionService.startSession(input.id, ctx.session.user.id)
    ),

  /**
   * Update session
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().max(500).optional(),
        quickNotes: z.string().max(10000).optional(),
        recap: z.string().max(50000).optional(),
        status: z.enum(['planning', 'in_progress', 'completed']).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return sessionService.update(id, ctx.session.user.id, data);
    }),

  /**
   * Update player visibility for a session
   */
  updateVisibility: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        playerVisibility: z.enum(['dm-only', 'summary-only', 'public']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await authz
        .session(input.sessionId, ctx.session.user.id)
        .requireManage();

      return prisma.gameSession.update({
        where: { id: input.sessionId },
        data: { playerVisibility: input.playerVisibility },
      });
    }),

  /**
   * Delete session
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.delete(input.id, ctx.session.user.id)
    ),

  /**
   * Get active session for a campaign
   */
  getActive: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getActiveByCampaignId(
        input.campaignId,
        ctx.session.user.id
      )
    ),

  /**
   * Complete session
   */
  complete: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        recap: z.string().max(50000).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.complete(input.id, ctx.session.user.id, {
        recap: input.recap,
      })
    ),

  /**
   * Generate AI recap from session transcripts
   */
  generateRecap: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const sessionAccess = await authz
        .session(input.sessionId, ctx.session.user.id)
        .verify();

      if (sessionAccess.resource.campaignId !== input.campaignId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Session does not belong to the provided campaign',
        });
      }

      const recap = await sessionService.generateRecap(
        input.sessionId,
        ctx.session.user.id
      );
      return { recap };
    }),

  generateSummary: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.generateSummary(input.sessionId, ctx.session.user.id)
    ),

  getSummaryStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getSummaryStatus(input.sessionId, ctx.session.user.id)
    ),

  runDerailmentDetector: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        include: { transcripts: { take: 1, orderBy: { createdAt: 'desc' } } },
      });

      if (!session) throw new NotFoundError('session', input.sessionId);
      if (session.campaignId !== input.campaignId) {
        throw new BadRequestError('Session does not belong to the provided campaign');
      }

      const transcript = session.transcripts[0];
      if (!transcript) throw new BadRequestError('No transcript available');

      const text = transcript.correctedText ?? transcript.rawText;
      await prisma.gameSession.update({
        where: { id: input.sessionId },
        data: { derailmentStatus: 'pending' },
      });

      await derailmentQueue.add('detect-derailment', {
        sessionId: input.sessionId,
        transcriptText: text,
        quickNotes: session.quickNotes ?? '',
      });

      return { ok: true };
    }),

  getDerailmentStatus: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: { derailmentStatus: true, derailmentData: true, campaignId: true },
      });

      if (!session) throw new NotFoundError('session', input.sessionId);
      if (session.campaignId !== input.campaignId) {
        throw new BadRequestError('Session does not belong to the provided campaign');
      }

      return {
        derailmentStatus: session.derailmentStatus,
        derailmentData: session.derailmentData,
      };
    }),

  generatePlayerRecap: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: {
          aiSummary: true,
          sessionNumber: true,
          title: true,
          playerRecapStatus: true,
          campaignId: true,
        },
      });
      if (!session) throw new NotFoundError('session', input.sessionId);
      if (session.campaignId !== input.campaignId) {
        throw new BadRequestError('Session does not belong to the provided campaign');
      }
      if (!session.aiSummary) throw new BadRequestError('Generate AI summary first');

      await prisma.gameSession.update({
        where: { id: input.sessionId },
        data: { playerRecapStatus: 'pending' },
      });

      await playerRecapQueue.add('generate-recap', {
        sessionId: input.sessionId,
        aiSummary: session.aiSummary,
        sessionTitle: session.title,
        sessionNumber: session.sessionNumber,
      });
      return { ok: true };
    }),

  getPlayerRecapStatus: campaignMemberProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: {
          campaignId: true,
          playerRecapStatus: true,
          playerRecap: true,
          playerVisibility: true,
        },
      });
      if (!session) throw new NotFoundError('session', input.sessionId);
      if (session.campaignId !== input.campaignId) {
        throw new BadRequestError('Session does not belong to the provided campaign');
      }
      return {
        playerRecapStatus: session.playerRecapStatus,
        playerRecap: session.playerRecap,
        playerVisibility: session.playerVisibility,
      };
    }),

  createShareToken: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.createShareToken(input.sessionId, ctx.session.user.id)
    ),

  getSessionsWithSummaries: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getSessionsWithSummaries(input.campaignId, ctx.session.user.id)
    ),

  generateCombatCopilot: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await authz
        .session(input.sessionId, ctx.session.user.id)
        .requireManage();

      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        include: { transcripts: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      if (!session) throw new NotFoundError('session', input.sessionId);

      const transcript = session.transcripts[0];
      if (!transcript) throw new BadRequestError('No transcript available');

      const text = transcript.correctedText ?? transcript.rawText;

      await prisma.gameSession.update({
        where: { id: input.sessionId },
        data: { combatCopiloterStatus: 'pending' },
      });

      await combatCopilotQueue.add('extract-combat', {
        sessionId: input.sessionId,
        transcriptText: text,
      });

      return { ok: true };
    }),

  getCombatCopiloterStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      await authz
        .session(input.sessionId, ctx.session.user.id)
        .verify();

      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: {
          combatCopiloterStatus: true,
          combatCopiloterData: true,
        },
      });

      if (!session) throw new NotFoundError('session', input.sessionId);
      return session;
    }),

  getCharacterSessionStates: campaignMemberProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .query(({ input }) => sessionStateService.getStates(input.sessionId)),

  initCharacterSessionStates: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .mutation(({ input }) => sessionStateService.initForSession(input.sessionId)),

  getSessionEvents: campaignMemberProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .query(({ input }) => sessionStateService.getAllEvents(input.sessionId)),

  reviewEvent: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), eventId: z.string(), action: z.enum(['confirm', 'reject']) }))
    .mutation(({ input }) => sessionStateService.reviewEvent(input.eventId, input.action, input.campaignId)),

  commitSessionEvents: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .mutation(({ input }) => sessionStateService.commitSessionEvents(input.sessionId)),

  extractPrepFromNotes: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
        url: z.string().optional(),
        text: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let text = input.text ?? '';
      if (input.url && !text) {
        text = `[Uploaded document: ${input.url}]`;
      }
      if (!text) return {};

      const ctx2 = await sessionService.getContextForPrep(input.campaignId, ctx.session.user.id);

      return extractPrepNotes({
        text,
        campaignContext: {
          npcs: ctx2.npcs.map(n => ({ id: n.id, name: n.name })),
          characters: ctx2.characters.map(c => ({ id: c.id, name: c.name })),
          recentSessions: ctx2.recentSessions.map(s => ({
            title: s.title ?? null,
            recap: s.recap ?? null,
          })),
        },
      });
    }),

  generateBriefing: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const [state, timeline, entities] = await Promise.all([
        brainRepository.getOrCreateState(input.campaignId),
        brainRepository.getTimeline(input.campaignId, 20),
        brainRepository.findEntities(input.campaignId, { status: 'active', limit: 20 }),
      ]);

      const hooks = Array.isArray(state.hooks)
        ? (state.hooks as Array<Record<string, unknown>>)
            .filter((h) => h.status === 'open' || !h.status)
            .filter((h) => typeof h.text === 'string' && h.text.length > 0)
            .map((h) => ({ text: String(h.text), urgency: String(h.urgency ?? 'unknown') }))
        : [];

      const threats = Array.isArray(state.threats)
        ? (state.threats as Array<Record<string, unknown>>).map((t) => ({
            name: typeof t.name === 'string' ? t.name : undefined,
            description: typeof t.description === 'string' ? t.description : undefined,
          }))
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

      const cards = await generateBriefingCards({
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
        entities: entities.map((e) => {
          const pin = e.mapPins?.[0];
          return {
            name: e.name,
            type: e.type,
            description: e.description,
            mapPin: pin ? { mapId: pin.mapId, x: pin.x, y: pin.y } : null,
          };
        }),
      });

      // Deterministic auto-placement: match entityName → entity, assign mapCoords
      const enriched = cards.map((card) => {
        const entity = entities.find(
          (e) => e.name.toLowerCase() === card.entityName.toLowerCase()
        );

        if (!entity) return card;

        const pin = entity.mapPins?.[0];

        if (pin) {
          return {
            ...card,
            entityId: entity.id,
            mapCoords: {
              placement: 'auto' as const,
              mapId: pin.mapId,
              x: pin.x,
              y: pin.y,
            },
          };
        }

        return { ...card, entityId: entity.id };
      });

      return { cards: enriched };
    }),

  acceptBriefingCards: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: { prepData: true },
      });
      if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });

      const { BriefingCardSchema } = await import('@/lib/briefing-types');
      const prepDataRaw = session.prepData as Record<string, unknown> | null;
      const cardsRaw = Array.isArray(prepDataRaw?.briefingCards) ? prepDataRaw.briefingCards : [];
      const cards = cardsRaw
        .map((c) => BriefingCardSchema.safeParse(c))
        .filter((r) => r.success)
        .map((r) => r.data!);

      const accepted = cards.filter((c) => c.status === 'accepted');

      let pinsUpserted = 0;
      let appearancesRecorded = 0;

      for (const card of accepted) {
        if (card.entityId) {
          await brainRepository.recordAppearance({
            sessionId: input.sessionId,
            entityId: card.entityId,
            campaignId: input.campaignId,
            role: card.type,
          });
          appearancesRecorded++;
        }

        const coords = card.mapCoords;
        if (card.entityId && coords) {
          await prisma.mapPin.upsert({
            where: { mapId_entityId: { mapId: coords.mapId, entityId: card.entityId } },
            create: {
              mapId: coords.mapId,
              entityId: card.entityId,
              x: coords.x,
              y: coords.y,
              lastEventAt: new Date(),
            },
            update: { lastEventAt: new Date() },
          });
          pinsUpserted++;
        }
      }

      return { pinsUpserted, appearancesRecorded };
    }),

  updateActiveScene: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string(), sceneIndex: z.number().int().min(0) }))
    .mutation(async ({ input }) => {
      await prisma.gameSession.update({
        where: { id: input.sessionId },
        data: { activeSceneIndex: input.sceneIndex },
      });
    }),

  getActiveScene: campaignMemberProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await prisma.gameSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        select: { activeSceneIndex: true },
      });
      return { sceneIndex: session.activeSceneIndex ?? 0 };
    }),

  postToDiscord: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: {
          title: true,
          sessionNumber: true,
          aiSummary: true,
          campaignId: true,
          campaign: {
            select: {
              settings: true,
              userId: true,
            },
          },
        },
      });

      if (!session) throw new NotFoundError('session', input.sessionId);
      if (session.campaignId !== input.campaignId) {
        throw new BadRequestError('Session does not belong to the provided campaign');
      }

      if (!session.aiSummary) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No summary available to post' });
      }

      const settings = (session.campaign.settings ?? {}) as Record<string, unknown>;
      const webhookUrl = settings.discordWebhookUrl as string | undefined;

      if (!webhookUrl) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No Discord webhook configured for this campaign' });
      }

      const owner = await prisma.user.findUnique({
        where: { id: session.campaign.userId },
        select: { tier: true },
      });

      const isSubscribed = owner?.tier === 'pro' || owner?.tier === 'team' || owner?.tier === 'alpha';

      await postSummaryToDiscord(
        webhookUrl,
        session.title ?? `Session ${session.sessionNumber}`,
        session.aiSummary,
        isSubscribed
      );

      return { ok: true };
    }),

  triggerOocCleanup: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findFirst({
        where: { id: input.sessionId, campaignId: input.campaignId },
        include: { transcripts: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      if (!session) throw new NotFoundError('session', input.sessionId);

      const transcript = session.transcripts[0];
      if (!transcript) throw new BadRequestError('No transcript found for this session');

      await prisma.transcript.update({
        where: { id: transcript.id },
        data: { cleanupStatus: 'processing' },
      });

      await addTranscriptCleanupJob({
        transcriptId: transcript.id,
        sessionId: input.sessionId,
        campaignId: input.campaignId,
        phase: 'ooc',
      });

      return { transcriptId: transcript.id };
    }),

  confirmOocReview: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      sessionId: z.string(),
      drops: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findFirst({
        where: { id: input.sessionId, campaignId: input.campaignId },
        include: { transcripts: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      if (!session) throw new NotFoundError('session', input.sessionId);

      const transcript = session.transcripts[0];
      if (!transcript) throw new BadRequestError('No transcript found');

      const reviewItems = (transcript.oocReviewItems ?? []) as unknown as OocReviewItem[];

      if (input.drops.length > 0 && transcript.correctedText) {
        const dropSet = new Set(input.drops);
        const dropTexts = reviewItems
          .filter(item => dropSet.has(item.index))
          .map(item => item.text);

        const lines = transcript.correctedText.split('\n');
        const cleaned = lines.filter(line => {
          if (!line.startsWith('**[')) return true;
          const m = line.match(/^\*\*\[[^\]]+\] [^:]+:\*\*\s(.+)$/);
          return !m || !dropTexts.includes(m[1]);
        });

        await prisma.transcript.update({
          where: { id: transcript.id },
          data: {
            correctedText: cleaned.join('\n'),
            oocReviewItems: Prisma.JsonNull,
            cleanupStatus: 'complete',
          },
        });
      } else {
        await prisma.transcript.update({
          where: { id: transcript.id },
          data: { oocReviewItems: Prisma.JsonNull, cleanupStatus: 'complete' },
        });
      }

      return { success: true };
    }),

  updateIntentBrief: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      intentBrief: z.object({
        toneKeywords: z.array(z.string()),
        playerGoals: z.array(z.string()),
        dmOnlyTruths: z.array(z.string()),
      }),
    }))
    .mutation(async ({ input }) => {
      return prisma.gameSession.update({
        where: { id: input.sessionId, campaignId: input.campaignId },
        data: { intentBrief: input.intentBrief },
      });
    }),

  triggerRevelationSync: campaignDMProcedure
    .input(z.object({
      sessionId: z.string().min(1),
      revelationId: z.string().min(1),
      prepSecretId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await addRevelationSyncJob({
        revelationId: input.revelationId,
        prepSecretId: input.prepSecretId,
        sessionId: input.sessionId,
        campaignId: input.campaignId,
      });
      return { queued: true };
    }),

  generatePrepBrief: campaignDMProcedure
    .input(z.object({
      sessionId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const [session, prepSecrets, secretEntities] = await Promise.all([
        prisma.gameSession.findFirst({
          where: { id: input.sessionId, campaignId: input.campaignId },
          select: { intentBrief: true },
        }),
        prisma.prepSecret.findMany({
          where: { sessionId: input.sessionId, campaignId: input.campaignId },
          select: { id: true, name: true, content: true, isRevealed: true, knowledge: { select: { isCritical: true } } },
        }),
        prisma.worldEntity.findMany({
          where: { campaignId: input.campaignId, type: 'SECRET' },
          select: { id: true, name: true },
        }),
      ]);

      if (!session) throw new NotFoundError('session', input.sessionId);

      const secretEntityIds = secretEntities.map(e => e.id);
      const revealedRelationships = secretEntityIds.length
        ? await prisma.worldRelationship.findMany({
            where: { type: 'revealed_to_players', toEntityId: { in: secretEntityIds } },
            include: { toEntity: { select: { name: true } } },
          })
        : [];

      const intentBrief = session.intentBrief as {
        toneKeywords: string[];
        playerGoals: string[];
        dmOnlyTruths: string[];
      } | null;

      const revealedToPlayers = revealedRelationships.map(r => ({
        secretName: r.toEntity.name,
      }));

      const brief = await generatePrepBrief({
        intentBrief,
        prepSecrets: prepSecrets.map(s => ({
          ...s,
          isCritical: s.knowledge.some(k => k.isCritical),
        })),
        revealedToPlayers,
      });

      return { brief };
    }),

  generatePostSessionSummary: campaignDMProcedure
    .input(z.object({
      sessionId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const [session, revelations, phases] = await Promise.all([
        prisma.gameSession.findFirst({
          where: { id: input.sessionId, campaignId: input.campaignId },
          select: { title: true },
        }),
        prisma.secretRevelation.findMany({
          where: { sessionId: input.sessionId, prepSecret: { campaignId: input.campaignId } },
          include: {
            prepSecret: {
              include: { knowledge: { select: { worldEntity: { select: { name: true, type: true } } } } },
            },
          },
        }),
        prisma.sessionPhase.findMany({
          where: { sessionId: input.sessionId },
          orderBy: { orderIndex: 'asc' },
          select: { name: true, targetMinutes: true },
        }),
      ]);

      if (!session) throw new NotFoundError('session', input.sessionId);

      const revealedThisSession = revelations.map(r => ({
        secretName: r.prepSecret.name,
        content: r.prepSecret.content,
      }));

      const summary = await generatePostSessionSummary({
        sessionTitle: session.title,
        revealedThisSession,
        phasesElapsed: phases,
        activeNpcNames: [...new Set(
          revelations.flatMap(r => r.prepSecret.knowledge.map(k => k.worldEntity)).filter(e => e.type === 'NPC').map(e => e.name)
        )],
      });

      return { summary };
    }),

  extractSIPrepDoc: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
        text: z.string().min(1).max(100_000),
      })
    )
    .mutation(async ({ input }) => {
      const extracted = await extractSIDoc(input.text);

      const npcProfilesWithMatches = await Promise.all(
        extracted.npcProfiles.map(async (npc) => {
          const suggestedMatch = await fuzzyMatchNpc(npc.name, input.campaignId);
          return { ...npc, suggestedMatch: suggestedMatch ?? null };
        })
      );

      return { ...extracted, npcProfiles: npcProfilesWithMatches };
    }),

  confirmSIPrepImport: campaignDMProcedure
    .input(SIConfirmPayloadSchema)
    .mutation(async ({ input }) => {
      const counters = {
        secretsCreated: 0,
        phasesCreated: 0,
        routesCreated: 0,
        profilesUpserted: 0,
        entitiesCreated: 0,
      };

      await prisma.$transaction(async (tx) => {
        // 1. Intent brief
        if (input.intentBrief) {
          await tx.gameSession.update({
            where: { id: input.sessionId },
            data: { prepNotes: input.intentBrief },
          });
        }

        // 2. PrepSecrets + PrepKnowledge
        for (const s of input.secrets) {
          const secret = await tx.prepSecret.create({
            data: {
              campaignId: input.campaignId,
              sessionId: input.sessionId,
              name: s.name,
              content: s.content,
            },
          });
          counters.secretsCreated++;

          for (const k of s.knowledge) {
            if (!k.worldEntityId) continue;
            await tx.prepKnowledge.create({
              data: {
                prepSecretId: secret.id,
                worldEntityId: k.worldEntityId,
                revealCondition: k.revealCondition,
                isCritical: s.isCritical,
              },
            });
          }
        }

        // 3. SessionPhases — append after max existing orderIndex
        const maxPhase = await tx.sessionPhase.aggregate({
          where: { sessionId: input.sessionId },
          _max: { orderIndex: true },
        });
        let phaseOrder = (maxPhase._max.orderIndex ?? -1) + 1;
        for (const p of input.phases) {
          await tx.sessionPhase.create({
            data: {
              sessionId: input.sessionId,
              name: p.name,
              targetMinutes: p.targetMinutes,
              notes: p.notes,
              orderIndex: phaseOrder++,
            },
          });
          counters.phasesCreated++;
        }

        // 4. SessionRoutes — clear isActive on existing if any new route is active
        const hasActiveRoute = input.routes.some((r) => r.isActive);
        if (hasActiveRoute) {
          await tx.sessionRoute.updateMany({
            where: { sessionId: input.sessionId },
            data: { isActive: false },
          });
        }
        const maxRoute = await tx.sessionRoute.aggregate({
          where: { sessionId: input.sessionId },
          _max: { orderIndex: true },
        });
        let routeOrder = (maxRoute._max.orderIndex ?? -1) + 1;
        for (const r of input.routes) {
          await tx.sessionRoute.create({
            data: {
              sessionId: input.sessionId,
              name: r.name,
              description: r.description,
              isActive: r.isActive,
              orderIndex: routeOrder++,
            },
          });
          counters.routesCreated++;
        }

        // 5. NpcBehaviorProfiles — upsert, merge arrays
        for (const npc of input.npcProfiles) {
          let entityId = npc.worldEntityId;

          if (!entityId) {
            const entity = await tx.worldEntity.create({
              data: {
                campaignId: input.campaignId,
                type: 'NPC',
                name: npc.name,
              },
            });
            entityId = entity.id;
            counters.entitiesCreated++;
          }

          const existing = await tx.npcBehaviorProfile.findUnique({
            where: { worldEntityId: entityId },
          });

          if (existing) {
            const existingTB = existing.triggeredBehaviors as Array<{ condition: string; behavior: string }>;
            const existingCD = existing.criticalDialogue as Array<{ line: string; trigger: string }>;

            await tx.npcBehaviorProfile.update({
              where: { worldEntityId: entityId },
              data: {
                defaultBehavior: existing.defaultBehavior ?? npc.defaultBehavior,
                triggeredBehaviors: [
                  ...existingTB,
                  ...npc.triggeredBehaviors.filter(
                    (t) => !existingTB.some((e) => e.condition === t.condition)
                  ),
                ],
                criticalDialogue: [
                  ...existingCD,
                  ...npc.criticalDialogue.filter(
                    (d) => !existingCD.some((e) => e.line === d.line)
                  ),
                ],
              },
            });
          } else {
            await tx.npcBehaviorProfile.create({
              data: {
                worldEntityId: entityId,
                defaultBehavior: npc.defaultBehavior,
                triggeredBehaviors: npc.triggeredBehaviors,
                criticalDialogue: npc.criticalDialogue,
              },
            });
          }
          counters.profilesUpserted++;
        }
      });

      return counters;
    }),
});
