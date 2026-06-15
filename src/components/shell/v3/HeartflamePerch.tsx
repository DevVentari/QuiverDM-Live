'use client';

import { useState } from 'react';

export interface HeartflamePerchProps {
  /** A short line the Heartflame surfaces "In the Margins". One or two sentences. */
  message?: string;
  /** True while the flame is working (extraction/transcription) — it burns brighter. */
  active?: boolean;
}

/**
 * The Heartflame — QuiverDM's companion, a living hearth-flame banked at the
 * bottom-right edge of the screen. It is not a panel or a chat window; it has a
 * hearth. Idle, it is a low breathing glow. When it has something to say, a
 * single line surfaces in its light under the label "In the Margins"; the line
 * dismisses on click.
 *
 * Foundation scaffold: presentation only, styled on the `--qd-*` tokens. Track B
 * wires the predicate engine + line pool to feed `message` / `active`.
 */
export function HeartflamePerch({ message, active = false }: HeartflamePerchProps) {
  const [dismissed, setDismissed] = useState(false);
  const showMessage = Boolean(message) && !dismissed;

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex items-end gap-3"
      aria-live="polite"
    >
      {showMessage && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="pointer-events-auto max-w-[18rem] rounded-[14px] border border-[var(--qd-border)] bg-[var(--qd-card)] px-4 py-3 text-left shadow-[var(--qd-shadow-card)] backdrop-blur-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--qd-grad-card), var(--qd-card)' }}
          title="Dismiss"
        >
          <span className="block font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--qd-accent-text)]">
            In the Margins
          </span>
          <span className="mt-1 block font-[family-name:var(--qd-font-display)] text-[18px] italic leading-snug text-[var(--qd-ink)]">
            {message}
          </span>
        </button>
      )}

      {/* The ember itself */}
      <span
        className={`hf-ember${active ? ' hf-ember--active' : ''} block h-7 w-7 flex-none rounded-full`}
        role="img"
        aria-label={active ? 'The Heartflame is working' : 'The Heartflame, watching'}
      />
    </div>
  );
}
