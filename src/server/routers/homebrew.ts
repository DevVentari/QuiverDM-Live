import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';
import { verifyHomebrewOwnership, verifyCampaignOwnership } from '../lib/ownership';

// Homebrew content types
export const HomebrewType = z.enum([
  'item',
  'creature',
  'spell',
  'location',
  'subclass',
  'feat',
  'rule',
  'race',
  'class',
  'background',
  'character',
]);

// Source type for tracking how content was created
export const SourceType = z.enum([
  'manual',
  'dndbeyond_import',
]);

export const homebrewRouter = router({
  // ========== Content Management ==========

  /**
   * Create homebrew content manually
   */
  createContent: protectedProcedure
    .input(
      z.object({
        type: HomebrewType,
        name: z.string(),
        data: z.any(),
        images: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        addToCampaignId: z.string().optional(), // Optionally add to campaign immediately
        sourceType: SourceType.default('manual'),
        dndBeyondId: z.string().optional(),
        dndBeyondUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Generate search text from name + data
      const searchText = `${input.name} ${JSON.stringify(input.data)}`;

      const content = await prisma.homebrewContent.create({
        data: {
          userId,
          type: input.type,
          name: input.name,
          data: input.data,
          images: input.images,
          tags: input.tags,
          searchText,
          sourceType: input.sourceType,
          dndBeyondId: input.dndBeyondId,
          dndBeyondUrl: input.dndBeyondUrl,
        },
      });

      // If adding to campaign, create link
      if (input.addToCampaignId) {
        await prisma.campaignHomebrewContent.create({
          data: {
            campaignId: input.addToCampaignId,
            homebrewId: content.id,
          },
        });
      }

      return content;
    }),

  /**
   * Get all homebrew content for the current user
   */
  getContent: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        type: HomebrewType.optional(),
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const where: any = { userId };

      if (input.type) {
        where.type = input.type;
      }

      if (input.search) {
        where.searchText = {
          contains: input.search,
          mode: 'insensitive',
        };
      }

      if (input.tags && input.tags.length > 0) {
        where.tags = {
          hasSome: input.tags,
        };
      }

      // If campaign filter, join with campaign content
      if (input.campaignId) {
        where.campaigns = {
          some: {
            campaignId: input.campaignId,
          },
        };
      }

      const content = await prisma.homebrewContent.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          campaigns: {
            select: {
              campaignId: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (content.length > input.limit) {
        const nextItem = content.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: content,
        nextCursor,
      };
    }),

  /**
   * Get a single homebrew content item by ID
   */
  getContentById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input }) => {
      const content = await prisma.homebrewContent.findUnique({
        where: { id: input.id },
        include: {
          campaigns: {
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!content) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Homebrew content not found',
        });
      }

      return content;
    }),

  /**
   * Update homebrew content
   */
  updateContent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        data: z.any().optional(),
        images: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      await verifyHomebrewOwnership(input.id, userId);

      const updateData: any = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.data !== undefined) updateData.data = input.data;
      if (input.images !== undefined) updateData.images = input.images;
      if (input.tags !== undefined) updateData.tags = input.tags;

      // Update search text if name or data changed
      if (input.name !== undefined || input.data !== undefined) {
        const existing = await prisma.homebrewContent.findUnique({
          where: { id: input.id },
        });
        const name = input.name ?? existing!.name;
        const data = input.data ?? existing!.data;
        updateData.searchText = `${name} ${JSON.stringify(data)}`;
      }

      const content = await prisma.homebrewContent.update({
        where: { id: input.id },
        data: updateData,
      });

      return content;
    }),

  /**
   * Delete homebrew content
   */
  deleteContent: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.homebrewContent.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Get homebrew content filtered by type
   */
  getContentByType: protectedProcedure
    .input(
      z.object({
        type: HomebrewType,
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const where: any = {
        userId,
        type: input.type,
      };

      if (input.campaignId) {
        where.campaigns = {
          some: {
            campaignId: input.campaignId,
          },
        };
      }

      const content = await prisma.homebrewContent.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        include: {
          campaigns: {
            select: {
              campaignId: true,
            },
          },
        },
      });

      return content;
    }),

  /**
   * Get homebrew statistics for the user
   */
  getContentStats: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const where: any = { userId };

      if (input.campaignId) {
        where.campaigns = {
          some: {
            campaignId: input.campaignId,
          },
        };
      }

      const stats = await prisma.homebrewContent.groupBy({
        by: ['type'],
        where,
        _count: {
          id: true,
        },
      });

      const total = await prisma.homebrewContent.count({ where });

      return {
        total,
        byType: stats.reduce(
          (acc, stat) => {
            acc[stat.type] = stat._count.id;
            return acc;
          },
          {} as Record<string, number>
        ),
      };
    }),

  /**
   * Add homebrew content to a campaign
   */
  addToCampaign: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string(),
        campaignId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify campaign ownership
      await verifyCampaignOwnership(input.campaignId, userId);

      // Verify homebrew ownership
      await verifyHomebrewOwnership(input.homebrewId, userId);

      // Create link (upsert to handle duplicates)
      const link = await prisma.campaignHomebrewContent.upsert({
        where: {
          campaignId_homebrewId: {
            campaignId: input.campaignId,
            homebrewId: input.homebrewId,
          },
        },
        create: {
          campaignId: input.campaignId,
          homebrewId: input.homebrewId,
        },
        update: {},
      });

      return link;
    }),

  /**
   * Remove homebrew content from a campaign
   */
  removeFromCampaign: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string(),
        campaignId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify campaign ownership
      await verifyCampaignOwnership(input.campaignId, userId);

      // Delete link
      await prisma.campaignHomebrewContent.delete({
        where: {
          campaignId_homebrewId: {
            campaignId: input.campaignId,
            homebrewId: input.homebrewId,
          },
        },
      });

      return { success: true };
    }),
});
