import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { homebrewService } from '../services/homebrew.service';

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
        data: z.any().default({}),
        images: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        addToCampaignId: z.string().optional(), // Optionally add to campaign immediately
        sourceType: SourceType.default('manual'),
        dndBeyondId: z.string().optional(),
        dndBeyondUrl: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewService.createContent(ctx.session.user.id, { ...input, data: input.data ?? {} })
    ),

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
    .query(({ input, ctx }) =>
      homebrewService.getContent(ctx.session.user.id, input)
    ),

  /**
   * Get a single homebrew content item by ID
   */
  getContentById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(({ input }) => homebrewService.getContentById(input.id)),

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
    .mutation(({ input, ctx }) =>
      homebrewService.updateContent(ctx.session.user.id, input)
    ),

  /**
   * Remove a single image URL from homebrew content
   */
  removeImage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        imageUrl: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const content = await homebrewService.getContentById(input.id);
      if (content.userId !== ctx.session.user.id) {
        throw new Error('Forbidden');
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
        id: z.string(),
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
        campaignId: z.string().optional(),
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
        campaignId: z.string().optional(),
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
        homebrewId: z.string(),
        campaignId: z.string(),
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
        homebrewId: z.string(),
        campaignId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewService.removeFromCampaign(ctx.session.user.id, input)
    ),
});
