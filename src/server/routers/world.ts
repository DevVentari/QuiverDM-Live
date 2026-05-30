import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { worldRepository } from '../repositories/world.repository';
import { WorldEntryType } from '@prisma/client';
import { authz } from '../services/authorization.service';
import { prisma } from '@/lib/prisma';

const ADDED_THRESHOLD_MS = 60_000; // entity is "Added" if updated within 1 min of creation

export type WorldActivityItem = {
  id: string;
  source: 'WorldEntity' | 'NPC' | 'WorldEntry';
  type: string;
  name: string;
  status: 'Added' | 'Updated';
  changedAt: Date;
  href: string;
  imageUrl?: string | null;
};

export const worldRouter = router({
  getEntries: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        type: z.nativeEnum(WorldEntryType).optional(),
        search: z.string().max(255).optional(),
        limit: z.number().min(1).max(500).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ input }) =>
      worldRepository.findEntries(input.campaignId, {
        type: input.type,
        search: input.search,
        limit: input.limit,
        cursor: input.cursor,
      })
    ),

  getCampaignChapters: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await authz.campaign(input.campaignId, ctx.session.user.id).verify();

      const links = await prisma.campaignSourcebook.findMany({
        where: { campaignId: input.campaignId },
        include: {
          sourcebook: {
            include: {
              chapters: {
                orderBy: { chapterIndex: 'asc' },
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  chapterIndex: true,
                  parentSlug: true,
                },
              },
            },
          },
        },
      });

      return links.flatMap((link) => link.sourcebook.chapters);
    }),

  getEntryBySlug: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        slug: z.string().min(1),
      })
    )
    .query(({ input }) =>
      worldRepository.findEntryBySlug(input.campaignId, input.slug)
    ),

  /**
   * Recent activity feed for the home page. Unions WorldEntity (Brain),
   * NPC, and WorldEntry by `updatedAt`, derives Added/Updated status from
   * the createdAt-updatedAt delta. Slice D1 of the V2 home rollout.
   */
  getRecentActivity: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ input, ctx }): Promise<WorldActivityItem[]> => {
      const access = await authz
        .campaign(input.campaignId, ctx.session.user.id)
        .verify();
      const slug = access.campaign.slug;
      const limit = input.limit;
      const fetchSize = Math.min(limit * 2, 20);

      const [entities, npcs, entries] = await Promise.all([
        prisma.worldEntity.findMany({
          where: { campaignId: input.campaignId },
          orderBy: { updatedAt: 'desc' },
          take: fetchSize,
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.nPC.findMany({
          where: { campaignId: input.campaignId },
          orderBy: { updatedAt: 'desc' },
          take: fetchSize,
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.worldEntry
          .findMany({
            where: { campaignId: input.campaignId },
            orderBy: { updatedAt: 'desc' },
            take: fetchSize,
            select: {
              id: true,
              name: true,
              type: true,
              slug: true,
              imageUrl: true,
              createdAt: true,
              updatedAt: true,
            },
          })
          .catch(() => [] as never[]),
      ]);

      const deriveStatus = (
        createdAt: Date,
        updatedAt: Date,
      ): 'Added' | 'Updated' =>
        updatedAt.getTime() - createdAt.getTime() < ADDED_THRESHOLD_MS
          ? 'Added'
          : 'Updated';

      const items: WorldActivityItem[] = [
        ...entities.map((e) => ({
          id: e.id,
          source: 'WorldEntity' as const,
          type: e.type as string,
          name: e.name,
          status: deriveStatus(e.createdAt, e.updatedAt),
          changedAt: e.updatedAt,
          href: `/campaigns/${slug}/brain/entities/${e.id}`,
        })),
        ...npcs.map((n) => ({
          id: n.id,
          source: 'NPC' as const,
          type: 'NPC',
          name: n.name,
          status: deriveStatus(n.createdAt, n.updatedAt),
          changedAt: n.updatedAt,
          href: `/campaigns/${slug}/npcs`,
        })),
        ...entries.map((e) => ({
          id: e.id,
          source: 'WorldEntry' as const,
          type: e.type as string,
          name: e.name,
          status: deriveStatus(e.createdAt, e.updatedAt),
          changedAt: e.updatedAt,
          href: `/campaigns/${slug}/world/${e.slug}`,
          imageUrl: (e as { imageUrl?: string | null }).imageUrl ?? null,
        })),
      ];

      return items
        .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
        .slice(0, limit);
    }),

  getCampaignAnchors: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await authz.campaign(input.campaignId, ctx.session.user.id).verify();

      const link = await prisma.campaignSourcebook.findFirst({
        where: { campaignId: input.campaignId },
        select: { sourcebookId: true },
      });
      if (!link) return { npcs: [], locations: [] };

      const [npcs, locations] = await Promise.all([
        prisma.sourcebookEntity.findMany({
          where: { sourcebookId: link.sourcebookId, type: 'NPC' },
          orderBy: { createdAt: 'asc' },
          take: 4,
          select: { id: true, name: true, description: true, imageUrl: true },
        }),
        prisma.sourcebookEntity.findMany({
          where: { sourcebookId: link.sourcebookId, type: 'LOCATION' },
          orderBy: { createdAt: 'asc' },
          take: 4,
          select: { id: true, name: true, description: true, imageUrl: true },
        }),
      ]);

      return { npcs, locations };
    }),

  getSourcebookEntities: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        types: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await authz.campaign(input.campaignId, ctx.session.user.id).verify();

      const links = await prisma.campaignSourcebook.findMany({
        where: { campaignId: input.campaignId },
        select: { sourcebookId: true },
      });
      if (links.length === 0) return [];

      const sourcebookIds = links.map((l) => l.sourcebookId);
      const allowedTypes = ['NPC', 'LOCATION', 'FACTION', 'ITEM'] as const;
      const typeFilter = input.types?.filter((t): t is typeof allowedTypes[number] =>
        (allowedTypes as readonly string[]).includes(t)
      ) ?? [...allowedTypes];

      return prisma.sourcebookEntity.findMany({
        where: {
          sourcebookId: { in: sourcebookIds },
          type: { in: typeFilter },
        },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          imageUrl: true,
          chapter: { select: { slug: true } },
        },
        orderBy: { name: 'asc' },
        take: 500,
      });
    }),

  regenerateActivityImage: protectedProcedure
    .input(z.object({ worldEntryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Visual asset regeneration is dev-only');
      }
      const entry = await prisma.worldEntry.findUnique({
        where: { id: input.worldEntryId },
        select: { id: true, campaignId: true, name: true, content: true },
      });
      if (!entry) throw new Error('World entry not found');
      await authz.campaign(entry.campaignId, ctx.session.user.id).requireRole('CO_DM');
      const { enqueueVisualAsset } = await import('@/lib/queue/visual-asset-queue');
      await enqueueVisualAsset({
        kind: 'world-activity-thumb',
        campaignId: entry.campaignId,
        userId: ctx.session.user.id,
        worldEntryId: entry.id,
        promptHint: entry.content?.slice(0, 200),
      });
      return { queued: true };
    }),
});
