'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AudioRecorder } from '@/components/session/audio-recorder';
import { DmVisibilityControls } from '@/components/session/dm-visibility-controls';
import {
  Sparkles,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Mic,
  Video,
  Clock,
  FileText,
  ArrowLeft,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';

function SummaryCard({
  session,
  sessionId,
  campaignId,
}: {
  session: any;
  sessionId: string;
  campaignId: string;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const generateSummary = trpc.sessions.generateSummary.useMutation({
    onSuccess: () => void utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (e) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const postToDiscord = trpc.sessions.postToDiscord.useMutation({
    onSuccess: () => toast({ title: 'Posted to Discord' }),
    onError: (e) =>
      toast({ title: 'Discord post failed', description: e.message, variant: 'destructive' }),
  });

  const status = session.aiSummaryStatus as string | null | undefined;

  return (
    <div
      className="rounded-sm border border-border/40 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)' }}
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: 'hsl(35 80% 55%)' }} />
          <span className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>
            Session Summary
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'done' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => postToDiscord.mutate({ sessionId, campaignId })}
                disabled={postToDiscord.isPending}
              >
                <Send className="h-3 w-3" />
                {postToDiscord.isPending ? 'Posting…' : 'Discord'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => generateSummary.mutate({ sessionId })}
                disabled={generateSummary.isPending}
              >
                <RefreshCw className="h-3 w-3" />
                Re-analyze
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {(!status || status === 'none') && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm" style={{ color: 'hsl(35 10% 45%)' }}>
              No summary yet.
            </p>
            <Button
              size="sm"
              onClick={() => generateSummary.mutate({ sessionId })}
              disabled={generateSummary.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Analyze Session
            </Button>
          </div>
        )}
        {(status === 'pending' || status === 'processing') && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-sm" style={{ color: 'hsl(35 10% 48%)' }}>
              Analyzing session…
            </span>
          </div>
        )}
        {status === 'done' && session.aiSummary && (
          <div
            className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed"
            style={{ color: 'hsl(35 15% 65%)' }}
          >
            <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-destructive">
              {session.aiSummaryError ?? 'Summary generation failed.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateSummary.mutate({ sessionId })}
              disabled={generateSummary.isPending}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RawDataSection({ session }: { session: any }) {
  const [open, setOpen] = useState(false);
  const transcripts: any[] = session.transcripts ?? [];
  if (!transcripts.length) return null;

  return (
    <div
      className="rounded-sm border border-border/40 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" style={{ color: 'hsl(35 10% 40%)' }} />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'hsl(35 10% 40%)' }}
          >
            Transcript Data
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/30 px-5 py-4">
          <pre
            className="text-[11px] overflow-auto max-h-96 rounded-sm p-3"
            style={{ background: 'hsl(240 10% 6%)', color: 'hsl(35 10% 60%)' }}
          >
            {JSON.stringify(transcripts[0]?.speakers ?? transcripts[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function RecordingsSection({
  session,
  sessionId,
  campaignId,
}: {
  session: any;
  sessionId: string;
  campaignId: string;
}) {
  const recordings: any[] = session.recordings ?? [];
  const utils = trpc.useUtils();

  return (
    <div className="space-y-3">
      <p
        className="text-[10px] uppercase tracking-widest font-semibold"
        style={{ color: 'hsl(35 80% 48%)' }}
      >
        Recordings
      </p>
      {recordings.map((rec: any) => (
        <div
          key={rec.id}
          className="rounded-sm border border-border/40 px-4 py-3"
          style={{
            background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
          }}
        >
          <div className="flex items-center gap-2">
            {rec.type === 'video' ? (
              <Video className="h-4 w-4 shrink-0" style={{ color: 'hsl(35 10% 45%)' }} />
            ) : (
              <Mic className="h-4 w-4 shrink-0" style={{ color: 'hsl(35 10% 45%)' }} />
            )}
            <span className="text-sm capitalize" style={{ color: 'hsl(35 20% 75%)' }}>
              {rec.type} recording
            </span>
            {!!rec.durationSeconds && (
              <span
                className="flex items-center gap-1 text-xs ml-auto"
                style={{ color: 'hsl(35 10% 40%)' }}
              >
                <Clock className="h-3 w-3" />
                {Math.floor(rec.durationSeconds / 60)}m
              </span>
            )}
          </div>
        </div>
      ))}
      <AudioRecorder
        sessionId={sessionId}
        campaignId={campaignId}
        onUploadComplete={() => void utils.sessions.getById.invalidate({ id: sessionId })}
      />
    </div>
  );
}

export default function SessionDetailPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const { campaignId, isDM } = useCampaign();

  const { data: session, isLoading } = trpc.sessions.getById.useQuery(
    { id: sessionId },
    {
      staleTime: 30_000,
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.aiSummaryStatus;
        return status === 'pending' || status === 'processing' ? 5000 : false;
      },
    }
  );

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!session) return null;

  const s = session as any;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/campaigns/${slug}/sessions`}
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: 'hsl(35 10% 45%)' }}
        >
          <ArrowLeft className="h-3 w-3" /> Sessions
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="text-[10px] uppercase tracking-widest font-semibold mb-1"
              style={{ color: 'hsl(35 80% 48%)' }}
            >
              Session {s.sessionNumber}
            </p>
            <h1 className="font-display text-xl font-bold" style={{ color: 'hsl(35 20% 88%)' }}>
              {s.title ?? `Session ${s.sessionNumber}`}
            </h1>
            {s.date && (
              <p className="text-xs mt-1" style={{ color: 'hsl(35 10% 48%)' }}>
                {format(new Date(s.date as string), 'd MMM yyyy')}
              </p>
            )}
          </div>
          {isDM && (
            <Link href={`/campaigns/${slug}/sessions/${sessionId}/prep`}>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs mt-1">
                <Pencil className="h-3 w-3" /> Prep
              </Button>
            </Link>
          )}
        </div>
        {isDM && s.playerVisibility && (
          <DmVisibilityControls sessionId={sessionId} currentVisibility={s.playerVisibility} />
        )}
      </div>

      {/* Summary */}
      <SummaryCard session={s} sessionId={sessionId} campaignId={campaignId} />

      {/* Recordings (DM only) */}
      {isDM && <RecordingsSection session={s} sessionId={sessionId} campaignId={campaignId} />}

      {/* Raw transcript data (DM only) */}
      {isDM && <RawDataSection session={s} />}
    </div>
  );
}
