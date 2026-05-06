'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Shield, Users } from 'lucide-react';
import { CampaignCreateSheet } from '@/components/campaign/campaign-create-sheet';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

function CampaignsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaigns = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 120_000 });

  const sheetOpen = searchParams.get('create') === 'true';

  function openSheet() {
    router.replace('?create=true');
  }

  function closeSheet() {
    router.replace('/campaigns');
  }

  const totalCampaigns = campaigns.data?.length ?? 0;
  const totalSessions =
    campaigns.data?.reduce((sum: number, campaign: any) => sum + (campaign._count?.gameSessions ?? 0), 0) ?? 0;
  const totalMembers =
    campaigns.data?.reduce((sum: number, campaign: any) => sum + (campaign._count?.members ?? 0), 0) ?? 0;

  return (
    <PageLayout
      overline="Campaigns"
      title="Your Worlds"
      subtitle="Keep every table, faction, and unfinished thread within reach. Choose a campaign to step back into the world, or open a new frontier."
      maxWidth="xl"
      actions={
        <Button onClick={openSheet}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      }
    >
      {!campaigns.isLoading && totalCampaigns > 0 && (
        <div className="stone-card glass-panel">
          <div className="stone-card-body flex flex-wrap items-center gap-x-5 gap-y-2 py-3">
            <div>
              <p className="stat-value text-lg">{totalCampaigns}</p>
              <p className="stat-label">Campaigns</p>
            </div>
            <div>
              <p className="stat-value text-lg">{totalSessions}</p>
              <p className="stat-label">Sessions Logged</p>
            </div>
            <div>
              <p className="stat-value text-lg">{totalMembers}</p>
              <p className="stat-label">Seats Filled</p>
            </div>
          </div>
        </div>
      )}

      {campaigns.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : campaigns.data && campaigns.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.data.map((campaign: any) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.slug || campaign.id}`}>
              <div className="stone-card glass-panel h-full cursor-pointer overflow-hidden transition-colors hover:border-amber-700/40">
                <div className="relative h-28 w-full shrink-0">
                  {campaign.bannerUrl ? (
                    <Image
                      src={campaign.bannerUrl}
                      alt={campaign.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(240,15%,13%)] via-[hsl(250,20%,10%)] to-[hsl(35,30%,8%)]">
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 30% 50%, hsl(35,60%,40%), transparent 60%), radial-gradient(circle at 80% 20%, hsl(260,40%,30%), transparent 50%)',
                        }}
                      />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(240,10%,11%)] via-transparent to-transparent" />
                  {campaign.status && (
                    <Badge variant="secondary" className="absolute right-2 top-2 text-xs capitalize">
                      {campaign.status}
                    </Badge>
                  )}
                </div>

                <div className="stone-card-header flex-1">
                  <div className="min-w-0">
                    <span className="stone-card-title">Campaign</span>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground/90">{campaign.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {campaign.description || 'No description yet.'}
                    </p>
                  </div>
                </div>

                <div className="stone-card-body pt-0">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>{campaign._count?.gameSessions ?? 0} sessions</span>
                    <span>{campaign._count?.npcs ?? 0} NPCs</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign._count?.members ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
            <Shield className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No campaigns yet</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Raise your first world, invite the party, and start building the record of play.
            </p>
            <Button size="sm" onClick={openSheet}>
              New Campaign
            </Button>
          </div>
        </div>
      )}

      <CampaignCreateSheet open={sheetOpen} onOpenChange={(o) => { if (!o) closeSheet(); }} />
    </PageLayout>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5" />}>
      <CampaignsPageInner />
    </Suspense>
  );
}
