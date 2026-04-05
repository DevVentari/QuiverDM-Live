'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { RefreshCw, ScrollText, ExternalLink } from 'lucide-react';

interface RecapCardProps {
  sessionId: string;
  campaignId: string;
  transcriptId: string | undefined;
  slug: string;
}

export function RecapCard({ sessionId, campaignId, transcriptId, slug }: RecapCardProps) {
  const utils = trpc.useUtils();

  const { data: recaps, isLoading } = trpc.recap.getBySession.useQuery(
    { campaignId, sessionId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as Array<{ status: string }> | undefined;
        return data?.some((r) => r.status === 'GENERATING') ? 3000 : false;
      },
    }
  );

  const generateMutation = trpc.recap.generate.useMutation({
    onSuccess: () => void utils.recap.getBySession.invalidate({ campaignId, sessionId }),
  });

  if (isLoading) return null;

  const latest = recaps?.[0];
  const isGenerating = latest?.status === 'GENERATING';
  const isFailed = latest?.status === 'FAILED';
  const isStuck =
    isGenerating &&
    latest &&
    Date.now() - (latest.createdAt as Date).getTime() > 5 * 60 * 1000;

  const sections = latest?.sections as Array<{ key: string; title: string; content: string }> | undefined;
  const firstSection = sections?.[0];

  return (
    <div
      className="rounded-sm border border-border/40 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
    >
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <ScrollText className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(35 80% 55%)' }} />
          <span
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'hsl(35 80% 48%)' }}
          >
            Recap
          </span>
          {latest?.style && (
            <span className="text-[10px] capitalize" style={{ color: 'hsl(35 5% 38%)' }}>
              {(latest.style as string).toLowerCase().replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <Link href={`/campaigns/${slug}/sessions/${sessionId}/recap`}>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1.5 text-xs px-2"
            style={{ color: 'hsl(35 5% 45%)' }}
          >
            View full <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="px-6 py-5">
        {!latest && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>
              No recap yet.
            </p>
            {transcriptId ? (
              <Button
                size="sm"
                onClick={() =>
                  generateMutation.mutate({
                    campaignId,
                    sessionId,
                    transcriptId,
                    style: 'NARRATIVE',
                  })
                }
                disabled={generateMutation.isPending}
              >
                <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Generate Recap
              </Button>
            ) : (
              <p className="text-xs" style={{ color: 'hsl(35 5% 32%)' }}>
                Transcribe a recording first.
              </p>
            )}
          </div>
        )}

        {(isStuck || isFailed) && (
          <div className="py-4 text-center">
            <p className="text-sm text-destructive">
              {isFailed ? 'Generation failed.' : 'Generation timed out.'}
            </p>
            <Link href={`/campaigns/${slug}/sessions/${sessionId}/recap`}>
              <Button size="sm" variant="outline" className="mt-2">
                Retry on recap page
              </Button>
            </Link>
          </div>
        )}

        {isGenerating && !isStuck && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-sm" style={{ color: 'hsl(35 10% 48%)' }}>
              Generating recap…
            </span>
          </div>
        )}

        {latest?.status === 'AUTO_GENERATED' && firstSection && (
          <div className="space-y-1.5">
            <p
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'hsl(35 60% 38%)' }}
            >
              {firstSection.title}
            </p>
            <p
              className="text-sm leading-relaxed line-clamp-4"
              style={{ color: 'hsl(35 15% 68%)' }}
            >
              {firstSection.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
