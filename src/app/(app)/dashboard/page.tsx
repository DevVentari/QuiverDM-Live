'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Plus, Swords, Check, X, ArrowRight, CalendarDays } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { toast } = useToast();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 120_000 });
  const invites   = trpc.campaigns.getPendingInvites.useQuery(undefined,  { staleTime: 10_000  });
  const utils     = trpc.useUtils();

  const acceptInvite = trpc.campaigns.acceptInvite.useMutation({
    onSuccess: () => { utils.campaigns.getPendingInvites.invalidate(); utils.campaigns.getMyMemberships.invalidate(); },
    onError:   (e) => { toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });
  const declineInvite = trpc.campaigns.declineInvite.useMutation({
    onSuccess: () => { utils.campaigns.getPendingInvites.invalidate(); },
    onError:   (e) => { toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const campaignList  = campaigns.data ?? [];
  const campaignCount = campaignList.length;
  const totalSessions = campaignList.reduce((sum, c) => sum + (c.sessionCount ?? 0), 0);

  const activeCampaign = useMemo(() => {
    if (!campaignList.length) return null;
    return [...campaignList].sort((a, b) => {
      const aDate = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : new Date(a.updatedAt).getTime();
      const bDate = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : new Date(b.updatedAt).getTime();
      return bDate - aDate;
    })[0] ?? null;
  }, [campaignList]);

  const activeCampaignSlug = activeCampaign ? (activeCampaign.slug || activeCampaign.id) : null;

  return (
    <PageLayout
      overline="Dashboard"
      title="Command Table"
      subtitle="A global view of your active worlds and the campaign that needs your attention next."
      stats={[
        { label: 'Campaigns', value: campaignCount  },
        { label: 'Sessions',  value: totalSessions  },
      ]}
      actions={
        <Button asChild>
          <Link href="/campaigns/new"><Plus className="mr-2 h-4 w-4" />New Campaign</Link>
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── Left sidebar ── */}
        <aside className="hidden md:flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {campaigns.isLoading ? (
            <Skeleton className="h-44 rounded-xl" />
          ) : activeCampaign && activeCampaignSlug ? (
            <Link href={`/campaigns/${activeCampaignSlug}`}>
              <div className="glass-panel relative overflow-hidden rounded-xl border h-44 cursor-pointer hover:border-amber-700/40 transition-colors">
                {activeCampaign.bannerUrl ? (
                  <Image src={activeCampaign.bannerUrl} alt={activeCampaign.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 80% at 70% 50%, hsl(258 40% 10% / 0.8), hsl(240 8% 6%))' }} />
                )}
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 p-4 flex flex-col h-full">
                  <p className="text-[10px] uppercase tracking-widest text-primary mb-1">Active Campaign</p>
                  <p className="font-display text-lg font-bold text-white leading-tight truncate">{activeCampaign.name}</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    {activeCampaign.lastSessionDate
                      ? formatDistanceToNow(new Date(activeCampaign.lastSessionDate), { addSuffix: true })
                      : 'No sessions yet'}
                  </p>
                  <div className="mt-auto flex items-center gap-1.5 text-xs text-white/50">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {activeCampaign.sessionCount ?? 0} sessions
                  </div>
                </div>
              </div>
            </Link>
          ) : null}

          {activeCampaign && activeCampaignSlug && (
            <div className="flex flex-col gap-2">
              <Button size="sm" asChild className="w-full gap-1.5">
                <Link href={`/campaigns/${activeCampaignSlug}/sessions`}>
                  Resume <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="w-full">
                <Link href={`/campaigns/${activeCampaignSlug}`}>Overview</Link>
              </Button>
            </div>
          )}
        </aside>

        {/* ── Right: invites + campaign list ── */}
        <div className="space-y-5">
          {/* Mobile: active campaign hero */}
          {activeCampaign && activeCampaignSlug && (
            <Link href={`/campaigns/${activeCampaignSlug}`} className="block md:hidden">
              <div className="glass-panel relative overflow-hidden rounded-xl border h-36 cursor-pointer hover:border-amber-700/40 transition-colors">
                {activeCampaign.bannerUrl ? (
                  <Image src={activeCampaign.bannerUrl} alt={activeCampaign.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 80% at 70% 50%, hsl(258 40% 10% / 0.8), hsl(240 8% 6%))' }} />
                )}
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-primary mb-1">Active Campaign</p>
                  <p className="font-display text-lg font-bold text-white">{activeCampaign.name}</p>
                </div>
              </div>
            </Link>
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
                      <p className="text-xs text-muted-foreground">Invited as {(invite.role ?? 'player').toLowerCase().replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptInvite.mutate({ inviteId: invite.id })} disabled={acceptInvite.isPending}>
                        <Check className="mr-1 h-3 w-3" />Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => declineInvite.mutate({ inviteId: invite.id })} disabled={declineInvite.isPending}>
                        <X className="mr-1 h-3 w-3" />Decline
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Campaign list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Campaigns</h2>
              <Button variant="ghost" size="sm" asChild className="h-auto px-2 py-1 text-xs text-muted-foreground">
                <Link href="/campaigns">View all</Link>
              </Button>
            </div>

            {campaigns.isLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : campaigns.isError ? (
              <div className="stone-card glass-panel p-8 text-center">
                <p className="text-sm text-muted-foreground">Failed to load campaigns.</p>
              </div>
            ) : campaignList.length > 0 ? (
              <div className="space-y-1.5">
                {campaignList.map((campaign) => {
                  const campaignSlug = campaign.slug || campaign.id;
                  return (
                    <Link key={campaign.id} href={`/campaigns/${campaignSlug}`}>
                      <div className={cn(
                        'stone-card glass-panel flex items-center gap-3 px-4 py-3 transition-colors hover:border-amber-700/40 cursor-pointer',
                        activeCampaign?.id === campaign.id ? 'border-amber-500/20' : ''
                      )}>
                        {activeCampaign?.id === campaign.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.sessionCount ?? 0} sessions
                            {campaign.lastSessionDate && ` · ${formatDistanceToNow(new Date(campaign.lastSessionDate), { addSuffix: true })}`}
                          </p>
                        </div>
                        {campaign.nextSession && (
                          <span className="shrink-0 text-xs text-amber-400/80">
                            Next: {format(new Date(campaign.nextSession.date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="stone-card glass-panel">
                <div className="stone-card-body flex flex-col items-center py-8 text-center">
                  <Swords className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="mb-3 text-sm text-muted-foreground">No campaigns yet.</p>
                  <Button size="sm" asChild>
                    <Link href="/campaigns/new"><Plus className="mr-2 h-3 w-3" />Create Campaign</Link>
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
