'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

/**
 * DM-only config for the Discord voice bot: which server (guild) and voice channel
 * the bot joins to record a session. Stored via discordVoice.setConfig
 * (guild id on Campaign, voice channel id in Campaign.settings).
 */
export function DiscordVoiceSettings({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const { data } = trpc.discordVoice.getConfig.useQuery({ campaignId });
  const save = trpc.discordVoice.setConfig.useMutation({
    onSuccess: () => utils.discordVoice.getConfig.invalidate({ campaignId }),
  });

  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');

  useEffect(() => {
    if (data) {
      setGuildId(data.discordGuildId ?? '');
      setChannelId(data.discordVoiceChannelId ?? '');
    }
  }, [data]);

  const dirty = data ? guildId !== (data.discordGuildId ?? '') || channelId !== (data.discordVoiceChannelId ?? '') : false;

  return (
    <div
      className="flex flex-col gap-2.5 rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)] px-3.5 py-3"
      data-testid="discord-voice-settings"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">🎧</span>
        <div className="text-qd-body-sm text-qd-ink-2">Discord voice recording</div>
      </div>
      <div className="font-qd-mono text-[8.5px] text-qd-ink-muted">
        the bot joins this channel to record each speaker as their character
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          placeholder="Server (guild) ID"
          className="flex-1 rounded-qd-md border border-qd-faint bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 font-qd-mono text-[11px] text-qd-ink-2 placeholder:text-qd-ink-muted"
        />
        <input
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="Voice channel ID"
          className="flex-1 rounded-qd-md border border-qd-faint bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 font-qd-mono text-[11px] text-qd-ink-2 placeholder:text-qd-ink-muted"
        />
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ campaignId, discordGuildId: guildId || null, discordVoiceChannelId: channelId || null })}
          className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-3 py-1.5 font-qd-display text-[12px] text-qd-ink-2 disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {save.isSuccess && !dirty && (
        <div className="font-qd-mono text-[8.5px]" style={{ color: 'var(--qd-success)' }}>
          saved
        </div>
      )}
    </div>
  );
}
