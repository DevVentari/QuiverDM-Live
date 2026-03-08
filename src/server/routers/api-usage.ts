import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const apiUsageRouter = router({
  getSummary: protectedProcedure
    .input(z.object({
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();
      const start = input?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input?.periodEnd ?? now;

      const logs = await prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const geminiToday = await prisma.apiUsageLog.aggregate({
        where: { userId, provider: 'gemini', createdAt: { gte: todayStart } },
        _sum: { requestCount: true },
      });

      return {
        providers: logs.map(l => ({
          provider: l.provider,
          requests: l._count,
          tokensIn: l._sum.tokensIn || 0,
          tokensOut: l._sum.tokensOut || 0,
          estimatedCost: l._sum.estimatedCost || 0,
        })),
        geminiRequestsToday: geminiToday._sum.requestCount || 0,
        periodStart: start,
        periodEnd: end,
      };
    }),

  getByFeature: protectedProcedure
    .input(z.object({
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();
      const start = input?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input?.periodEnd ?? now;

      const logs = await prisma.apiUsageLog.groupBy({
        by: ['feature'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      return logs.map(l => ({
        feature: l.feature,
        requests: l._count,
        tokensIn: l._sum.tokensIn || 0,
        tokensOut: l._sum.tokensOut || 0,
        estimatedCost: l._sum.estimatedCost || 0,
      }));
    }),

  getByModel: protectedProcedure
    .input(z.object({
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();
      const start = input?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input?.periodEnd ?? now;

      const logs = await prisma.apiUsageLog.groupBy({
        by: ['model', 'provider'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      return logs.map(l => ({
        model: l.model,
        provider: l.provider,
        requests: l._count,
        tokensIn: l._sum.tokensIn || 0,
        tokensOut: l._sum.tokensOut || 0,
        estimatedCost: l._sum.estimatedCost || 0,
      }));
    }),

  getRecentCalls: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input?.limit ?? 50;

      const logs = await prisma.apiUsageLog.findMany({
        where: {
          userId,
          ...(input?.cursor ? { id: { lt: input.cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          provider: true,
          model: true,
          feature: true,
          tokensIn: true,
          tokensOut: true,
          estimatedCost: true,
          createdAt: true,
        },
      });

      const hasMore = logs.length > limit;
      const items = hasMore ? logs.slice(0, -1) : logs;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),
});
