'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ExternalLink, FileText, Mic, ScrollText, Sparkles } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planning:    { label: 'Planning',    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10',       dot: 'bg-slate-500' },
  in_progress: { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       dot: 'bg-amber-400' },
  active:      { label: 'Active',      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       dot: 'bg-amber-400' },
  completed:   { label: 'Completed',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-500' },
};

interface SessionInspectorPanelProps {
  session: any;
  slug: string;
  isDM: boolean;
}

export function SessionInspectorPanel({ session, slug, isDM }: SessionInspectorPanelProps) {
  const statusKey = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
  const status    = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
  const hasRecording  = (session._count?.recordings ?? 0) > 0 || (session.recordings?.length ?? 0) > 0;
  const hasTranscript = (session._count?.transcriptions ?? 0) > 0 || (session.transcriptions?.length ?? 0) > 0;
  const hasSummary    = !!session.aiSummary;
  const sessionNum    = session.sessionNumber ?? 0;
  const href          = `/campaigns/${slug}/sessions/${session.id}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className={`h-1 w-full rounded-full mb-6 ${status.dot}`} />

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-1">
            Session {String(sessionNum).padStart(2, '0')}
          </p>
          <h2 className="font-display text-xl font-bold text-amber-50">
            {session.title || `Session ${sessionNum}`}
          </h2>
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs ${status.color}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
          {status.label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-xs text-muted-foreground">
        {session.createdAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(session.createdAt), 'MMM d, yyyy')}
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

      {session.quickNotes && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-2">Quick Notes</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{session.quickNotes}</p>
        </div>
      )}

      {(hasRecording || hasTranscript || hasSummary) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {hasRecording && (
            <div className="flex items-center gap-1.5 rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">
              <Mic className="h-3 w-3" />
              Recording
            </div>
          )}
          {hasTranscript && (
            <div className="flex items-center gap-1.5 rounded border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-400">
              <FileText className="h-3 w-3" />
              Transcript
            </div>
          )}
          {hasSummary && (
            <div className="flex items-center gap-1.5 rounded border border-purple-500/20 bg-purple-500/10 px-2.5 py-1.5 text-xs text-purple-400">
              <Sparkles className="h-3 w-3" />
              AI Summary
            </div>
          )}
        </div>
      )}

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
