'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';

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
  const { data: events, isLoading } = trpc.brain.worldSimulation.sessionSeed.useQuery(
    { campaignId },
    { staleTime: 60_000 }
  );

  return (
    <Card className="glass-panel" data-testid="session-seed-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Major Developments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No simulations run yet. Run a world tick to generate story developments.
          </p>
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
