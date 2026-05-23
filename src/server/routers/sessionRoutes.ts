import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { prisma } from '@/server/db';
import { NotFoundError } from '@/server/errors';

async function assertSessionOwnership(sessionId: string, campaignId: string) {
  const session = await prisma.gameSession.findFirst({
    where: { id: sessionId, campaignId },
    select: { id: true },
  });
  if (!session) throw new NotFoundError('session', sessionId);
}

export const sessionRoutesRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      await assertSessionOwnership(input.sessionId, input.campaignId);
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
    .mutation(async ({ input }) => {
      await assertSessionOwnership(input.sessionId, input.campaignId);
      const result = await prisma.$transaction(async (tx) => {
        await tx.sessionRoute.deleteMany({ where: { sessionId: input.sessionId } });
        await tx.sessionRoute.createMany({
          data: input.routes.map(r => ({
            sessionId: input.sessionId,
            name: r.name,
            description: r.description,
            benefits: r.benefits,
            risks: r.risks,
            orderIndex: r.orderIndex,
          })),
        });
        return tx.sessionRoute.findMany({
          where: { sessionId: input.sessionId },
          orderBy: { orderIndex: 'asc' },
        });
      });
      return result;
    }),

  setActive: campaignDMProcedure
    .input(z.object({ sessionId: z.string(), routeId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      await assertSessionOwnership(input.sessionId, input.campaignId);
      await prisma.$transaction([
        prisma.sessionRoute.updateMany({
          where: { sessionId: input.sessionId },
          data: { isActive: false },
        }),
        ...(input.routeId ? [
          prisma.sessionRoute.update({
            where: { id: input.routeId, sessionId: input.sessionId },
            data: { isActive: true },
          }),
        ] : []),
      ]);
    }),
});
