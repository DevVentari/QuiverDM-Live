import { router, campaignDMProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';

async function getAncestorPath(mapId: string): Promise<Array<{ mapId: string; name: string; entityId: string | null }>> {
  const path: Array<{ mapId: string; name: string; entityId: string | null }> = [];
  let current = await prisma.campaignMap.findUnique({
    where: { id: mapId },
    select: { id: true, name: true, parentLocationId: true },
  });
  while (current) {
    path.unshift({ mapId: current.id, name: current.name, entityId: current.parentLocationId });
    if (!current.parentLocationId) break;
    const parent = await prisma.campaignMap.findFirst({
      where: { parentLocationId: current.parentLocationId },
      select: { id: true, name: true, parentLocationId: true },
    });
    if (!parent || parent.id === current.id) break;
    current = parent;
  }
  return path;
}

export const worldMapRouter = router({
  getOrCreateRoot: campaignDMProcedure
    .query(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { campaignId: input.campaignId, parentLocationId: null },
        include: { pins: { include: { entity: { select: { id: true, name: true, type: true } } } } },
      });
      return map;
    }),

  getMap: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1) }))
    .query(async ({ input }) => {
      const map = await prisma.campaignMap.findUnique({
        where: { id: input.mapId },
        include: {
          pins: {
            include: {
              entity: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  _count: { select: { stateChanges: true } },
                },
              },
            },
          },
        },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const ancestorPath = await getAncestorPath(input.mapId);
      return { ...map, ancestorPath };
    }),

  getLocationEvents: protectedProcedure
    .input(z.object({ entityId: z.string().min(1) }))
    .query(async ({ input }) => {
      return prisma.worldStateChange.findMany({
        where: { entityId: input.entityId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          changeType: true,
          newValue: true,
          source: true,
          createdAt: true,
          sessionId: true,
          session: { select: { title: true, sessionNumber: true } },
        },
      });
    }),
});
