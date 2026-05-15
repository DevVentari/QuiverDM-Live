'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  session0Id: string;
  campaignSlug: string;
  initialPrepStatus: string;
}

export function Session0HeroCard({ session0Id, campaignSlug, initialPrepStatus }: Props) {
  const utils = trpc.useUtils();

  const isDraft = initialPrepStatus === 'draft';

  // Poll every 3s while draft, stop after 60s
  const sessionQuery = trpc.sessions.getById.useQuery(
    { id: session0Id },
    {
      enabled: isDraft,
      refetchInterval: isDraft ? 3000 : false,
      refetchIntervalInBackground: true,
    }
  );

  const currentPrepStatus = (sessionQuery.data as any)?.prepStatus ?? initialPrepStatus;
  const isReady = currentPrepStatus === 'complete';

  // Stop polling once complete
  useEffect(() => {
    if (isReady) {
      utils.sessions.getAll.invalidate();
    }
  }, [isReady, utils]);

  function dismiss() {
    try { sessionStorage.setItem(`session0-dismissed-${session0Id}`, '1'); } catch {}
    // Force re-render by invalidating - hero card re-checks sessionStorage on next render
    utils.sessions.getAll.invalidate();
  }

  return (
    <div className="flex justify-center mb-8">
      <div
        className="relative w-full max-w-[480px] rounded-xl border border-[var(--q-amber-border)]/40 bg-[oklch(0.17_0.02_265/0.85)] p-8 text-center shadow-[0_8px_32px_oklch(0_0_0/0.4),0_0_60px_var(--q-amber-glow)]"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <Flame className="mx-auto mb-3 h-8 w-8 text-[var(--q-amber)] opacity-80" aria-hidden="true" />
        <p className="font-[var(--q-font-display)] text-[9px] uppercase tracking-[0.2em] text-[var(--q-text-faint)] mb-2">
          Your campaign has been created
        </p>

        {!isReady ? (
          <>
            <Skeleton className="mx-auto mb-2 h-7 w-48 bg-[var(--q-surface-utility)]" />
            <p className="text-sm text-[var(--q-text-dim)]">Preparing your Session 0 prep...</p>
          </>
        ) : (
          <>
            <h2 className="font-[var(--q-font-display)] text-xl text-[var(--q-text)] mb-3">
              Session 0 is ready
            </h2>
            <div className="mx-auto mb-6 h-px w-24 bg-[var(--q-amber-border)]/30" />
            <p className="text-sm text-[var(--q-text-dim)] mb-6">
              We drafted an opening prep from the sourcebook. Review it, adjust it, then invite your players.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <Button asChild className="w-full max-w-[260px]">
                <Link href={`/campaigns/${campaignSlug}/sessions/${session0Id}`}>
                  Review Session 0 Prep
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <button
                onClick={dismiss}
                className="text-xs text-[var(--q-text-faint)] hover:text-[var(--q-text-dim)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-[10px] text-[var(--q-text-faint)]">
          Disappears after your first session
        </p>
      </div>
    </div>
  );
}
