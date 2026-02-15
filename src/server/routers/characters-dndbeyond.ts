/**
 * Characters D&D Beyond Router
 *
 * tRPC endpoints for importing and syncing characters from D&D Beyond.
 * Targets the Character model (not the legacy Player model).
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { charactersDndbeyondService } from '../services/characters-dndbeyond.service';

export const charactersDndBeyondRouter = router({
  /**
   * Import a character from D&D Beyond by URL or character ID.
   * Creates a new Character or updates an existing one.
   * Also extracts any homebrew content found on the character.
   */
  importCharacter: protectedProcedure
    .input(
      z
        .object({
          url: z.string().url().optional(),
          characterId: z.string().optional(),
          cobaltToken: z.string().optional(),
          campaignId: z.string().optional(),
        })
        .refine((data) => data.url || data.characterId, {
          message: 'Either url or characterId must be provided',
        })
    )
    .mutation(({ input, ctx }) =>
      charactersDndbeyondService.importCharacter(ctx.session.user.id, input)
    ),

  /**
   * Re-sync an existing D&D Beyond-linked character with fresh data.
   */
  syncCharacter: protectedProcedure
    .input(z.object({ characterId: z.string() }))
    .mutation(({ input, ctx }) =>
      charactersDndbeyondService.syncCharacter(ctx.session.user.id, input.characterId)
    ),

  /**
   * Check if a D&D Beyond character has already been imported.
   */
  checkDuplicate: protectedProcedure
    .input(
      z
        .object({
          url: z.string().url().optional(),
          characterId: z.string().optional(),
        })
        .refine((data) => data.url || data.characterId, {
          message: 'Either url or characterId must be provided',
        })
    )
    .query(({ input, ctx }) =>
      charactersDndbeyondService.checkDuplicate(ctx.session.user.id, input)
    ),

  /**
   * List all characters linked to D&D Beyond for the current user.
   */
  getLinkedCharacters: protectedProcedure.query(({ ctx }) =>
    charactersDndbeyondService.getLinkedCharacters(ctx.session.user.id)
  ),
});

export type CharactersDndBeyondRouter = typeof charactersDndBeyondRouter;
