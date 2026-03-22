'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WorldEntityStatus } from '@prisma/client';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type EntityDetailSheetProps = {
  entityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STATUS_OPTIONS = Object.values(WorldEntityStatus);

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  dormant: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  destroyed: 'text-red-400 border-red-400/30 bg-red-400/10',
  resolved: 'text-muted-foreground border-border bg-muted/20',
};

const typeColors: Record<string, string> = {
  NPC: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  PC: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
  FACTION: 'text-violet-400 border-violet-400/30 bg-violet-400/10',
  LOCATION: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  THREAT: 'text-red-400 border-red-400/30 bg-red-400/10',
  ITEM: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  ARC: 'text-pink-400 border-pink-400/30 bg-pink-400/10',
  EVENT: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  SECRET: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  CUSTOM: 'text-muted-foreground border-border bg-muted/20',
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let label: string;
  let className: string;

  if (confidence >= 0.9) {
    label = 'Confirmed';
    className = 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
  } else if (confidence >= 0.7) {
    label = 'Inferred';
    className = 'text-amber-500 border-amber-500/30 bg-amber-500/10';
  } else {
    label = 'Uncertain';
    className = 'text-destructive border-destructive/30 bg-destructive/10';
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs uppercase tracking-wider', className)}
      title="Confidence reflects how consistently this entity has been identified across sessions."
    >
      {label}
    </Badge>
  );
}

export function EntityDetailSheet({ entityId, open, onOpenChange }: EntityDetailSheetProps) {
  const { campaignId, isDM } = useCampaign();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editStatus, setEditStatus] = useState<WorldEntityStatus | ''>('');

  const shouldFetch = !!entityId && open && isDM;

  const entityQuery = trpc.brain.entities.get.useQuery(
    { entityId: entityId ?? '', campaignId },
    { enabled: shouldFetch, staleTime: 30_000 }
  );
  const relationshipsQuery = trpc.brain.relationships.list.useQuery(
    { campaignId, entityId: entityId ?? undefined },
    { enabled: shouldFetch, staleTime: 30_000 }
  );
  const timelineQuery = trpc.brain.timeline.useQuery(
    { campaignId, entityId: entityId ?? undefined, limit: 20 },
    { enabled: shouldFetch, staleTime: 30_000 }
  );

  const updateMutation = trpc.brain.entities.update.useMutation({
    onSuccess: () => {
      toast.success('Entity status updated.');
      entityQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      if (entityQuery.data?.status) {
        setEditStatus(entityQuery.data.status);
      }
    },
  });

  useEffect(() => {
    if (entityQuery.data?.status) {
      setEditStatus(entityQuery.data.status);
    }
  }, [entityQuery.data?.id, entityQuery.data?.status]);

  const entity = entityQuery.data;
  const relationships = relationshipsQuery.data ?? [];
  const entityTimeline = timelineQuery.data ?? [];
  const properties = entity?.properties as Record<string, unknown> | null | undefined;

  const outgoingRelationships = useMemo(
    () => relationships.filter((rel) => rel.fromEntityId === entityId),
    [relationships, entityId]
  );
  const incomingRelationships = useMemo(
    () => relationships.filter((rel) => rel.toEntityId === entityId),
    [relationships, entityId]
  );

  const hasProperties = !!properties && Object.keys(properties).length > 0;

  function openRelatedEntity(nextEntityId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('entity', nextEntityId);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function updateStatus(nextStatus: string) {
    const status = nextStatus as WorldEntityStatus;
    setEditStatus(status);
    if (!entity) return;

    updateMutation.mutate({
      entityId: entity.id,
      campaignId,
      status,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {!isDM ? (
          <div className="pt-6">
            <p className="text-sm text-muted-foreground">DM Brain is only accessible to Dungeon Masters.</p>
          </div>
        ) : entityQuery.isLoading ? (
          <div className="space-y-5 pt-2">
            <Skeleton className="h-8 w-56 rounded" />
            <Skeleton className="h-5 w-72 rounded" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : entityQuery.isError ? (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Failed to load entity details.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                entityQuery.refetch();
                relationshipsQuery.refetch();
                timelineQuery.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : !entity ? (
          <p className="pt-2 text-sm text-muted-foreground">Entity not found.</p>
        ) : (
          <div className="space-y-4">
            <SheetHeader className="space-y-3">
              <p className="label-overline">DM Brain</p>
              <SheetTitle className="text-xl">{entity.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs uppercase tracking-wider', typeColors[entity.type] ?? typeColors.CUSTOM)}
                >
                  {entity.type}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('text-xs uppercase tracking-wider', statusColors[entity.status] ?? statusColors.resolved)}
                >
                  {entity.status}
                </Badge>
                <ConfidenceBadge confidence={entity.confidence} />
              </div>
              {entity.aliases.length > 0 && (
                <p className="text-sm text-muted-foreground">Also known as: {entity.aliases.join(', ')}</p>
              )}
              <div className="section-rule" />
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="entity-status-select" className="label-overline text-muted-foreground">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={updateStatus}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="entity-status-select" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SheetHeader>

            <section className="glass-panel glass-grain rounded-lg border border-border/50 p-4">
              <p className="label-overline">Description</p>
              <div className="section-rule mt-2" />
              <p className="pt-2 text-sm text-muted-foreground leading-relaxed">
                {entity.description ?? <span className="italic">No description.</span>}
              </p>
            </section>

            <Accordion type="single" collapsible defaultValue={hasProperties ? 'properties' : undefined}>
              <AccordionItem value="properties" className="glass-panel glass-grain rounded-lg border border-border/50 px-4">
                <AccordionTrigger className="label-overline text-muted-foreground">Properties</AccordionTrigger>
                <AccordionContent>
                  {!hasProperties ? (
                    <p className="text-sm text-muted-foreground italic">No properties recorded.</p>
                  ) : (
                    <dl className="space-y-2">
                      {Object.entries(properties).map(([key, value]) => {
                        if (value == null || value === '') return null;
                        return (
                          <div key={key} className="flex gap-3">
                            <dt className="w-36 shrink-0 text-xs font-medium text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}
                            </dt>
                            <dd className="text-sm">{String(value)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible defaultValue="relationships">
              <AccordionItem value="relationships" className="glass-panel glass-grain rounded-lg border border-border/50 px-4">
                <AccordionTrigger className="label-overline text-muted-foreground">Relationships</AccordionTrigger>
                <AccordionContent>
                  {relationshipsQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  ) : relationships.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No relationships recorded.</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="label-overline">From this entity</p>
                        <div className="section-rule mt-2" />
                        {outgoingRelationships.length === 0 ? (
                          <p className="pt-2 text-sm text-muted-foreground italic">No outgoing relationships.</p>
                        ) : (
                          <ul className="space-y-3 pt-2">
                            {outgoingRelationships.map((rel) => (
                              <li key={rel.id} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => openRelatedEntity(rel.toEntity.id)}
                                  className="text-sm font-medium hover:text-primary transition-colors"
                                >
                                  {rel.toEntity.name}
                                </button>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{rel.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{Math.round(rel.strength * 100)}%</span>
                                </div>
                                <div className="h-1 w-full rounded-full bg-muted/40">
                                  <div
                                    className="h-full rounded-full bg-primary/60"
                                    style={{ width: `${rel.strength * 100}%` }}
                                  />
                                </div>
                                {rel.description && <p className="text-xs text-muted-foreground">{rel.description}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <p className="label-overline">To this entity</p>
                        <div className="section-rule mt-2" />
                        {incomingRelationships.length === 0 ? (
                          <p className="pt-2 text-sm text-muted-foreground italic">No incoming relationships.</p>
                        ) : (
                          <ul className="space-y-3 pt-2">
                            {incomingRelationships.map((rel) => (
                              <li key={rel.id} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => openRelatedEntity(rel.fromEntity.id)}
                                  className="text-sm font-medium hover:text-primary transition-colors"
                                >
                                  {rel.fromEntity.name}
                                </button>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{rel.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{Math.round(rel.strength * 100)}%</span>
                                </div>
                                <div className="h-1 w-full rounded-full bg-muted/40">
                                  <div
                                    className="h-full rounded-full bg-primary/60"
                                    style={{ width: `${rel.strength * 100}%` }}
                                  />
                                </div>
                                {rel.description && <p className="text-xs text-muted-foreground">{rel.description}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {entityTimeline.length > 0 && (
              <Accordion type="single" collapsible defaultValue="history">
                <AccordionItem value="history" className="glass-panel glass-grain rounded-lg border border-border/50 px-4">
                  <AccordionTrigger className="label-overline text-muted-foreground">State Changes</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-3">
                      {entityTimeline.map((entry) => (
                        <li key={entry.id}>
                          <Separator className="mb-3" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium capitalize">
                              {entry.changeType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {entry.source} &middot; {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
