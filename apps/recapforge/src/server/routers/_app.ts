import { router, publicProcedure } from '../trpc';
import { forgeKeysRouter } from './forge-keys';
import { forgeCampaignRouter } from './forge-campaign';
import { forgeSessionsRouter } from './forge-sessions';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, app: 'recapforge' })),
  forgeKeys: forgeKeysRouter,
  forgeCampaign: forgeCampaignRouter,
  forgeSessions: forgeSessionsRouter,
});

export type AppRouter = typeof appRouter;
