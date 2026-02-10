'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  ContextBanner,
  ContextBannerSkeleton,
  QuickActions,
  WelcomeHeader,
  WelcomeHeaderSkeleton,
  ContentCarousel,
} from '@/components/dashboard';
import { isSessionActive, isSessionToday, formatSessionTime } from '@/lib/utils/date';
import { DashboardCampaign } from '@/types/dashboard';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    redirect('/auth/signin');
  }

  // Data fetching - Characters
  const { data: characters, isLoading: charsLoading } =
    trpc.characters.getMyCharacters.useQuery(undefined, {
      enabled: status === 'authenticated',
    });

  // Data fetching - Campaigns
  const { data: campaigns, isLoading: campsLoading } =
    trpc.campaigns.getMyMemberships.useQuery(undefined, {
      enabled: status === 'authenticated',
    });

  // Data fetching - Invites
  const { data: invites, isLoading: invitesLoading } =
    trpc.campaigns.getPendingInvites.useQuery(undefined, {
      enabled: status === 'authenticated',
    });

  // Data fetching - Homebrew Content
  const { data: homebrewData, isLoading: homebrewLoading } =
    trpc.homebrew.getContent.useQuery(
      { limit: 100 },
      { enabled: status === 'authenticated' }
    );

  // Mutations for invite handling
  const utils = trpc.useUtils();
  const acceptInviteMutation = trpc.campaigns.acceptInvite.useMutation({
    onSuccess: () => {
      void utils.campaigns.getMyMemberships.invalidate();
      void utils.campaigns.getPendingInvites.invalidate();
    },
  });

  const declineInviteMutation = trpc.campaigns.declineInvite.useMutation({
    onSuccess: () => {
      void utils.campaigns.getPendingInvites.invalidate();
    },
  });

  // Determine context for banners
  const activeSession = campaigns?.find(
    (c: DashboardCampaign) => c.nextSession && isSessionActive(c.nextSession)
  );
  const todaySession = campaigns?.find(
    (c: DashboardCampaign) =>
      c.nextSession && isSessionToday(c.nextSession) && !isSessionActive(c.nextSession)
  );
  const pendingInvite = invites?.[0];

  // Check if user owns any campaigns (for quick actions)
  const hasOwnedCampaigns =
    campaigns?.some((c: DashboardCampaign) => c.role === 'OWNER') ?? false;

  // Loading state
  const isLoading = status === 'loading' || charsLoading || campsLoading;

  // Organize homebrew content by type
  const homebrew = homebrewData?.items || [];
  const spells = homebrew.filter((h) => h.type === 'spell');
  const items = homebrew.filter((h) => h.type === 'item');
  const creatures = homebrew.filter((h) => h.type === 'creature');
  const races = homebrew.filter((h) => h.type === 'race');
  const classes = homebrew.filter((h) => h.type === 'class');
  const subclasses = homebrew.filter((h) => h.type === 'subclass');
  const feats = homebrew.filter((h) => h.type === 'feat');
  const backgrounds = homebrew.filter((h) => h.type === 'background');

  // Transform data for carousels
  const campaignItems =
    campaigns?.map((c: DashboardCampaign) => ({
      id: c.id,
      name: c.name,
      subtitle: `${c.role} • ${c.memberCount || 0} members`,
      image: c.bannerUrl,
      href: `/campaigns/${c.slug}`,
      icon: '🏰',
    })) || [];

  const characterItems =
    characters?.map((c) => ({
      id: c.id,
      name: c.name,
      subtitle: `${c.class || 'Unknown'} ${c.level || 1}`,
      image: c.portraitUrl,
      href: `/characters/${c.id}`,
      icon: '🎭',
    })) || [];

  const spellItems = spells.map((s) => ({
    id: s.id,
    name: s.name,
    subtitle: `Level ${(s.data as any)?.level || '?'}`,
    href: `/homebrew/${s.id}`,
    icon: '✨',
  }));

  const itemItems = items.map((i) => ({
    id: i.id,
    name: i.name,
    subtitle: (i.data as any)?.rarity || 'Item',
    href: `/homebrew/${i.id}`,
    icon: '⚔️',
  }));

  const creatureItems = creatures.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: `CR ${(c.data as any)?.challengeRating || '?'}`,
    href: `/homebrew/${c.id}`,
    icon: '🐉',
  }));

  const raceItems = races.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: 'Race',
    href: `/homebrew/${r.id}`,
    icon: '🧝',
  }));

  const classItems = classes.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: 'Class',
    href: `/homebrew/${c.id}`,
    icon: '⚔️',
  }));

  const subclassItems = subclasses.map((s) => ({
    id: s.id,
    name: s.name,
    subtitle: 'Subclass',
    href: `/homebrew/${s.id}`,
    icon: '📖',
  }));

  const featItems = feats.map((f) => ({
    id: f.id,
    name: f.name,
    subtitle: 'Feat',
    href: `/homebrew/${f.id}`,
    icon: '🎯',
  }));

  const backgroundItems = backgrounds.map((b) => ({
    id: b.id,
    name: b.name,
    subtitle: 'Background',
    href: `/homebrew/${b.id}`,
    icon: '📜',
  }));

  return (
    <div className="min-h-screen bg-cream-bg">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Context Banner */}
        {isLoading ? (
          invitesLoading ? <ContextBannerSkeleton /> : null
        ) : (
          <ContextBanner
            activeSession={
              activeSession
                ? {
                    campaignName: activeSession.name,
                    campaignSlug: activeSession.slug,
                  }
                : null
            }
            todaySession={
              todaySession?.nextSession
                ? {
                    campaignName: todaySession.name,
                    campaignSlug: todaySession.slug,
                    time: formatSessionTime(todaySession.nextSession.date),
                  }
                : null
            }
            pendingInvite={pendingInvite}
            onAcceptInvite={(inviteId) => acceptInviteMutation.mutate({ inviteId })}
            onDeclineInvite={(inviteId) => declineInviteMutation.mutate({ inviteId })}
          />
        )}

        {/* Welcome Header */}
        {isLoading ? (
          <WelcomeHeaderSkeleton />
        ) : (
          <WelcomeHeader
            userName={session?.user?.name || 'Adventurer'}
            hasSessionToday={!!todaySession || !!activeSession}
            characterCount={characters?.length ?? 0}
            campaignCount={campaigns?.length ?? 0}
          />
        )}

        {/* Dashboard Grid */}
        <div className="mt-8">
          {/* Row 1: Campaigns & Characters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-2">
            <ContentCarousel
              title="My Campaigns"
              items={campaignItems}
              emptyIcon="🏰"
              emptyText="No campaigns yet"
              createHref="/campaigns/new"
              createText="Create Campaign"
              isLoading={campsLoading}
            />
            <ContentCarousel
              title="My Characters"
              items={characterItems}
              emptyIcon="🎭"
              emptyText="No characters yet"
              createHref="/characters/new"
              createText="Create Character"
              isLoading={charsLoading}
            />
          </div>

          {/* Row 2: Spells & Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-2">
            <ContentCarousel
              title="Spells"
              items={spellItems}
              emptyIcon="✨"
              emptyText="No spells yet"
              createHref="/homebrew/create/spell"
              createText="Create Spell"
              isLoading={homebrewLoading}
            />
            <ContentCarousel
              title="Magic Items"
              items={itemItems}
              emptyIcon="⚔️"
              emptyText="No items yet"
              createHref="/homebrew/create/item"
              createText="Create Item"
              isLoading={homebrewLoading}
            />
          </div>

          {/* Row 3: Creatures & Subclasses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-2">
            <ContentCarousel
              title="Creatures"
              items={creatureItems}
              emptyIcon="🐉"
              emptyText="No creatures yet"
              createHref="/homebrew/create/creature"
              createText="Create Creature"
              isLoading={homebrewLoading}
            />
            <ContentCarousel
              title="Subclasses"
              items={subclassItems}
              emptyIcon="📖"
              emptyText="No subclasses yet"
              createHref="/homebrew/create/subclass"
              createText="Create Subclass"
              isLoading={homebrewLoading}
            />
          </div>

          {/* Row 4: Races & Classes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-2">
            <ContentCarousel
              title="Races"
              items={raceItems}
              emptyIcon="🧝"
              emptyText="No races yet"
              createHref="/homebrew/create/race"
              createText="Create Race"
              isLoading={homebrewLoading}
            />
            <ContentCarousel
              title="Classes"
              items={classItems}
              emptyIcon="⚔️"
              emptyText="No classes yet"
              createHref="/homebrew/create/class"
              createText="Create Class"
              isLoading={homebrewLoading}
            />
          </div>

          {/* Row 5: Feats & Backgrounds */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-2">
            <ContentCarousel
              title="Feats"
              items={featItems}
              emptyIcon="🎯"
              emptyText="No feats yet"
              createHref="/homebrew/create/feat"
              createText="Create Feat"
              isLoading={homebrewLoading}
            />
            <ContentCarousel
              title="Backgrounds"
              items={backgroundItems}
              emptyIcon="📜"
              emptyText="No backgrounds yet"
              createHref="/homebrew/create/background"
              createText="Create Background"
              isLoading={homebrewLoading}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <section className="mt-8">
          <h3 className="font-display text-text-primary text-xl mb-4 hidden md:block">
            Quick Actions
          </h3>
          <QuickActions hasOwnedCampaigns={hasOwnedCampaigns} />
        </section>
      </div>
    </div>
  );
}
