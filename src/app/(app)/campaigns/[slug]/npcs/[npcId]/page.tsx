'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ImageGallery } from '@/components/homebrew/image-gallery';
import { ExportToFoundryButton } from '@/components/foundry/ExportToFoundryButton';

export default function NPCDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { slug, isDM } = useCampaign();
  const npcId = params.npcId as string;

  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
            <ExportToFoundryButton
              type="npc"
              sourceId={npcId}
              sourceName={data.name ?? 'NPC'}
            />
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
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="label-overline">IMAGE</p>
        <div className="section-rule mb-4" />
        <ImageGallery
          entityType="npc"
          entityId={data.id}
          currentImageUrl={data.imageUrl}
          currentJobId={data.imageJobId}
          canGenerate={isDM}
          entityName={data.name}
        />
      </div>

      {data.description && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </CardContent>
        </Card>
      )}

      {isDM && data.secrets && (
        <Card className="glass-panel border-amber-500/30">
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
          <p className="label-overline">STAT BLOCK</p>
          <div className="section-rule mb-4" />
          <Card className="glass-panel">
            <CardContent className="pt-6">
              {(stats.creatureType || stats.cr || stats.alignment) && (
                <p className="text-sm text-muted-foreground mb-4">
                  {[stats.creatureType, stats.alignment, stats.cr ? `CR ${stats.cr}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
                {stats.armorClass != null && (
                  <p><span className="font-semibold">AC</span> {stats.armorClass}</p>
                )}
                {stats.hitPoints != null && (
                  <p>
                    <span className="font-semibold">HP</span>{' '}
                    {typeof stats.hitPoints === 'object' ? stats.hitPoints.max : stats.hitPoints}
                  </p>
                )}
                {stats.speed && (
                  <p><span className="font-semibold">Speed</span> {stats.speed}</p>
                )}
                {stats.savingThrows && (
                  <p><span className="font-semibold">Saving Throws</span> {stats.savingThrows}</p>
                )}
                {stats.skills && (
                  <p><span className="font-semibold">Skills</span> {stats.skills}</p>
                )}
                {stats.senses && (
                  <p><span className="font-semibold">Senses</span> {stats.senses}</p>
                )}
                {stats.languages && (
                  <p><span className="font-semibold">Languages</span> {stats.languages}</p>
                )}
                {stats.damageResistances && (
                  <p><span className="font-semibold">Damage Resistances</span> {stats.damageResistances}</p>
                )}
                {stats.damageImmunities && (
                  <p><span className="font-semibold">Damage Immunities</span> {stats.damageImmunities}</p>
                )}
              </div>
              {stats.abilityScores && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center text-sm border-t border-b border-border py-3 mb-4">
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
              )}
              {stats.actions && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Actions</p>
                  <p className="text-sm whitespace-pre-wrap">{stats.actions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete NPC"
        description="Are you sure you want to delete this NPC? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteNpc.mutate({ id: npcId })}
        loading={deleteNpc.isPending}
      />
    </div>
  );
}
