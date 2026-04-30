'use client';

import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { TranscriptCleanupBadge } from '@/components/session/transcript-cleanup-badge';
import { OocReviewSheet } from '@/components/session/ooc-review-sheet';

interface PhaseSummaryProps {
  session: {
    id: string;
    aiSummaryStatus?: string | null;
    aiSummary?: string | null;
    transcripts?: Array<{
      id: string;
      correctedText?: string | null;
      rawText?: string | null;
      cleanupStatus?: string | null;
      oocReviewItems?: unknown;
    }>;
  };
  campaignId: string;
  onSummaryReady: () => void;
}

export function PhaseSummary({ session, campaignId, onSummaryReady }: PhaseSummaryProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showTranscript, setShowTranscript] = useState(false);
  const [oocSheetOpen, setOocSheetOpen] = useState(false);

  const generateSummary = trpc.sessions.generateSummary.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: session.id });
      onSummaryReady();
    },
    onError: (e) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const status = session.aiSummaryStatus as string | undefined;
  const transcript = session.transcripts?.[0];

  return (
    <div className="space-y-4">
      {transcript && (
        <>
          <div className="stone-card glass-panel">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="stone-card-header flex w-full items-center justify-between hover:text-foreground transition-colors"
            >
              <span className="stone-card-title text-sm">Transcript</span>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <TranscriptCleanupBadge
                  sessionId={session.id}
                  campaignId={campaignId}
                  cleanupStatus={transcript.cleanupStatus ?? null}
                  oocReviewItemCount={Array.isArray(transcript.oocReviewItems) ? transcript.oocReviewItems.length : 0}
                  onReviewOpen={() => setOocSheetOpen(true)}
                />
                {showTranscript ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {showTranscript && (
              <div className="stone-card-body max-h-64 overflow-y-auto text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap">
                {transcript.correctedText ?? transcript.rawText}
              </div>
            )}
          </div>
          {Array.isArray(transcript.oocReviewItems) && transcript.oocReviewItems.length > 0 && (
            <OocReviewSheet
              open={oocSheetOpen}
              onClose={() => setOocSheetOpen(false)}
              sessionId={session.id}
              campaignId={campaignId}
              items={transcript.oocReviewItems as Parameters<typeof OocReviewSheet>[0]['items']}
            />
          )}
        </>
      )}

      <div className="stone-card glass-panel">
        <div className="stone-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400/70" />
            <span className="stone-card-title text-sm">AI Summary</span>
          </div>
          {status === 'done' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateSummary.mutate({ sessionId: session.id })}
              disabled={generateSummary.isPending}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
            </Button>
          )}
        </div>
        <div className="stone-card-body">
          {(status === 'pending' || status === 'processing') && (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          )}
          {status === 'done' && session.aiSummary && (
            <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground">
              <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
            </div>
          )}
          {(status === 'none' || !status) && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">No summary generated yet.</p>
              <Button
                size="sm"
                onClick={() => generateSummary.mutate({ sessionId: session.id })}
                disabled={generateSummary.isPending}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate Summary
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">Summary generation failed.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateSummary.mutate({ sessionId: session.id })}
                disabled={generateSummary.isPending}
              >
                <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
