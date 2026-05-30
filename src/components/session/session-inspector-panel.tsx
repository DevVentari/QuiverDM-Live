'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ExternalLink, FileText, Mic, ScrollText, Timer, Users } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; border: string }> = {
  planning:    { label: 'Planning',    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10',       dot: 'bg-slate-500',   border: 'border-slate-500/40' },
  in_progress: { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       dot: 'bg-amber-400',   border: 'border-amber-500/60' },
  active:      { label: 'Active',      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       dot: 'bg-amber-400',   border: 'border-amber-500/60' },
  completed:   { label: 'Completed',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-500', border: 'border-emerald-500/60' },
};

type Speaker = { id: string; name: string; segments: number };

type SessionTranscript = {
  id: string;
  hasSpeakers?: boolean | null;
  durationSeconds?: number | null;
  speakers?: unknown;
};

type SessionInspectorSession = {
  id: string;
  title?: string | null;
  status?: string | null;
  sessionNumber?: number | null;
  createdAt?: string | Date | null;
  prepStatus?: string | null;
  quickNotes?: string | null;
  aiSummary?: string | null;
  transcripts?: SessionTranscript[] | null;
  _count?: {
    recordings?: number;
    transcriptions?: number;
  } | null;
  recordings?: unknown[] | null;
  transcriptions?: unknown[] | null;
};

interface SessionInspectorPanelProps {
  session: SessionInspectorSession;
  slug: string;
  isDM: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SessionInspectorPanel({ session, slug, isDM }: SessionInspectorPanelProps) {
  const statusKey = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
  const status    = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
  const hasRecording  = (session._count?.recordings ?? 0) > 0 || (session.recordings?.length ?? 0) > 0;
  const hasTranscript = (session._count?.transcriptions ?? 0) > 0 || (session.transcriptions?.length ?? 0) > 0;
  const hasSummary    = !!session.aiSummary;
  const sessionNum    = session.sessionNumber ?? 0;
  const href          = `/campaigns/${slug}/sessions/${session.id}`;
  const displayTitle  = session.title
    ? session.title.replace(/^session\s+\d+[:\s-]+/i, '').trim() || session.title
    : `Session ${sessionNum}`;

  const transcript = session.transcripts?.[0] ?? null;
  const duration   = transcript?.durationSeconds ?? null;
  const speakers   = (transcript?.speakers as Speaker[] | null) ?? null;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      {/* Header */}
      <div className={`border-l-4 pl-4 mb-6 ${status.border}`}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-1">
          Session {String(sessionNum).padStart(2, '0')}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-amber-50">
            {displayTitle}
          </h2>
          <Badge variant="outline" className={`shrink-0 text-xs mt-0.5 ${status.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-muted-foreground">
        {session.createdAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(session.createdAt), 'MMM d, yyyy')}
          </span>
        )}
        {duration !== null && (
          <span className="flex items-center gap-1 text-amber-400/70">
            <Timer className="h-3 w-3" />
            {formatDuration(duration)}
          </span>
        )}
        {session.prepStatus && session.prepStatus !== 'none' && (
          <span className="flex items-center gap-1">
            Prep:{' '}
            <span className={`font-medium ${session.prepStatus === 'complete' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {session.prepStatus === 'complete' ? 'Complete' : 'In progress'}
            </span>
          </span>
        )}
      </div>

      {/* Recap */}
      {hasSummary && (
        <div className="rounded border border-purple-500/15 bg-purple-500/5 p-4 mb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-purple-400/50 mb-2">Session Recap</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{session.aiSummary}</p>
        </div>
      )}

      {/* Quick notes fallback */}
      {!hasSummary && session.quickNotes && (
        <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.02] p-4 mb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-2">The Story So Far</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{session.quickNotes}</p>
        </div>
      )}

      {/* Speakers */}
      {speakers && speakers.length > 0 && (
        <div className="rounded border border-white/5 bg-white/[0.02] p-3 mb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/40 mb-2.5 flex items-center gap-1.5">
            <Users className="h-3 w-3" /> At the Table
          </p>
          <div className="flex flex-wrap gap-1.5">
            {speakers.map((s) => (
              <span
                key={s.id}
                className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-muted-foreground"
              >
                {s.name}
                <span className="ml-1.5 text-[9px] opacity-50">{s.segments}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recording / transcript badges */}
      {(hasRecording || hasTranscript) && (
        <div className="flex gap-2 mb-4">
          {hasRecording && (
            <div className="flex items-center gap-1.5 rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">
              <Mic className="h-3 w-3" /> Recording
            </div>
          )}
          {hasTranscript && (
            <div className="flex items-center gap-1.5 rounded border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-400">
              <FileText className="h-3 w-3" /> Transcript
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto space-y-2">
        <Button asChild className="w-full gap-2">
          <Link href={href}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open Session
          </Link>
        </Button>
        {isDM && session.prepStatus !== 'complete' && (
          <Button asChild variant="outline" className="w-full gap-2">
            <Link href={`/campaigns/${slug}/sessions/prep?sessionId=${session.id}`}>
              <ScrollText className="h-3.5 w-3.5" />
              {session.prepStatus === 'draft' ? 'Continue Prep' : 'Start Prep'}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
