/**
 * Characters D&D Beyond Router
 *
 * tRPC endpoints for importing and syncing characters from D&D Beyond.
 * Targets the Character model (not the legacy Player model).
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { charactersDndbeyondService } from '../services/characters-dndbeyond.service';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { fetchDDBCampaignCharacters } from '@/lib/dndbeyond-api';

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

  /**
   * Import all characters from a D&D Beyond campaign URL.
   * Fetches the campaign roster and imports each character into the given campaign.
   */
  importFromCampaign: protectedProcedure
    .input(
      z.object({
        campaignUrl: z.string().url(),
        campaignId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      if (!settings?.dndBeyondCobaltCookie) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No DnD Beyond Cobalt token found. Add it in Settings → API Keys.',
        });
      }

      const cobaltToken = decrypt(settings.dndBeyondCobaltCookie);
      const result = await fetchDDBCampaignCharacters(input.campaignUrl, cobaltToken);

      if (!result.success || !result.characters) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.message ?? 'Failed to fetch campaign characters from DnD Beyond.',
        });
      }

      const imported: string[] = [];
      const failed: string[] = [];

      for (const ref of result.characters) {
        try {
          await charactersDndbeyondService.importCharacter(userId, {
            characterId: ref.characterId,
            campaignId: input.campaignId,
          });
          imported.push(ref.characterId);
        } catch {
          failed.push(ref.characterId);
        }
      }

      return { imported: imported.length, failed: failed.length };
    }),
});

export type CharactersDndBeyondRouter = typeof charactersDndBeyondRouter;
