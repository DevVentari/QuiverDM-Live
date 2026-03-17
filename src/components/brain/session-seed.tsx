'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RefreshCw } from 'lucide-react';

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

export function SessionSeedCard({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: events, isLoading } = trpc.brain.worldSimulation.sessionSeed.useQuery(
    { campaignId },
    { staleTime: 60_000 }
  );

  const runTick = trpc.brain.worldSimulation.runTick.useMutation({
    onSuccess: () => {
      void utils.brain.worldSimulation.sessionSeed.invalidate({ campaignId });
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
        ) : !events || events.length === 0 ? (
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
      </CardContent>
    </Card>
  );
}
