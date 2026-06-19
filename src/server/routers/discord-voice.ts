import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { router, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/queue/queue';
import { NotFoundError, ValidationError } from '../errors';
import { VOICE_CONTROL_CHANNEL, type VoiceControlMessage } from '@/lib/discord/voice-bot';

/**
 * Control surface for the Discord voice bot. The bot runs as its own process and
 * listens on a Redis channel; these mutations publish to it. The web process
 * never holds a Discord gateway connection.
 */
async function publishControl(msg: VoiceControlMessage): Promise<void> {
  if (!redis) throw new ValidationError('Live voice service is unavailable right now.');
  await redis.publish(VOICE_CONTROL_CHANNEL, JSON.stringify(msg));
}

function readSettings(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {};
}

export const discordVoiceRouter = router({
  getConfig: campaignDMProcedure.query(async ({ input }) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { discordGuildId: true, settings: true },
    });
    const settings = readSettings(campaign?.settings);
    return {
      discordGuildId: campaign?.discordGuildId ?? null,
      discordVoiceChannelId: (settings.discordVoiceChannelId as string | undefined) ?? null,
    };
  }),

  setConfig: campaignDMProcedure
    .input(
      z.object({
        discordGuildId: z.string().nullish(),
        discordVoiceChannelId: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      if (!campaign) throw new NotFoundError('campaign', input.campaignId);

      const settings = readSettings(campaign.settings);
      if (input.discordVoiceChannelId !== undefined) {
        settings.discordVoiceChannelId = input.discordVoiceChannelId ?? null;
      }

      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          settings: settings as Prisma.InputJsonValue,
          ...(input.discordGuildId !== undefined ? { discordGuildId: input.discordGuildId } : {}),
        },
      });
      return { ok: true };
    }),

  startRecording: campaignDMProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { discordGuildId: true, settings: true },
      });
      const settings = readSettings(campaign?.settings);
      const voiceChannelId = settings.discordVoiceChannelId as string | undefined;
      if (!campaign?.discordGuildId || !voiceChannelId) {
        throw new ValidationError('Set the Discord server and voice channel for this campaign first.');
      }
      await publishControl({
        action: 'start',
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        guildId: campaign.discordGuildId,
        voiceChannelId,
      });
      return { ok: true };
    }),

  stopRecording: campaignDMProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      await publishControl({ action: 'stop', campaignId: input.campaignId, sessionId: input.sessionId });
      return { ok: true };
    }),
});
