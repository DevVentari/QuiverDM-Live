'use client';
import { trpc } from '@/lib/trpc';
import { PlayerCampaignCard } from '@/components/play/player-campaign-card';
import { Sword } from 'lucide-react';

export default function PlayerHomePage() {
  const { data: campaigns, isLoading } = trpc.play.getHome.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <p className="overline-label">Player Mode</p>
        <h1 className="font-display text-2xl font-bold">Your Campaigns</h1>
      </div>
      {!campaigns?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Sword className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>You haven't joined any campaigns yet.</p>
          <p className="text-sm mt-1">Ask your DM for an invite code.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <PlayerCampaignCard key={c.campaignId} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}
