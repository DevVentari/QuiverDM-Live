'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Plus, Swords, X } from 'lucide-react';
import { ActiveCampaignHero } from '@/components/dashboard/ActiveCampaignHero';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';

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

  const heroStats = [
    { label: campaignCount === 1 ? 'campaign' : 'campaigns', value: campaignCount },
    { label: 'sessions', value: totalSessions },
  ];

  return (
    <PageLayout
      overline="Dashboard"
      title="Command Table"
      subtitle="A global view of your active worlds, pending invites, and the campaign most likely to need your attention next."
      stats={heroStats}
      actions={
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      }
    >
      <div className="flex gap-6 items-start">
        {/* Left sidebar */}
        <div className="hidden lg:flex flex-col w-[260px] shrink-0 gap-4 lg:self-start lg:sticky lg:top-4">
          {campaigns.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : activeCampaign ? (
            <ActiveCampaignHero campaign={activeCampaign} />
          ) : null}

          {!campaigns.isLoading && campaignCount > 0 && (
            <div className="stone-card glass-panel">
              <div className="stone-card-body space-y-3 py-3">
                <div className="flex items-center gap-2">
                  <Swords className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-sm font-medium tabular-nums">{campaignCount}</span>
                  <span className="text-xs text-muted-foreground">campaign{campaignCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center text-[10px] text-primary font-bold">#</span>
                  <span className="text-sm font-medium tabular-nums">{totalSessions}</span>
                  <span className="text-xs text-muted-foreground">sessions logged</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile active campaign */}
          {!campaigns.isLoading && activeCampaign && (
            <div className="lg:hidden">
              <ActiveCampaignHero campaign={activeCampaign} />
            </div>
          )}

          {/* Pending invites */}
          {invites.data && invites.data.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pending Invites</h2>
              {invites.data.map((invite) => (
                <div key={invite.id} className="stone-card glass-panel border-primary/30">
                  <div className="stone-card-body flex items-center justify-between py-3 px-4">
                    <div>
                      <p className="text-sm font-medium">{invite.campaignName || 'Campaign'}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited as {(invite.role ?? 'player').toLowerCase().replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptInvite.mutate({ inviteId: invite.id })} disabled={acceptInvite.isPending}>
                        <Check className="mr-1 h-3 w-3" />
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => declineInvite.mutate({ inviteId: invite.id })} disabled={declineInvite.isPending}>
                        <X className="mr-1 h-3 w-3" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Campaigns list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Campaigns</h2>
              <Button variant="ghost" size="sm" asChild className="h-auto px-2 py-1 text-xs text-muted-foreground">
                <Link href="/campaigns">View all</Link>
              </Button>
            </div>

            {campaigns.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : campaigns.isError ? (
              <div className="stone-card glass-panel p-8 text-center">
                <p className="text-sm text-muted-foreground">Failed to load campaigns. Please refresh.</p>
              </div>
            ) : campaigns.data && campaigns.data.length > 0 ? (
              <div className="space-y-1.5">
                {campaigns.data.map((campaign) => (
                  <Link key={campaign.id} href={`/campaigns/${campaign.slug || campaign.id}`} className="block">
                    <div className="stone-card glass-panel flex items-center gap-3 px-4 py-3 overflow-hidden transition-colors hover:border-amber-700/40 cursor-pointer">
                      {campaign.bannerUrl && (
                        <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden">
                          <Image src={campaign.bannerUrl} alt={campaign.name} fill className="object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.sessionCount} sessions
                          {campaign.lastSessionDate && ` · Last played ${formatDistanceToNow(new Date(campaign.lastSessionDate), { addSuffix: true })}`}
                          {campaign.nextSession && ` · Next: ${format(new Date(campaign.nextSession.date), 'EEE MMM d')}`}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="stone-card glass-panel">
                <div className="stone-card-body flex flex-col items-center py-8 text-center">
                  <Swords className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="mb-3 text-sm text-muted-foreground">
                    No campaigns yet. Create one to get started.
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
      </div>
    </PageLayout>
  );
}
