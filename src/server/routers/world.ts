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
        })),
      ];

      return items
        .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
        .slice(0, limit);
    }),
});
