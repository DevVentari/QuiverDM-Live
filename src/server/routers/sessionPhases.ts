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

export const sessionPhasesRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      await assertSessionOwnership(input.sessionId, input.campaignId);
      return prisma.sessionPhase.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  upsertMany: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      phases: z.array(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        targetMinutes: z.number().int().min(1),
        orderIndex: z.number().int(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      await assertSessionOwnership(input.sessionId, input.campaignId);
      const result = await prisma.$transaction(async (tx) => {
        await tx.sessionPhase.deleteMany({ where: { sessionId: input.sessionId } });
        await tx.sessionPhase.createMany({
          data: input.phases.map(p => ({
            sessionId: input.sessionId,
            name: p.name,
            targetMinutes: p.targetMinutes,
            orderIndex: p.orderIndex,
            notes: p.notes,
          })),
        });
        return tx.sessionPhase.findMany({
          where: { sessionId: input.sessionId },
          orderBy: { orderIndex: 'asc' },
        });
      });
      return result;
    }),
});
