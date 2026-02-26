import {
  router,
  protectedProcedure,
  campaignDMProcedure,
} from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sessionService } from '../services/session.service';
import { prisma } from '../db';
import { authz } from '../services/authorization.service';
import { BadRequestError, NotFoundError } from '../errors';
import { combatCopilotQueue } from '@/lib/queue/combat-copilot-queue';

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
   * Create new session
   * Requires DM access or canManageSessions permission
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        title: z.string().max(500).optional(),
        quickNotes: z.string().max(10000).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { campaignId, ...data } = input;
      return sessionService.create(campaignId, ctx.session.user.id, data);
    }),

  /**
   * Update session
   * Requires DM access or canManageSessions permission
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
   * Requires DM access or canManageSessions permission
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
   * Requires DM access or canManageSessions permission
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
   * Supports multi-user: any campaign member can view
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
   * Requires DM access or canManageSessions permission
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
   * Requires DM access (OWNER or CO_DM)
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
});
