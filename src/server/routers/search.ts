import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { searchService } from '../services/search.service';
import { usageService } from '../services/usage.service';

export const searchRouter = router({
  semantic: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(500),
        campaignId: z.string(),
        entityTypes: z
          .array(z.enum(['transcript', 'npc', 'quest', 'rules']))
          .optional()
          .default([]),
        limit: z.number().int().min(1).max(20).optional().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const canSearch = await usageService.canSearch(userId);
      if (!canSearch) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Semantic search limit reached for your tier. Upgrade to Pro for more searches.',
        });
      }

      const results = await searchService.semantic(
        input.query,
        input.campaignId,
        userId,
        input.entityTypes,
        input.limit
      );

      // Fire-and-forget increment (search already ran; don't block on accounting)
      void usageService.incrementSemanticSearches(userId).catch(() => {});

      return results;
    }),
});
