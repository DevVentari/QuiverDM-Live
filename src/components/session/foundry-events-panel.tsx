'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Flame, Heart, ShieldAlert, Swords } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FoundryEventItem = {
  id: string;
  type: 'combat_round' | 'hp_change' | 'actor_death' | 'combat_start' | 'combat_end' | string;
  payload: Record<string, unknown>;
  createdAt: Date | string;
};

function getEventLabel(event: FoundryEventItem): string {
  const payload = event.payload ?? {};

  if (event.type === 'combat_round') {
    const round = typeof payload.round === 'number' ? payload.round : '?';
    return `Combat round ${round}`;
  }

  if (event.type === 'hp_change') {
    const actorName = typeof payload.actorName === 'string' ? payload.actorName : 'Actor';
    const hpBefore = typeof payload.hpBefore === 'number' ? payload.hpBefore : '?';
    const hpAfter = typeof payload.hpAfter === 'number' ? payload.hpAfter : '?';
    return `${actorName}: ${hpBefore} -> ${hpAfter} HP`;
  }

  if (event.type === 'actor_death') {
    const actorName = typeof payload.actorName === 'string' ? payload.actorName : 'Actor';
    return `${actorName} died`;
  }

  if (event.type === 'combat_start') {
    return 'Combat started';
  }

  if (event.type === 'combat_end') {
    return 'Combat ended';
  }

  return event.type;
}

function EventIcon({ type }: { type: FoundryEventItem['type'] }) {
  if (type === 'hp_change') return <Heart className="h-3.5 w-3.5 text-rose-400" />;
  if (type === 'actor_death') return <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />;
  if (type === 'combat_start' || type === 'combat_end') return <Swords className="h-3.5 w-3.5 text-amber-400" />;
  return <Flame className="h-3.5 w-3.5 text-primary" />;
}

export function FoundryEventsPanel({
  campaignId,
  sessionId,
  campaignSlug,
}: {
  campaignId: string;
  sessionId: string;
  campaignSlug: string;
}) {
  const foundryEnabled = process.env.NEXT_PUBLIC_FOUNDRY_BRIDGE_ENABLED === 'true';
  const [liveEvents, setLiveEvents] = useState<FoundryEventItem[]>([]);

  const eventsQuery = trpc.foundry.getEvents.useQuery(
    { campaignId, sessionId, limit: 20 },
    { enabled: foundryEnabled, staleTime: 10_000 }
  );

  useEffect(() => {
    if (!foundryEnabled) {
      return;
    }

    const source = new EventSource(`/api/sessions/${sessionId}/foundry-stream`);

    source.addEventListener('foundry_events', (event) => {
      try {
        const data = JSON.parse(event.data) as FoundryEventItem[];
        setLiveEvents((previous) => [...data, ...previous].slice(0, 100));
      } catch {
        // No-op for malformed payloads.
      }
    });

    return () => {
      source.close();
    };
  }, [foundryEnabled, sessionId]);

  const mergedEvents = useMemo(() => {
    const initialEvents = (eventsQuery.data?.items ?? []) as FoundryEventItem[];
    const deduped = new Map<string, FoundryEventItem>();

    [...liveEvents, ...initialEvents].forEach((event) => {
      deduped.set(event.id, event);
    });

    return Array.from(deduped.values()).sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
  }, [eventsQuery.data?.items, liveEvents]);

  if (!foundryEnabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Foundry Events</CardTitle>
      </CardHeader>
      <CardContent>
        {mergedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Connect Foundry VTT to see live combat events here.{' '}
            <Link href={`/campaigns/${campaignSlug}/settings`} className="underline underline-offset-2">
              Open campaign settings
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {mergedEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-border bg-muted/25 px-2.5 py-2">
                <div className="flex items-start gap-2">
                  <EventIcon type={event.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{getEventLabel(event)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(event.createdAt), 'MMM d, h:mm:ss a')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
