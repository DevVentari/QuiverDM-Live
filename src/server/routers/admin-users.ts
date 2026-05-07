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

  getDetail: wardenProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const [user, usage, ownedCampaigns, recentApiUsage, apiSummary] = await Promise.all([
        prisma.user.findUnique({
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
            settings: {
              select: {
                openaiApiKey: true,
                anthropicApiKey: true,
                geminiApiKey: true,
                huggingfaceToken: true,
                dndBeyondCobaltCookie: true,
              },
            },
            accounts: {
              select: {
                provider: true,
              },
            },
          },
        }),
        prisma.userUsage.findUnique({
          where: { userId: input.userId },
          select: {
            periodStart: true,
            periodEnd: true,
            campaignsOwned: true,
            campaignLimit: true,
            pdfUploads: true,
            pdfUploadLimit: true,
            aiRecaps: true,
            aiRecapLimit: true,
            transcriptionSeconds: true,
            transcriptionLimit: true,
            sessionUploads: true,
            sessionUploadLimit: true,
            semanticSearches: true,
            semanticSearchLimit: true,
            imageGenerations: true,
            imageGenerationLimit: true,
            lastResetAt: true,
          },
        }),
        prisma.campaign.findMany({
          where: { userId: input.userId },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            updatedAt: true,
            _count: {
              select: {
                gameSessions: true,
              },
            },
          },
        }),
        prisma.apiUsageLog.findMany({
          where: { userId: input.userId },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: {
            id: true,
            provider: true,
            model: true,
            feature: true,
            estimatedCost: true,
            tokensIn: true,
            tokensOut: true,
            requestCount: true,
            createdAt: true,
          },
        }),
        prisma.apiUsageLog.aggregate({
          where: { userId: input.userId },
          _sum: {
            estimatedCost: true,
            requestCount: true,
            tokensIn: true,
            tokensOut: true,
          },
          _count: {
            _all: true,
          },
        }),
      ]);

      if (!user) throw new NotFoundError('user', input.userId);

      return {
        user: {
          ...user,
          settings: undefined,
          accounts: undefined,
        },
        authProviders: [...new Set(user.accounts.map((account) => account.provider))],
        apiKeys: [
          { name: 'openaiApiKey', label: 'OpenAI', present: !!user.settings?.openaiApiKey },
          { name: 'anthropicApiKey', label: 'Anthropic', present: !!user.settings?.anthropicApiKey },
          { name: 'geminiApiKey', label: 'Gemini', present: !!user.settings?.geminiApiKey },
          { name: 'huggingfaceToken', label: 'Hugging Face', present: !!user.settings?.huggingfaceToken },
          { name: 'dndBeyondCobaltCookie', label: 'D&D Beyond', present: !!user.settings?.dndBeyondCobaltCookie },
        ],
        usage: usage ?? {
          periodStart: null,
          periodEnd: null,
          campaignsOwned: 0,
          campaignLimit: -1,
          pdfUploads: 0,
          pdfUploadLimit: -1,
          aiRecaps: 0,
          aiRecapLimit: -1,
          transcriptionSeconds: 0,
          transcriptionLimit: -1,
          sessionUploads: 0,
          sessionUploadLimit: -1,
          semanticSearches: 0,
          semanticSearchLimit: -1,
          imageGenerations: 0,
          imageGenerationLimit: -1,
          lastResetAt: null,
        },
        ownedCampaigns,
        recentApiUsage,
        apiSummary: {
          estimatedCost: apiSummary._sum.estimatedCost ?? 0,
          requestCount: apiSummary._sum.requestCount ?? 0,
          tokensIn: apiSummary._sum.tokensIn ?? 0,
          tokensOut: apiSummary._sum.tokensOut ?? 0,
          logCount: apiSummary._count._all,
        },
      };
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

  changeTier: wardenProcedure
    .input(z.object({
      userId: z.string(),
      tier: z.enum(['free', 'pro', 'team', 'alpha']),
    }))
    .mutation(async ({ input }) => {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      return prisma.user.update({
        where: { id: input.userId },
        data: { tier: input.tier },
        select: { id: true, tier: true },
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

  bulkChangeRole: wardenProcedure
    .input(z.object({
      userIds: z.array(z.string()).min(1).max(100),
      newRole: z.nativeEnum(PlatformRole),
    }))
    .mutation(async ({ ctx, input }) => {
      const actorRole = ctx.platformRole as PlatformRole;

      if (!canPromoteTo(actorRole, input.newRole)) {
        throw new ForbiddenError('Insufficient role to assign this role');
      }

      const targets = await prisma.user.findMany({
        where: { id: { in: input.userIds } },
        select: { id: true, platformRole: true },
      });

      let updated = 0;
      let skipped = 0;

      await prisma.$transaction(async (tx) => {
        for (const target of targets) {
          if (target.id === ctx.session.user.id) { skipped++; continue; }
          if (!canDemoteFrom(actorRole, target.platformRole)) { skipped++; continue; }
          await tx.user.update({
            where: { id: target.id },
            data: { platformRole: input.newRole },
          });
          updated++;
        }
      });

      return { updated, skipped };
    }),

  bulkChangeTier: wardenProcedure
    .input(z.object({
      userIds: z.array(z.string()).min(1).max(100),
      tier: z.enum(['free', 'pro', 'team', 'alpha']),
    }))
    .mutation(async ({ input }) => {
      const result = await prisma.user.updateMany({
        where: { id: { in: input.userIds } },
        data: { tier: input.tier },
      });
      return { updated: result.count };
    }),

  bulkSuspend: wardenProcedure
    .input(z.object({
      userIds: z.array(z.string()).min(1).max(100),
      suspended: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.user.updateMany({
        where: {
          id: { in: input.userIds },
          NOT: [
            { id: ctx.session.user.id },
            { platformRole: PlatformRole.MYTHKEEPER },
          ],
        },
        data: { suspended: input.suspended },
      });
      return { updated: result.count };
    }),
});
