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
 * Check if user is admin (for now, all authenticated users are admins)
 * TODO: Add admin role to User model or use env variable for admin emails
 */
function requireAdmin(userId: string) {
  // For closed beta, all authenticated users have admin access
  // You can add proper admin checking here later:
  // const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  // const isAdmin = adminEmails.includes(userEmail);
  // if (!isAdmin) throw ForbiddenError.forPermission('manage', 'feedback');

  // For now, just return (all authenticated users can access)
  return;
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
      requireAdmin(ctx.session.user.id);

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
      requireAdmin(ctx.session.user.id);

      return feedbackService.updateStatus(
        input.feedbackId,
        input.status,
        input.adminNotes
      );
    }),

  /**
   * Get feedback statistics (admin only)
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.session.user.id);

    return feedbackService.getStats();
  }),
});
