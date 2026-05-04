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

  const roleLabel =
    role === 'OWNER' ? 'Dungeon Master'
    : role === 'CO_DM' ? 'Co-DM'
    : role === 'PLAYER' ? 'Player'
    : 'Spectator';

  const roleColor = isDM
    ? 'text-amber-400/80 border-amber-500/20 bg-amber-500/8'
    : 'text-sky-400/80 border-sky-500/20 bg-sky-500/8';

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
      <div className="w-full max-w-[1400px]">
        {/* Campaign hero header */}
        <div className="relative overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8" style={{ minHeight: 120 }}>
          {/* Banner image */}
          {data.bannerUrl && (
            <Image
              src={data.bannerUrl}
              alt=""
              fill
              className="object-cover object-center"
              style={{ opacity: 0.15 }}
              aria-hidden
            />
          )}

          {/* Base background */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, hsl(240 10% 9%) 0%, hsl(240 8% 7%) 100%)' }}
          />

          {/* Amber candlelight — upper left */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 55% 130% at 0% 0%, hsl(35 70% 18% / 0.45), transparent 70%)' }}
          />

          {/* Mystical purple — upper right */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 45% 100% at 100% 0%, hsl(258 50% 14% / 0.35), transparent 65%)' }}
          />

          {/* Grain overlay */}
          <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
            backgroundSize: '200px 200px',
          }} />

          {/* Content */}
          <div className="relative z-10 flex items-end justify-between gap-4 px-6 sm:px-8 pt-8 pb-5">
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2"
                style={{ color: 'hsl(35 60% 45%)' }}
              >
                Campaign
              </p>
              <h1
                className="font-display text-2xl sm:text-3xl font-bold tracking-wide leading-tight"
                style={{ color: 'hsl(35 30% 90%)' }}
              >
                {data.name}
              </h1>
              {data.description && (
                <p
                  className="text-sm mt-1.5 line-clamp-1 max-w-xl"
                  style={{ color: 'hsl(35 10% 50%)' }}
                >
                  {data.description}
                </p>
              )}
            </div>

            <span
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border ${roleColor}`}
              style={{ letterSpacing: '0.04em' }}
            >
              {roleLabel}
            </span>
          </div>

          {/* Amber rule */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(to right, transparent 0%, hsl(35 60% 35% / 0.6) 30%, hsl(35 60% 35% / 0.6) 70%, transparent 100%)' }}
          />
        </div>

        <div className="pt-6">{children}</div>
      </div>
    </CampaignProvider>
  );
}
