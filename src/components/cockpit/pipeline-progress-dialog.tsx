'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react';

type PipelineStage = {
  label: string;
  status: 'pending' | 'processing' | 'done' | 'error';
};

function StageIcon({ status }: { status: PipelineStage['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === 'error') return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (status === 'processing') return <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}

interface PipelineProgressDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  campaignId: string;
  slug: string;
}

export function PipelineProgressDialog({
  open,
  onClose,
  sessionId,
  campaignId,
  slug,
}: PipelineProgressDialogProps) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const TIMEOUT_MS = 3 * 60 * 1000;

  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => setStartedAt(Date.now()),
    onError: () => setConfirmed(false),
  });

  const sessionQuery = trpc.sessions.getById.useQuery(
    { id: sessionId },
    { enabled: confirmed && !!startedAt, refetchInterval: 3000, staleTime: 0 }
  );

  const worldStateQuery = trpc.brain.state.get.useQuery(
    { campaignId },
    { enabled: confirmed && !!startedAt, refetchInterval: 5000, staleTime: 0 }
  );

  const session = sessionQuery.data as any;
  const worldState = worldStateQuery.data as any;

  const timedOut = startedAt ? Date.now() - startedAt > TIMEOUT_MS : false;

  const stages: PipelineStage[] =
    confirmed && startedAt
      ? [
          { label: 'Session complete', status: 'done' },
          {
            label: 'AI Summary',
            status:
              session?.aiSummaryStatus === 'done'
                ? 'done'
                : session?.aiSummaryStatus === 'error'
                  ? 'error'
                  : session?.aiSummaryStatus === 'processing'
                    ? 'processing'
                    : 'pending',
          },
          {
            label: 'Player Recap',
            status:
              session?.playerRecapStatus === 'done'
                ? 'done'
                : session?.playerRecapStatus === 'error'
                  ? 'error'
                  : session?.playerRecapStatus === 'pending'
                    ? 'processing'
                    : 'pending',
          },
          {
            label: 'Derailment Analysis',
            status:
              session?.derailmentStatus === 'done'
                ? 'done'
                : session?.derailmentStatus === 'error'
                  ? 'error'
                  : session?.derailmentStatus === 'pending'
                    ? 'processing'
                    : 'pending',
          },
          {
            label: 'Brain Ingestion',
            status: worldState?.lastIngestedSessionId === sessionId ? 'done' : 'pending',
          },
        ]
      : [];

  const allDone =
    stages.length > 0 && stages.every((s) => s.status === 'done' || s.status === 'error');
  const showViewButton = allDone || timedOut;

  const handleOpenChange = (v: boolean) => {
    if (!v && !confirmed) {
      onClose();
    }
    // Prevent close mid-pipeline
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>End Session?</DialogTitle>
        </DialogHeader>

        {!confirmed ? (
          <>
            <p className="text-sm text-muted-foreground">
              This will mark the session as complete and trigger the AI summary pipeline.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Keep Playing
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                onClick={() => {
                  setConfirmed(true);
                  completeSession.mutate({ id: sessionId });
                }}
                disabled={completeSession.isPending}
              >
                {completeSession.isPending ? 'Ending…' : 'End Session'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2.5 py-1">
              {stages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-2.5 text-sm">
                  <StageIcon status={stage.status} />
                  <span
                    className={
                      stage.status === 'done'
                        ? 'text-foreground'
                        : stage.status === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }
                  >
                    {stage.label}
                  </span>
                </div>
              ))}
              {timedOut && !allDone && (
                <p className="text-xs text-muted-foreground pt-1">
                  Taking longer than expected — you can view the session now.
                </p>
              )}
            </div>
            {showViewButton && (
              <DialogFooter>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  onClick={() => router.push(`/campaigns/${slug}/sessions/${sessionId}`)}
                >
                  View Session
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
