/**
 * Feedback Router
 * tRPC endpoints for beta feedback collection
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { feedbackService } from '../services/feedback.service';
import { ForbiddenError } from '../errors';

const feedbackTypeEnum = z.enum(['bug', 'feature', 'improvement', 'other']);
const feedbackCategoryEnum = z.enum([
  'transcription',
  'pdf',
  'ui',
  'performance',
  'other',
]);
const feedbackStatusEnum = z.enum([
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'wont_fix',
]);

/**
 * Check if user is admin via ADMIN_EMAILS environment variable.
 * Throws ForbiddenError if the user's email is not in the list.
 */
function requireAdmin(userEmail: string | null | undefined) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    // No ADMIN_EMAILS configured — lock down to prevent accidental exposure
    throw ForbiddenError.forPermission('manage', 'feedback');
  }

  if (!userEmail || !adminEmails.includes(userEmail.toLowerCase())) {
    throw ForbiddenError.forPermission('manage', 'feedback');
  }
}

export const feedbackRouter = router({
  /**
   * Submit new feedback
   */
  create: protectedProcedure
    .input(
      z.object({
        type: feedbackTypeEnum,
        category: feedbackCategoryEnum.optional(),
        title: z.string().min(3).max(200),
        description: z.string().min(10),
        rating: z.number().min(1).max(5).optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return feedbackService.create(ctx.session.user.id, input);
    }),

  /**
   * Get feedback by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        feedbackId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return feedbackService.getById(input.feedbackId, ctx.session.user.id);
    }),

  /**
   * Get user's feedback history
   */
  getMyFeedback: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return feedbackService.getUserFeedback(
        ctx.session.user.id,
        input.limit
      );
    }),

  /**
   * Get all feedback (admin only)
   */
  getAll: protectedProcedure
    .input(
      z.object({
        type: feedbackTypeEnum.optional(),
        category: feedbackCategoryEnum.optional(),
        status: feedbackStatusEnum.optional(),
        limit: z.number().min(1).max(500).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.email);

      return feedbackService.getAll(input);
    }),

  /**
   * Update feedback status (admin only)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        feedbackId: z.string(),
        status: feedbackStatusEnum,
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.email);

      return feedbackService.updateStatus(
        input.feedbackId,
        input.status,
        input.adminNotes
      );
    }),

  /**
   * Submit a rich report from the feedback overlay widget
   */
  createReport: protectedProcedure
    .input(
      z.object({
        type: z.enum(['bug', 'feature', 'feedback']),
        description: z.string().min(10).max(5000),
        pageUrl: z.string().url(),
        userAgent: z.string().max(500),
        screenshotBase64: z.string().max(5_000_000),
        consoleLogs: z
          .array(
            z.object({
              ts: z.number(),
              level: z.string(),
              msg: z.string().max(500),
            })
          )
          .max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return feedbackService.createReport(
        ctx.session.user.id,
        ctx.session.user.email ?? '',
        input
      );
    }),

  /**
   * Get feedback statistics (admin only)
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.session.user.email);

    return feedbackService.getStats();
  }),
});
