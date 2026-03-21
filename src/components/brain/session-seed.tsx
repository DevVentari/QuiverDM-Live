'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RefreshCw, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-context';

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface ProposedEvent {
  id: string;
  actorId: string | null;
  description: string;
  effects: unknown[];
  approved: boolean | null;
}

export function SessionSeedCard({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const { slug } = useCampaign();
  const utils = trpc.useUtils();

  const { data: events, isLoading: eventsLoading } = trpc.brain.worldSimulation.sessionSeed.useQuery(
    { campaignId },
    { staleTime: 60_000 }
  );

  const { data: proposals, isLoading: proposalsLoading } = trpc.brain.worldSimulation.proposals.list.useQuery(
    { campaignId },
    { staleTime: 30_000 }
  );

  const isLoading = eventsLoading || proposalsLoading;

  const pendingProposal = proposals?.find(p => p.status === 'pending');
  const pendingEvents = pendingProposal
    ? (pendingProposal.events as unknown as ProposedEvent[])
    : [];

  const runTick = trpc.brain.worldSimulation.runTick.useMutation({
    onSuccess: () => {
      void utils.brain.worldSimulation.sessionSeed.invalidate({ campaignId });
      void utils.brain.worldSimulation.proposals.list.invalidate({ campaignId });
      toast({ title: 'World tick complete', description: 'New story developments generated.' });
    },
    onError: (e) => toast({ title: 'Tick failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="glass-panel" data-testid="session-seed-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Major Developments
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => runTick.mutate({ campaignId })}
            disabled={runTick.isPending}
            data-testid="run-tick-button"
          >
            {runTick.isPending
              ? <><RefreshCw className="h-3 w-3 animate-spin" /> Running…</>
              : <><RefreshCw className="h-3 w-3" /> Run Tick</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingProposal && pendingEvents.length > 0 && (
              <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {pendingEvents.length} event{pendingEvents.length !== 1 ? 's' : ''} awaiting review
                  </span>
                  <Link
                    href={`/campaigns/${slug}/brain/events`}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Review Events <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {pendingEvents.slice(0, 3).map((event) => (
                    <li key={event.id} className="text-xs text-muted-foreground leading-snug border-l border-primary/30 pl-2">
                      {event.description}
                    </li>
                  ))}
                  {pendingEvents.length > 3 && (
                    <li className="text-xs text-muted-foreground pl-2">
                      +{pendingEvents.length - 3} more…
                    </li>
                  )}
                </ul>
              </div>
            )}

            {!events || events.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No simulations run yet.
                </p>
                <Button
                  size="sm"
                  onClick={() => runTick.mutate({ campaignId })}
                  disabled={runTick.isPending}
                >
                  {runTick.isPending
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…</>
                    : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run World Tick</>}
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3">
                    <span className="text-sm leading-snug">{event.description}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
