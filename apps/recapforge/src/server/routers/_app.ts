import { router, publicProcedure } from '../trpc';
import { forgeKeysRouter } from './forge-keys';
import { forgeCampaignRouter } from './forge-campaign';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, app: 'recapforge' })),
  forgeKeys: forgeKeysRouter,
  forgeCampaign: forgeCampaignRouter,
});

export type AppRouter = typeof appRouter;
