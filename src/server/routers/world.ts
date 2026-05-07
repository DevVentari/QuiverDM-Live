import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { worldRepository } from '../repositories/world.repository';
import { WorldEntryType } from '@prisma/client';

export const worldRouter = router({
  getEntries: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        type: z.nativeEnum(WorldEntryType).optional(),
        search: z.string().max(255).optional(),
        limit: z.number().min(1).max(500).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ input }) =>
      worldRepository.findEntries(input.campaignId, {
        type: input.type,
        search: input.search,
        limit: input.limit,
        cursor: input.cursor,
      })
    ),

  getEntryBySlug: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        slug: z.string().min(1),
      })
    )
    .query(({ input }) =>
      worldRepository.findEntryBySlug(input.campaignId, input.slug)
    ),
});
