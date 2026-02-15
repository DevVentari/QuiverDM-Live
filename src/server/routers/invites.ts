/**
 * Invite Code Router
 * tRPC endpoints for closed beta invite system
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { inviteService } from '../services/invite.service';
import { ForbiddenError } from '../errors';

/**
 * Check if user is admin (for now, all authenticated users are admins)
 * TODO: Add admin role to User model or use env variable for admin emails
 */
function requireAdmin(userId: string) {
  // For closed beta, all authenticated users have admin access
  // You can add proper admin checking here later:
  // const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  // const isAdmin = adminEmails.includes(userEmail);
  // if (!isAdmin) throw ForbiddenError.forPermission('manage', 'invite codes');

  // For now, just return (all authenticated users can access)
  return;
}

export const invitesRouter = router({
  /**
   * Validate an invite code (public - used during signup)
   */
  validate: publicProcedure
    .input(
      z.object({
        code: z.string().min(8, 'Invite code must be at least 8 characters'),
      })
    )
    .mutation(async ({ input }) => {
      await inviteService.validateCode(input.code);
      return { valid: true };
    }),

  /**
   * Redeem an invite code (called during user registration)
   * This should be called internally after successful signup
   */
  redeem: protectedProcedure
    .input(
      z.object({
        code: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await inviteService.redeemCode(input.code, ctx.session.user.id);
      return { redeemed: true };
    }),

  /**
   * Generate new invite codes (admin only)
   */
  generate: protectedProcedure
    .input(
      z.object({
        count: z.number().min(1).max(1000),
        expiresInDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.id);

      const result = await inviteService.generateCodes(
        input.count,
        input.expiresInDays
      );

      return result;
    }),

  /**
   * Get invite code statistics (admin only)
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.session.user.id);

    return inviteService.getStats();
  }),

  /**
   * Get all invite codes (admin only)
   */
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.id);

      return inviteService.getAllCodes(input.limit);
    }),

  /**
   * Get unused invite codes (admin only)
   */
  getUnused: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.session.user.id);

      return inviteService.getUnusedCodes(input.limit);
    }),

  /**
   * Clean up expired invite codes (admin only)
   */
  cleanupExpired: protectedProcedure.mutation(async ({ ctx }) => {
    requireAdmin(ctx.session.user.id);

    const deletedCount = await inviteService.cleanupExpired();
    return { deletedCount };
  }),
});
