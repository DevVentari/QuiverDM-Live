import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { router, wardenProcedure } from '../trpc';

export const adminOverviewRouter = router({
  getTimeline: wardenProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const [signupRows, costRows] = await Promise.all([
        prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE_TRUNC('day', "createdAt") AS date, COUNT(*) AS count
          FROM "User"
          WHERE "createdAt" >= ${since}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY date ASC
        `,
        prisma.$queryRaw<Array<{ date: Date; cost: number }>>`
          SELECT DATE_TRUNC('day', "createdAt") AS date,
                 COALESCE(SUM("estimatedCost"), 0)::float AS cost
          FROM "ApiUsageLog"
          WHERE "createdAt" >= ${since}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY date ASC
        `,
      ]);

      const days: Record<string, { newUsers: number; apiCost: number }> = {};
      for (let i = 0; i < input.days; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        days[key] = { newUsers: 0, apiCost: 0 };
      }

      for (const row of signupRows) {
        const key = new Date(row.date).toISOString().slice(0, 10);
        if (days[key]) days[key].newUsers = Number(row.count);
      }
      for (const row of costRows) {
        const key = new Date(row.date).toISOString().slice(0, 10);
        if (days[key]) days[key].apiCost = Number(row.cost);
      }

      return Object.entries(days).map(([date, v]) => ({ date, ...v }));
    }),

  getSummary: wardenProcedure.query(async () => {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      totalUsers,
      suspendedUsers,
      activeSubscriptions,
      totalCampaigns,
      totalSessions,
      totalHomebrew,
      newUsersLast7Days,
      newUsersLast30Days,
      recentUsers,
      recentCampaigns,
      recentSessions,
      roleBreakdown,
      tierBreakdown,
      providerUsage,
      featureUsage,
      topUsageUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { suspended: true } }),
      prisma.user.count({
        where: { subscriptionStatus: { in: ['active', 'trialing'] } },
      }),
      prisma.campaign.count(),
      prisma.gameSession.count(),
      prisma.homebrewContent.count(),
      prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          platformRole: true,
          tier: true,
          createdAt: true,
        },
      }),
      prisma.campaign.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          slug: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.gameSession.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          sessionNumber: true,
          updatedAt: true,
          status: true,
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.user.groupBy({
        by: ['platformRole'],
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ['tier'],
        _count: { _all: true },
      }),
      prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: last30Days } },
        _sum: {
          estimatedCost: true,
          requestCount: true,
          tokensIn: true,
          tokensOut: true,
        },
      }),
      prisma.apiUsageLog.groupBy({
        by: ['feature'],
        where: { createdAt: { gte: last30Days } },
        _sum: {
          estimatedCost: true,
          requestCount: true,
        },
        orderBy: {
          _sum: {
            estimatedCost: 'desc',
          },
        },
        take: 8,
      }),
      prisma.apiUsageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: last30Days } },
        _sum: {
          estimatedCost: true,
          requestCount: true,
          tokensIn: true,
          tokensOut: true,
        },
        orderBy: {
          _sum: {
            estimatedCost: 'desc',
          },
        },
        take: 6,
      }),
    ]);

    const topUserIds = topUsageUsers.map((row) => row.userId);
    const topUsers = topUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: topUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            platformRole: true,
            tier: true,
          },
        })
      : [];
    const topUserMap = new Map(topUsers.map((user) => [user.id, user]));

    const usageSummary = providerUsage.reduce(
      (acc, row) => {
        acc.totalCost += row._sum.estimatedCost ?? 0;
        acc.totalRequests += row._sum.requestCount ?? 0;
        acc.totalTokensIn += row._sum.tokensIn ?? 0;
        acc.totalTokensOut += row._sum.tokensOut ?? 0;
        return acc;
      },
      { totalCost: 0, totalRequests: 0, totalTokensIn: 0, totalTokensOut: 0 },
    );

    return {
      totals: {
        totalUsers,
        suspendedUsers,
        activeSubscriptions,
        totalCampaigns,
        totalSessions,
        totalHomebrew,
        newUsersLast7Days,
        newUsersLast30Days,
      },
      usage: {
        periodDays: 30,
        ...usageSummary,
        providerUsage,
        featureUsage,
      },
      roleBreakdown: roleBreakdown.map((row) => ({
        role: row.platformRole,
        count: row._count._all,
      })),
      tierBreakdown: tierBreakdown.map((row) => ({
        tier: row.tier,
        count: row._count._all,
      })),
      recentUsers,
      recentCampaigns,
      recentSessions,
      topUsageUsers: topUsageUsers.map((row) => ({
        userId: row.userId,
        user: topUserMap.get(row.userId) ?? null,
        estimatedCost: row._sum.estimatedCost ?? 0,
        requestCount: row._sum.requestCount ?? 0,
        tokensIn: row._sum.tokensIn ?? 0,
        tokensOut: row._sum.tokensOut ?? 0,
      })),
    };
  }),
});
