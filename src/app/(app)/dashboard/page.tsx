'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Plus, Swords, Check, X, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ActiveCampaignHero } from '@/components/dashboard/ActiveCampaignHero';


export default function DashboardPage() {
  const { toast } = useToast();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 120_000 });
  const invites = trpc.campaigns.getPendingInvites.useQuery(undefined, { staleTime: 10_000 });
  const utils = trpc.useUtils();

  const acceptInvite = trpc.campaigns.acceptInvite.useMutation({
    onSuccess: () => {
      utils.campaigns.getPendingInvites.invalidate();
      utils.campaigns.getMyMemberships.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const declineInvite = trpc.campaigns.declineInvite.useMutation({
    onSuccess: () => {
      utils.campaigns.getPendingInvites.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const campaignCount = campaigns.data?.length ?? 0;
  const totalSessions = campaigns.data?.reduce((sum, c) => sum + (c.sessionCount ?? 0), 0) ?? 0;
  const activeCampaign = useMemo(() => {
    if (!campaigns.data?.length) return null;
    return [...campaigns.data].sort((a, b) => {
      const aDate = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : new Date(a.updatedAt).getTime();
      const bDate = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : new Date(b.updatedAt).getTime();
      return bDate - aDate;
    })[0] ?? null;
  }, [campaigns.data]);

  return (
    <div className="dashboard-bg space-y-6 max-w-6xl 2xl:max-w-[1500px] overflow-hidden rounded-2xl border border-white/5 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">Dashboard</h1>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      {!campaigns.isLoading && campaigns.data && campaigns.data.length > 0 && (
        <div className="stone-card glass-panel">
          <div className="stone-card-body py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium tabular-nums">{campaignCount}</span>
              <span className="text-xs text-muted-foreground">campaigns</span>
            </div>
            <span className="text-border select-none hidden sm:block">·</span>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium tabular-nums">{totalSessions}</span>
              <span className="text-xs text-muted-foreground">sessions</span>
            </div>
          </div>
        </div>
      )}

      {activeCampaign && <ActiveCampaignHero campaign={activeCampaign} />}

      {/* Pending Invites */}
      {invites.data && invites.data.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pending Invites</h2>
          {invites.data.map((invite) => (
            <div key={invite.id} className="stone-card glass-panel border-primary/30">
              <div className="stone-card-body flex items-center justify-between py-3 px-4">
                <div>
                  <p className="font-medium text-sm">{invite.campaignName || 'Campaign'}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited as {(invite.role ?? 'player').toLowerCase().replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => acceptInvite.mutate({ inviteId: invite.id })}
                    disabled={acceptInvite.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declineInvite.mutate({ inviteId: invite.id })}
                    disabled={declineInvite.isPending}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaigns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Campaigns</h2>
          <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground h-auto py-1 px-2">
            <Link href="/campaigns">View all</Link>
          </Button>
        </div>
        {campaigns.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : campaigns.isError ? (
          <div className="stone-card glass-panel p-8 text-center">
            <p className="text-sm text-muted-foreground">Failed to load campaigns. Please refresh.</p>
          </div>
        ) : campaigns.data && campaigns.data.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent -mx-1 px-1">
            {campaigns.data.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.slug || campaign.id}`}
                className="shrink-0 w-[280px] sm:w-[320px] snap-start"
              >
                <div className="stone-card overflow-hidden hover:border-amber-700/40 transition-colors cursor-pointer glass-panel h-full flex flex-col">
                  {campaign.bannerUrl && (
                    <div className="relative h-24 w-full shrink-0">
                      <Image
                        src={campaign.bannerUrl}
                        alt={campaign.name}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(240,10%,11%)] via-transparent to-transparent" />
                    </div>
                  )}
                  <div className="stone-card-header pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="stone-card-title text-sm truncate">{campaign.name}</span>
                    </div>
                  </div>
                  <div className="stone-card-body pt-0">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{campaign.sessionCount} sessions</span>
                      <span>{campaign.memberCount} members</span>
                      {campaign.lastSessionDate && (
                        <span>Last played {formatDistanceToNow(new Date(campaign.lastSessionDate), { addSuffix: true })}</span>
                      )}
                      {campaign.nextSession && (
                        <span className="text-amber-400">Next: {format(new Date(campaign.nextSession.date), 'EEE MMM d')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="stone-card glass-panel">
            <div className="stone-card-body flex flex-col items-center py-8 text-center">
              <Swords className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                No campaigns yet. Create one to get started!
              </p>
              <Button size="sm" asChild>
                <Link href="/campaigns/new">
                  <Plus className="mr-2 h-3 w-3" />
                  Create Campaign
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
