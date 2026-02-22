'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Copy, Share2, RefreshCw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const HIGHLIGHT_COLORS: Record<string, string> = {
  decision: 'bg-blue-100 text-blue-800',
  npc_change: 'bg-purple-100 text-purple-800',
  cliffhanger: 'bg-red-100 text-red-800',
  combat: 'bg-orange-100 text-orange-800',
  loot: 'bg-green-100 text-green-800',
};

interface SummaryPanelProps {
  sessionId: string;
  isDM: boolean;
}

interface SummaryHighlight {
  type: string;
  text: string;
  timestampMs?: number;
  speakerLabel?: string;
}

export function SummaryPanel({ sessionId, isDM }: SummaryPanelProps) {
  const utils = trpc.useUtils();

  const { data: status, isLoading } = trpc.sessions.getSummaryStatus.useQuery(
    { sessionId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as
          | { aiSummaryStatus?: string }
          | undefined;
        const summaryStatus = data?.aiSummaryStatus;
        if (summaryStatus === 'pending' || summaryStatus === 'processing') {
          return 3000;
        }
        return false;
      },
    }
  );

  const generateMutation = trpc.sessions.generateSummary.useMutation({
    onSuccess: () => {
      void utils.sessions.getSummaryStatus.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const shareTokenMutation = trpc.sessions.createShareToken.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/share/session/${data.shareToken}`;
      void navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard');
      void utils.sessions.getSummaryStatus.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) {
    return <div className="h-20 animate-pulse bg-muted rounded-lg" />;
  }

  const summaryStatus = status?.aiSummaryStatus ?? 'none';
  const isRunning = summaryStatus === 'pending' || summaryStatus === 'processing';
  const highlights = (status?.aiHighlights as SummaryHighlight[] | null) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Summary
        </CardTitle>
        <div className="flex gap-2">
          {summaryStatus === 'done' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(status?.aiSummary ?? '');
                  toast.success('Summary copied');
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              {isDM && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => shareTokenMutation.mutate({ sessionId })}
                  disabled={shareTokenMutation.isPending}
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Share
                </Button>
              )}
            </>
          )}
          {isDM && (
            <Button
              size="sm"
              onClick={() => generateMutation.mutate({ sessionId })}
              disabled={isRunning || generateMutation.isPending}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : summaryStatus === 'done' ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generate
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {summaryStatus === 'none' && (
          <p className="text-sm text-muted-foreground">
            No summary yet.{' '}
            {isDM ? 'Click Generate to create one.' : 'The DM has not generated a summary yet.'}
          </p>
        )}
        {summaryStatus === 'error' && (
          <p className="text-sm text-destructive">Error: {status?.aiSummaryError ?? 'Unknown error'}</p>
        )}
        {isRunning && (
          <p className="text-sm text-muted-foreground animate-pulse">Generating summary...</p>
        )}
        {summaryStatus === 'done' && (
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{status?.aiSummary ?? ''}</ReactMarkdown>
            </div>
            {highlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">HIGHLIGHTS</p>
                <div className="flex flex-wrap gap-2">
                  {highlights.map((highlight, index) => (
                    <Badge
                      key={`${highlight.type}-${index}`}
                      className={HIGHLIGHT_COLORS[highlight.type] ?? ''}
                      variant="outline"
                    >
                      <span className="font-medium capitalize mr-1">
                        {highlight.type.replace('_', ' ')}:
                      </span>{' '}
                      {highlight.text}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

