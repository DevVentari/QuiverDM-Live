/**
 * Invite Code Router
 * tRPC endpoints for closed beta invite system
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure, wardenProcedure } from '../trpc';
import { inviteService } from '../services/invite.service';
import { BadRequestError } from '../errors';
import { emailService } from '@/lib/email';

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
  generate: wardenProcedure
    .input(
      z.object({
        count: z.number().min(1).max(1000),
        expiresInDays: z.number().min(1).max(365).optional(),
        emails: z.array(z.string().email()).max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.emails && input.emails.length > input.count) {
        throw new BadRequestError('Number of emails cannot exceed generated code count');
      }

      const result = await inviteService.generateCodes(
        input.count,
        input.expiresInDays
      );

      const recipients = input.emails ?? [];
      if (recipients.length === 0) {
        return result;
      }

      const emailResults = await Promise.allSettled(
        recipients.map((to, index) =>
          emailService.sendInviteCodeEmail({
            to,
            code: result.codes[index],
            expiresAt: result.expiresAt,
          })
        )
      );

      const emailSent = emailResults.filter(
        (entry) =>
          entry.status === 'fulfilled' &&
          entry.value.sent
      ).length;

      return {
        ...result,
        emailSent,
        emailRequested: recipients.length,
      };
    }),

  /**
   * Get invite code statistics (admin only)
   */
  getStats: wardenProcedure.query(async () => {
    return inviteService.getStats();
  }),

  /**
   * Get all invite codes (admin only)
   */
  getAll: wardenProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional(),
      })
    )
    .query(async ({ input }) => {
      return inviteService.getAllCodes(input.limit);
    }),

  /**
   * Get unused invite codes (admin only)
   */
  getUnused: wardenProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional(),
      })
    )
    .query(async ({ input }) => {
      return inviteService.getUnusedCodes(input.limit);
    }),

  /**
   * Clean up expired invite codes (admin only)
   */
  cleanupExpired: wardenProcedure.mutation(async () => {
    const deletedCount = await inviteService.cleanupExpired();
    return { deletedCount };
  }),
});
