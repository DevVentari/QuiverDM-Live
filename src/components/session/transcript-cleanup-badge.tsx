'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TranscriptCleanupBadgeProps {
  sessionId: string;
  campaignId: string;
  cleanupStatus: string | null;
  oocReviewItemCount: number;
  onReviewOpen: () => void;
}

export function TranscriptCleanupBadge({
  sessionId,
  campaignId,
  cleanupStatus,
  oocReviewItemCount,
  onReviewOpen,
}: TranscriptCleanupBadgeProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const triggerOoc = trpc.sessions.triggerOocCleanup.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      toast({ title: 'OOC filter running', description: 'Results will appear shortly.' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (!cleanupStatus) return null;

  if (cleanupStatus === 'pending' || cleanupStatus === 'processing') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Cleaning transcript…
      </div>
    );
  }

  if (cleanupStatus === 'failed') {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'hsl(0 70% 65%)' }}>
        <XCircle className="h-3 w-3" />
        Cleanup failed
      </div>
    );
  }

  if (cleanupStatus === 'ooc_pending_review') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        style={{ borderColor: 'hsl(35 80% 55% / 0.4)', color: 'hsl(35 80% 62%)' }}
        onClick={onReviewOpen}
      >
        <AlertTriangle className="h-3 w-3" />
        {oocReviewItemCount} line{oocReviewItemCount !== 1 ? 's' : ''} flagged — Review
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle className="h-3 w-3" style={{ color: 'hsl(35 80% 55%)' }} />
        Transcript ready
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
        disabled={triggerOoc.isPending}
        onClick={() => triggerOoc.mutate({ sessionId, campaignId })}
      >
        {triggerOoc.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Run OOC filter'}
      </Button>
    </div>
  );
}
