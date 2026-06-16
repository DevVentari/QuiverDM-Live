'use client';

import { useLiveTranscript } from '@/hooks/useLiveTranscript';

const mono = 'font-[family-name:var(--qd-font-mono)]';

/**
 * v3 live-session surface — rolling captions + DM hints, streamed over the
 * WebSocket from the live transcription pipeline. Only mounts while the session
 * is live (`in_progress`); shows a waiting state until turns arrive.
 */
export function LiveTranscriptPanel({
  campaignId,
  sessionId,
  isLive,
}: {
  campaignId: string;
  sessionId: string;
  isLive: boolean;
}) {
  const { connected, turns, hints } = useLiveTranscript(campaignId, sessionId, isLive);

  return (
    <div
      className="rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] p-[13px]"
      data-testid="live-transcript"
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 flex-none rounded-full"
          style={{ background: connected ? 'var(--qd-success)' : 'var(--qd-ink-faint)' }}
        />
        <span className={`${mono} text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>
          LIVE TRANSCRIPT{connected ? '' : ' · connecting…'}
        </span>
      </div>

      {/* DM hints — surfaced from the live pipeline (every ~30s of dialogue). */}
      {hints.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5" data-testid="live-hints">
          {hints.map((h, i) => (
            <div
              key={i}
              className={`${mono} rounded-[8px] border px-2.5 py-1.5 text-[9px] leading-snug`}
              style={{
                borderColor: h.priority === 'important' ? 'var(--qd-danger-bright)' : 'var(--qd-border-accent)',
                color: h.priority === 'important' ? 'var(--qd-danger-bright)' : 'var(--qd-accent-text)',
                background: 'rgba(255,255,255,.02)',
              }}
            >
              {h.effectName ? `${h.effectName}: ` : ''}{h.text}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex max-h-[220px] flex-col gap-1.5 overflow-auto">
        {turns.length === 0 ? (
          <p className={`${mono} text-[10px] text-[var(--qd-ink-faint)]`}>
            {connected ? 'Listening… speak and the words will appear.' : 'Waiting for the live feed.'}
          </p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className="text-[11px] leading-relaxed text-[var(--qd-ink-2)]" style={{ opacity: t.isFinal ? 1 : 0.6 }}>
              {t.speaker && (
                <span className={`${mono} mr-1.5 text-[9px] text-[var(--qd-accent-text)]`}>{t.speaker}</span>
              )}
              {t.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
