import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { NotFoundError } from '@/server/errors';
import { prisma } from '@/server/db';

export const prepSecretsRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .query(async ({ input }) => {
      return prisma.prepSecret.findMany({
        where: {
          campaignId: input.campaignId,
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        },
        include: {
          knowledge: {
            include: { worldEntity: { select: { id: true, name: true, type: true } } },
          },
          revelations: { select: { id: true, sessionId: true, revealedAt: true, revealedBy: true } },
        },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  create: campaignDMProcedure
    .input(z.object({
      name: z.string().min(1),
      content: z.string().min(1),
      sessionId: z.string().optional(),
      orderIndex: z.number().int().default(0),
    }))
    .mutation(async ({ input }) => {
      return prisma.prepSecret.create({
        data: {
          campaignId: input.campaignId,
          sessionId: input.sessionId,
          name: input.name,
          content: input.content,
          orderIndex: input.orderIndex,
        },
      });
    }),

  update: campaignDMProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      content: z.string().optional(),
      sessionId: z.string().nullable().optional(),
      orderIndex: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, campaignId, ...data } = input;
      const secret = await prisma.prepSecret.findFirst({
        where: { id, campaignId },
      });
      if (!secret) throw new NotFoundError('prepSecret', id);
      return prisma.prepSecret.update({ where: { id }, data });
    }),

  delete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const secret = await prisma.prepSecret.findFirst({
        where: { id: input.id, campaignId: input.campaignId },
      });
      if (!secret) throw new NotFoundError('prepSecret', input.id);
      await prisma.prepSecret.delete({ where: { id: input.id } });
    }),

  addKnowledge: campaignDMProcedure
    .input(z.object({
      prepSecretId: z.string(),
      worldEntityId: z.string(),
      revealCondition: z.string().optional(),
      isCritical: z.boolean().default(false),
      criticalDialogue: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const secret = await prisma.prepSecret.findFirst({
        where: { id: input.prepSecretId, campaignId: input.campaignId },
      });
      if (!secret) throw new NotFoundError('prepSecret', input.prepSecretId);
      return prisma.prepKnowledge.upsert({
        where: {
          prepSecretId_worldEntityId: {
            prepSecretId: input.prepSecretId,
            worldEntityId: input.worldEntityId,
          },
        },
        create: {
          prepSecretId: input.prepSecretId,
          worldEntityId: input.worldEntityId,
          revealCondition: input.revealCondition,
          isCritical: input.isCritical,
          criticalDialogue: input.criticalDialogue,
        },
        update: {
          revealCondition: input.revealCondition,
          isCritical: input.isCritical,
          criticalDialogue: input.criticalDialogue,
        },
      });
    }),

  removeKnowledge: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const knowledge = await prisma.prepKnowledge.findFirst({
        where: { id: input.id, prepSecret: { campaignId: input.campaignId } },
      });
      if (!knowledge) throw new NotFoundError('prepKnowledge', input.id);
      await prisma.prepKnowledge.delete({ where: { id: input.id } });
    }),
});
