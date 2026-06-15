'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';

/**
 * v3 home — the campaign picker / returning-DM landing. Lists the user's
 * campaigns; each opens the campaign-scoped v3 shell at its overview.
 */
export default function V3HomePage() {
  const campaigns = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 60_000 });

  return (
    <div className="mx-auto max-w-3xl px-8 py-14">
      <span className="font-qd-mono text-[10px] uppercase tracking-[0.22em] text-qd-ink-faint">
        The chronicle remembers you
      </span>
      <h1 className="mt-3 font-qd-display text-qd-display-xl text-qd-ink-strong">Your worlds</h1>

      {campaigns.isLoading && <p className="mt-8 text-qd-ink-muted">Gathering the chronicles…</p>}

      {campaigns.data && campaigns.data.length === 0 && (
        <p className="mt-8 text-qd-ink-muted">No worlds yet. The first chronicle begins when you name it.</p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {(campaigns.data as any[] | undefined)?.map((c) => (
          <Link
            key={c.id}
            href={`/v3/campaigns/${c.slug}/overview`}
            className="group rounded-qd-lg border border-qd-faint bg-qd-card p-5 transition-colors hover:border-qd-accent"
          >
            <span className="block font-qd-display text-xl text-qd-ink-strong group-hover:text-qd-accent-hi">
              {c.name}
            </span>
            {c.description && (
              <span className="mt-1 block line-clamp-2 text-qd-body-sm text-qd-ink-muted">{c.description}</span>
            )}
            <span className="mt-3 inline-block font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-accent-text">
              Enter →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
