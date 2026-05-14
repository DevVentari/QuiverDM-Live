import { router, campaignDMProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';
import { WorldEntityType, WorldStateChangeSource, MapBgType } from '@prisma/client';
import { addMapGenerationJob } from '@/lib/queue/map-generation-queue';
import { enqueueMeiliSyncSafe } from '@/lib/queue/meili-sync-queue';
import { dedupeMapBackgroundCandidates, type MapBackgroundImageCandidate } from '@/lib/map-background-sources';

async function getAncestorPath(mapId: string): Promise<Array<{ mapId: string; name: string; entityId: string | null }>> {
  const path: Array<{ mapId: string; name: string; entityId: string | null }> = [];
  let current = await prisma.campaignMap.findUnique({
    where: { id: mapId },
    select: { id: true, name: true, parentLocationId: true },
  });
  while (current) {
    path.unshift({ mapId: current.id, name: current.name, entityId: current.parentLocationId });
    if (!current.parentLocationId) break;
    // Find the map that contains a pin for the parent location entity
    const parentPin = await prisma.mapPin.findFirst({
      where: { entityId: current.parentLocationId },
      select: { mapId: true },
    });
    if (!parentPin) break;
    current = await prisma.campaignMap.findUnique({
      where: { id: parentPin.mapId },
      select: { id: true, name: true, parentLocationId: true },
    });
    if (!current) break;
  }
  return path;
}

export const worldMapRouter = router({
  getOrCreateRoot: campaignDMProcedure
    .query(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { campaignId: input.campaignId, parentLocationId: null },
        include: {
          pins: {
            include: {
              entity: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });
      return map;
    }),

  getMap: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1), campaignId: z.string().min(1) }))
    .query(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { id: input.mapId, campaignId: input.campaignId },
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

  getLocationEvents: campaignDMProcedure
    .input(z.object({ entityId: z.string().min(1), campaignId: z.string().min(1) }))
    .query(async ({ input }) => {
      return prisma.worldStateChange.findMany({
        where: { entityId: input.entityId, campaignId: input.campaignId },
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

  createRoot: campaignDMProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      name: z.string().min(1).max(100).default('World Map'),
      backgroundType: z.nativeEnum(MapBgType).default('BLANK'),
      backgroundUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await prisma.campaignMap.findFirst({
        where: { campaignId: input.campaignId, parentLocationId: null },
      });
      if (existing) return existing;
      return prisma.campaignMap.create({
        data: {
          campaignId: input.campaignId,
          name: input.name,
          backgroundType: input.backgroundType,
          backgroundUrl: input.backgroundUrl ?? null,
          parentLocationId: null,
        },
      });
    }),

  createLocationPin: campaignDMProcedure
    .input(z.object({
      mapId: z.string().min(1),
      campaignId: z.string().min(1),
      name: z.string().min(1).max(255),
      x: z.number(),
      y: z.number(),
    }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { id: input.mapId, campaignId: input.campaignId },
        select: { campaignId: true },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const entity = await prisma.worldEntity.create({
        data: {
          campaignId: map.campaignId,
          type: WorldEntityType.LOCATION,
          name: input.name,
          aliases: [],
          properties: {},
        },
      });
      enqueueMeiliSyncSafe({ kind: 'world_entity', op: 'upsert', id: entity.id });
      return prisma.mapPin.create({
        data: { mapId: input.mapId, entityId: entity.id, x: input.x, y: input.y },
        include: { entity: { select: { id: true, name: true, type: true } } },
      });
    }),

  createNotePin: campaignDMProcedure
    .input(z.object({
      mapId: z.string().min(1),
      campaignId: z.string().min(1),
      content: z.string().min(1).max(2000),
      x: z.number(),
      y: z.number(),
    }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { id: input.mapId, campaignId: input.campaignId },
        select: { campaignId: true },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const entity = await prisma.worldEntity.create({
        data: {
          campaignId: map.campaignId,
          type: WorldEntityType.NOTE,
          name: input.content.slice(0, 60),
          aliases: [],
          properties: { content: input.content },
        },
      });
      enqueueMeiliSyncSafe({ kind: 'world_entity', op: 'upsert', id: entity.id });
      return prisma.mapPin.create({
        data: { mapId: input.mapId, entityId: entity.id, x: input.x, y: input.y },
        include: { entity: { select: { id: true, name: true, type: true } } },
      });
    }),

  updatePinPosition: campaignDMProcedure
    .input(z.object({ pinId: z.string().min(1), campaignId: z.string().min(1), x: z.number(), y: z.number() }))
    .mutation(async ({ input }) => {
      const pin = await prisma.mapPin.findFirst({
        where: { id: input.pinId, map: { campaignId: input.campaignId } },
      });
      if (!pin) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pin not found' });
      return prisma.mapPin.update({
        where: { id: input.pinId },
        data: { x: input.x, y: input.y, unplaced: false },
      });
    }),

  deletePin: campaignDMProcedure
    .input(z.object({ pinId: z.string().min(1), campaignId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const pin = await prisma.mapPin.findFirst({
        where: { id: input.pinId, map: { campaignId: input.campaignId } },
      });
      if (!pin) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pin not found' });
      await prisma.mapPin.delete({ where: { id: input.pinId } });
      return { success: true };
    }),

  uploadMapBackground: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1), campaignId: z.string().min(1), backgroundUrl: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { id: input.mapId, campaignId: input.campaignId },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      return prisma.campaignMap.update({
        where: { id: input.mapId },
        data: { backgroundType: 'UPLOADED', backgroundUrl: input.backgroundUrl },
      });
    }),

  setBlankBackground: campaignDMProcedure
    .input(z.object({ mapId: z.string().min(1), campaignId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { id: input.mapId, campaignId: input.campaignId },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      return prisma.campaignMap.update({
        where: { id: input.mapId },
        data: { backgroundType: 'BLANK', backgroundUrl: null },
      });
    }),

  createSubMap: campaignDMProcedure
    .input(z.object({
      parentLocationEntityId: z.string().min(1),
      campaignId: z.string().min(1),
      name: z.string().min(1).max(100),
      backgroundType: z.nativeEnum(MapBgType).default('BLANK'),
    }))
    .mutation(async ({ input }) => {
      const entity = await prisma.worldEntity.findFirst({
        where: { id: input.parentLocationEntityId, campaignId: input.campaignId },
        select: { campaignId: true },
      });
      if (!entity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
      const existing = await prisma.campaignMap.findFirst({
        where: { parentLocationId: input.parentLocationEntityId },
      });
      if (existing) return existing;
      return prisma.campaignMap.create({
        data: {
          campaignId: entity.campaignId,
          name: input.name,
          backgroundType: input.backgroundType,
          parentLocationId: input.parentLocationEntityId,
        },
      });
    }),

  addLocationNote: campaignDMProcedure
    .input(z.object({
      entityId: z.string().min(1),
      campaignId: z.string().min(1),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      return prisma.worldStateChange.create({
        data: {
          campaignId: input.campaignId,
          entityId: input.entityId,
          changeType: 'property_update',
          newValue: { content: input.content },
          source: WorldStateChangeSource.dm_edit,
        },
      });
    }),

  generateMapBackground: campaignDMProcedure
    .input(z.object({
      mapId: z.string().min(1),
      campaignId: z.string().min(1),
      customPrompt: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const map = await prisma.campaignMap.findFirst({
        where: { id: input.mapId, campaignId: input.campaignId },
        include: { campaign: { select: { name: true, description: true } } },
      });
      if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Map not found' });
      const settingContext = map.campaign.description ?? map.campaign.name;
      const prompt = input.customPrompt ??
        `Fantasy world map, ${settingContext}, top-down cartographic style, parchment, ink lines, no labels, no text`;
      await addMapGenerationJob({ mapId: input.mapId, campaignId: input.campaignId, prompt });
      return { queued: true };
    }),

  listMaps: campaignDMProcedure
    .query(async ({ input }) => {
      return prisma.campaignMap.findMany({
        where: { campaignId: input.campaignId },
        select: { id: true, name: true, parentLocationId: true, backgroundType: true, backgroundUrl: true },
        orderBy: { name: 'asc' },
      });
    }),

  listBackgroundSources: campaignDMProcedure
    .query(async ({ input }) => {
      const sourcebooks = await prisma.campaignSourcebook.findMany({
        where: { campaignId: input.campaignId },
        select: {
          sourcebook: {
            select: {
              id: true,
              title: true,
              slug: true,
              chapterImages: {
                orderBy: [{ chapterId: 'asc' }, { position: 'asc' }],
                select: {
                  id: true,
                  url: true,
                  alt: true,
                  sectionHeading: true,
                  kind: true,
                  chapter: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const rawCandidates: Array<MapBackgroundImageCandidate & {
        title: string;
        subtitle: string;
        sourcebookTitle: string;
        chapterTitle: string;
      }> = [];

      for (const link of sourcebooks) {
        for (const image of link.sourcebook.chapterImages) {
          rawCandidates.push({
            id: image.id,
            url: image.url,
            alt: image.alt,
            sectionHeading: image.sectionHeading,
            kind: image.kind,
            chapterTitle: image.chapter.title,
            sourcebookTitle: link.sourcebook.title,
            title: image.sectionHeading ?? image.alt ?? image.chapter.title,
            subtitle: image.alt ?? 'Extracted map from linked sourcebook',
          });
        }
      }

      return dedupeMapBackgroundCandidates(rawCandidates).map(({ title, subtitle, sourcebookTitle, chapterTitle, ...image }) => ({
        ...image,
        title,
        subtitle,
        sourcebookTitle,
        chapterTitle,
      }));
    }),
});
