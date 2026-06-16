'use client';

import { useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

// ---------------------------------------------------------------------------
// Adapters — typed subsets of the real Prisma shapes returned by the routers.
// ---------------------------------------------------------------------------

// Subset of GameSession rows from sessions.getAll (each carries its recordings).
interface SessionRow {
  id: string;
  title?: string | null;
  sessionNumber?: number | null;
  date?: string | Date | null;
  recordings?: { id: string; durationSeconds?: number | null }[] | null;
}

// Subset of SessionRecording rows from sessionRecordings.getBySessionId.
interface RecordingRow {
  id: string;
  type?: string | null;
  processingStatus?: string | null;
  durationSeconds?: number | null;
  isMultiTrack?: boolean | null;
  createdAt?: string | Date | null;
  // Storage paths — typically `/api/storage/<key>`, directly playable (the
  // storage route streams local files with Range support and redirects R2
  // to a presigned URL).
  originalUrl?: string | null;
  extractedAudioUrl?: string | null;
  transcripts?: TranscriptRow[] | null;
}

// Subset of Transcript rows (speakers/timestamps are loose JSON — guard them).
interface TranscriptRow {
  id: string;
  rawText?: string | null;
  correctedText?: string | null;
  speakers?: unknown;
  timestamps?: unknown;
  hasSpeakers?: boolean | null;
}

// A speaker-tagged transcript segment, reconstructed defensively from timestamps.
interface Segment {
  speaker?: string;
  text: string;
  start?: number;
}

// ---------------------------------------------------------------------------
// Status pill colors.
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--qd-success)',
  processing: 'var(--qd-warn)',
  queued: 'var(--qd-warn)',
  failed: 'var(--qd-danger)',
};
const statusColor = (s?: string | null) =>
  STATUS_COLOR[(s ?? '').toLowerCase()] ?? 'var(--qd-ink-muted)';
const statusLabel = (s?: string | null) => (s ?? 'unknown').toUpperCase();

// ---------------------------------------------------------------------------
// Formatting helpers.
// ---------------------------------------------------------------------------

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(d?: string | Date | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const titleOf = (s: SessionRow) =>
  s.title?.trim() || (s.sessionNumber != null ? `Session ${s.sessionNumber}` : 'Untitled session');

// Pull the primary recording out of a session row (most recent, if multiple).
const primaryRecording = (s: SessionRow) => s.recordings?.[0] ?? null;

// ---------------------------------------------------------------------------
// Defensive transcript reconstruction.
// ---------------------------------------------------------------------------

// timestamps JSON is expected to be an array of { speaker?, text, start? }.
// It may be absent or malformed — guard everything.
function segmentsFromTranscript(t?: TranscriptRow | null): Segment[] {
  if (!t) return [];
  const raw = t.timestamps;
  if (Array.isArray(raw)) {
    const segs: Segment[] = [];
    for (const item of raw) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const text = typeof obj.text === 'string' ? obj.text : '';
        if (!text.trim()) continue;
        segs.push({
          text,
          speaker: typeof obj.speaker === 'string' ? obj.speaker : undefined,
          start: typeof obj.start === 'number' ? obj.start : undefined,
        });
      }
    }
    if (segs.length > 0) return segs;
  }
  return [];
}

const transcriptText = (t?: TranscriptRow | null) =>
  (t?.correctedText || t?.rawText || '').trim();

function formatSegmentTime(start?: number): string {
  if (start == null || Number.isNaN(start)) return '';
  const m = Math.floor(start / 60);
  const s = Math.floor(start % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Page.
// ---------------------------------------------------------------------------

export default function RecordingsPage() {
  const { campaignId } = useCampaign();
  const sessions = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 60_000 });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = (sessions.data as SessionRow[] | undefined) ?? [];
  // Only sessions that actually have a recording belong in the chronicle.
  const recorded = useMemo(
    () => rows.filter((s) => (s.recordings?.length ?? 0) > 0),
    [rows],
  );
  const selected = recorded.find((s) => s.id === selectedId) ?? recorded[0] ?? null;

  // Lazily load the selected session's recordings (with transcripts) on demand.
  const detail = trpc.sessionRecordings.getBySessionId.useQuery(
    { sessionId: selected?.id ?? '' },
    { enabled: !!selected?.id, staleTime: 30_000 },
  );

  const detailRows = (detail.data as RecordingRow[] | undefined) ?? [];
  const recording = detailRows[0] ?? null;
  const transcript = recording?.transcripts?.[0] ?? null;
  const segments = useMemo(() => segmentsFromTranscript(transcript), [transcript]);
  const fullText = transcriptText(transcript);

  // Prefer the extracted audio (for videos) so transcript timestamps align; fall
  // back to the original upload. Both are `/api/storage/<key>` paths or full URLs.
  const playbackUrl = recording?.extractedAudioUrl || recording?.originalUrl || null;

  const audioRef = useRef<HTMLAudioElement>(null);
  // Click a transcript line → seek the player there and play.
  const seekTo = (start?: number) => {
    const el = audioRef.current;
    if (!el || start == null || Number.isNaN(start)) return;
    el.currentTime = start;
    void el.play().catch(() => {});
  };

  if (sessions.isLoading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Gathering the chronicle…</div>;
  }
  if (sessions.error) {
    return <div className="px-8 py-16 text-qd-ink-muted">The threads tangled. Try again.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Recordings</div>
          <div className="font-qd-mono text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">
            Capture · Transcribe · Recap
          </div>
        </div>
        <span className="flex-1" />
        {/* TODO: live recording capture — UI placeholder only */}
        <button className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">
          ● Record next session
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* LIST */}
        <aside className="flex w-[282px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          <div className="px-1 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-muted">
            Sessions
          </div>
          {recorded.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">
              The chronicle is unrecorded.
            </p>
          )}
          {recorded.map((s) => {
            const active = selected?.id === s.id;
            const rec = primaryRecording(s);
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="rounded-qd-lg border p-2.5 text-left transition-colors"
                style={active
                  ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                  : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-qd-ink-strong">{titleOf(s)}</span>
                  <span className="flex-none font-qd-mono text-[9px]" style={{ color: active ? 'var(--qd-accent-text)' : 'var(--qd-ink-muted)' }}>
                    {formatDuration(rec?.durationSeconds)}
                  </span>
                </div>
                {formatDate(s.date) && (
                  <div className="mt-1 truncate font-qd-mono text-[7.5px] text-qd-ink-muted">
                    {formatDate(s.date)}
                  </div>
                )}
              </button>
            );
          })}
        </aside>

        {/* DETAIL */}
        <div className="flex-1 overflow-auto p-6">
          {!selected ? (
            <p className="text-qd-ink-muted">The chronicle is unrecorded.</p>
          ) : (
            <>
              {/* title */}
              <div className="font-qd-display text-[24px] leading-none text-qd-ink-strong">
                {titleOf(selected)}
              </div>
              <div className="mt-2 flex items-center gap-3 font-qd-mono text-[10px] text-qd-ink-muted">
                {formatDate(selected.date) && <span>{formatDate(selected.date)}</span>}
                {recording?.durationSeconds ? <span>· {formatDuration(recording.durationSeconds)}</span> : null}
                {recording?.type ? <span>· {recording.type}</span> : null}
                {recording?.isMultiTrack ? <span>· multi-track</span> : null}
              </div>

              {/* status / detail-load states */}
              {detail.isLoading && (
                <div className="mt-4 text-qd-body-sm text-qd-ink-muted">Recalling the session…</div>
              )}
              {detail.error && (
                <div className="mt-4 text-qd-body-sm text-qd-ink-muted">The threads tangled. Try again.</div>
              )}

              {!detail.isLoading && !detail.error && (
                <>
                  {/* status pill */}
                  {recording && (
                    <div className="mt-4">
                      <span
                        className="rounded-full px-2.5 py-1 font-qd-mono text-[9px]"
                        style={{
                          color: statusColor(recording.processingStatus),
                          borderColor: statusColor(recording.processingStatus),
                          borderWidth: 1,
                          background: 'rgba(255,255,255,.03)',
                        }}
                      >
                        {statusLabel(recording.processingStatus)}
                      </span>
                    </div>
                  )}

                  {/* audio/video playback — native element streams from /api/storage */}
                  <div className="mt-5 rounded-qd-lg border border-qd-faint p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
                    {playbackUrl ? (
                      <audio
                        ref={audioRef}
                        controls
                        preload="metadata"
                        src={playbackUrl}
                        className="w-full"
                        data-testid="recording-audio"
                      />
                    ) : (
                      <div className="flex items-center gap-3 font-qd-mono text-[10px] text-qd-ink-muted">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[14px] text-qd-ink-faint" style={{ background: 'rgba(255,255,255,.05)' }}>
                          ▶
                        </span>
                        No audio file is attached to this recording.
                      </div>
                    )}
                  </div>

                  {/* transcript */}
                  <div className="my-5 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-muted">
                    Transcript
                  </div>

                  {!transcript || !fullText ? (
                    <p className="text-qd-body-sm text-qd-ink-muted">
                      {recording?.processingStatus === 'failed'
                        ? 'The threads tangled. Try again.'
                        : recording && recording.processingStatus !== 'completed'
                          ? 'The recording is still being transcribed…'
                          : 'No transcript woven for this session yet.'}
                    </p>
                  ) : segments.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {segments.map((seg, i) => (
                        <div key={i} className="flex gap-3">
                          {playbackUrl && seg.start != null ? (
                            <button
                              onClick={() => seekTo(seg.start)}
                              title="Jump to this moment"
                              className="w-[46px] flex-none pt-0.5 text-left font-qd-mono text-[9px] text-qd-accent-text transition-colors hover:text-qd-ink-strong"
                            >
                              {formatSegmentTime(seg.start)}
                            </button>
                          ) : (
                            <span className="w-[46px] flex-none pt-0.5 font-qd-mono text-[9px] text-qd-ink-muted">
                              {formatSegmentTime(seg.start)}
                            </span>
                          )}
                          <div className="flex-1 text-qd-body-sm leading-relaxed text-qd-ink-2">
                            {seg.speaker && (
                              <span className="font-qd-mono text-[12px] text-qd-accent-text">{seg.speaker}: </span>
                            )}
                            {seg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // No structured segments — render the flat corrected/raw text.
                    <p className="whitespace-pre-wrap text-qd-body-sm leading-relaxed text-qd-ink-2">
                      {fullText}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
