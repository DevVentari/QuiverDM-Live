import { z } from 'zod';
import { router, campaignDMProcedure } from '../trpc';
import { getClipsForEntity, regenerateSignature, reassignVoice } from '../services/voice.service';
import { getTtsProvider } from '@/lib/voice/tts';

export const voiceRouter = router({
  listVoices: campaignDMProcedure
    .query(() => getTtsProvider().listVoices()),

  getClipsForEntity: campaignDMProcedure
    .input(z.object({ entityId: z.string().min(1) }))
    .query(({ input }) => getClipsForEntity(input.entityId)),

  regenerateSignature: campaignDMProcedure
    .input(z.object({ entityId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await regenerateSignature(input.entityId);
      return { ok: true };
    }),

  reassignVoice: campaignDMProcedure
    .input(z.object({ entityId: z.string().min(1), voiceId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await reassignVoice(input.entityId, input.voiceId);
      return { ok: true };
    }),
});
