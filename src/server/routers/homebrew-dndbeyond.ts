import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { HomebrewType } from './homebrew';
import { homebrewDndbeyondService } from '../services/homebrew-dndbeyond.service';

/**
 * D&D Beyond Homebrew Integration Router
 *
 * Handles import/export of homebrew content to/from D&D Beyond
 * Note: D&D Beyond API is READ-ONLY - no official write endpoints exist
 */
export const homebrewDndBeyondRouter = router({
  /**
   * Test if D&D Beyond API is accessible with the given Cobalt token
   */
  testConnection: protectedProcedure
    .input(z.object({ cobaltToken: z.string() }))
    .query(({ input }) => homebrewDndbeyondService.testConnection(input.cobaltToken)),

  /**
   * Import homebrew content from D&D Beyond
   */
  importHomebrewFromDDB: protectedProcedure
    .input(
      z.object({
        cobaltToken: z.string(),
        contentType: HomebrewType,
        dndBeyondId: z.string(),
        addToCampaignId: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewDndbeyondService.importFromDDB(ctx.session.user.id, input)
    ),

  /**
   * Export homebrew content to D&D Beyond compatible format
   */
  exportToDnDBeyondFormat: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string(),
        format: z.enum(['json', 'markdown', 'plain']).default('markdown'),
      })
    )
    .query(({ input, ctx }) =>
      homebrewDndbeyondService.exportToDnDBeyondFormat(
        input.homebrewId,
        ctx.session.user.id,
        input.format
      )
    ),

  /**
   * Bulk export multiple homebrew items
   */
  exportMultipleToDnDBeyond: protectedProcedure
    .input(
      z.object({
        homebrewIds: z.array(z.string()),
        format: z.enum(['json', 'markdown', 'plain']).default('markdown'),
      })
    )
    .query(({ input, ctx }) =>
      homebrewDndbeyondService.exportMultiple(
        input.homebrewIds,
        ctx.session.user.id,
        input.format
      )
    ),

  /**
   * Check if homebrew content already exists by D&D Beyond ID
   */
  checkDuplicateByDnDBeyondId: protectedProcedure
    .input(z.object({ dndBeyondId: z.string() }))
    .query(({ input, ctx }) =>
      homebrewDndbeyondService.checkDuplicate(ctx.session.user.id, input.dndBeyondId)
    ),
});

export type HomebrewDndBeyondRouter = typeof homebrewDndBeyondRouter;
