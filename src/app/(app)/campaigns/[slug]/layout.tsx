'use client';

import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useParams } from 'next/navigation';
import { CampaignProvider } from '@/components/campaign/campaign-context';
import { Skeleton } from '@/components/ui/skeleton';
import { useHeaderStore } from '@/store/header-store';

export default function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const setSlot = useHeaderStore((s) => s.setSlot);

  const campaign = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 120_000 });
  const utils = trpc.useUtils();

  const campaignId = (campaign.data as any)?.id as string | undefined;

  useEffect(() => {
    if (!campaignId) return;
    utils.npcs.getAll.prefetch({ campaignId });
    utils.sessions.getAll.prefetch({ campaignId });
    utils.members.getAll.prefetch({ campaignId });
  }, [campaignId, utils]);

  useEffect(() => {
    if ((campaign.data as any)?.name) {
      document.title = `${(campaign.data as any).name} | QuiverDM`;
    }
  }, [campaign.data]);

  useEffect(() => {
    if (!campaign.data) return;
    const data = campaign.data as any;
    const role = data.myRole || data.myPermissions?.role || 'PLAYER';
    const isDM = role === 'OWNER' || role === 'CO_DM';

    setSlot({
      label: 'Campaign',
      title: data.name,
      campaignSlug: slug,
      campaignId: data.id,
      isDM,
    });
  }, [campaign.data, setSlot]);

  useEffect(() => {
    return () => setSlot(null);
  }, [setSlot]);

  if (campaign.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (campaign.error || !campaign.data) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          {campaign.error?.message || 'Campaign not found'}
        </p>
      </div>
    );
  }

  const data = campaign.data as any;
  const role = data.myRole || data.myPermissions?.role || 'PLAYER';
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
      {children}
    </CampaignProvider>
  );
}
