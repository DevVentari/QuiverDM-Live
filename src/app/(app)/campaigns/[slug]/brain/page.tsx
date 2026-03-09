'use client';

import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { PressureGauges } from '@/components/brain/pressure-gauges';
import { HookList } from '@/components/brain/hook-list';
import { EntityCard } from '@/components/brain/entity-card';
import { Brain, ChevronRight, Sprout } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { WorldEntityType } from '@prisma/client';

const TYPE_LABELS: Record<string, string> = {
  NPC: 'NPCs',
  PC: 'PCs',
  FACTION: 'Factions',
  LOCATION: 'Locations',
  THREAT: 'Threats',
  ITEM: 'Items',
  ARC: 'Arcs',
  EVENT: 'Events',
  SECRET: 'Secrets',
  CUSTOM: 'Custom',
};

export default function BrainPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const [seeding, setSeeding] = useState(false);

  const stateQuery = trpc.brain.state.get.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );
  const entitiesQuery = trpc.brain.entities.list.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );
  const timelineQuery = trpc.brain.timeline.useQuery(
    { campaignId, limit: 10 },
    { enabled: isDM, staleTime: 60_000 }
  );

  const seedMutation = trpc.brain.seedFromExisting.useMutation({
    onSuccess: (result) => {
      toast.success(`Seeded ${result.npcsSeeded} NPCs and ${result.charactersSeeded} characters.`);
      entitiesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const stateUpdateMutation = trpc.brain.state.update.useMutation({
    onSuccess: () => stateQuery.refetch(),
  });

  if (!isDM) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Brain className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">DM Brain is only accessible to Dungeon Masters.</p>
      </div>
    );
  }

  const state = stateQuery.data;
  const entities = entitiesQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];

  const hooks: Array<{ id: string; text: string; urgency: 'low' | 'medium' | 'high'; status?: string }> =
    Array.isArray((state as { hooks?: unknown })?.hooks) ? (state as { hooks: unknown[] }).hooks as Array<{ id: string; text: string; urgency: 'low' | 'medium' | 'high'; status?: string }> : [];

  const typeCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  const recentEntities = entities.slice(0, 6);
  const hasEntities = entities.length > 0;

  function handleResolveHook(hookId: string) {
    if (!state) return;
    const updatedHooks = hooks.map((h) =>
      h.id === hookId ? { ...h, status: 'resolved' } : h
    );
    stateUpdateMutation.mutate({ campaignId, hooks: updatedHooks });
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="label-overline">World State Intelligence</p>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            DM Brain
          </h2>
        </div>
        {!hasEntities && (
          <Button
            size="sm"
            variant="outline"
            disabled={seeding || seedMutation.isPending}
            onClick={() => {
              setSeeding(true);
              seedMutation.mutate({ campaignId }, { onSettled: () => setSeeding(false) });
            }}
          >
            <Sprout className="mr-2 h-4 w-4" />
            Seed from Existing
          </Button>
        )}
      </div>

      <div className="section-rule" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — pressures + hooks */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pressure Gauges */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                World Pressure
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stateQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-5 w-full rounded" />
                  ))}
                </div>
              ) : stateQuery.isError ? (
                <p className="text-sm text-muted-foreground">Failed to load world state.</p>
              ) : state ? (
                <PressureGauges state={state} />
              ) : null}
            </CardContent>
          </Card>

          {/* Open Hooks */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Open Hooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stateQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                  ))}
                </div>
              ) : (
                <HookList hooks={hooks.slice(0, 5)} onResolve={handleResolveHook} />
              )}
            </CardContent>
          </Card>

          {/* Recent Entities */}
          <Card className="glass-panel">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Entities
              </CardTitle>
              <Link
                href={`/campaigns/${slug}/brain/entities`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View all
                <ChevronRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {entitiesQuery.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : !hasEntities ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No entities tracked yet. Seed from existing NPCs and characters to get started.
                  </p>
                  <Button
                    size="sm"
                    disabled={seedMutation.isPending}
                    onClick={() => seedMutation.mutate({ campaignId })}
                  >
                    <Sprout className="mr-2 h-4 w-4" />
                    Seed from Existing
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentEntities.map((entity) => (
                    <EntityCard
                      key={entity.id}
                      entity={entity}
                      href={`/campaigns/${slug}/brain/entities/${entity.id}`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — stats + timeline */}
        <div className="space-y-6">
          {/* Entity counts */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Entity Counts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entitiesQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-5 w-full rounded" />
                  ))}
                </div>
              ) : Object.keys(typeCounts).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No entities yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <li key={type} className="flex items-center justify-between">
                      <Link
                        href={`/campaigns/${slug}/brain/entities?type=${type}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {TYPE_LABELS[type] ?? type}
                      </Link>
                      <span className="text-sm font-mono tabular-nums text-foreground">{count}</span>
                    </li>
                  ))}
                  <Separator className="my-1" />
                  <li className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-sm font-mono tabular-nums">{entities.length}</span>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Timeline */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timelineQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))}
                </div>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No changes recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium capitalize">
                        {entry.changeType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.source} &middot;{' '}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
