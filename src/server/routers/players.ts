import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';
import { verifyPlayerOwnership, verifyCampaignOwnership } from '../lib/ownership';

export const playersRouter = router({
  /**
   * Get all players for a campaign
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      if (input.campaignId) {
        await verifyCampaignOwnership(input.campaignId, userId);
      }
      const players = await prisma.player.findMany({
        where: {
          campaignId: input.campaignId,
        },
        orderBy: {
          characterName: 'asc',
        },
      });

      return players;
    }),

  /**
   * Get single player by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyPlayerOwnership(input.id, userId);
      const player = await prisma.player.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!player) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Player not found',
        });
      }

      return player;
    }),

  /**
   * Create a new player/character
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        characterName: z.string(),
        name: z.string(),
        characterRace: z.string().optional(),
        characterClass: z.string().optional(),
        level: z.number().default(1),
        imageUrl: z.string().optional(),
        backstory: z.string().optional(),
        dndBeyondUrl: z.string().optional(),
        characterData: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyCampaignOwnership(input.campaignId, userId);
      const player = await prisma.player.create({
        data: {
          ...input,
          lastSyncedAt: input.dndBeyondUrl ? new Date() : null,
        },
      });

      return player;
    }),

  /**
   * Update a player/character
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        characterName: z.string().optional(),
        name: z.string().optional(),
        characterRace: z.string().optional(),
        characterClass: z.string().optional(),
        level: z.number().optional(),
        imageUrl: z.string().optional(),
        backstory: z.string().optional(),
        characterData: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyPlayerOwnership(input.id, userId);
      const { id, ...data } = input;

      const player = await prisma.player.update({
        where: { id },
        data,
      });

      return player;
    }),

  /**
   * Delete a player/character
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyPlayerOwnership(input.id, userId);
      await prisma.player.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});

export type PlayersRouter = typeof playersRouter;
