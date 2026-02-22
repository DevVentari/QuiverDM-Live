import { router, protectedProcedure, campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { sessionService } from '../services/session.service';
import { prisma } from '../db';
import { authz } from '../services/authorization.service';

export const sessionsRouter = router({
  /**
   * Get all sessions for a campaign
   * Supports multi-user: any campaign member can view sessions
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
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
        id: z.string(),
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
        campaignId: z.string(),
        title: z.string().optional(),
        quickNotes: z.string().optional(),
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
        id: z.string(),
        title: z.string().optional(),
        quickNotes: z.string().optional(),
        recap: z.string().optional(),
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
        sessionId: z.string(),
        playerVisibility: z.enum(['dm-only', 'summary-only', 'public']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await authz
        .session(input.sessionId, ctx.session.user.id)
        .requirePermission('canManageSessions');

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
        id: z.string(),
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
        campaignId: z.string(),
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
        id: z.string(),
        recap: z.string().optional(),
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
        campaignId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const recap = await sessionService.generateRecap(
        input.sessionId,
        ctx.session.user.id
      );
      return { recap };
    }),

  generateSummary: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.generateSummary(input.sessionId, ctx.session.user.id)
    ),

  getSummaryStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getSummaryStatus(input.sessionId, ctx.session.user.id)
    ),

  createShareToken: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      sessionService.createShareToken(input.sessionId, ctx.session.user.id)
    ),

  getSessionsWithSummaries: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(({ input, ctx }) =>
      sessionService.getSessionsWithSummaries(input.campaignId, ctx.session.user.id)
    ),
});
