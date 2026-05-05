'use client';

import { useParams } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionPipeline } from '@/components/session/session-pipeline';
import { PhaseCompleteRow } from '@/components/session/phase-complete-row';
import { PhasePrep } from '@/components/session/phase-prep';
import { PhaseProcessing } from '@/components/session/phase-processing';
import { PhaseSummary } from '@/components/session/phase-summary';
import { PhaseRecap } from '@/components/session/phase-recap';
import { deriveSessionPhase } from '@/lib/session-lifecycle';
import { PageLayout } from '@/components/layout/page-layout';

export default function SessionHubPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { campaignId, slug, isDM } = useCampaign();

  const sessionQuery = trpc.sessions.getById.useQuery({ id: sessionId }, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  const session = sessionQuery.data as Record<string, unknown> | undefined;

  if (sessionQuery.isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return <p className="text-sm text-muted-foreground">Session not found.</p>;
  }

  const recordings = (session.recordings as Array<unknown>) ?? [];
  const transcripts = (session.transcripts as Array<{
    id: string;
    correctedText?: string | null;
    rawText?: string | null;
    cleanupStatus?: string | null;
    oocReviewItems?: unknown;
  }>) ?? [];
  const sessionNumber = session.sessionNumber as number;
  const sessionTitle = session.title as string | null;
  const sessionDate = session.date ? new Date(session.date as string) : null;

  const phase = deriveSessionPhase({
    status: (session.status as string) ?? 'planning',
    aiSummaryStatus: (session.aiSummaryStatus as string) ?? 'none',
    aiSummary: (session.aiSummary as string | null) ?? null,
    recordingCount: recordings.length,
    hasApprovedRecap: ((session._count as { recaps?: number } | undefined)?.recaps ?? 0) > 0,
  });

  const refresh = () => void utils.sessions.getById.invalidate({ id: sessionId });

  const prepDone         = phase !== 'prep';
  const ranDone          = !['prep', 'ran'].includes(phase);
  const procDone         = !['prep', 'ran', 'processing'].includes(phase);
  const sumDone          = !['prep', 'ran', 'processing', 'summary'].includes(phase);
  const isRanOrProcessing = phase === 'ran' || phase === 'processing';

  return (
    <PageLayout
      overline={`Session ${sessionNumber}`}
      title={sessionTitle ?? `Session ${sessionNumber}`}
      subtitle={sessionDate ? format(sessionDate, 'EEEE, MMMM d yyyy') : undefined}
      maxWidth="md"
    >
      {/* Pipeline */}
      <SessionPipeline currentPhase={phase} />

      {/* Completed phase rows */}
      <div className="space-y-2">
        {prepDone && (
          <PhaseCompleteRow
            phase="prep"
            detail={(session.prepStatus as string) === 'complete' ? 'Prep complete' : 'Skipped'}
          />
        )}
        {ranDone && (
          <PhaseCompleteRow
            phase="ran"
            detail={
              sessionDate
                ? `Ran ${formatDistanceToNow(sessionDate, { addSuffix: true })}`
                : 'Session complete'
            }
          />
        )}
        {procDone && (
          <PhaseCompleteRow
            phase="processing"
            detail={`${recordings.length} file${recordings.length !== 1 ? 's' : ''} uploaded`}
          />
        )}
        {sumDone && (
          <PhaseCompleteRow
            phase="summary"
            detail="AI summary generated"
          />
        )}
      </div>

      {/* Current phase content */}
      {phase === 'prep' && isDM && (
        <PhasePrep
          session={session}
          slug={slug}
          campaignId={campaignId}
          onStatusChange={refresh}
        />
      )}
      {isRanOrProcessing && isDM && (
        <PhaseProcessing
          session={{ id: session.id as string }}
          campaignId={campaignId}
          onUploadComplete={refresh}
        />
      )}
      {phase === 'summary' && (
        <PhaseSummary
          session={{
            id: session.id as string,
            aiSummaryStatus: (session.aiSummaryStatus as string | null) ?? null,
            aiSummary: (session.aiSummary as string | null) ?? null,
            transcripts,
          }}
          campaignId={campaignId}
          onSummaryReady={refresh}
        />
      )}
      {phase === 'recap' && (
        <PhaseRecap
          session={{ id: session.id as string, transcripts }}
          campaignId={campaignId}
          slug={slug}
        />
      )}
      {phase === 'complete' && (
        <div className="stone-card glass-panel">
          <div className="stone-card-body text-center py-6">
            <p className="text-sm text-muted-foreground">This session is complete.</p>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
