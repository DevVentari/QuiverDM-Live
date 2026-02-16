'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds to MM:SS */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Format duration in seconds to human-readable */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

/** Determine if a recording is video or audio based on its type field */
function isVideoRecording(rec: { type: string; originalUrl: string }): boolean {
  if (rec.type === 'video') return true;
  const url = rec.originalUrl.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.mkv') || url.endsWith('.avi') || url.endsWith('.mov') || url.endsWith('.wmv');
}

// ---------------------------------------------------------------------------
// Transcript segment type (from timestamps JSON)
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

/** Highlight matching text within a string */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <span>{text}</span>;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const splitRegex = new RegExp(`(${escaped})`, 'gi');
  const testRegex = new RegExp(`^${escaped}$`, 'i');
  const parts = text.split(splitRegex);

  return (
    <span>
      {parts.map((part, i) =>
        testRegex.test(part) ? (
          <mark key={i} className="bg-yellow-500/30 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/** Single recording card with inline media player */
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
              {rec.durationSeconds
                ? formatDuration(rec.durationSeconds)
                : 'Duration unknown'}
              {rec.processingStatus && ` · ${rec.processingStatus}`}
              {rec.fileSize && ` · ${(rec.fileSize / (1024 * 1024)).toFixed(1)} MB`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canPlay && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPlayer(!showPlayer)}
                aria-expanded={showPlayer}
              >
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
              <video
                controls
                preload="metadata"
                className="w-full max-h-[400px]"
                src={rec.originalUrl}
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <audio
                controls
                preload="metadata"
                className="w-full"
                src={rec.originalUrl}
              >
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        )}

        {rec.originalDeleted && (
          <p className="text-xs text-muted-foreground italic">
            Original file deleted after transcription.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Transcript viewer section */
function TranscriptViewer({ sessionId }: { sessionId: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const transcripts = trpc.transcript.getSessionTranscripts.useQuery(
    { sessionId },
    { refetchOnWindowFocus: false, staleTime: 30_000 }
  );

  const transcriptList = (transcripts.data ?? []) as any[];

  // Filter segments based on search query
  const getFilteredSegments = useCallback(
    (segments: TranscriptSegment[]): TranscriptSegment[] => {
      if (!searchQuery.trim()) return segments;
      return segments.filter((seg) =>
        seg.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
    [searchQuery]
  );

  if (transcripts.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcripts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (transcriptList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcripts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transcripts yet. Upload a recording and it will be transcribed automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcripts
            <Badge variant="secondary" className="ml-1">
              {transcriptList.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Transcript entries */}
        <div className="space-y-4">
          {transcriptList.map((transcript) => {
            const segments = (transcript.timestamps ?? []) as TranscriptSegment[];
            const filteredSegments = getFilteredSegments(segments);
            const isExpanded = expandedId === transcript.id;
            const hasTimestamps = segments.length > 0;
            const displayText = transcript.correctedText || transcript.rawText || '';

            return (
              <div
                key={transcript.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                {/* Transcript header */}
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
                    <span>
                      {format(new Date(transcript.createdAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {hasTimestamps && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : transcript.id)
                      }
                    >
                      {isExpanded ? 'Show full text' : 'Show segments'}
                    </Button>
                  )}
                </div>

                {/* Transcript body */}
                <div className="px-4 py-3 max-h-[500px] overflow-y-auto">
                  {isExpanded && hasTimestamps ? (
                    // Segmented view with timestamps
                    <div className="space-y-1.5">
                      {filteredSegments.length === 0 && searchQuery ? (
                        <p className="text-sm text-muted-foreground italic">
                          No segments match &quot;{searchQuery}&quot;
                        </p>
                      ) : (
                        filteredSegments.map((seg, idx) => (
                          <div
                            key={idx}
                            className="flex gap-3 text-sm group hover:bg-muted/20 rounded px-1 py-0.5 -mx-1"
                          >
                            <span className="text-xs text-muted-foreground font-mono shrink-0 pt-0.5 w-[48px]">
                              {formatTimestamp(seg.start)}
                            </span>
                            {seg.speaker && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-5 shrink-0"
                              >
                                {seg.speaker}
                              </Badge>
                            )}
                            <span className="text-foreground/90">
                              <HighlightedText
                                text={seg.text}
                                query={searchQuery}
                              />
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    // Full text view
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      <HighlightedText text={displayText} query={searchQuery} />
                    </div>
                  )}
                </div>

                {/* Search match count */}
                {searchQuery && isExpanded && hasTimestamps && (
                  <div className="px-4 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                    {filteredSegments.length} of {segments.length} segments match
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Session recap section with generate/regenerate */
function RecapSection({
  sessionId,
  campaignId,
  recap,
  isDM,
}: {
  sessionId: string;
  campaignId: string;
  recap: string | null;
  isDM: boolean;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
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
            <div className="flex items-center gap-2">
              {recap ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generateRecap.isPending}
                  onClick={() =>
                    generateRecap.mutate({ campaignId, sessionId })
                  }
                >
                  {generateRecap.isPending ? (
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3 w-3" />
                  )}
                  {generateRecap.isPending
                    ? 'Regenerating...'
                    : 'Regenerate Recap'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generateRecap.isPending}
                  onClick={() =>
                    generateRecap.mutate({ campaignId, sessionId })
                  }
                >
                  {generateRecap.isPending ? (
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  {generateRecap.isPending
                    ? 'Generating...'
                    : 'Generate Recap'}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {generateRecap.isError && (
          <p className="text-sm text-destructive mb-3">
            {generateRecap.error.message}
          </p>
        )}
        {recap ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown skipHtml>{recap}</ReactMarkdown>
          </div>
        ) : isDM ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No recap yet. Generate one from your session transcripts or write one manually.
            </p>
            <Textarea
              placeholder="Or write a recap manually..."
              rows={4}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value) {
                  updateSession.mutate({
                    id: sessionId,
                    recap: value,
                  });
                }
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recap available for this session yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { campaignId, slug, isDM } = useCampaign();
  const { toast } = useToast();
  const sessionId = params.sessionId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const session = trpc.sessions.getById.useQuery({ id: sessionId }, { staleTime: 30_000 });
  const recordings = trpc.sessionRecordings.getBySessionId.useQuery({ sessionId }, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => router.push(`/campaigns/${slug}/sessions`),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('type', file.type.startsWith('video/') ? 'video' : 'audio');

      await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      });

      utils.sessionRecordings.getBySessionId.invalidate({ sessionId });
    } catch (err) {
      toast({
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
      <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{session.error?.message || 'An unexpected error occurred'}</p>
          <Button variant="outline" onClick={() => session.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!session.data) {
    return <p className="text-destructive">Session not found</p>;
  }

  const data = session.data as any;

  return (
    <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            {data.title || `Session ${data.sessionNumber || ''}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.createdAt && format(new Date(data.createdAt), 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.status && (
            <Badge variant="secondary">{data.status.replace('_', ' ')}</Badge>
          )}
          {isDM && data.status !== 'completed' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => completeSession.mutate({ id: sessionId })}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete
            </Button>
          )}
          {isDM && (
            <Button
              size="sm"
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Notes */}
      {isDM && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              defaultValue={data.quickNotes || ''}
              placeholder="Session notes..."
              rows={4}
              onBlur={(e) => {
                if (e.target.value !== (data.quickNotes || '')) {
                  updateSession.mutate({
                    id: sessionId,
                    quickNotes: e.target.value,
                  });
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Recap Section */}
      <RecapSection
        sessionId={sessionId}
        campaignId={campaignId}
        recap={data.recap || null}
        isDM={isDM}
      />

      <Separator />

      {/* Recordings with Playback */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-semibold">Recordings</h3>
          {isDM && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload Recording'}
              </Button>
            </div>
          )}
        </div>

        {recordings.isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        ) : recordings.data && (recordings.data as any[]).length > 0 ? (
          <div className="space-y-2">
            {(recordings.data as any[]).map((rec) => (
              <RecordingCard key={rec.id} rec={rec} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recordings yet.</p>
        )}
      </div>

      <Separator />

      {/* Transcript Viewer */}
      <TranscriptViewer sessionId={sessionId} />

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
    </div>
  );
}
