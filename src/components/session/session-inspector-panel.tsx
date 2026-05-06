'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink, FileText, Mic, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning:    { label: 'Planning',    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10' },
  in_progress: { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  active:      { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  completed:   { label: 'Completed',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
};

interface SessionInspectorPanelProps {
  session: {
    id: string;
    title: string | null;
    sessionNumber: number | null;
    status: string | null;
    createdAt: string | Date;
    quickNotes?: string | null;
    prepStatus?: string | null;
    aiSummary: string | null;
    aiSummaryStatus?: string | null;
    _count?: { recordings: number; transcriptions: number } | null;
    recordings?: unknown[];
    transcriptions?: unknown[];
  };
  slug: string;
}

export function SessionInspectorPanel({ session, slug }: SessionInspectorPanelProps) {
  const sessionNum  = session.sessionNumber ?? 0;
  const statusKey   = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
  const status      = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
  const hasRecording  = (session._count?.recordings ?? 0) > 0 || ((session.recordings as unknown[])?.length ?? 0) > 0;
  const hasTranscript = (session._count?.transcriptions ?? 0) > 0 || ((session.transcriptions as unknown[])?.length ?? 0) > 0;
  const hasSummary    = !!session.aiSummary;
  const href = `/campaigns/${slug}/sessions/${session.id}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border/50 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70 mb-1">
              Session {String(sessionNum).padStart(2, '0')}
            </p>
            <h2 className="font-display text-xl font-bold text-foreground leading-tight">
              {session.title || `Session ${sessionNum}`}
            </h2>
          </div>
          <Button size="sm" variant="outline" asChild className="shrink-0">
            <Link href={href}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open
            </Link>
          </Button>
        </div>
        <Badge variant="outline" className={status.color}>{status.label}</Badge>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/50 bg-card/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-1">Created</p>
            <p className="text-sm text-foreground/80 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              {format(new Date(session.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-1">Prep</p>
            <p className="text-sm text-foreground/80">
              {session.prepStatus === 'complete'
                ? 'Complete'
                : session.prepStatus === 'draft'
                  ? 'In progress'
                  : 'Not started'}
            </p>
          </div>
        </div>

        {session.quickNotes && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-2">Quick Notes</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{session.quickNotes}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-2">Content</p>
          <div className="flex flex-wrap gap-2">
            {[
              { has: hasRecording,  icon: Mic,      label: 'Recording',   color: 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15' },
              { has: hasTranscript, icon: FileText,  label: 'Transcript',  color: 'border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/15' },
              { has: hasSummary,    icon: Sparkles,  label: session.aiSummaryStatus === 'processing' ? 'Processing…' : 'Summary', color: 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/15' },
            ].map(({ has, icon: Icon, label, color }) => (
              <Link key={label} href={href}>
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
                  has ? color : 'border-border/40 bg-card/20 text-muted-foreground/40 pointer-events-none'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
