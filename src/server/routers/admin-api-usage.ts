import { z } from 'zod';
import { router, wardenProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const adminApiUsageRouter = router({
  getPlatformSummary: wardenProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const byProvider = await prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      const totalCost = byProvider.reduce((sum, p) => sum + (p._sum.estimatedCost ?? 0), 0);
      const totalRequests = byProvider.reduce((sum, p) => sum + (p._sum.requestCount ?? 0), 0);

      return { byProvider, totalCost, totalRequests, periodDays: days };
    }),

  getByUser: wardenProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30;
      const limit = input?.limit ?? 50;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const userUsage = await prisma.apiUsageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
        orderBy: { _sum: { estimatedCost: 'desc' } },
        take: limit,
      });

      const userIds = userUsage.map(u => u.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, displayName: true, image: true, platformRole: true, tier: true },
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      return userUsage.map(u => ({
        user: userMap.get(u.userId) ?? { id: u.userId, name: null, email: null },
        requests: u._sum.requestCount ?? 0,
        tokensIn: u._sum.tokensIn ?? 0,
        tokensOut: u._sum.tokensOut ?? 0,
        estimatedCost: u._sum.estimatedCost ?? 0,
      }));
    }),

  getUserDetail: wardenProcedure
    .input(z.object({
      userId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const [byFeature, byModel] = await Promise.all([
        prisma.apiUsageLog.groupBy({
          by: ['feature'],
          where: { userId: input.userId, createdAt: { gte: since } },
          _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        }),
        prisma.apiUsageLog.groupBy({
          by: ['model', 'provider'],
          where: { userId: input.userId, createdAt: { gte: since } },
          _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        }),
      ]);

      return { byFeature, byModel };
    }),
});
