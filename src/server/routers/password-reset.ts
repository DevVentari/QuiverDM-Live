import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { BadRequestError, NotFoundError } from '../errors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const passwordResetRouter = router({
  /**
   * Step 1: Request a password reset email
   * Always returns success (don't leak whether email exists)
   */
  requestReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (user) {
        // Invalidate any existing tokens for this user
        await prisma.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.create({
          data: { token, userId: user.id, expiresAt },
        });

        const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3847'}/auth/reset-password/${token}`;
        await emailService.sendPasswordResetEmail({
          to: user.email!,
          resetUrl,
          name: user.name || user.displayName,
        });
      }

      // Always return success - never leak whether email exists
      return { success: true };
    }),

  /**
   * Step 2: Validate a reset token (used by the reset page on load)
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const record = await prisma.passwordResetToken.findUnique({
        where: { token: input.token },
      });

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        return { valid: false };
      }
      return { valid: true };
    }),

  /**
   * Step 3: Reset password using a valid token
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }))
    .mutation(async ({ input }) => {
      const record = await prisma.passwordResetToken.findUnique({
        where: { token: input.token },
      });

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new BadRequestError('Invalid or expired reset token.');
      }

      const hashed = await bcrypt.hash(input.password, 12);

      await prisma.$transaction(async (tx) => {
        const updatedAccount = await tx.account.updateMany({
          where: {
            userId: record.userId,
            provider: 'credentials',
          },
          data: { password: hashed },
        });

        if (updatedAccount.count === 0) {
          throw new NotFoundError('Credentials account');
        }

        await tx.passwordResetToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
      });

      return { success: true };
    }),
});
