'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { GapsList } from '@/components/brain/gaps-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PressureGauges } from '@/components/brain/pressure-gauges';
import { HookList } from '@/components/brain/hook-list';
import { HookDetailDrawer } from '@/components/brain/hook-detail-drawer';
import { ThreatTrajectoryCard } from '@/components/brain/threat-trajectory-card';
import { BrainQueryPanel } from '@/components/brain/brain-query-panel';
import { EntityCard } from '@/components/brain/entity-card';
import { EntityGraph } from '@/components/brain/entity-graph';
import { SessionTimeline } from '@/components/brain/session-timeline';
import { ContinuityWarnings } from '@/components/brain/continuity-warnings';
import { Brain, ChevronRight, Sprout, Upload, CheckCircle, XCircle, GitMerge, LayoutDashboard, Network, Clock, AlertTriangle, Zap, FileQuestion } from 'lucide-react';
import { SessionSeedCard } from '@/components/brain/session-seed';
import { useState } from 'react';
import { toast } from 'sonner';
import { WorldEntityType } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

type Hook = {
  id: string;
  text: string;
  urgency: 'low' | 'medium' | 'high';
  status?: string;
  ageInSessions?: number;
  linkedEntityNames?: string[];
  createdSessionId?: string | null | undefined;
};

export default function BrainPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestType, setIngestType] = useState<'pdf' | 'image' | 'text'>('text');
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestLabel, setIngestLabel] = useState('');
  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);
  const [hookDrawerOpen, setHookDrawerOpen] = useState(false);

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
  const relationshipsQuery = trpc.brain.relationships.list.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );
  const warningsQuery = trpc.brain.continuityWarnings.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 120_000 }
  );
  const gapsQuery = trpc.brain.gaps.list.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );
  const gaps = gapsQuery.data ?? [];
  const sessionsQuery = trpc.sessions.getAll.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );
  const pressureHistoryQuery = trpc.brain.pressureHistory.list.useQuery(
    { campaignId, limit: 7 },
    { enabled: isDM, staleTime: 120_000 }
  );
  const pendingEventsQuery = trpc.brain.events.pending.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 30_000 }
  );
  const proposalsQuery = trpc.brain.worldSimulation.proposals.list.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 30_000 }
  );
  const mergeCandidatesQuery = trpc.brain.mergeCandidates.list.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 30_000 }
  );

  const seedMutation = trpc.brain.seedFromExisting.useMutation({
    onSuccess: (result) => {
      toast.success(`Seeded ${result.npcsSeeded} NPCs and ${result.charactersSeeded} characters.`);
      entitiesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const ingestSourcesQuery = trpc.brain.ingest.sources.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 30_000 }
  );

  const ingestDocumentMutation = trpc.brain.ingest.document.useMutation({
    onSuccess: () => {
      toast.success('Document queued for ingestion.');
      setIngestOpen(false);
      setIngestUrl('');
      setIngestContent('');
      setIngestLabel('');
      ingestSourcesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMergeMutation = trpc.brain.mergeCandidates.approve.useMutation({
    onSuccess: () => {
      toast.success('Entities merged.');
      mergeCandidatesQuery.refetch();
      entitiesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMergeMutation = trpc.brain.mergeCandidates.reject.useMutation({
    onSuccess: () => {
      toast.success('Merge rejected — will not suggest again.');
      mergeCandidatesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveProposalMutation = trpc.brain.worldSimulation.proposals.approve.useMutation({
    onSuccess: () => {
      toast.success('Events approved.');
      proposalsQuery.refetch();
      pendingEventsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectProposalMutation = trpc.brain.worldSimulation.proposals.reject.useMutation({
    onSuccess: () => {
      toast.success('Proposal rejected.');
      proposalsQuery.refetch();
      pendingEventsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isDM) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Brain className="mx-auto h-12 w-12 text-[var(--q-text-dim)]/40 mb-4" />
        <p className="text-[var(--q-text-dim)]">DM Brain is only accessible to Dungeon Masters.</p>
      </div>
    );
  }

  const state = stateQuery.data;
  const entities = entitiesQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];
  const relationships = relationshipsQuery.data ?? [];
  const warnings = warningsQuery.data ?? [];
  const pressureHistory = pressureHistoryQuery.data ?? [];

  const hooks: Hook[] = Array.isArray((state as { hooks?: unknown })?.hooks)
    ? (state as { hooks: unknown[] }).hooks as Hook[]
    : [];

  const typeCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  const recentEntities = entities.slice(0, 6);
  const hasEntities = entities.length > 0;

  const threatEntities = entities.filter(
    (e) =>
      e.type === WorldEntityType.THREAT &&
      (e.properties as Record<string, unknown>)?.['trajectory'] != null
  );

  const rawSessions = (sessionsQuery.data ?? []) as Array<{ id: string; sessionNumber: number; title?: string | null; date: Date | string }>;
  const sessionList = rawSessions.map(s => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    title: s.title ?? null,
    date: new Date(s.date),
  }));

  const appearanceData = entities.flatMap(entity => {
    const firstSeen = entity.firstSeenSessionId
      ? sessionList.find(s => s.id === entity.firstSeenSessionId)
      : undefined;
    const lastSeen = entity.lastSeenSessionId && entity.lastSeenSessionId !== entity.firstSeenSessionId
      ? sessionList.find(s => s.id === entity.lastSeenSessionId)
      : undefined;

    const result = [];
    if (firstSeen) result.push({ session: firstSeen, entity });
    if (lastSeen) result.push({ session: lastSeen, entity });
    return result;
  });

  const pendingEventCount =
    (pendingEventsQuery.data?.proposals.length ?? 0) +
    (pendingEventsQuery.data?.mergeCandidates.length ?? 0);

  function openHookDrawer(hook: Hook) {
    setSelectedHook(hook);
    setHookDrawerOpen(true);
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <p className="label-overline mb-1">Campaign</p>
        <div className="section-rule" />
        <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
          DM Brain
        </h1>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIngestOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4" />
          Ingest Document
        </Button>
        {!hasEntities && (
          <Button
            data-testid="seed-from-existing-btn"
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

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview"><LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="graph"><Network className="h-3.5 w-3.5 mr-1.5" />Graph</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="h-3.5 w-3.5 mr-1.5" />Timeline</TabsTrigger>
          <TabsTrigger value="warnings">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Warnings
            {warnings.length > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive/80 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {warnings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <FileQuestion className="h-3.5 w-3.5 mr-1.5" />Gaps
            {gaps.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--q-amber)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {gaps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">
            <Zap className="h-3.5 w-3.5 mr-1.5" />Events
            {pendingEventCount > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--q-amber)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {pendingEventCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="merge">
            <GitMerge className="h-3.5 w-3.5 mr-1.5" />Merge Queue
            {(mergeCandidatesQuery.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--q-amber)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {mergeCandidatesQuery.data!.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column — pressures + hooks */}
            <div className="space-y-6 lg:col-span-2">
              {/* Session Seed — Major Developments */}
              <SessionSeedCard campaignId={campaignId} />
              {/* Pressure Gauges */}
              <div className="stone-card">
                <div className="stone-card-header">
                  <span className="stone-card-title">World Pressure</span>
                </div>
                <div className="stone-card-body">
                  {stateQuery.isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-5 w-full rounded" />
                      ))}
                    </div>
                  ) : stateQuery.isError ? (
                    <p className="text-sm text-[var(--q-text-dim)]">Failed to load world state.</p>
                  ) : state ? (
                    <PressureGauges
                      state={state}
                      history={pressureHistory.length >= 2 ? pressureHistory : undefined}
                    />
                  ) : null}
                </div>
              </div>

              {/* Open Hooks */}
              <div className="stone-card">
                <div className="stone-card-header">
                  <span className="stone-card-title">Open Hooks</span>
                </div>
                <div className="stone-card-body">
                  {stateQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  ) : (
                    <HookList hooks={hooks} onSelect={openHookDrawer} />
                  )}
                </div>
              </div>

              {/* Recent Entities */}
              <div className="stone-card">
                <div className="stone-card-header">
                  <span className="stone-card-title">Entities</span>
                  <Link
                    href={`/campaigns/${slug}/brain/entities`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View all
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="stone-card-body space-y-4">
                  {entitiesQuery.isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                      ))}
                    </div>
                  ) : !hasEntities ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-[var(--q-text-dim)] mb-4">
                        No entities tracked yet. Seed from existing NPCs and characters to get started.
                      </p>
                      <Button
                        data-testid="seed-from-existing-btn"
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
                </div>
              </div>
            </div>

            {/* Right column — stats + timeline + threats */}
            <div className="space-y-6">
              {/* Entity counts */}
              <div className="stone-card">
                <div className="stone-card-header">
                  <span className="stone-card-title">Entity Counts</span>
                </div>
                <div className="stone-card-body">
                  {entitiesQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-5 w-full rounded" />
                      ))}
                    </div>
                  ) : Object.keys(typeCounts).length === 0 ? (
                    <p className="text-sm text-[var(--q-text-dim)] italic">No entities yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {Object.entries(typeCounts).map(([type, count]) => (
                        <li key={type} className="flex items-center justify-between">
                          <Link
                            href={`/campaigns/${slug}/brain/entities?type=${type}`}
                            className="text-sm text-[var(--q-text-dim)] hover:text-foreground transition-colors"
                          >
                            {TYPE_LABELS[type] ?? type}
                          </Link>
                          <span className="text-sm font-mono tabular-nums text-foreground">{count}</span>
                        </li>
                      ))}
                      <div className="section-rule my-1" />
                      <li className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total</span>
                        <span className="text-sm font-mono tabular-nums">{entities.length}</span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Threat Trajectories */}
              {threatEntities.length > 0 && (
                <div className="stone-card">
                  <div className="stone-card-header">
                    <span className="stone-card-title">Threat Trajectories</span>
                  </div>
                  <div className="stone-card-body space-y-2">
                    {threatEntities.map((entity) => (
                      <ThreatTrajectoryCard
                        key={entity.id}
                        entity={{
                          id: entity.id,
                          name: entity.name,
                          properties: entity.properties as Record<string, unknown>,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Timeline */}
              <div className="stone-card">
                <div className="stone-card-header">
                  <span className="stone-card-title">Recent Changes</span>
                </div>
                <div className="stone-card-body">
                  {timelineQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-8 w-full rounded" />
                      ))}
                    </div>
                  ) : timeline.length === 0 ? (
                    <p className="text-sm text-[var(--q-text-dim)] italic">No changes recorded yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {timeline.map((entry) => (
                        <li key={entry.id} className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium capitalize">
                            {entry.changeType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-[var(--q-text-dim)]">
                            {entry.source} &middot;{' '}
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Graph Tab */}
        <TabsContent value="graph">
          <div className="stone-card">
            <div className="stone-card-header">
              <span className="stone-card-title">Entity Relationship Graph</span>
            </div>
            <div className="stone-card-body">
              {entitiesQuery.isLoading || relationshipsQuery.isLoading ? (
                <Skeleton className="h-[500px] w-full rounded-lg" />
              ) : (
                <EntityGraph
                  entities={entities}
                  relationships={relationships}
                  onEntityClick={(entityId) => router.push(`/campaigns/${slug}/brain/entities/${entityId}`)}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <div className="stone-card">
            <div className="stone-card-header">
              <span className="stone-card-title">Entity Appearances by Session</span>
            </div>
            <div className="stone-card-body">
              {entitiesQuery.isLoading || sessionsQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded" />
              ) : (
                <SessionTimeline
                  appearances={appearanceData}
                  sessions={sessionList}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Warnings Tab */}
        <TabsContent value="warnings">
          <div className="stone-card">
            <div className="stone-card-header">
              <span className="stone-card-title">Continuity Warnings</span>
            </div>
            <div className="stone-card-body">
              {warningsQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded" />
                  ))}
                </div>
              ) : (
                <ContinuityWarnings warnings={warnings} campaignSlug={slug} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Gaps Tab */}
        <TabsContent value="gaps">
          <div className="stone-card">
            <div className="stone-card-header">
              <span className="stone-card-title">Entity Gaps</span>
            </div>
            <div className="stone-card-body">
              {gapsQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded" />
                  ))}
                </div>
              ) : (
                <GapsList gaps={gaps} slug={slug} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <div className="space-y-6">
            {/* World Event Proposals */}
            <div className="stone-card">
              <div className="stone-card-header">
                <span className="stone-card-title">World Event Proposals</span>
              </div>
              <div className="stone-card-body">
                {proposalsQuery.isLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded" />)}
                  </div>
                ) : !proposalsQuery.data?.length ? (
                  <p className="text-sm text-[var(--q-text-dim)] italic">No pending proposals.</p>
                ) : (
                  <ul className="space-y-4">
                    {proposalsQuery.data
                      .filter(p => p.status === 'pending')
                      .map((proposal) => {
                        const events = proposal.events as Array<{ id?: string; narrative?: string; proposedEffects?: string[] }>;
                        return (
                          <li key={proposal.id} className="rounded-lg border border-[var(--q-border-subtle)] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {new Date(proposal.createdAt).toLocaleDateString()}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-[var(--q-amber)] border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)]"
                                  disabled={approveProposalMutation.isPending || rejectProposalMutation.isPending}
                                  onClick={() =>
                                    approveProposalMutation.mutate({
                                      campaignId,
                                      proposalId: proposal.id,
                                      eventIds: events.map((e, i) => e.id ?? String(i)),
                                    })
                                  }
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Approve All
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                  disabled={approveProposalMutation.isPending || rejectProposalMutation.isPending}
                                  onClick={() => rejectProposalMutation.mutate({ campaignId, proposalId: proposal.id })}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                            <ul className="space-y-2">
                              {events.map((event, i) => (
                                <li key={i} className="text-sm space-y-1">
                                  {event.narrative && (
                                    <p className="leading-snug">{event.narrative}</p>
                                  )}
                                  {event.proposedEffects && event.proposedEffects.length > 0 && (
                                    <ul className="pl-4 space-y-0.5">
                                      {event.proposedEffects.map((effect, j) => (
                                        <li key={j} className="text-xs text-[var(--q-text-dim)] list-disc">{effect}</li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>

            {/* Merge Candidates */}
            <div className="stone-card">
              <div className="stone-card-header">
                <span className="stone-card-title flex items-center gap-2">
                  <GitMerge className="h-4 w-4" />
                  Entity Merge Candidates
                </span>
              </div>
              <div className="stone-card-body">
                {mergeCandidatesQuery.isLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded" />)}
                  </div>
                ) : !mergeCandidatesQuery.data?.length ? (
                  <p className="text-sm text-[var(--q-text-dim)] italic">No pending merges.</p>
                ) : (
                  <ul className="space-y-3">
                    {mergeCandidatesQuery.data.map((candidate) => (
                      <li key={candidate.id} className="flex items-start justify-between gap-4 rounded-lg border border-[var(--q-border-subtle)] p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{candidate.entityA.name}</span>
                            <span className="text-[var(--q-text-dim)] text-xs">≈</span>
                            <span className="font-medium text-sm">{candidate.entityB.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(candidate.score * 100)}% match
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--q-text-dim)] mt-1">
                            Suggested canonical: <span className="font-mono">{candidate.suggestedCanonical}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[var(--q-amber)] border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)]"
                            disabled={approveMergeMutation.isPending || rejectMergeMutation.isPending}
                            onClick={() => approveMergeMutation.mutate({ campaignId, candidateId: candidate.id })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                            disabled={approveMergeMutation.isPending || rejectMergeMutation.isPending}
                            onClick={() => rejectMergeMutation.mutate({ campaignId, candidateId: candidate.id })}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Keep Separate
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Merge Queue Tab */}
        <TabsContent value="merge">
          <div className="space-y-4">
            <div className="stone-card">
              <div className="stone-card-header">
                <span className="stone-card-title flex items-center gap-2">
                  <GitMerge className="h-4 w-4" />
                  Entity Merge Queue
                </span>
              </div>
              <div className="stone-card-body">
                {mergeCandidatesQuery.isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded" />)}
                  </div>
                ) : !mergeCandidatesQuery.data?.length ? (
                  <p className="text-sm text-[var(--q-text-dim)] italic">No merge candidates pending review.</p>
                ) : (
                  <ul className="space-y-3">
                    {mergeCandidatesQuery.data.map((candidate) => (
                      <li key={candidate.id} className="flex items-start justify-between gap-4 rounded-lg border border-[var(--q-border-subtle)] p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{candidate.entityA.name}</span>
                            <span className="text-[var(--q-text-dim)] text-xs">≈</span>
                            <span className="font-medium text-sm">{candidate.entityB.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(candidate.score * 100)}% match
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--q-text-dim)] mt-1">
                            Suggested canonical: <span className="font-mono">{candidate.suggestedCanonical}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[var(--q-amber)] border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)]"
                            disabled={approveMergeMutation.isPending || rejectMergeMutation.isPending}
                            onClick={() => approveMergeMutation.mutate({ campaignId, candidateId: candidate.id })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                            disabled={approveMergeMutation.isPending || rejectMergeMutation.isPending}
                            onClick={() => rejectMergeMutation.mutate({ campaignId, candidateId: candidate.id })}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Keep Separate
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Ingest Sources history */}
            <div className="stone-card">
              <div className="stone-card-header">
                <span className="stone-card-title">Ingestion History</span>
              </div>
              <div className="stone-card-body">
                {ingestSourcesQuery.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
                  </div>
                ) : !ingestSourcesQuery.data?.length ? (
                  <p className="text-sm text-[var(--q-text-dim)] italic">No ingestion jobs yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {ingestSourcesQuery.data.map((src) => (
                      <li key={src.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">{src.type}</Badge>
                          <span className="truncate text-[var(--q-text-dim)]">{src.sourceLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={src.status === 'done' ? 'default' : src.status === 'failed' ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {src.status}
                          </Badge>
                          <span className="text-[10px] text-[var(--q-text-dim)]">
                            {new Date(src.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Ingest Document Dialog */}
      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ingest Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={ingestType} onValueChange={(v) => setIngestType(v as 'pdf' | 'image' | 'text')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Plain Text / Notes</SelectItem>
                  <SelectItem value="pdf">PDF (URL)</SelectItem>
                  <SelectItem value="image">Image (URL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source Label</Label>
              <Input
                placeholder="e.g. Session 0 notes, Campaign bible"
                value={ingestLabel}
                onChange={(e) => setIngestLabel(e.target.value)}
              />
            </div>
            {ingestType === 'text' ? (
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea
                  placeholder="Paste your notes, backstory, or lore here..."
                  rows={6}
                  value={ingestContent}
                  onChange={(e) => setIngestContent(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>File URL</Label>
                <Input
                  placeholder="https://..."
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIngestOpen(false)}>Cancel</Button>
            <Button
              disabled={ingestDocumentMutation.isPending || !ingestLabel.trim() || (ingestType === 'text' ? !ingestContent.trim() : !ingestUrl.trim())}
              onClick={() =>
                ingestDocumentMutation.mutate({
                  campaignId,
                  type: ingestType,
                  url: ingestType !== 'text' ? ingestUrl : undefined,
                  content: ingestType === 'text' ? ingestContent : undefined,
                  sourceLabel: ingestLabel,
                })
              }
            >
              {ingestDocumentMutation.isPending ? 'Queuing...' : 'Ingest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hook Detail Drawer */}
      {selectedHook && (
        <HookDetailDrawer
          hook={selectedHook}
          campaignId={campaignId}
          campaignSlug={slug}
          open={hookDrawerOpen}
          onClose={() => setHookDrawerOpen(false)}
          onMutated={() => stateQuery.refetch()}
        />
      )}

      {/* Brain Query Panel (Cmd+K) */}
      <BrainQueryPanel campaignId={campaignId} campaignSlug={slug} />
    </div>
  );
}
