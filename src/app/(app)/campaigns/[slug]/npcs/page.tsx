'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Users } from 'lucide-react';

export default function NPCsPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const [search, setSearch] = useState('');
  const npcs = trpc.npcs.getAll.useQuery({ campaignId, search: search || undefined });
  const factions = trpc.npcs.getFactions.useQuery({ campaignId });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">NPCs</h2>
        {isDM && (
          <Button asChild size="sm">
            <Link href={`/campaigns/${slug}/npcs/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New NPC
            </Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search NPCs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {factions.data && (factions.data as string[]).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(factions.data as string[]).map((faction) => (
            <Badge
              key={faction}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setSearch(faction)}
            >
              {faction}
            </Badge>
          ))}
        </div>
      )}

      {npcs.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : npcs.data && (npcs.data as any[]).length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(npcs.data as any[]).map((npc) => (
            <Link key={npc.id} href={`/campaigns/${slug}/npcs/${npc.id}`}>
              <Card className="h-full hover:border-foreground/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{npc.name}</CardTitle>
                    {npc.faction && (
                      <Badge variant="outline" className="text-xs">
                        {npc.faction}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-3">
                    {npc.description || 'No description'}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No NPCs yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
