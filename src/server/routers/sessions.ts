import {
  router,
  protectedProcedure,
  campaignDMProcedure,
  campaignMemberProcedure,
} from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sessionService } from '../services/session.service';
import { prisma } from '../db';
import { authz } from '../services/authorization.service';
import { BadRequestError, NotFoundError } from '../errors';
import { derailmentQueue } from '@/lib/queue/derailment-queue';
import { combatCopilotQueue } from '@/lib/queue/combat-copilot-queue';
import { playerRecapQueue } from '@/lib/queue/player-recap-queue';
import { SessionPrepDataSchema } from '@/lib/prep-types';
import { sessionStateService } from '../services/session-state.service';

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
    .mutation(({ input, ctx }) =>
      sessionService.completePrep(input.id, ctx.session.user.id)
    ),

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
    .mutation(({ input }) => sessionStateService.reviewEvent(input.eventId, input.action)),

  commitSessionEvents: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .mutation(({ input }) => sessionStateService.commitSessionEvents(input.sessionId)),
});
