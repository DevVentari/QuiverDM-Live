import { router, protectedProcedure, authz } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';

export const playersRouter = router({
  /**
   * Get all players for a campaign
   * Supports multi-user: any campaign member can view players
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.campaign(input.campaignId, userId).verify();

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
   * Supports multi-user: any campaign member can view
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.player(input.id, userId);

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
   * Requires DM access (OWNER or CO_DM) to add players
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
      await authz.campaign(input.campaignId, userId).requireDM();

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
   * Requires DM access
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

      // Get player to find campaign
      const player = await authz.player(input.id, userId);

      // Verify DM access to the campaign
      await authz.campaign(player.campaignId, userId).requireDM();

      const { id, ...data } = input;

      const updatedPlayer = await prisma.player.update({
        where: { id },
        data,
      });

      return updatedPlayer;
    }),

  /**
   * Delete a player/character
   * Requires DM access
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get player to find campaign
      const player = await authz.player(input.id, userId);

      // Verify DM access to the campaign
      await authz.campaign(player.campaignId, userId).requireDM();

      await prisma.player.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});

export type PlayersRouter = typeof playersRouter;
