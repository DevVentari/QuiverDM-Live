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

  // Set campaignSlug immediately from URL so rail shows campaign nav before data loads
  useEffect(() => {
    setSlot({ label: 'Campaign', title: '', campaignSlug: slug, campaignId: '', isDM: false });
  }, [slug, setSlot]);

  // Update with full campaign details once loaded
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
  }, [campaign.data, setSlot, slug]);

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
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-lg font-semibold text-[var(--q-text)]">Campaign not found</p>
        <p className="text-sm text-[var(--q-text-faint)]">This campaign doesn&apos;t exist or you don&apos;t have access.</p>
        <a href="/campaigns" className="text-sm text-[var(--q-primary)] hover:underline">← Back to Campaigns</a>
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
