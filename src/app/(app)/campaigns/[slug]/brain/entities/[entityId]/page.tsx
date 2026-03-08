'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Brain, ArrowLeft, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { WorldEntityStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = Object.values(WorldEntityStatus);

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  dormant: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  destroyed: 'text-red-400 border-red-400/30 bg-red-400/10',
  resolved: 'text-muted-foreground border-border bg-muted/20',
};

export default function EntityDetailPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = use(params);
  const { campaignId, slug, isDM } = useCampaign();
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<WorldEntityStatus | ''>('');
  const [editDescription, setEditDescription] = useState('');

  const entityQuery = trpc.brain.entities.get.useQuery(
    { entityId, campaignId },
    { enabled: isDM, staleTime: 30_000 }
  );
  const relationshipsQuery = trpc.brain.relationships.list.useQuery(
    { campaignId, entityId },
    { enabled: isDM, staleTime: 30_000 }
  );
  const timelineQuery = trpc.brain.timeline.useQuery(
    { campaignId, limit: 20 },
    { enabled: isDM, staleTime: 30_000 }
  );

  const updateMutation = trpc.brain.entities.update.useMutation({
    onSuccess: () => {
      toast.success('Entity updated.');
      setEditing(false);
      entityQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isDM) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Brain className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">DM Brain is only accessible to Dungeon Masters.</p>
      </div>
    );
  }

  function startEdit(entity: NonNullable<typeof entityQuery.data>) {
    setEditStatus(entity.status);
    setEditDescription(entity.description ?? '');
    setEditing(true);
  }

  function saveEdit(entity: NonNullable<typeof entityQuery.data>) {
    updateMutation.mutate({
      entityId: entity.id,
      campaignId,
      status: editStatus || undefined,
      description: editDescription || undefined,
    });
  }

  const entity = entityQuery.data;
  const relationships = relationshipsQuery.data ?? [];

  // Filter timeline to only changes for this entity
  const entityTimeline = (timelineQuery.data ?? []).filter(
    (entry) => entry.entityId === entityId
  );

  const properties = entity?.properties as Record<string, unknown> | null | undefined;

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/campaigns/${slug}/brain/entities`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Entities
      </Link>

      {entityQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : entityQuery.isError || !entity ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Entity not found.</p>
        </Card>
      ) : (
        <>
          {/* Entity header */}
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">{entity.name}</h2>
                <Badge variant="outline" className="text-xs uppercase tracking-wider">
                  {entity.type}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('text-xs uppercase tracking-wider', statusColors[entity.status] ?? '')}
                >
                  {entity.status}
                </Badge>
              </div>
              {entity.aliases.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Also known as: {entity.aliases.join(', ')}
                </p>
              )}
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => startEdit(entity)}>
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={() => saveEdit(entity)}
                >
                  <Check className="mr-2 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="section-rule" />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Description */}
              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select
                          value={editStatus}
                          onValueChange={(v) => setEditStatus(v as WorldEntityStatus)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={5}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {entity.description ?? (
                        <span className="italic">No description.</span>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Properties */}
              {properties && Object.keys(properties).length > 0 && (
                <Card className="glass-panel">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2">
                      {Object.entries(properties).map(([key, value]) => {
                        if (value == null || value === '') return null;
                        return (
                          <div key={key} className="flex gap-3">
                            <dt className="w-32 shrink-0 text-xs font-medium text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}
                            </dt>
                            <dd className="text-sm">{String(value)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </CardContent>
                </Card>
              )}

              {/* Relationships */}
              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Relationships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {relationshipsQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  ) : relationships.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No relationships recorded.</p>
                  ) : (
                    <ul className="space-y-3">
                      {relationships.map((rel) => {
                        const isFrom = rel.fromEntityId === entityId;
                        const otherEntity = isFrom ? rel.toEntity : rel.fromEntity;
                        return (
                          <li key={rel.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {isFrom ? 'to' : 'from'}
                              </span>
                              <Link
                                href={`/campaigns/${slug}/brain/entities/${otherEntity.id}`}
                                className="text-sm font-medium hover:text-primary transition-colors"
                              >
                                {otherEntity.name}
                              </Link>
                              <Badge variant="outline" className="ml-auto text-[10px]">
                                {rel.type}
                              </Badge>
                            </div>
                            {/* Strength bar */}
                            <div className="h-1 w-full rounded-full bg-muted/40">
                              <div
                                className="h-full rounded-full bg-primary/60"
                                style={{ width: `${rel.strength * 100}%` }}
                              />
                            </div>
                            {rel.description && (
                              <p className="text-xs text-muted-foreground">{rel.description}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: change timeline */}
            <div>
              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Change History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-8 w-full rounded" />
                      ))}
                    </div>
                  ) : entityTimeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No history yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {entityTimeline.map((entry) => (
                        <li key={entry.id}>
                          <Separator className="mb-3" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium capitalize">
                              {entry.changeType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {entry.source} &middot;{' '}
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
