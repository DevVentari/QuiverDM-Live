'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCampaign } from '@/components/campaign/campaign-context';
import { LiveTranscriptionControls } from '@/components/session/live-transcription-controls';
import { TranscriptionStatus } from '@/components/session/transcription-status';
import { EncounterTracker } from '@/components/session/encounter-tracker';
import { FoundryEventsPanel } from '@/components/session/foundry-events-panel';
import { LoadEncounterPlanDialog } from '@/components/encounter/load-encounter-plan-dialog';
import { RulesPanel } from '@/components/session/rules-panel';
import { SummaryPanel } from '@/components/session/summary-panel';
import { AudioRecorder } from '@/components/session/audio-recorder';
import { DmVisibilityControls } from '@/components/session/dm-visibility-controls';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Upload,
  Trash2,
  CheckCircle,
  Search,
  FileText,
  RefreshCw,
  Sparkles,
  Play,
  Clock,
  Languages,
  Users,
  X,
  Pencil,
  Mic,
  Video,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function isVideoRecording(rec: { type: string; originalUrl: string }): boolean {
  if (rec.type === 'video') return true;
  const url = rec.originalUrl.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.mkv') || url.endsWith('.avi') || url.endsWith('.mov') || url.endsWith('.wmv');
}

// ---------------------------------------------------------------------------
// Transcript segment type
// ---------------------------------------------------------------------------
interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const splitRegex = new RegExp(`(${escaped})`, 'gi');
  const testRegex = new RegExp(`^${escaped}$`, 'i');
  const parts = text.split(splitRegex);

  return (
    <span>
      {parts.map((part, i) =>
        testRegex.test(part) ? (
          <mark key={i} className="bg-yellow-500/30 text-foreground rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function RecordingCard({ rec }: { rec: any }) {
  const [showPlayer, setShowPlayer] = useState(false);
  const isVideo = isVideoRecording(rec);
  const canPlay = !rec.originalDeleted && rec.originalUrl;

  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm font-medium capitalize">{rec.type} recording</p>
            <p className="text-xs text-muted-foreground">
              {rec.durationSeconds ? formatDuration(rec.durationSeconds) : 'Duration unknown'}
              {rec.processingStatus && ` · ${rec.processingStatus}`}
              {rec.fileSize && ` · ${(rec.fileSize / (1024 * 1024)).toFixed(1)} MB`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canPlay && (
              <Button size="sm" variant="ghost" onClick={() => setShowPlayer(!showPlayer)} aria-expanded={showPlayer}>
                <Play className="mr-1 h-3 w-3" />
                {showPlayer ? 'Hide' : 'Play'}
              </Button>
            )}
            <Badge variant="secondary">{rec.processingStatus || 'pending'}</Badge>
          </div>
        </div>

        {showPlayer && canPlay && (
          <div className="rounded-md overflow-hidden border border-border bg-muted/30">
            {isVideo ? (
              <video controls preload="metadata" className="w-full max-h-[400px]" src={rec.originalUrl}>
                Your browser does not support video playback.
              </video>
            ) : (
              <audio controls preload="metadata" className="w-full" src={rec.originalUrl}>
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        )}

        {rec.originalDeleted && (
          <p className="text-xs text-muted-foreground italic">Original file deleted after transcription.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TranscriptViewer({ sessionId, canView }: { sessionId: string; canView: boolean }) {
  const { isDM } = useCampaign();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSegment, setEditingSegment] = useState<{
    transcriptId: string;
    index: number;
    text: string;
  } | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<{
    transcriptId: string;
    name: string;
    draft: string;
  } | null>(null);

  const transcripts = trpc.transcript.getSessionTranscripts.useQuery(
    { sessionId },
    { enabled: canView, refetchOnWindowFocus: false, staleTime: 30_000 }
  );
  const updateSegmentMutation = trpc.transcript.updateSegment.useMutation({
    onSuccess: () => { setEditingSegment(null); transcripts.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const renameSpeakerMutation = trpc.transcript.renameSpeaker.useMutation({
    onSuccess: () => { setEditingSpeaker(null); transcripts.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const transcriptList = (transcripts.data ?? []) as any[];

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">The DM has not shared transcripts for this session.</p>
        </CardContent>
      </Card>
    );
  }

  const getFilteredSegments = useCallback(
    (segments: TranscriptSegment[]): TranscriptSegment[] => {
      if (!searchQuery.trim()) return segments;
      return segments.filter((seg) => seg.text.toLowerCase().includes(searchQuery.toLowerCase()));
    },
    [searchQuery]
  );

  if (transcripts.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (transcriptList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg text-center">
        <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No transcripts yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Upload a recording and it will be transcribed automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transcripts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Search transcripts"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Transcript count */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{transcriptList.length} transcript{transcriptList.length !== 1 ? 's' : ''}</Badge>
      </div>

      {/* Transcripts */}
      <div className="space-y-4">
        {transcriptList.map((transcript) => {
          const segments = (transcript.timestamps ?? []) as TranscriptSegment[];
          const filteredSegments = getFilteredSegments(segments);
          const isExpanded = expandedId === transcript.id;
          const hasTimestamps = segments.length > 0;
          const displayText = transcript.correctedText || transcript.rawText || '';

          return (
            <div key={transcript.id} className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-muted/30 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {transcript.language && (
                    <span className="flex items-center gap-1">
                      <Languages className="h-3 w-3" />
                      {transcript.language.toUpperCase()}
                    </span>
                  )}
                  {transcript.durationSeconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(transcript.durationSeconds)}
                    </span>
                  )}
                  {transcript.hasSpeakers && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {(transcript.speakers as any[])?.length ?? 0} speakers
                    </span>
                  )}
                  <span>{format(new Date(transcript.createdAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
                {hasTimestamps && (
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setExpandedId(isExpanded ? null : transcript.id)}>
                    {isExpanded ? 'Show full text' : 'Show segments'}
                  </Button>
                )}
              </div>

              {/* Body */}
              <div className="px-4 py-3 max-h-[500px] overflow-y-auto">
                {isExpanded && hasTimestamps ? (
                  <div className="space-y-1.5">
                    {filteredSegments.length === 0 && searchQuery ? (
                      <p className="text-sm text-muted-foreground italic">No segments match &quot;{searchQuery}&quot;</p>
                    ) : (
                      filteredSegments.map((seg, idx) => (
                        <div key={idx} className="relative flex gap-3 text-sm group hover:bg-muted/20 rounded px-1 py-0.5 -mx-1">
                          <span className="text-xs text-muted-foreground font-mono shrink-0 pt-0.5 w-[48px]">
                            {formatTimestamp(seg.start)}
                          </span>
                          {seg.speaker && (
                            isDM && transcript.hasSpeakers ? (
                              editingSpeaker?.transcriptId === transcript.id && editingSpeaker?.name === seg.speaker ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Input
                                    value={editingSpeaker!.draft}
                                    onChange={(e) => setEditingSpeaker((prev) => prev ? { ...prev, draft: e.target.value } : prev)}
                                    className="h-6 text-[10px] w-28"
                                  />
                                  <Button size="sm" className="h-6 px-2 text-[10px]" disabled={renameSpeakerMutation.isPending}
                                    onClick={() => {
                                      const newName = editingSpeaker!.draft.trim();
                                      if (!newName) { toast.error('Speaker name cannot be empty'); return; }
                                      renameSpeakerMutation.mutate({ transcriptId: transcript.id, oldName: editingSpeaker!.name, newName });
                                    }}>Save</Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setEditingSpeaker(null)}>Cancel</Button>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-primary shrink-0 flex items-center gap-1">
                                  {seg.speaker}
                                  <button
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                    onClick={() => setEditingSpeaker({ transcriptId: transcript.id, name: seg.speaker!, draft: seg.speaker! })}
                                    aria-label={`Rename speaker ${seg.speaker}`}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 shrink-0">{seg.speaker}</Badge>
                            )
                          )}
                          {isDM && editingSegment?.transcriptId === transcript.id && editingSegment?.index === segments.indexOf(seg) ? (
                            <div className="flex-1 space-y-1">
                              <Textarea
                                value={editingSegment!.text}
                                onChange={(e) => setEditingSegment((prev) => prev ? { ...prev, text: e.target.value } : prev)}
                                className="min-h-[64px] text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="h-7 px-2 text-xs" disabled={updateSegmentMutation.isPending}
                                  onClick={() => {
                                    const text = editingSegment!.text.trim();
                                    if (!text) { toast.error('Segment text cannot be empty'); return; }
                                    updateSegmentMutation.mutate({ transcriptId: transcript.id, segmentIndex: editingSegment!.index, text });
                                  }}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingSegment(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-foreground/90 flex-1 flex items-start gap-1">
                              <HighlightedText text={seg.text} query={searchQuery} />
                              {isDM && (
                                <button
                                  className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                  onClick={() => setEditingSegment({ transcriptId: transcript.id, index: segments.indexOf(seg), text: seg.text })}
                                  aria-label="Edit segment text"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    <HighlightedText text={displayText} query={searchQuery} />
                  </div>
                )}
              </div>

              {searchQuery && isExpanded && hasTimestamps && (
                <div className="px-4 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                  {filteredSegments.length} of {segments.length} segments match
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecapSection({ sessionId, campaignId, recap, isDM }: {
  sessionId: string;
  campaignId: string;
  recap: string | null;
  isDM: boolean;
}) {
  const { toast: uiToast } = useToast();
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (error) => uiToast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const generateRecap = trpc.sessions.generateRecap.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Session Recap
          </CardTitle>
          {isDM && (
            <Button size="sm" variant="outline" disabled={generateRecap.isPending} onClick={() => generateRecap.mutate({ campaignId, sessionId })}>
              {generateRecap.isPending ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : recap ? <RefreshCw className="mr-1 h-3 w-3" /> : <Sparkles className="mr-1 h-3 w-3" />}
              {generateRecap.isPending ? (recap ? 'Regenerating...' : 'Generating...') : (recap ? 'Regenerate Recap' : 'Generate Recap')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {generateRecap.isError && (
          <p className="text-sm text-destructive mb-3">{generateRecap.error.message}</p>
        )}
        {recap ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown skipHtml>{recap}</ReactMarkdown>
          </div>
        ) : isDM ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No recap yet. Generate one from your session transcripts or write one manually.</p>
            <Textarea
              placeholder="Or write a recap manually..."
              rows={4}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value) updateSession.mutate({ id: sessionId, recap: value });
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recap available for this session yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab trigger shared class
// ---------------------------------------------------------------------------
const TAB_CLS = 'rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground px-4 py-2.5 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { campaignId, slug, isDM } = useCampaign();
  const { toast: uiToast } = useToast();
  const sessionId = params.sessionId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const session = trpc.sessions.getById.useQuery({ id: sessionId }, { staleTime: 30_000 });
  const playerVisibility =
    ((session.data as any)?.playerVisibility as 'dm-only' | 'summary-only' | 'public' | undefined) ?? 'dm-only';
  const canSeeSummaryContent = isDM || playerVisibility !== 'dm-only';
  const canSeeFullSessionContent = isDM || playerVisibility === 'public';

  const recordings = trpc.sessionRecordings.getBySessionId.useQuery(
    { sessionId },
    { enabled: canSeeFullSessionContent, staleTime: 30_000 }
  );
  const transcriptionJobs = trpc.sessionTranscription.getSessionTranscriptionJobs.useQuery(
    { sessionId },
    { enabled: isDM, staleTime: 5_000, refetchInterval: 3_000 }
  );
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (error) => uiToast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => router.push(`/campaigns/${slug}/sessions`),
    onError: (error) => uiToast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (error) => uiToast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const createRecording = trpc.sessionRecordings.create.useMutation();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'audio';
      let recordingUrl: string;

      if (process.env.NEXT_PUBLIC_STORAGE_MODE === 'r2') {
        // R2: get presigned upload URL, PUT directly to R2, then register in DB
        const res = await fetch('/api/recordings/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, filename: file.name, contentType: file.type, fileSize: file.size }),
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
        const r2Res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!r2Res.ok) throw new Error('Upload to storage failed');
        recordingUrl = `/api/storage/${key}`;
      } else {
        // Local: POST FormData directly to API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        const res = await fetch('/api/recordings/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const data = (await res.json()) as { url: string };
        recordingUrl = data.url;
      }

      await createRecording.mutateAsync({ sessionId, type, url: recordingUrl, fileSize: file.size });
      void utils.sessionRecordings.getBySessionId.invalidate({ sessionId });
    } catch (err) {
      uiToast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Network error. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (session.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load session</p>
          <p className="text-sm text-muted-foreground">{session.error?.message}</p>
          <Button variant="outline" onClick={() => session.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!session.data) return <p className="text-destructive">Session not found</p>;

  const data = session.data as any;
  const latestTranscriptionJob = transcriptionJobs.data?.[0] ?? null;

  // Status badge colour
  const statusClass =
    data.status === 'completed'
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : data.status === 'in_progress' || data.status === 'active'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-muted-foreground border-border';

  return (
    <>
      <div className="space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Session number bubble */}
            <div className="shrink-0 h-12 w-12 rounded-full border-2 border-primary/50 bg-card flex items-center justify-center">
              <span className="font-display text-sm font-bold text-primary leading-none">
                {String(data.sessionNumber ?? 1).padStart(2, '0')}
              </span>
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wide leading-tight">
                {data.title || `Session ${data.sessionNumber ?? 1}`}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.createdAt && format(new Date(data.createdAt), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data.status && (
              <Badge variant="outline" className={statusClass}>
                {data.status.replace(/_/g, ' ')}
              </Badge>
            )}
            {isDM && data.status !== 'completed' && (
              <Button size="sm" variant="outline" onClick={() => completeSession.mutate({ id: sessionId })}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Complete
              </Button>
            )}
            {isDM && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* DM visibility controls */}
        {isDM && (
          <DmVisibilityControls sessionId={sessionId} currentVisibility={playerVisibility} />
        )}

        {/* Encounter tracker — always visible to players with full access */}
        {!isDM && canSeeFullSessionContent && (
          <EncounterTracker sessionId={sessionId} isDM={false} />
        )}

        {/* Locked state for players */}
        {!isDM && !canSeeSummaryContent && !canSeeFullSessionContent && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground text-sm">The DM hasn&apos;t shared this session yet.</p>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        {(isDM || canSeeSummaryContent || canSeeFullSessionContent) && (
          <Tabs defaultValue={isDM ? 'play' : 'recap'} className="w-full">

            {/* Tab bar */}
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              {isDM && (
                <TabsTrigger value="play" className={TAB_CLS}>
                  <Mic className="h-3.5 w-3.5" />
                  Live Play
                </TabsTrigger>
              )}
              {canSeeFullSessionContent && (
                <TabsTrigger value="recordings" className={TAB_CLS}>
                  <Video className="h-3.5 w-3.5" />
                  Recordings
                </TabsTrigger>
              )}
              {canSeeFullSessionContent && (
                <TabsTrigger value="transcript" className={TAB_CLS}>
                  <FileText className="h-3.5 w-3.5" />
                  Transcript
                </TabsTrigger>
              )}
              {canSeeSummaryContent && (
                <TabsTrigger value="recap" className={TAB_CLS}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Recap
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── Live Play tab (DM only) ────────────────────────────── */}
            {isDM && (
              <TabsContent value="play" className="mt-5">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                  {/* Left: DM tools */}
                  <div className="lg:col-span-3 space-y-4">

                    {/* Quick Notes */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Quick Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          defaultValue={data.quickNotes || ''}
                          placeholder="Initiative order, plot hooks, in-play reminders..."
                          rows={5}
                          onBlur={(e) => {
                            if (e.target.value !== (data.quickNotes || '')) {
                              updateSession.mutate({ id: sessionId, quickNotes: e.target.value });
                            }
                          }}
                        />
                      </CardContent>
                    </Card>

                    {/* In-browser recording */}
                    <AudioRecorder
                      sessionId={sessionId}
                      campaignId={campaignId}
                      onUploadComplete={() => void utils.sessionRecordings.getBySessionId.invalidate({ sessionId })}
                    />

                    {/* Live transcription */}
                    <LiveTranscriptionControls
                      sessionId={sessionId}
                      isDM={isDM}
                      onTranscriptSaved={() => {
                        void utils.sessionTranscription.getSessionTranscriptionJobs.invalidate({ sessionId });
                        void utils.transcript.getSessionTranscripts.invalidate({ sessionId });
                      }}
                    />

                    {/* Transcription job progress */}
                    {latestTranscriptionJob && latestTranscriptionJob.status !== 'completed' && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Transcription Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <TranscriptionStatus
                            jobId={latestTranscriptionJob.jobId}
                            onComplete={() => {
                              void utils.sessionTranscription.getSessionTranscriptionJobs.invalidate({ sessionId });
                              void utils.transcript.getSessionTranscripts.invalidate({ sessionId });
                              void utils.sessionRecordings.getBySessionId.invalidate({ sessionId });
                            }}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Right: Encounter Tracker */}
                  <div className="lg:col-span-2 space-y-4">
                    <LoadEncounterPlanDialog campaignId={campaignId} sessionId={sessionId} />
                    <EncounterTracker sessionId={sessionId} isDM={isDM} />
                    <FoundryEventsPanel campaignId={campaignId} sessionId={sessionId} campaignSlug={slug} />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ── Recordings tab ────────────────────────────────────── */}
            {canSeeFullSessionContent && (
              <TabsContent value="recordings" className="mt-5 space-y-4">
                {isDM && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {recordings.data
                        ? `${(recordings.data as any[]).length} recording${(recordings.data as any[]).length !== 1 ? 's' : ''}`
                        : ''}
                    </p>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,video/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleUpload}
                      />
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <Upload className="mr-2 h-3.5 w-3.5" />
                        {uploading ? 'Uploading...' : 'Upload Recording'}
                      </Button>
                    </div>
                  </div>
                )}

                {recordings.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-20 rounded-lg" />
                  </div>
                ) : recordings.data && (recordings.data as any[]).length > 0 ? (
                  <div className="space-y-2">
                    {(recordings.data as any[]).map((rec) => (
                      <RecordingCard key={rec.id} rec={rec} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg text-center">
                    <Video className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No recordings yet.</p>
                    {isDM && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Record in-browser from the Live Play tab, or upload a file above.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
            )}

            {/* ── Transcript tab ────────────────────────────────────── */}
            {canSeeFullSessionContent && (
              <TabsContent value="transcript" className="mt-5">
                <TranscriptViewer sessionId={sessionId} canView={canSeeFullSessionContent} />
              </TabsContent>
            )}

            {/* ── Recap tab ─────────────────────────────────────────── */}
            {canSeeSummaryContent && (
              <TabsContent value="recap" className="mt-5 space-y-4">
                <RecapSection
                  sessionId={sessionId}
                  campaignId={campaignId}
                  recap={data.recap || null}
                  isDM={isDM}
                />
                <SummaryPanel sessionId={sessionId} isDM={isDM} />
              </TabsContent>
            )}

          </Tabs>
        )}
      </div>

      {/* Floating rules panel */}
      <RulesPanel />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Session"
        description="Are you sure you want to delete this session? All recordings and transcripts will also be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteSession.mutate({ id: sessionId })}
        loading={deleteSession.isPending}
      />
    </>
  );
}
