'use client';

import { use, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

export default function FoundryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: _slug } = use(params);
  const { campaignId } = useCampaign();

  const settings = trpc.foundry.getSettings.useQuery(
    { campaignId },
    { enabled: !!campaignId },
  );

  const foundryUrl = settings.data?.foundryUrl;
  const baseUrl = foundryUrl
    ? foundryUrl.replace(/\/game.*$/, '').replace(/\/$/, '')
    : null;

  const iframeSrc = baseUrl ? `${baseUrl}/game?quiver=1` : null;

  // The parent <main> has overflow-y:auto. Lock it while this page is mounted
  // so it doesn't compete with Foundry's canvas for wheel/pointer events.
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const prev = (main as HTMLElement).style.overflowY;
    (main as HTMLElement).style.overflowY = 'hidden';
    return () => {
      (main as HTMLElement).style.overflowY = prev;
    };
  }, []);

  if (settings.isLoading || !campaignId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--q-border-subtle)] bg-[var(--q-shell-bar)]">
          <p className="label-overline">Campaign</p>
          <div className="w-px h-3 bg-[var(--q-border)]" />
          <span className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">Foundry VTT</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-32 animate-pulse rounded bg-[var(--q-surface-utility)]" />
        </div>
      </div>
    );
  }

  if (!iframeSrc) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--q-border-subtle)] bg-[var(--q-shell-bar)]">
          <p className="label-overline">Campaign</p>
          <div className="w-px h-3 bg-[var(--q-border)]" />
          <span className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">Foundry VTT</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="rounded-lg border border-[var(--q-accent-danger-border)] bg-[var(--q-accent-danger-trace)] p-6 max-w-sm w-full">
            <p className="text-sm text-[var(--q-accent-danger)]">No Foundry URL configured. Set it in Campaign Settings → Foundry tab.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--q-border-subtle)] bg-[var(--q-shell-bar)]">
        <p className="label-overline">Campaign</p>
        <div className="w-px h-3 bg-[var(--q-border)]" />
        <span className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">Foundry VTT</span>
      </div>
      <div className="flex-1 relative">
        <iframe
          src={iframeSrc}
          className="absolute inset-0 h-full w-full border-0"
          allow="storage-access; autoplay; fullscreen; pointer-lock"
          title="FoundryVTT"
        />
      </div>
    </div>
  );
}
