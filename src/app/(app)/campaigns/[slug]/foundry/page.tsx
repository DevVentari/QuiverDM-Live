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
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!iframeSrc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No Foundry URL configured. Set it in Campaign Settings → Foundry tab.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <iframe
        src={iframeSrc}
        className="absolute inset-0 h-full w-full border-0"
        allow="storage-access; autoplay; fullscreen; pointer-lock"
        title="FoundryVTT"
      />
    </div>
  );
}
