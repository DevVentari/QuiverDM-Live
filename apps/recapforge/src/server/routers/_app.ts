import { router, publicProcedure } from '../trpc';
import { forgeKeysRouter } from './forge-keys';
import { forgeCampaignRouter } from './forge-campaign';
import { forgeSessionsRouter } from './forge-sessions';
import { forgeTranscriptRouter } from './forge-transcript';
import { forgeRecapRouter } from './forge-recap';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, app: 'recapforge' })),
  forgeKeys: forgeKeysRouter,
  forgeCampaign: forgeCampaignRouter,
  forgeSessions: forgeSessionsRouter,
  forgeTranscript: forgeTranscriptRouter,
  forgeRecap: forgeRecapRouter,
});

export type AppRouter = typeof appRouter;
