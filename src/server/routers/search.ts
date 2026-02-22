import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { searchService } from '../services/search.service';

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
    .query(({ input, ctx }) =>
      searchService.semantic(
        input.query,
        input.campaignId,
        ctx.session.user.id,
        input.entityTypes,
        input.limit
      )
    ),
});
