'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { Plus, Swords, Users, Check, X, BookOpen, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ActiveCampaignHero } from '@/components/dashboard/ActiveCampaignHero';

const typeColorMap: Record<string, string> = {
  item: 'border-amber-500/50 text-amber-600 dark:text-amber-400',
  spell: 'border-sky-500/50 text-sky-600 dark:text-sky-400',
  creature: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
  class: 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400',
  subclass: 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export default function DashboardPage() {
  const { toast } = useToast();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 120_000 });
  const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
  const invites = trpc.campaigns.getPendingInvites.useQuery(undefined, { staleTime: 10_000 });
  const homebrew = trpc.homebrew.getContent.useQuery({}, { staleTime: 30_000 });
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

  // Quick stats
  const campaignCount = campaigns.data?.length ?? 0;
  const characterCount = characters.data?.length ?? 0;
  const homebrewItems = ((homebrew.data as any)?.items || []) as any[];
  const activeCampaign = useMemo(() => {
    if (!campaigns.data?.length) return null;
    return [...campaigns.data].sort((a, b) => {
      const aDate = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : new Date(a.updatedAt).getTime();
      const bDate = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : new Date(b.updatedAt).getTime();
      return bDate - aDate;
    })[0] ?? null;
  }, [campaigns.data]);

  return (
    <div className="dashboard-bg space-y-6 max-w-6xl overflow-hidden rounded-2xl border border-white/5 p-4 sm:p-5">
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
      {!campaigns.isLoading && !characters.isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stone-card glass-panel">
            <div className="stone-card-body p-3 flex items-center gap-3">
              <Swords className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-2xl font-bold tabular-nums leading-tight">{campaignCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaigns</div>
              </div>
            </div>
          </div>
          <div className="stone-card glass-panel">
            <div className="stone-card-body p-3 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-2xl font-bold tabular-nums leading-tight">{characterCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Characters</div>
              </div>
            </div>
          </div>
          <div className="stone-card glass-panel">
            <div className="stone-card-body p-3 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-2xl font-bold tabular-nums leading-tight">{homebrewItems.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Homebrew</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeCampaign && <ActiveCampaignHero campaign={activeCampaign} />}

      {/* Pending Invites */}
      {invites.data && invites.data.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pending Invites</h2>
          {invites.data.map((invite: any) => (
            <div key={invite.id} className="stone-card glass-panel border-primary/30">
              <div className="stone-card-body flex items-center justify-between py-3 px-4">
                <div>
                  <p className="font-medium text-sm">{invite.campaign?.name || 'Campaign'}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited as {invite.role || 'player'}
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

      {/* Campaigns - full-width with top banners */}
      <div className="space-y-3">
        <div>
          <p className="label-overline mb-1">Campaigns</p>
          <div className="section-rule" />
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Continue Playing</h2>
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
            {campaigns.data.map((campaign: any) => (
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
                      {campaign.role && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {campaign.role}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 text-xs">
                      {campaign.description || 'No description'}
                    </p>
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
                      {campaign.myCharacter && (
                        <span>Playing: {campaign.myCharacter.name}</span>
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

      {/* Side-by-side: Characters (left) + Homebrew (right) */}
      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        {/* Characters */}
        <div className="space-y-3">
          <div>
            <p className="label-overline mb-1">Characters</p>
            <div className="section-rule" />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Party</h2>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground h-auto py-1 px-2">
              <Link href="/characters">View all</Link>
            </Button>
          </div>
          {characters.isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : characters.isError ? (
            <div className="stone-card glass-panel p-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load characters. Please refresh.</p>
            </div>
          ) : characters.data && characters.data.length > 0 ? (
            <div className="space-y-3">
              {characters.data.map((char: any) => {
                const hp = char.hitPoints as any;
                const hpPct = hp?.max > 0 ? (hp.current / hp.max) * 100 : null;
                return (
                  <Link key={char.id} href={`/characters/${char.id}`}>
                    <div className="stone-card glass-panel group cursor-pointer overflow-hidden transition-all hover:border-white/20 hover:bg-white/[0.05]">
                      <div className="flex gap-3 p-3">
                        <div className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden">
                          {char.portraitUrl ? (
                            <Image
                              src={char.portraitUrl}
                              alt={char.name}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="stone-card-title text-sm truncate">{char.name}</span>
                            {char.level && (
                              <Badge variant="outline" className="border-white/35 bg-white/5 text-[10px] shrink-0 tabular-nums">
                                Lvl {char.level}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {[char.race, char.class].filter(Boolean).join(' · ') || 'No details'}
                          </p>
                          {hp && hpPct != null && (
                            <div className="flex items-center gap-2 mt-2">
                              <Heart className="h-3 w-3 text-red-500 shrink-0" />
                              <Progress value={hpPct} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                {hp.current}/{hp.max}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="stone-card glass-panel">
              <div className="stone-card-body flex flex-col items-center py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No characters yet</p>
                <Button size="sm" asChild>
                  <Link href="/characters/new">
                    <Plus className="mr-2 h-3 w-3" />
                    Create Character
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Homebrew */}
        <div className="space-y-3 min-w-0">
          <div>
            <p className="label-overline mb-1">Homebrew</p>
            <div className="section-rule" />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Homebrew Library</h2>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground h-auto py-1 px-2">
              <Link href="/homebrew">View all</Link>
            </Button>
          </div>
          {homebrew.isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : homebrew.isError ? (
            <div className="stone-card glass-panel p-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load homebrew content. Please refresh.</p>
            </div>
          ) : homebrewItems.length > 0 ? (
            <div className="space-y-2">
              {homebrewItems.slice(0, 8).map((item: any) => (
                <div key={item.id} className="stone-card glass-row overflow-hidden">
                  <div className="stone-card-body flex items-center gap-3 py-2.5 px-4 overflow-hidden">
                    {item.images?.[0] ? (
                      <Image
                        src={item.images[0]}
                        alt={item.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.data?.description && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {stripHtml(item.data.description)}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize shrink-0 ${typeColorMap[item.type] || ''}`}
                    >
                      {item.type}
                    </Badge>
                  </div>
                </div>
              ))}
              {homebrewItems.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{homebrewItems.length - 8} more items
                </p>
              )}
            </div>
          ) : (
            <div className="stone-card glass-panel">
              <div className="stone-card-body flex flex-col items-center py-8 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No homebrew content yet</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/homebrew/pdfs">
                    Upload PDFs
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

