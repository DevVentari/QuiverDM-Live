'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type ScrollkinNudge } from '@/lib/scrollkin/types';

/**
 * Scrollkin perch — the fixed bottom-right home of the nudge companion and the
 * evolution of the Co-DM alert toast (`co-dm-alert.tsx`). Idle, it shows a quiet
 * silhouette; when a nudge arrives it surfaces the line, and tapping reveals the
 * plain rule text (never AI). This is the UI mount point Track C wires to the
 * delivery layer over the existing WS broadcast.
 */
interface ScrollkinPerchProps {
  /** The current nudge to surface, or null when idle. */
  nudge?: ScrollkinNudge | null;
  onDismiss?: () => void;
}

const CATEGORY_TONE: Record<ScrollkinNudge['category'], string> = {
  opportunity: 'border-[var(--q-accent-primary)]/40 text-[var(--q-accent-primary)]',
  'option-unused': 'border-amber-500/40 text-amber-400',
  risk: 'border-destructive/50 text-destructive',
};

export function ScrollkinPerch({ nudge = null, onDismiss }: ScrollkinPerchProps) {
  const [revealed, setRevealed] = useState(false);

  if (!nudge) {
    // Idle silhouette — present but quiet ("the world breathes").
    return (
      <div
        aria-hidden
        className="fixed bottom-5 right-5 z-50 grid h-12 w-12 place-items-center rounded-full border border-[var(--q-border-subtle)]/60 bg-[var(--q-surface-raised)]/70 text-[var(--q-text-dim)] shadow-lg backdrop-blur-md"
        data-testid="scrollkin-perch-idle"
      >
        <Sparkles className="h-5 w-5 opacity-60" />
      </div>
    );
  }

  const meta = CATEGORY_META[nudge.category];

  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-50 w-80 rounded-2xl border bg-[var(--q-surface-raised)]/95 p-4 shadow-2xl backdrop-blur-md',
        CATEGORY_TONE[nudge.category],
      )}
      data-testid="scrollkin-perch-nudge"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
            <span aria-hidden>{meta.glyph}</span>
            <span>Scrollkin · {meta.label}</span>
          </div>
          <p className="text-sm font-medium text-[var(--q-text)]">
            {nudge.reskinnedText ?? nudge.line.text}
          </p>
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="text-[11px] text-[var(--q-text-dim)] underline-offset-2 hover:underline"
          >
            {revealed ? 'Hide rule' : 'Show rule'}
          </button>
          {revealed && (
            <p className="text-[11px] leading-snug text-[var(--q-text-dim)]">{nudge.line.rule}</p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-[var(--q-text-dim)] transition-colors hover:text-[var(--q-text)]"
            aria-label="Dismiss nudge"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
