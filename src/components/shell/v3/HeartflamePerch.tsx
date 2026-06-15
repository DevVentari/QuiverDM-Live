'use client';

import { useHeartflame } from './heartflame-context';
import type { NudgeCategory } from '@/lib/heartflame';

/** Accent token per nudge category (matches the design-system semantic colours). */
const CATEGORY_TINT: Record<NudgeCategory, string> = {
  risk: 'var(--qd-danger-bright)',
  opportunity: 'var(--qd-accent-text)',
  'option-unused': 'var(--qd-warn)',
};

/**
 * The Heartflame — QuiverDM's companion, a living hearth-flame banked at the
 * bottom-right edge of the screen. It reads the current nudge from context: idle
 * it is a low breathing ember; when a nudge is present a single line surfaces in
 * its light under the label "In the Margins", tinted to the nudge's category.
 * Click dismisses. The flame burns brighter while `active`.
 */
export function HeartflamePerch({ active = false }: { active?: boolean }) {
  const { nudge, setNudge } = useHeartflame();

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex items-end gap-3"
      aria-live="polite"
    >
      {nudge && (
        <button
          type="button"
          onClick={() => setNudge(null)}
          className="pointer-events-auto max-w-[18rem] rounded-[14px] border border-[var(--qd-border)] px-4 py-3 text-left shadow-[var(--qd-shadow-card)] backdrop-blur-sm transition-opacity hover:opacity-90"
          style={{
            background: 'var(--qd-grad-card), var(--qd-card)',
            borderLeft: `2px solid ${CATEGORY_TINT[nudge.category]}`,
          }}
          title="Dismiss"
        >
          <span
            className="block font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.16em]"
            style={{ color: CATEGORY_TINT[nudge.category] }}
          >
            In the Margins
          </span>
          <span className="mt-1 block font-[family-name:var(--qd-font-display)] text-[18px] italic leading-snug text-[var(--qd-ink)]">
            {nudge.line}
          </span>
        </button>
      )}

      {/* The ember itself */}
      <span
        className={`hf-ember${active || nudge ? ' hf-ember--active' : ''} block h-7 w-7 flex-none rounded-full`}
        role="img"
        aria-label={nudge ? 'The Heartflame stirs' : 'The Heartflame, watching'}
      />
    </div>
  );
}
