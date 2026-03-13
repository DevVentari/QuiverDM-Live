'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Plus, Shield } from 'lucide-react';

export default function CampaignsPage() {
  const campaigns = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 120_000 });

  return (
    <div className="space-y-6 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">Campaigns</h1>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {campaigns.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : campaigns.data && campaigns.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.data.map((campaign: any) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.slug || campaign.id}`}
            >
              <div className="stone-card overflow-hidden hover:border-amber-700/40 transition-colors cursor-pointer h-full">
                {campaign.bannerUrl ? (
                  <div className="relative h-24 w-full">
                    <Image
                      src={campaign.bannerUrl}
                      alt={campaign.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
                )}
                <div className="stone-card-header">
                  <div className="flex items-center justify-between">
                    <span className="stone-card-title">{campaign.name}</span>
                    {campaign.status && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {campaign.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {campaign.description || 'No description'}
                  </p>
                </div>
                <div className="stone-card-body">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{campaign._count?.sessions || 0} sessions</span>
                    <span>{campaign._count?.npcs || 0} NPCs</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Create a campaign to start your adventure - invite players, track sessions, and manage your world.
            </p>
            <Button asChild size="sm">
              <Link href="/campaigns/new">
                New Campaign
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
