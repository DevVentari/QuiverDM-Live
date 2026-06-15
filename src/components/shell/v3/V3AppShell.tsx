'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import { HeartflamePerch } from './HeartflamePerch';
import { HeartflameProvider } from './heartflame-context';
import {
  evaluate,
  primaryNudge,
  toSurfaced,
  participantToActorState,
  DEFAULT_RULES,
  type SurfacedNudge,
} from '@/lib/heartflame';

// Demo nudge from the real predicate engine — the diagram's "Barksley" actor
// (in combat, Crimson Rite inactive, bonus action free). Proves the engine →
// delivery → perch path end-to-end with no DB. A combat screen (Track C) will
// replace this with live encounter nudges via trpc.heartflame.getNudges.
const DEMO_ACTOR = participantToActorState(
  {
    id: 'demo',
    name: 'Barksley',
    hp: 28,
    maxHp: 40,
    tempHp: 0,
    conditions: [],
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: true,
    concentration: false,
    isAlive: true,
  },
  { inCombat: true, features: { 'crimson-rite': { active: false } } },
);
const DEMO_NUDGE = primaryNudge(evaluate(DEMO_ACTOR, DEFAULT_RULES).nudges);
const DEMO_SURFACED: SurfacedNudge | null = DEMO_NUDGE ? toSurfaced(DEMO_NUDGE) : null;

interface RailItem {
  /** Icon path under public/icons/dnd, in `category/name` form. */
  icon: string;
  label: string;
  href: string;
}

/** Global icon rail — the first level of the two-level v3 navigation. */
const RAIL: RailItem[] = [
  { icon: 'util/home', label: 'Home', href: '/v3' },
  { icon: 'game/party', label: 'Campaign', href: '/v3/campaign' },
  { icon: 'game/source-book', label: 'Compendium', href: '/v3/compendium' },
  { icon: 'game/combat', label: 'Combat', href: '/v3/combat' },
  { icon: 'entity/map', label: 'World Map', href: '/v3/world-map' },
  { icon: 'entity/scroll', label: 'Sessions', href: '/v3/sessions' },
];

/**
 * v3 application shell — the two-level navigation (global icon rail + campaign
 * sidebar) with the Heartflame perched at the bottom-right edge. Styled on the
 * `--qd-*` design-token system (Kalam display, Hanken body, amber on #0a0707).
 * Icons reuse `MaskedDndIcon` (mask + currentColor). The campaign sidebar is a
 * placeholder until Track C migrates campaign-scoped screens.
 */
export function V3AppShell({ children }: { children: ReactNode }) {
  return (
    <HeartflameProvider initial={DEMO_SURFACED}>
    <div className="relative flex h-screen overflow-hidden bg-[var(--qd-bg)] text-[var(--qd-ink)]">
      {/* Global icon rail */}
      <nav
        aria-label="Global navigation"
        className="flex w-14 flex-none flex-col items-center gap-1 border-r border-[var(--qd-border-faint)] bg-[var(--qd-rail)] py-4"
      >
        <Link
          href="/v3"
          className="mb-3 grid h-9 w-9 place-items-center rounded-[10px] text-[var(--qd-on-accent)] shadow-[var(--qd-shadow-accent)]"
          style={{ background: 'var(--qd-grad-accent)' }}
        >
          <MaskedDndIcon name="game/dm" size={18} />
        </Link>
        {RAIL.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            className="grid h-10 w-10 place-items-center rounded-[10px] text-[var(--qd-ink-muted)] transition-colors hover:bg-[var(--qd-card)] hover:text-[var(--qd-accent-text)]"
          >
            <MaskedDndIcon name={item.icon} size={20} />
          </Link>
        ))}
        <Link
          href="/dev/icons"
          title="Icon library"
          className="mt-auto grid h-10 w-10 place-items-center rounded-[10px] text-[var(--qd-ink-muted)] transition-colors hover:text-[var(--qd-accent-text)]"
        >
          <MaskedDndIcon name="util/cog" size={20} />
        </Link>
      </nav>

      {/* Campaign sidebar (placeholder — populated in Track C) */}
      <aside
        aria-label="Campaign navigation"
        className="hidden w-56 flex-none flex-col border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.18)] p-4 md:flex"
      >
        <span className="font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--qd-ink-faint)]">
          Campaign
        </span>
        <span className="mt-2 font-[family-name:var(--qd-font-display)] text-xl leading-tight text-[var(--qd-ink-strong)]">
          No world open
        </span>
        <span className="mt-1 text-sm text-[var(--qd-ink-muted)]">
          Campaign nav arrives with Track C.
        </span>
      </aside>

      {/* Main content */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 flex-none items-center gap-3 border-b border-[var(--qd-border-faint)] px-5">
          <span className="font-[family-name:var(--qd-font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--qd-ink-faint)]">
            QuiverDM v3
          </span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* The companion, at the edge of the chronicle (reads nudges from context) */}
      <HeartflamePerch />
    </div>
    </HeartflameProvider>
  );
}
