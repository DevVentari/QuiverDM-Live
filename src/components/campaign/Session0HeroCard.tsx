'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Props {
  session0Id: string;
  campaignSlug: string;
  initialPrepStatus: string;
}

export function Session0HeroCard({ session0Id, campaignSlug, initialPrepStatus }: Props) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  // Auto-open once on mount, respecting sessionStorage dismiss
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(`session0-dismissed-${session0Id}`)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [session0Id]);

  const isDraft = initialPrepStatus === 'draft';

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

  useEffect(() => {
    if (isReady) utils.sessions.getAll.invalidate();
  }, [isReady, utils]);

  function dismiss() {
    try { sessionStorage.setItem(`session0-dismissed-${session0Id}`, '1'); } catch {}
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-md border-l border-[var(--q-amber-border)]/30 bg-[oklch(0.20_0.015_265)] p-0"
      >
        <div className="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
          <Flame className="mb-4 h-9 w-9 text-[var(--q-amber)] opacity-80" aria-hidden="true" />

          <SheetHeader className="mb-0 space-y-1">
            <p className="font-[var(--q-font-display)] text-[9px] uppercase tracking-[0.2em] text-[var(--q-text-faint)]">
              Your campaign has been created
            </p>
            <SheetTitle className="font-[var(--q-font-display)] text-xl text-[var(--q-text)]">
              {isReady ? 'Session 0 is ready' : 'Preparing your prep…'}
            </SheetTitle>
          </SheetHeader>

          <div className="my-6 h-px w-20 bg-[var(--q-amber-border)]/30" />

          {!isReady ? (
            <div className="w-full space-y-3">
              <Skeleton className="mx-auto h-4 w-3/4 bg-[var(--q-surface-utility)]" />
              <Skeleton className="mx-auto h-4 w-1/2 bg-[var(--q-surface-utility)]" />
              <p className="mt-4 text-xs text-[var(--q-text-faint)]">Seeding from sourcebook entities…</p>
            </div>
          ) : (
            <>
              <p className="mb-8 text-sm text-[var(--q-text-dim)]">
                We drafted an opening prep from the sourcebook — strong start, key NPCs, opening scenes, and DM secrets. Review it, adjust it, then invite your players.
              </p>
              <div className="flex w-full flex-col gap-3">
                <Button asChild className="w-full" onClick={() => setOpen(false)}>
                  <Link href={`/campaigns/${campaignSlug}/sessions/${session0Id}`}>
                    Review Session 0 Prep
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <button
                  onClick={dismiss}
                  className="text-xs text-[var(--q-text-faint)] transition-colors hover:text-[var(--q-text-dim)]"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          <p className="mt-8 text-[10px] text-[var(--q-text-faint)]">
            Reappears until your first real session is created
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
