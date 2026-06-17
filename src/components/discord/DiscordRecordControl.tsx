'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

/**
 * DM control to start/stop the Discord voice bot recording for this session.
 * Recording state is optimistic (the bot lives in another process and doesn't
 * report back yet); the toggle reflects intent. Captured tracks are transcribed
 * and merged into the session transcript with character-name speakers.
 */
export function DiscordRecordControl({
  campaignId,
  sessionId,
}: {
  campaignId: string;
  sessionId: string;
}) {
  const [recording, setRecording] = useState(false);
  const start = trpc.discordVoice.startRecording.useMutation({ onSuccess: () => setRecording(true) });
  const stop = trpc.discordVoice.stopRecording.useMutation({ onSuccess: () => setRecording(false) });

  const pending = start.isPending || stop.isPending;
  const error = start.error?.message ?? stop.error?.message;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        data-testid="discord-record"
        disabled={pending}
        onClick={() =>
          recording
            ? stop.mutate({ campaignId, sessionId })
            : start.mutate({ campaignId, sessionId })
        }
        className="flex items-center justify-center gap-2 rounded-[11px] p-3 font-qd-display text-[14px] font-bold disabled:opacity-50"
        style={
          recording
            ? { border: '1px solid var(--qd-danger-bright)', color: 'var(--qd-danger-bright)', background: 'rgba(196,69,58,.08)' }
            : { border: '1px solid var(--qd-strong)', color: 'var(--qd-ink-2)', background: 'rgba(255,255,255,0.04)' }
        }
      >
        {recording ? '■ Stop Discord recording' : '🎙 Record in Discord'}
      </button>
      {error && (
        <div className="font-qd-mono text-[9px]" style={{ color: 'var(--qd-danger-bright)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
