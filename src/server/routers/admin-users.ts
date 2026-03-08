import { z } from 'zod';
import { router, wardenProcedure, mythkeeperProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { canPromoteTo, canDemoteFrom } from '@/lib/platform';
import { ForbiddenError, NotFoundError } from '../errors';
import crypto from 'crypto';

export const adminUsersRouter = router({
  list: wardenProcedure
    .input(z.object({
      search: z.string().optional(),
      role: z.nativeEnum(PlatformRole).optional(),
      tier: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
          { displayName: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      if (input.role) where.platformRole = input.role;
      if (input.tier) where.tier = input.tier;

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          image: true,
          platformRole: true,
          tier: true,
          suspended: true,
          createdAt: true,
          updatedAt: true,
          onboardingCompleted: true,
          subscriptionStatus: true,
          _count: { select: { campaigns: true, campaignMemberships: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (users.length > input.limit) {
        const next = users.pop();
        nextCursor = next?.id;
      }

      return { users, nextCursor };
    }),

  getById: wardenProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          image: true,
          bio: true,
          platformRole: true,
          tier: true,
          suspended: true,
          createdAt: true,
          updatedAt: true,
          onboardingCompleted: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          _count: { select: { campaigns: true, campaignMemberships: true, homebrewContent: true, homebrewPDFs: true } },
        },
      });
      if (!user) throw new NotFoundError('user', input.userId);
      return user;
    }),

  changeRole: wardenProcedure
    .input(z.object({
      userId: z.string(),
      newRole: z.nativeEnum(PlatformRole),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new ForbiddenError('Cannot change your own role');
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { platformRole: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      const actorRole = ctx.platformRole as PlatformRole;

      if (!canDemoteFrom(actorRole, target.platformRole)) {
        throw new ForbiddenError('Insufficient role to modify this user');
      }
      if (!canPromoteTo(actorRole, input.newRole)) {
        throw new ForbiddenError('Insufficient role to assign this role');
      }

      return prisma.user.update({
        where: { id: input.userId },
        data: { platformRole: input.newRole },
        select: { id: true, platformRole: true },
      });
    }),

  suspend: wardenProcedure
    .input(z.object({
      userId: z.string(),
      suspended: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new ForbiddenError('Cannot suspend yourself');
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { platformRole: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      if (target.platformRole === PlatformRole.MYTHKEEPER) {
        throw new ForbiddenError('Cannot suspend a Mythkeeper');
      }

      return prisma.user.update({
        where: { id: input.userId },
        data: { suspended: input.suspended },
        select: { id: true, suspended: true },
      });
    }),

  forcePasswordReset: wardenProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new ForbiddenError('Cannot force-reset your own password');
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, name: true, displayName: true, platformRole: true },
      });
      if (!target?.email) throw new NotFoundError('user', input.userId);

      if (target.platformRole === PlatformRole.MYTHKEEPER) {
        throw new ForbiddenError('Cannot force-reset a Mythkeeper password');
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { token, userId: target.id, expiresAt },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3847'}/auth/reset-password/${token}`;
      const { emailService } = await import('@/lib/email');
      await emailService.sendPasswordResetEmail({
        to: target.email,
        resetUrl,
        name: target.name || target.displayName,
      });

      return { success: true };
    }),

  impersonate: mythkeeperProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, name: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      return { userId: target.id, email: target.email, name: target.name };
    }),
});
