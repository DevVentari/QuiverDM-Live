import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { NotFoundError } from '@/server/errors';
import { prisma } from '@/server/db';

export const npcBehaviorProfilesRouter = router({
  get: campaignMemberProcedure
    .input(z.object({ worldEntityId: z.string() }))
    .query(async ({ input }) => {
      const entity = await prisma.worldEntity.findFirst({
        where: { id: input.worldEntityId, campaignId: input.campaignId },
      });
      if (!entity) throw new NotFoundError('worldEntity', input.worldEntityId);
      return prisma.npcBehaviorProfile.findUnique({
        where: { worldEntityId: input.worldEntityId },
      });
    }),

  listBySession: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const sessionSecrets = await prisma.prepSecret.findMany({
        where: { sessionId: input.sessionId, campaignId: input.campaignId },
        include: { knowledge: { select: { worldEntityId: true } } },
      });
      const entityIds = [...new Set(
        sessionSecrets.flatMap(s => s.knowledge.map(k => k.worldEntityId))
      )];
      if (entityIds.length === 0) return [];
      return prisma.npcBehaviorProfile.findMany({
        where: {
          worldEntityId: { in: entityIds },
          worldEntity: { campaignId: input.campaignId },
        },
        include: {
          worldEntity: { select: { id: true, name: true, type: true, description: true } },
        },
      });
    }),

  upsert: campaignDMProcedure
    .input(z.object({
      worldEntityId: z.string(),
      defaultBehavior: z.string().optional(),
      triggeredBehaviors: z.array(z.object({ condition: z.string(), behavior: z.string() })).default([]),
      criticalDialogue: z.array(z.object({ line: z.string(), trigger: z.string() })).default([]),
    }))
    .mutation(async ({ input }) => {
      const entity = await prisma.worldEntity.findFirst({
        where: { id: input.worldEntityId, campaignId: input.campaignId },
      });
      if (!entity) throw new NotFoundError('worldEntity', input.worldEntityId);
      return prisma.npcBehaviorProfile.upsert({
        where: { worldEntityId: input.worldEntityId },
        create: {
          worldEntityId: input.worldEntityId,
          defaultBehavior: input.defaultBehavior,
          triggeredBehaviors: input.triggeredBehaviors,
          criticalDialogue: input.criticalDialogue,
        },
        update: {
          defaultBehavior: input.defaultBehavior,
          triggeredBehaviors: input.triggeredBehaviors,
          criticalDialogue: input.criticalDialogue,
        },
      });
    }),
});
