import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyNPCOwnership, verifyCampaignOwnership } from '../lib/ownership';

export const npcsRouter = router({
  /**
   * Get all NPCs for a campaign with optional search
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      if (input.campaignId) {
        await verifyCampaignOwnership(input.campaignId, userId);
      }
      const { campaignId, search } = input;

      const where: any = {
        campaignId,
      };

      // Add search filter if provided
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { faction: { contains: search, mode: 'insensitive' } },
        ];
      }

      const npcs = await prisma.nPC.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
      });

      return npcs;
    }),

  /**
   * Get single NPC by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyNPCOwnership(input.id, userId);
      const npc = await prisma.nPC.findUnique({
        where: {
          id: input.id,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return npc;
    }),

  /**
   * Create new NPC
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().min(1, 'Name is required'),
        description: z.string().optional(),
        faction: z.string().optional(),
        secrets: z.string().optional(),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyCampaignOwnership(input.campaignId, userId);
      const npc = await prisma.nPC.create({
        data: input,
      });

      return npc;
    }),

  /**
   * Update NPC
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Name is required').optional(),
        description: z.string().optional(),
        faction: z.string().optional(),
        secrets: z.string().optional(),
        imageUrl: z.string().optional(),
        stats: z.any().optional(), // JSON field for D&D stats
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyNPCOwnership(input.id, userId);
      const { id, ...data } = input;

      const npc = await prisma.nPC.update({
        where: { id },
        data,
      });

      return npc;
    }),

  /**
   * Delete NPC
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyNPCOwnership(input.id, userId);
      await prisma.nPC.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),

  /**
   * Get NPCs by faction
   */
  getByFaction: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        faction: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyCampaignOwnership(input.campaignId, userId);
      const npcs = await prisma.nPC.findMany({
        where: {
          campaignId: input.campaignId,
          faction: input.faction,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return npcs;
    }),

  /**
   * Get faction list for a campaign
   */
  getFactions: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyCampaignOwnership(input.campaignId, userId);
      const npcs = await prisma.nPC.findMany({
        where: {
          campaignId: input.campaignId,
          faction: {
            not: null,
          },
        },
        select: {
          faction: true,
        },
        distinct: ['faction'],
      });

      return npcs
        .map((npc) => npc.faction)
        .filter((faction): faction is string => faction !== null)
        .sort();
    }),
});
