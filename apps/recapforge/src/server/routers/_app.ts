import { router, publicProcedure } from '../trpc';
import { forgeKeysRouter } from './forge-keys';
import { forgeCampaignRouter } from './forge-campaign';
import { forgeSessionsRouter } from './forge-sessions';
import { forgeTranscriptRouter } from './forge-transcript';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, app: 'recapforge' })),
  forgeKeys: forgeKeysRouter,
  forgeCampaign: forgeCampaignRouter,
  forgeSessions: forgeSessionsRouter,
  forgeTranscript: forgeTranscriptRouter,
});

export type AppRouter = typeof appRouter;
