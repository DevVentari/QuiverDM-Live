'use client';

import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useParams } from 'next/navigation';
import { CampaignProvider } from '@/components/campaign/campaign-context';
import { CampaignNav } from '@/components/campaign/campaign-nav';
import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = params.slug as string;

  const campaign = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 120_000 });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (campaign.data?.id) {
      const campaignId = (campaign.data as any).id;
      utils.npcs.getAll.prefetch({ campaignId });
      utils.sessions.getAll.prefetch({ campaignId });
      utils.members.getAll.prefetch({ campaignId });
    }
  }, [campaign.data, utils]);

  if (campaign.isLoading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (campaign.error || !campaign.data) {
    return (
      <div className="max-w-6xl">
        <p className="text-destructive">
          {campaign.error?.message || 'Campaign not found'}
        </p>
      </div>
    );
  }

  const data = campaign.data as any;
  const membership = data.membership || data.campaignMembers?.[0];
  const role = membership?.role || 'PLAYER';
  const isDM = role === 'OWNER' || role === 'CO_DM';

  return (
    <CampaignProvider
      value={{
        campaignId: data.id,
        slug,
        name: data.name,
        role,
        isOwner: role === 'OWNER',
        isDM,
      }}
    >
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          {data.description && (
            <p className="text-muted-foreground mt-1">{data.description}</p>
          )}
        </div>
        <CampaignNav />
        <div>{children}</div>
      </div>
    </CampaignProvider>
  );
}
