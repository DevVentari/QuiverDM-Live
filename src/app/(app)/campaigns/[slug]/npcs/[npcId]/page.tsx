'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCampaign } from '@/components/campaign/campaign-context';
import { NpcEditSheet } from '@/components/npc/npc-edit-sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/primitives';
import { Trash2, ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ImageGallery } from '@/components/homebrew/image-gallery';
import { ExportToFoundryButton } from '@/components/foundry/ExportToFoundryButton';
import { NpcWorldState } from '@/components/brain/npc-world-state';

function NpcCard({
  title,
  meta,
  amber = false,
  children,
}: {
  title: string
  meta?: React.ReactNode
  amber?: boolean
  children: React.ReactNode
}) {
  return (
    <Card variant="detail" className={amber ? 'border-[var(--q-amber-border)]' : undefined}>
      <div className="flex items-center gap-2 border-b border-[var(--q-border-subtle)] pb-3 mb-3">
        <span className="font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text)]">
          {title}
        </span>
        {meta && <div className="ml-auto">{meta}</div>}
      </div>
      {children}
    </Card>
  )
}

export default function NPCDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { campaignId, slug, isDM } = useCampaign();
  const npcId = params.npcId as string;

  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });
  const utils = trpc.useUtils();
  const updateNpc = trpc.npcs.update.useMutation({
    onSuccess: () => void utils.npcs.getById.invalidate({ id: npcId }),
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });
  const deleteNpc = trpc.npcs.delete.useMutation({
    onSuccess: () => router.push(`/campaigns/${slug}/npcs`),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (npc.isLoading) {
    return <Skeleton className="h-64 rounded-sm" />;
  }

  if (npc.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-[var(--q-text-danger)] font-medium">Failed to load data</p>
          <p className="text-sm text-[var(--q-text-dim)]">{npc.error?.message || 'An unexpected error occurred'}</p>
          <Button variant="outline" onClick={() => npc.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!npc.data) {
    return <p className="text-[var(--q-text-danger)]">NPC not found</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = npc.data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stats = data.stats as any;

  const statBlockMeta = (stats?.size || stats?.creatureType || stats?.cr || stats?.alignment) ? (
    <span className="text-xs text-[var(--q-text-dim)]">
      {[stats.size, stats.creatureType, stats.alignment, stats.cr ? `CR ${stats.cr}` : null]
        .filter(Boolean)
        .join(' · ')}
    </span>
  ) : undefined;

  const imageBlock = (
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
  )

  const descriptionBlock = data.description ? (
    <NpcCard title="Description">
      <p className="text-sm text-[var(--q-text)] whitespace-pre-wrap">{data.description}</p>
    </NpcCard>
  ) : null

  const secretsBlock = isDM && data.secrets ? (
    <NpcCard title="DM Secrets" amber>
      <p className="text-sm text-[var(--q-text)] whitespace-pre-wrap">{data.secrets}</p>
    </NpcCard>
  ) : null

  return (
    <div className="space-y-6 max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href={`/campaigns/${slug}/npcs`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-[var(--q-font-display)] font-bold tracking-wide text-[var(--q-text)]">{data.name}</h2>
          {data.faction && (
            <Badge variant="outline" className="mt-1 border-[var(--q-border-subtle)] text-[var(--q-text-dim)]">{data.faction}</Badge>
          )}
        </div>
        {isDM && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={data.playerVisible ?? false}
                onCheckedChange={(val) => updateNpc.mutate({ id: npcId, playerVisible: val })}
              />
              <span className="text-xs text-[var(--q-text-dim)]">Visible to players</span>
            </div>
            <ExportToFoundryButton
              type="npc"
              sourceId={npcId}
              sourceName={data.name ?? 'NPC'}
            />
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
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

      {/* Main content — two-column when stats exist on desktop */}
      {stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] items-start gap-6">
          <div className="space-y-6">
            {imageBlock}
            {descriptionBlock}
            {secretsBlock}
            {isDM && (
              <NpcWorldState
                npcId={npcId}
                campaignId={campaignId}
                slug={slug}
                isDM={isDM}
              />
            )}
          </div>

          <NpcCard title="Stat Block" meta={statBlockMeta}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4 text-[var(--q-text)]">
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
              {stats.conditionImmunities && (
                <p><span className="font-semibold">Condition Immunities</span> {stats.conditionImmunities}</p>
              )}
              {stats.damageVulnerabilities && (
                <p><span className="font-semibold">Damage Vulnerabilities</span> {stats.damageVulnerabilities}</p>
              )}
            </div>
            {stats.abilityScores && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center text-sm border-t border-b border-[var(--q-border-subtle)] py-3 mb-4">
                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((ability) => {
                  const key = ability.toLowerCase();
                  const score = stats.abilityScores?.[key] ?? stats[key] ?? '—';
                  const mod = typeof score === 'number' ? Math.floor((score - 10) / 2) : 0;
                  return (
                    <div key={ability}>
                      <div className="font-semibold text-xs text-[var(--q-text-dim)]">
                        {ability}
                      </div>
                      <div className="font-[var(--q-font-mono)] text-lg font-bold tabular-nums text-[var(--q-text)]">{score}</div>
                      <div className="text-xs text-[var(--q-text-faint)]">
                        {typeof score === 'number' ? `(${mod >= 0 ? '+' : ''}${mod})` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {stats.traits && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--q-amber-dim)] mb-1">Traits</p>
                <p className="text-sm whitespace-pre-wrap text-[var(--q-text)]">{stats.traits}</p>
              </div>
            )}
            {stats.actions && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--q-amber-dim)] mb-1">Actions</p>
                <p className="text-sm whitespace-pre-wrap text-[var(--q-text)]">{stats.actions}</p>
              </div>
            )}
            {stats.reactions && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--q-amber-dim)] mb-1">Reactions</p>
                <p className="text-sm whitespace-pre-wrap text-[var(--q-text)]">{stats.reactions}</p>
              </div>
            )}
            {stats.legendaryActions && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--q-amber-dim)] mb-1">Legendary Actions</p>
                <p className="text-sm whitespace-pre-wrap text-[var(--q-text)]">{stats.legendaryActions}</p>
              </div>
            )}
          </NpcCard>
        </div>
      ) : (
        /* No stats — single column stacked layout */
        <div className="space-y-6">
          {imageBlock}
          {descriptionBlock}
          {secretsBlock}
          {isDM && (
            <NpcWorldState
              npcId={npcId}
              campaignId={campaignId}
              slug={slug}
              isDM={isDM}
            />
          )}
        </div>
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
      <NpcEditSheet npcId={npcId} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
