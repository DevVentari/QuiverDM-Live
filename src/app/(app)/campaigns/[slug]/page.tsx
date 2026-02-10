'use client';

import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Scroll, Swords, BookOpen } from 'lucide-react';

export default function CampaignOverviewPage() {
  const { campaignId } = useCampaign();
  const stats = trpc.campaigns.getStats.useQuery({ campaignId });

  if (stats.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const data = (stats.data || {}) as any;

  const statCards = [
    { label: 'Sessions', value: data.sessions ?? 0, icon: Scroll },
    { label: 'NPCs', value: data.npcs ?? 0, icon: Swords },
    { label: 'Members', value: data.members ?? 0, icon: Users },
    { label: 'Homebrew', value: data.homebrew ?? 0, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
