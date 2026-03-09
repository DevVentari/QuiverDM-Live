import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';

export const brainRouter = router({
  state: router({
    get: protectedProcedure
      .input(z.object({ campaignId: z.string().min(1) }))
      .query(async () => {
        return null as {
          hooks: Array<{ id: string; text: string; urgency: string; status?: string }>;
          threats: Array<{ name: string; urgency: number }>;
        } | null;
      }),
  }),

  entities: router({
    list: protectedProcedure
      .input(
        z.object({
          campaignId: z.string().min(1),
          search: z.string().optional(),
        })
      )
      .query(async () => {
        return [] as Array<{
          id: string;
          name: string;
          type: string;
          description?: string;
          properties?: Record<string, unknown>;
        }>;
      }),
  }),
});
