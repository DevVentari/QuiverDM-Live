'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import { useParams } from 'next/navigation';
import { CampaignProvider } from '@/components/campaign/campaign-context';
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
    if ((campaign.data as any)?.name) {
      document.title = `${(campaign.data as any).name} | QuiverDM`;
    }
  }, [campaign.data, utils]);

  if (campaign.isLoading) {
    return (
      <div className="space-y-4 max-w-6xl 2xl:max-w-[1500px]">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (campaign.error || !campaign.data) {
    return (
      <div className="max-w-6xl 2xl:max-w-[1500px]">
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
        {/* Stone Arch Split hero header */}
        <div
          className="relative flex overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8"
          style={{ height: 140, borderBottom: '1px solid hsl(35 35% 18%)' }}
        >
          {/* Left panel — arch clip, dark bg, campaign name */}
          <div
            className="hero-arch-left relative flex flex-col justify-center px-6 sm:px-8 min-w-0"
            style={{
              flex: '0 0 65%',
              background: 'linear-gradient(160deg, hsl(240 10% 10%), hsl(240 8% 7%))',
              paddingRight: '3rem',
            }}
          >
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wide leading-tight truncate" style={{ color: 'hsl(35 30% 88%)' }}>
              {data.name}
            </h1>
            {data.description && (
              <p className="text-sm mt-1 line-clamp-2" style={{ color: 'hsl(35 10% 50%)' }}>{data.description}</p>
            )}
          </div>

          {/* Right panel — banner image or atmospheric gradient, role badge */}
          <div className="relative flex-1 flex items-end justify-end p-4">
            {data.bannerUrl ? (
              <Image
                src={data.bannerUrl}
                alt=""
                fill
                className="object-cover opacity-40"
                aria-hidden
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(ellipse 80% 80% at 80% 50%, hsl(258 40% 12% / 0.7), hsl(240 8% 6%))' }}
              />
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, transparent 30%, hsl(240 8% 7% / 0.6))' }} />
            <span className={`relative z-10 text-xs font-medium px-2.5 py-1 rounded-full border ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="pt-6">{children}</div>
      </div>
    </CampaignProvider>
  );
}
