'use client';

import { useParams, useRouter } from 'next/navigation';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  Play,
  Trash2,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { format } from 'date-fns';
import { PrepStatusCard } from '@/components/session/prep-status-card';
import { RecapCard } from '@/components/recap/recap-card';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning:    { label: 'Planned',     color: 'hsl(240 20% 55%)' },
  in_progress: { label: 'In Progress', color: 'hsl(35 80% 55%)' },
  active:      { label: 'Active',      color: 'hsl(140 60% 45%)' },
  completed:   { label: 'Completed',   color: 'hsl(140 50% 40%)' },
  cancelled:   { label: 'Cancelled',   color: 'hsl(0 40% 45%)' },
};

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ session, sessionId, campaignId }: { session: any; sessionId: string; campaignId: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const generateSummary = trpc.sessions.generateSummary.useMutation({
    onSuccess: () => void utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (e) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const status = session.aiSummaryStatus as string | null | undefined;

  return (
    <div className="rounded-sm border border-border/40 overflow-hidden" style={{
      background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
    }}>
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(35 80% 55%)' }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'hsl(35 80% 48%)' }}>
            Session Summary
          </span>
        </div>
        {status === 'done' && (
          <Button size="sm" variant="ghost" className="h-6 gap-1.5 text-xs px-2"
            onClick={() => generateSummary.mutate({ sessionId })} disabled={generateSummary.isPending}>
            <RefreshCw className="h-3 w-3" /> Re-analyze
          </Button>
        )}
      </div>

      <div className="px-6 py-5">
        {(!status || status === 'none') && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>No summary yet.</p>
            <Button size="sm" onClick={() => generateSummary.mutate({ sessionId })} disabled={generateSummary.isPending}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Analyze Session
            </Button>
          </div>
        )}
        {(status === 'pending' || status === 'processing') && (
          <div className="flex items-center gap-3 py-10 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-sm" style={{ color: 'hsl(35 10% 48%)' }}>Analyzing session…</span>
          </div>
        )}
        {status === 'done' && session.aiSummary && (
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed" style={{ color: 'hsl(35 15% 68%)' }}>
            <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-destructive">{session.aiSummaryError ?? 'Summary generation failed.'}</p>
            <Button size="sm" variant="outline" onClick={() => generateSummary.mutate({ sessionId })} disabled={generateSummary.isPending}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transcript section ───────────────────────────────────────────────────────

function TranscriptSection({ session }: { session: any }) {
  const [open, setOpen] = useState(false);
  const transcripts: any[] = session.transcripts ?? [];
  if (!transcripts.length) return null;

  return (
    <div className="rounded-sm border border-border/40 overflow-hidden" style={{
      background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
    }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" style={{ color: 'hsl(35 10% 40%)' }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'hsl(35 10% 40%)' }}>
            Transcript Data
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border/20 px-6 py-4">
          <pre className="text-[11px] overflow-auto max-h-96 rounded-sm p-3"
            style={{ background: 'hsl(240 10% 6%)', color: 'hsl(35 10% 60%)' }}>
            {JSON.stringify(transcripts[0]?.speakers ?? transcripts[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar: Recordings ──────────────────────────────────────────────────────

function RecordingsSidebar({ session, sessionId, campaignId }: { session: any; sessionId: string; campaignId: string }) {
  const recordings: any[] = session.recordings ?? [];
  const utils = trpc.useUtils();

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest font-semibold px-1" style={{ color: 'hsl(35 80% 48%)' }}>
        Recordings
      </p>
      {recordings.map((rec: any) => (
        <div key={rec.id} className="rounded-sm border border-border/40 px-4 py-3 flex items-center gap-3" style={{
          background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
        }}>
          {rec.type === 'video'
            ? <Video className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(35 10% 45%)' }} />
            : <Mic className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(35 10% 45%)' }} />}
          <span className="text-sm capitalize flex-1" style={{ color: 'hsl(35 20% 70%)' }}>
            {rec.type} recording
          </span>
          {!!rec.durationSeconds && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'hsl(35 10% 40%)' }}>
              <Clock className="h-3 w-3" />
              {Math.floor(rec.durationSeconds / 60)}m
            </span>
          )}
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

// ─── Sidebar: Discord ─────────────────────────────────────────────────────────

function DiscordSidebar({ sessionId, campaignId, summaryAvailable }: { sessionId: string; campaignId: string; summaryAvailable: boolean }) {
  const { toast } = useToast();

  const postToDiscord = trpc.sessions.postToDiscord.useMutation({
    onSuccess: () => toast({ title: 'Posted to Discord' }),
    onError: (e) => toast({ title: 'Discord post failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="rounded-sm border border-border/40 px-4 py-3 flex items-center justify-between" style={{
      background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
    }}>
      <div className="flex items-center gap-2.5">
        <Send className="h-3.5 w-3.5" style={{ color: 'hsl(240 70% 65%)' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'hsl(35 20% 80%)' }}>Discord</p>
          <p className="text-[11px]" style={{ color: 'hsl(35 10% 42%)' }}>Not posted yet</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs px-3"
        onClick={() => postToDiscord.mutate({ sessionId, campaignId })}
        disabled={postToDiscord.isPending || !summaryAvailable}>
        <Send className="h-3 w-3" />
        {postToDiscord.isPending ? 'Posting…' : 'Post'}
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const { campaignId, isDM } = useCampaign();
  const { toast } = useToast();
  const router = useRouter();
  const utils = trpc.useUtils();

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

  const { data: campaign } = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 60_000 });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      router.push(`/campaigns/${slug}/sessions`);
    },
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-4 max-w-5xl">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-[1fr_280px] gap-6 mt-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  const s = session as any;
  const discordWebhookUrl = (campaign?.settings as any)?.discordWebhookUrl as string | undefined;
  const sessionStatus = s.status as string | undefined;
  const statusCfg = sessionStatus ? STATUS_CONFIG[sessionStatus] : null;

  const prepStatus = s.prepStatus as string | undefined; // 'none' | 'draft' | 'complete'
  const isPrepComplete = prepStatus === 'complete';
  const isPlanning = !sessionStatus || sessionStatus === 'planning';
  const isActive = sessionStatus === 'in_progress' || sessionStatus === 'active';
  const isCompleted = sessionStatus === 'completed';

  return (
    <div className="px-6 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="space-y-4">
        <Link href={`/campaigns/${slug}/sessions`}
          className="inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: 'hsl(35 10% 42%)' }}>
          <ArrowLeft className="h-3 w-3" /> Sessions
        </Link>

        <div className="flex items-start justify-between gap-4">
          {/* Title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'hsl(35 80% 48%)' }}>
                Session {s.sessionNumber}
              </span>
              {statusCfg && (
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: statusCfg.color }}>
                  {sessionStatus === 'completed'
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <Circle className="h-3 w-3" />}
                  {statusCfg.label}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight truncate" style={{ color: 'hsl(35 20% 90%)' }}>
              {s.title ?? `Session ${s.sessionNumber}`}
            </h1>
            {s.date && (
              <p className="text-xs mt-1" style={{ color: 'hsl(35 10% 45%)' }}>
                {format(new Date(s.date as string), 'd MMM yyyy')}
              </p>
            )}
          </div>

          {/* Action buttons */}
          {isDM && (
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {/* Planning + prep not done → primary CTA is prep */}
              {isPlanning && !isPrepComplete && (
                <Link href={`/campaigns/${slug}/sessions/${sessionId}/prep`}>
                  <Button size="sm" className="h-8 gap-1.5 text-xs"
                    style={{ background: 'hsl(35 80% 28%)', borderColor: 'hsl(35 80% 38%)', color: 'hsl(35 80% 85%)' }}>
                    <Pencil className="h-3 w-3" /> Open Prep Workspace
                  </Button>
                </Link>
              )}

              {/* Planning + prep done → primary CTA is start session */}
              {isPlanning && isPrepComplete && (
                <>
                  <Link href={`/campaigns/${slug}/sessions/${sessionId}/live`}>
                    <Button size="sm" className="h-8 gap-1.5 text-xs">
                      <Play className="h-3 w-3" /> Start Session
                    </Button>
                  </Link>
                  <Link href={`/campaigns/${slug}/sessions/${sessionId}/prep`}>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <Pencil className="h-3 w-3" /> View Prep
                    </Button>
                  </Link>
                </>
              )}

              {/* Active/in-progress → resume */}
              {isActive && (
                <>
                  <Link href={`/campaigns/${slug}/sessions/${sessionId}/live`}>
                    <Button size="sm" className="h-8 gap-1.5 text-xs"
                      style={{ background: 'hsl(140 40% 20%)', borderColor: 'hsl(140 40% 30%)', color: 'hsl(140 60% 75%)' }}>
                      <Play className="h-3 w-3" /> Resume Session
                    </Button>
                  </Link>
                  <Link href={`/campaigns/${slug}/sessions/${sessionId}/prep`}>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <Pencil className="h-3 w-3" /> View Prep
                    </Button>
                  </Link>
                </>
              )}

              {/* Completed → prep is secondary/ghost */}
              {isCompleted && (
                <Link href={`/campaigns/${slug}/sessions/${sessionId}/prep`}>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" /> View Prep
                  </Button>
                </Link>
              )}

              {/* Delete — always last */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this session and all its data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSession.mutate({ id: sessionId })}
                      className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Player visibility — inline, compact */}
        {isDM && s.playerVisibility && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest font-semibold shrink-0" style={{ color: 'hsl(35 10% 38%)' }}>
              Visibility
            </span>
            <DmVisibilityControls sessionId={sessionId} currentVisibility={s.playerVisibility} />
          </div>
        )}
      </div>

      {/* Amber rule */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, hsl(35 60% 28%) 0%, transparent 60%)' }} />

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-6 items-start">

        {/* Main — lifecycle-aware */}
        <div className="space-y-4 min-w-0">
          {isPlanning ? (
            <PrepStatusCard session={s} sessionId={sessionId} slug={slug} />
          ) : (
            <>
              <SummaryCard session={s} sessionId={sessionId} campaignId={campaignId} />
              <TranscriptSection session={s} />
              <RecapCard
                sessionId={sessionId}
                campaignId={campaignId}
                transcriptId={(s.transcripts as Array<{ id: string }> | undefined)?.[0]?.id}
                slug={slug}
              />
            </>
          )}
        </div>

        {/* Sidebar — recordings + discord */}
        {isDM && (
          <div className="space-y-5">
            <RecordingsSidebar session={s} sessionId={sessionId} campaignId={campaignId} />
            {!isPlanning && discordWebhookUrl && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-semibold px-1" style={{ color: 'hsl(35 80% 48%)' }}>
                  Share
                </p>
                <DiscordSidebar
                  sessionId={sessionId}
                  campaignId={campaignId}
                  summaryAvailable={s.aiSummaryStatus === 'done'}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
