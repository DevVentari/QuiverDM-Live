import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { sessionService } from '../services/session.service';

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
});
