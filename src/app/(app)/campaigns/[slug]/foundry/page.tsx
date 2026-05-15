'use client';

import { use } from 'react';
import { trpc } from '@/lib/trpc';

export default function FoundryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const campaign = trpc.campaigns.getBySlug.useQuery({ slug });
  const campaignId = campaign.data?.id;

  const settings = trpc.foundry.getSettings.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId },
  );

  const foundryUrl = settings.data?.foundryUrl;
  const embedUrl = foundryUrl ? `${foundryUrl.replace(/\/$/, '')}/game?quiver=1` : null;

  if (!embedUrl) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {settings.isLoading || campaign.isLoading
          ? 'Loading…'
          : 'No Foundry URL configured. Set it in Campaign Settings → Foundry tab.'}
      </div>
    );
  }

  return (
    <iframe
      src={embedUrl}
      className="fixed inset-0 h-screen w-screen border-0"
      allow="autoplay; fullscreen"
      title="FoundryVTT"
    />
  );
}
