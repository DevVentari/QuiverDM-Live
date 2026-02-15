'use client';

import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Trash2, ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function NPCDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { slug, isDM } = useCampaign();
  const npcId = params.npcId as string;

  const { toast } = useToast();
  const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });
  const deleteNpc = trpc.npcs.delete.useMutation({
    onSuccess: () => router.push(`/campaigns/${slug}/npcs`),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (npc.isLoading) {
    return <Skeleton className="h-64 rounded-lg" />;
  }

  if (npc.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{npc.error?.message || 'An unexpected error occurred'}</p>
          <Button variant="outline" onClick={() => npc.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!npc.data) {
    return <p className="text-destructive">NPC not found</p>;
  }

  const data = npc.data as any;
  const stats = data.stats as any;

  return (
    <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href={`/campaigns/${slug}/npcs`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold">{data.name}</h2>
          {data.faction && (
            <Badge variant="outline" className="mt-1">{data.faction}</Badge>
          )}
        </div>
        {isDM && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href={`/campaigns/${slug}/npcs/${npcId}/edit`}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Link>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => {
                if (confirm('Delete this NPC?')) {
                  deleteNpc.mutate({ id: npcId });
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt={data.name}
          className="w-full sm:w-32 h-48 sm:h-32 rounded-lg object-cover"
        />
      )}

      {data.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </CardContent>
        </Card>
      )}

      {isDM && data.secrets && (
        <Card className="border-foreground/30">
          <CardHeader>
            <CardTitle className="text-sm text-foreground">DM Secrets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.secrets}</p>
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Stat Block</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center text-sm">
                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((ability) => {
                  const key = ability.toLowerCase();
                  const score = stats.abilityScores?.[key] ?? stats[key] ?? '—';
                  const mod = typeof score === 'number' ? Math.floor((score - 10) / 2) : 0;
                  return (
                    <div key={ability}>
                      <div className="font-semibold text-xs text-muted-foreground">
                        {ability}
                      </div>
                      <div className="text-lg font-bold">{score}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeof score === 'number' ? `(${mod >= 0 ? '+' : ''}${mod})` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
              {stats.armorClass && (
                <p className="mt-4 text-sm">
                  <span className="font-semibold">AC:</span> {stats.armorClass}
                </p>
              )}
              {stats.hitPoints && (
                <p className="text-sm">
                  <span className="font-semibold">HP:</span> {typeof stats.hitPoints === 'object' ? stats.hitPoints.max : stats.hitPoints}
                </p>
              )}
              {stats.speed && (
                <p className="text-sm">
                  <span className="font-semibold">Speed:</span> {stats.speed}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
