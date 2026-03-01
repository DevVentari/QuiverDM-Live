'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, GitCommit } from 'lucide-react';

interface SessionEventsReviewProps {
  campaignId: string;
  sessionId: string;
}

export function SessionEventsReview({ campaignId, sessionId }: SessionEventsReviewProps) {
  const utils = trpc.useUtils();
  const { data: events = [], isLoading } = trpc.sessions.getSessionEvents.useQuery({ campaignId, sessionId });
  const reviewEvent = trpc.sessions.reviewEvent.useMutation({
    onSuccess: () => utils.sessions.getSessionEvents.invalidate({ campaignId, sessionId }),
  });
  const commitEvents = trpc.sessions.commitSessionEvents.useMutation({
    onSuccess: () => utils.sessions.getSessionEvents.invalidate({ campaignId, sessionId }),
  });

  const pending = events.filter((e) => e.status === 'pending');
  const autoApplied = events.filter((e) => e.status === 'auto_applied');

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading events...</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground p-4">No mechanical events recorded for this session.</p>;

  return (
    <div className="space-y-6 p-4">
      {autoApplied.length > 0 && (
        <div className="space-y-2">
          <h3 className="label-overline text-muted-foreground">Auto-Applied ({autoApplied.length})</h3>
          <div className="space-y-1.5">
            {autoApplied.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm opacity-60">
                <Badge variant="secondary" className="text-xs capitalize shrink-0">
                  {e.eventType.replace(/_/g, ' ')}
                </Badge>
                <span className="text-muted-foreground">{e.characterName ?? 'all'}</span>
                <span className="text-xs truncate">{JSON.stringify(e.eventData)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="label-overline">Needs Review ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((e) => (
              <div key={e.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">
                    {e.eventType.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-sm font-medium">{e.characterName ?? 'all'}</span>
                  <span className="text-xs text-muted-foreground truncate">{JSON.stringify(e.eventData)}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{Math.round(e.confidence * 100)}%</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => reviewEvent.mutate({ campaignId, eventId: e.id, action: 'confirm' })}
                    disabled={reviewEvent.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" /> Apply
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                    onClick={() => reviewEvent.mutate({ campaignId, eventId: e.id, action: 'reject' })}
                    disabled={reviewEvent.isPending}
                  >
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t">
        <Button
          onClick={() => commitEvents.mutate({ campaignId, sessionId })}
          disabled={commitEvents.isPending}
          className="w-full sm:w-auto"
        >
          <GitCommit className="h-4 w-4 mr-2" />
          Commit to Character Sheets
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Permanently applies confirmed events to character records.
        </p>
      </div>
    </div>
  );
}
