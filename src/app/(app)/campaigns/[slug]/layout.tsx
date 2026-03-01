'use client';

import { useEffect } from 'react';
import Image from 'next/image';
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
  const role = data.myRole || data.myPermissions?.role || 'PLAYER';
  const isDM = role === 'OWNER' || role === 'CO_DM';

  const roleLabel = role === 'OWNER' ? 'Dungeon Master' : role === 'CO_DM' ? 'Co-DM' : role === 'PLAYER' ? 'Player' : 'Spectator';
  const roleColor = isDM
    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    : 'text-sky-400 border-sky-500/30 bg-sky-500/10';

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
      <div className="space-y-0 w-full max-w-[1400px]">
        {/* Campaign header */}
        <div className="relative flex items-start justify-between gap-4 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-6 overflow-hidden rounded-t-lg">
          {data.bannerUrl && (
            <>
              <div className="absolute inset-0">
                <Image
                  src={data.bannerUrl}
                  alt=""
                  fill
                  className="object-cover scale-110 blur-[20px] opacity-[0.15]"
                  aria-hidden
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
            </>
          )}
          <div className="relative z-10 min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-wide leading-tight truncate">
              {data.name}
            </h1>
            {data.description && (
              <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{data.description}</p>
            )}
          </div>
          <span className={`relative z-10 shrink-0 mt-1 text-xs font-medium px-2.5 py-1 rounded-full border ${roleColor}`}>
            {roleLabel}
          </span>
        </div>

        <CampaignNav />

        <div className="pt-6">{children}</div>
      </div>
    </CampaignProvider>
  );
}
