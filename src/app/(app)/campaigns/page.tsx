'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
              <Card className="h-full hover:border-foreground/50 transition-colors cursor-pointer overflow-hidden">
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
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    {campaign.status && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {campaign.status}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {campaign.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{campaign._count?.sessions || 0} sessions</span>
                    <span>{campaign._count?.npcs || 0} NPCs</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
