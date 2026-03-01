'use client';

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Zap } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface PendingEventsQueueProps {
  campaignId: string;
  sessionId: string;
}

export function PendingEventsQueue({ campaignId, sessionId }: PendingEventsQueueProps) {
  const utils = trpc.useUtils();
  const { data: events = [] } = trpc.sessions.getSessionEvents.useQuery(
    { campaignId, sessionId },
    { refetchInterval: 10_000 }
  );
  const reviewEvent = trpc.sessions.reviewEvent.useMutation({
    onSuccess: () => utils.sessions.getSessionEvents.invalidate({ campaignId, sessionId }),
  });

  const pending = events.filter((e) => e.status === 'pending');
  const autoApplied = events.filter((e) => e.status === 'auto_applied').length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Zap className="h-4 w-4" />
          {pending.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center bg-amber-500">
              {pending.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Session Events
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {autoApplied > 0 && (
            <p className="text-xs text-muted-foreground">{autoApplied} events auto-applied</p>
          )}
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending events</p>
          )}
          {pending.map((event) => (
            <div key={event.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs capitalize">
                  {event.eventType.replace(/_/g, ' ')}
                </Badge>
                {event.characterName && (
                  <span className="text-sm font-medium">{event.characterName}</span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {Math.round(event.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {JSON.stringify(event.eventData)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" className="h-7 text-xs flex-1"
                  onClick={() => reviewEvent.mutate({ campaignId, eventId: event.id, action: 'confirm' })}
                  disabled={reviewEvent.isPending}
                >
                  <Check className="h-3 w-3 mr-1" /> Apply
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => reviewEvent.mutate({ campaignId, eventId: event.id, action: 'reject' })}
                  disabled={reviewEvent.isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
