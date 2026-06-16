'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';

/**
 * Player Portal shell — a distinct, focused chrome for players (no DM rail).
 * Scoped to /v3/play/[slug]/*. Players see their character, the live scene, the
 * journal, and their combat HUD. Data comes from the player-facing `play` router.
 */
const NAV = [
  { seg: '', label: 'Lobby' },
  { seg: 'character', label: 'Character' },
  { seg: 'journal', label: 'Journal' },
  { seg: 'combat', label: 'Combat' },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams() as { slug: string };
  const pathname = usePathname();
  const campaign = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 120_000 });
  const name = (campaign.data as any)?.name as string | undefined;
  const base = `/v3/play/${slug}`;

  return (
    <div className="flex h-screen flex-col bg-qd-bg text-qd-ink">
      <header className="flex items-center gap-4 border-b border-qd-faint px-5 py-3">
        <Link href="/v3" className="grid h-8 w-8 flex-none place-items-center rounded-qd-md bg-qd-accent font-qd-display text-qd-on-accent">◆</Link>
        <div className="min-w-0">
          <span className="block truncate font-qd-display text-lg leading-none text-qd-ink-strong">{name ?? 'The table'}</span>
          <span className="font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.16em] text-qd-ink-faint">Player view</span>
        </div>
        <nav className="ml-auto flex gap-1">
          {NAV.map((n) => {
            const href = n.seg ? `${base}/${n.seg}` : base;
            const active = n.seg ? pathname.startsWith(href) : pathname === base;
            return (
              <Link
                key={n.label}
                href={href}
                className={`rounded-qd-md px-3 py-1.5 text-sm transition-colors ${active ? 'bg-qd-card text-qd-accent-text' : 'text-qd-ink-2 hover:text-qd-ink-strong'}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
