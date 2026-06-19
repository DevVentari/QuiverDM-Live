'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import { HeartflamePerch } from './HeartflamePerch';
import { HeartflameProvider } from './heartflame-context';
import { V3CommandBar } from './V3CommandBar';
import {
  evaluate,
  primaryNudge,
  toSurfaced,
  participantToActorState,
  DEFAULT_RULES,
  type SurfacedNudge,
} from '@/lib/heartflame';

// Demo nudge from the real engine (the diagram's "Barksley" actor) — shows on
// non-campaign surfaces until a screen pushes a live nudge via useHeartflame.
const DEMO_ACTOR = participantToActorState(
  { id: 'demo', name: 'Barksley', hp: 28, maxHp: 40, tempHp: 0, conditions: [], actionUsed: false, bonusActionUsed: false, reactionUsed: true, concentration: false, isAlive: true },
  { inCombat: true, features: { 'crimson-rite': { active: false } } },
);
const DEMO_NUDGE = primaryNudge(evaluate(DEMO_ACTOR, DEFAULT_RULES).nudges);
const DEMO_SURFACED: SurfacedNudge | null = DEMO_NUDGE ? toSurfaced(DEMO_NUDGE) : null;

interface RailItem {
  icon: string;
  label: string;
  /** Path segment under the campaign, e.g. 'npcs'. null = global Home (/v3). */
  seg: string | null;
}

const RAIL: RailItem[] = [
  { icon: 'util/home', label: 'Home', seg: null },
  { icon: 'entity/world', label: 'Campaign', seg: 'overview' },
  { icon: 'game/party', label: 'Party', seg: 'characters' },
  { icon: 'entity/person', label: 'NPCs', seg: 'npcs' },
  { icon: 'game/source-book', label: 'Compendium', seg: 'compendium' },
  { icon: 'entity/book', label: 'Homebrew', seg: 'homebrew' },
  { icon: 'game/combat', label: 'Combat', seg: 'combat' },
  { icon: 'combat/target', label: 'Battle Map', seg: 'battle-map' },
  { icon: 'entity/map', label: 'World Map', seg: 'world-map' },
  { icon: 'location/castle', label: 'Location Map', seg: 'location-map' },
  { icon: 'entity/location', label: 'Locations', seg: 'locations' },
  { icon: 'game/explore', label: 'Scenes', seg: 'scenes' },
  { icon: 'entity/scroll', label: 'Sessions', seg: 'sessions' },
  { icon: 'entity/time', label: 'Recordings', seg: 'recordings' },
];

/**
 * v3 application shell — two-level navigation (global icon rail + campaign
 * sidebar) + the Heartflame perch. Derives the active campaign slug from the
 * pathname (the CampaignProvider lives in the nested [slug] layout, below this),
 * and resolves the campaign name via a deduped getBySlug query.
 */
export function V3AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const slug = pathname.match(/^\/v3\/campaigns\/([^/]+)/)?.[1];
  const campaign = trpc.campaigns.getBySlug.useQuery(
    { slug: slug ?? '' },
    { enabled: !!slug, staleTime: 120_000 },
  );
  const campaignName = (campaign.data as any)?.name as string | undefined;

  const hrefFor = (seg: string | null) =>
    seg === null ? '/v3' : slug ? `/v3/campaigns/${slug}/${seg}` : '/v3';

  return (
    <HeartflameProvider initial={DEMO_SURFACED}>
      <div className="relative flex h-screen overflow-hidden text-qd-ink">
        {/* Shared atmosphere — aria-hidden, non-interactive; every v3 screen floats over this. */}
        <div aria-hidden className="v3-atmosphere">
          <span className="v3-ember" />
          <span className="v3-grain" />
          <span className="v3-vignette" />
        </div>
        {/* Global icon rail */}
        <nav aria-label="Global navigation" className="relative z-10 flex w-14 flex-none flex-col items-center gap-1 border-r border-qd-faint bg-qd-rail py-4">
          <Link href="/v3" className="mb-3 grid h-9 w-9 place-items-center rounded-qd-md bg-qd-accent text-qd-on-accent shadow-qd-accent">
            <MaskedDndIcon name="game/dm" size={18} />
          </Link>
          {RAIL.map((item) => {
            const active = item.seg !== null && pathname.startsWith(hrefFor(item.seg));
            return (
              <Link
                key={item.label}
                href={hrefFor(item.seg)}
                title={item.label}
                className={`grid h-10 w-10 place-items-center rounded-qd-md transition-colors hover:bg-qd-card ${active ? 'bg-qd-card text-qd-accent-text' : 'text-qd-ink-muted hover:text-qd-accent-text'}`}
              >
                <MaskedDndIcon name={item.icon} size={20} />
              </Link>
            );
          })}
          <Link href={slug ? `/v3/campaigns/${slug}/settings` : '/dev/icons'} title="Settings" className="mt-auto grid h-10 w-10 place-items-center rounded-qd-md text-qd-ink-muted transition-colors hover:text-qd-accent-text">
            <MaskedDndIcon name="util/cog" size={20} />
          </Link>
        </nav>

        {/* Campaign sidebar */}
        <aside aria-label="Campaign navigation" className="relative z-10 hidden w-56 flex-none flex-col border-r border-qd-faint bg-[rgba(0,0,0,0.18)] p-4 md:flex">
          <span className="font-qd-mono text-[9px] uppercase tracking-[0.18em] text-qd-ink-faint">Campaign</span>
          {slug ? (
            <>
              <span className="mt-2 font-qd-display text-lg leading-tight text-qd-ink-strong">
                {campaignName ?? '…'}
              </span>
              <nav className="mt-4 flex flex-col gap-0.5">
                {RAIL.filter((i) => i.seg).map((item) => {
                  const href = hrefFor(item.seg);
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={item.label}
                      href={href}
                      className={`flex items-center gap-2.5 rounded-qd-sm px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-qd-card text-qd-accent-text' : 'text-qd-ink-2 hover:text-qd-ink-strong'}`}
                    >
                      <MaskedDndIcon name={item.icon} size={15} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </>
          ) : (
            <>
              <span className="mt-2 font-qd-display text-lg leading-tight text-qd-ink-strong">No world open</span>
              <Link href="/v3" className="mt-1 text-sm text-qd-accent-text hover:underline">Choose a campaign →</Link>
            </>
          )}
        </aside>

        {/* Main content */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-12 flex-none items-center gap-3 border-b border-qd-faint px-5">
            <span className="font-qd-mono text-[10px] uppercase tracking-[0.2em] text-qd-ink-faint">
              QuiverDM v3{campaignName ? ` · ${campaignName}` : ''}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              title="Search (Ctrl/⌘ K)"
              data-testid="v3-search-trigger"
              className="flex items-center gap-2 rounded-qd-md border border-qd-faint px-2.5 py-1.5 text-qd-ink-muted transition-colors hover:border-qd-strong hover:text-qd-ink-2"
            >
              <MaskedDndIcon name="util/search" size={13} />
              <span className="hidden font-qd-mono text-[10px] sm:inline">Search</span>
              <kbd className="hidden rounded-qd-sm border border-qd-faint px-1 font-qd-mono text-[8px] sm:inline">⌘K</kbd>
            </button>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>

        {/* The companion (reads nudges from context) */}
        <HeartflamePerch />

        {/* Global ⌘K search palette */}
        <V3CommandBar />
      </div>
    </HeartflameProvider>
  );
}
