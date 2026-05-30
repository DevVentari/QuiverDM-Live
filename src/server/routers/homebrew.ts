import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { homebrewService } from '../services/homebrew.service';
import { ForbiddenError, NotFoundError } from '../errors';
import { prisma } from '../db';
import { serverTrack } from '@/lib/analytics.server';
import { EVENTS } from '@/lib/analytics-events';
import { WorldEntityType } from '@prisma/client';
import { brainRepository } from '../repositories/brain.repository';

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
        name: z.string().min(1).max(255),
        data: z.any().default({}),
        images: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        addToCampaignId: z.string().optional(), // Optionally add to campaign immediately
        sourceType: SourceType.default('manual'),
        dndBeyondId: z.string().min(1).optional(),
        dndBeyondUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const content = await homebrewService.createContent(ctx.session.user.id, { ...input, data: input.data ?? {} });
      void serverTrack(ctx.session.user.id, EVENTS.HOMEBREW_CREATED, { source: input.sourceType ?? 'manual' });

      const BRAIN_SEEDABLE_TYPES: Record<string, WorldEntityType> = {
        creature: WorldEntityType.NPC,
        location: WorldEntityType.LOCATION,
        item: WorldEntityType.ITEM,
      };

      if (input.addToCampaignId && input.type in BRAIN_SEEDABLE_TYPES) {
        brainRepository.upsertEntity(input.addToCampaignId, {
          type: BRAIN_SEEDABLE_TYPES[input.type]!,
          name: input.name,
          description: typeof input.data?.description === 'string' ? input.data.description : undefined,
          sourceType: 'Homebrew',
          sourceId: content.id,
        }).catch((err) => console.warn('[brain] Homebrew auto-seed failed:', err));
      }

      return content;
    }),

  /**
   * Get all homebrew content for the current user
   */
  getContent: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1).optional(),
        type: HomebrewType.optional(),
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return homebrewService.getContent(ctx.session.user.id, input);
    }),

  /**
   * Get a single homebrew content item by ID.
   * Requires authentication; returns the item if the caller owns it or
   * if it has been shared with players in any campaign they belong to.
   */
  getContentById: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      })
    )
    .query(({ input, ctx }) => homebrewService.getContentById(input.id, ctx.session.user.id)),

  /**
   * Update homebrew content
   */
  updateContent: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        data: z.any().optional(),
        images: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewService.updateContent(ctx.session.user.id, input)
    ),

  /**
   * Toggle whether a homebrew item is shared with players
   */
  updateSharing: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string().min(1),
        sharedWithPlayers: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
        select: { userId: true },
      });

      if (!homebrew) {
        throw new NotFoundError('homebrew', input.homebrewId);
      }

      if (homebrew.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('share', 'homebrew content');
      }

      return prisma.homebrewContent.update({
        where: { id: input.homebrewId },
        data: { sharedWithPlayers: input.sharedWithPlayers },
      });
    }),

  /**
   * Remove a single image URL from homebrew content
   */
  removeImage: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        imageUrl: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const content = await homebrewService.getContentById(input.id, ctx.session.user.id);
      if (content.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'homebrew content');
      }
      const filtered = (content.images ?? []).filter((img) => img !== input.imageUrl);
      return homebrewService.updateContent(ctx.session.user.id, {
        id: input.id,
        images: filtered,
      });
    }),

  /**
   * Delete homebrew content
   */
  deleteContent: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewService.deleteContent(ctx.session.user.id, input.id)
    ),

  /**
   * Get homebrew content filtered by type
   */
  getContentByType: protectedProcedure
    .input(
      z.object({
        type: HomebrewType,
        campaignId: z.string().min(1).optional(),
      })
    )
    .query(({ input, ctx }) =>
      homebrewService.getContentByType(ctx.session.user.id, input)
    ),

  /**
   * Get homebrew statistics for the user
   */
  getContentStats: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1).optional(),
      })
    )
    .query(({ input, ctx }) =>
      homebrewService.getContentStats(ctx.session.user.id, input.campaignId)
    ),

  /**
   * Add homebrew content to a campaign
   */
  addToCampaign: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string().min(1),
        campaignId: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewService.addToCampaign(ctx.session.user.id, input)
    ),

  /**
   * Remove homebrew content from a campaign
   */
  removeFromCampaign: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string().min(1),
        campaignId: z.string().min(1),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewService.removeFromCampaign(ctx.session.user.id, input)
    ),
});


