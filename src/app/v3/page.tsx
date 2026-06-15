import Link from 'next/link';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

/**
 * v3 landing placeholder. Confirms the foundation + design system are live: the
 * new shell renders on the `--qd-*` tokens (Kalam display, Hanken body), the
 * Heartflame is perched (bottom-right), and the icon set is wired. Screens land
 * here per Track C.
 */
export default function V3LandingPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <span className="font-[family-name:var(--qd-font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--qd-ink-faint)]">
        Foundation · v3.0-alpha
      </span>
      <h1 className="mt-3 font-[family-name:var(--qd-font-display)] text-[44px] font-bold leading-[1.05] text-[var(--qd-ink-strong)]">
        The new shell is taking shape.
      </h1>
      <p className="mt-4 max-w-prose text-[var(--qd-text-body-lg)] leading-relaxed text-[var(--qd-ink-2)]">
        This is the parallel v3 surface, on the canonical design-token system —
        Kalam titles, Hanken body, amber on deep ember-black. The two-level
        navigation and the Heartflame are in place. Screens migrate here one at a
        time; the live app keeps running untouched until each is ready.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dev/icons"
          className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--qd-border)] bg-[var(--qd-card)] px-4 py-2.5 text-[var(--qd-text-body)] text-[var(--qd-ink)] transition-colors hover:text-[var(--qd-accent-text)]"
        >
          <MaskedDndIcon name="util/star" size={16} />
          Browse the icon library
        </Link>
      </div>
    </div>
  );
}
