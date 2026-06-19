'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { CampaignCreateSheet } from '@/components/campaign/campaign-create-sheet';

/**
 * v3 home — the campaign picker / returning-DM landing. Lists the user's
 * campaigns; each opens the campaign-scoped v3 shell at its overview.
 * The "Forge a new world" action opens the Campaign Forge and lands the
 * freshly-created campaign back in the v3 shell.
 */
export default function V3HomePage() {
  const campaigns = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 60_000 });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-8 py-14">
      <div className="flex items-start justify-between gap-6">
        <div>
          <span className="font-qd-mono text-[10px] uppercase tracking-[0.22em] text-qd-ink-faint">
            The chronicle remembers you
          </span>
          <h1 className="mt-3 font-qd-display text-qd-display-xl text-qd-ink-strong">Your worlds</h1>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          data-testid="v3-new-campaign-cta"
          className="mt-2 shrink-0 rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent transition-opacity hover:opacity-90"
        >
          Forge a new world →
        </button>
      </div>

      {campaigns.isLoading && <p className="mt-8 text-qd-ink-muted">Gathering the chronicles…</p>}

      {campaigns.data && campaigns.data.length === 0 && (
        <div className="mt-8">
          <p className="text-qd-ink-muted">No worlds yet. The first chronicle begins when you name it.</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            data-testid="v3-empty-create-cta"
            className="mt-4 rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent transition-opacity hover:opacity-90"
          >
            Forge your first world →
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {(campaigns.data as any[] | undefined)?.map((c) => (
          <div key={c.id} className="rounded-qd-lg border border-qd-faint bg-qd-card p-5">
            <span className="block font-qd-display text-xl text-qd-ink-strong">{c.name}</span>
            {c.description && (
              <span className="mt-1 block line-clamp-2 text-qd-body-sm text-qd-ink-muted">{c.description}</span>
            )}
            <div className="mt-3 flex gap-4">
              <Link href={`/v3/campaigns/${c.slug}/overview`} className="font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-accent-text hover:underline">
                Run · DM →
              </Link>
              <Link href={`/v3/play/${c.slug}`} className="font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-ink-muted hover:text-qd-ink-strong">
                Player view →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <CampaignCreateSheet open={createOpen} onOpenChange={setCreateOpen} shell="v3" />
    </div>
  );
}
