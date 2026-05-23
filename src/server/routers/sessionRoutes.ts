import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { prisma } from '../db';

export const sessionRoutesRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.sessionRoute.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  upsertMany: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      routes: z.array(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        benefits: z.array(z.string()),
        risks: z.array(z.string()),
        orderIndex: z.number().int(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await prisma.$transaction([
        prisma.sessionRoute.deleteMany({ where: { sessionId: input.sessionId } }),
        prisma.sessionRoute.createMany({
          data: input.routes.map(r => ({
            sessionId: input.sessionId,
            name: r.name,
            description: r.description,
            benefits: r.benefits,
            risks: r.risks,
            orderIndex: r.orderIndex,
          })),
        }),
      ]);
      return prisma.sessionRoute.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  setActive: campaignDMProcedure
    .input(z.object({ sessionId: z.string(), routeId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.$transaction([
        prisma.sessionRoute.updateMany({
          where: { sessionId: input.sessionId },
          data: { isActive: false },
        }),
        ...(input.routeId ? [
          prisma.sessionRoute.update({
            where: { id: input.routeId },
            data: { isActive: true },
          }),
        ] : []),
      ]);
    }),
});
