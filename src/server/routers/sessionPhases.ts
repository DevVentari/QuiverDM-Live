import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { prisma } from '@/lib/prisma';

export const sessionPhasesRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
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
      await prisma.$transaction([
        prisma.sessionPhase.deleteMany({ where: { sessionId: input.sessionId } }),
        prisma.sessionPhase.createMany({
          data: input.phases.map(p => ({
            sessionId: input.sessionId,
            name: p.name,
            targetMinutes: p.targetMinutes,
            orderIndex: p.orderIndex,
            notes: p.notes,
          })),
        }),
      ]);
      return prisma.sessionPhase.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),
});
