import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { prisma } from '@/lib/prisma';

const sceneFields = z.object({
  title: z.string().min(1).max(160),
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']).default('rp'),
  description: z.string().optional(),
  dmNotes: z.string().optional(),
  imageUrl: z.string().optional(),
  musicCue: z.string().optional(),
  orderIndex: z.number().optional(),
});

/**
 * Scenes — RP / description / shop / theatre moments presented to players.
 * TODO(authz): scope to campaign membership; today protectedProcedure gates auth only.
 */
export const scenesRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input }) =>
      prisma.scene.findMany({
        where: { campaignId: input.campaignId },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      }),
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => prisma.scene.findUnique({ where: { id: input.id } })),

  create: protectedProcedure
    .input(sceneFields.extend({ campaignId: z.string() }))
    .mutation(({ input }) => {
      const { campaignId, ...data } = input;
      return prisma.scene.create({ data: { campaignId, ...data } });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(sceneFields.partial()))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return prisma.scene.update({ where: { id }, data });
    }),

  /** Present one scene to players (exclusive — clears any other presented scene). */
  present: protectedProcedure
    .input(z.object({ id: z.string(), campaignId: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } });
      return prisma.scene.update({ where: { id: input.id }, data: { isPresented: true } });
    }),

  clearPresented: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(({ input }) => prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } })),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => prisma.scene.delete({ where: { id: input.id } })),
});
