'use client';

import { cn } from '@/lib/utils';
import { FileText, Mic, Sparkles } from 'lucide-react';

interface SessionListRowProps {
  session: {
    id: string;
    title: string | null;
    sessionNumber: number | null;
    status: string | null;
    aiSummary: string | null;
    _count?: { recordings: number; transcriptions: number } | null;
    recordings?: unknown[];
    transcriptions?: unknown[];
  };
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_DOT: Record<string, string> = {
  in_progress: 'bg-amber-400',
  active:      'bg-amber-400',
  completed:   'bg-emerald-500',
  planning:    'bg-slate-500',
};

export function SessionListRow({ session, isSelected, onClick }: SessionListRowProps) {
  const sessionNum = session.sessionNumber ?? 0;
  const statusKey = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
  const dotColor = STATUS_DOT[statusKey] ?? STATUS_DOT.planning;
  const hasRecording  = (session._count?.recordings ?? 0) > 0 || ((session.recordings as unknown[])?.length ?? 0) > 0;
  const hasTranscript = (session._count?.transcriptions ?? 0) > 0 || ((session.transcriptions as unknown[])?.length ?? 0) > 0;
  const hasSummary    = !!session.aiSummary;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-amber-500/[0.08] border-l-2 border-amber-500/50'
          : 'border-l-2 border-transparent hover:bg-white/[0.04] hover:border-white/10'
      )}
    >
      <div className={cn(
        'shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-bold tabular-nums font-display',
        isSelected ? 'border-amber-500/50 text-amber-300' : 'border-border text-muted-foreground'
      )}>
        {String(sessionNum).padStart(2, '0')}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {session.title || `Session ${sessionNum}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
          <div className="flex items-center gap-1">
            {hasRecording  && <Mic      className="h-3 w-3 text-red-400/70"    />}
            {hasTranscript && <FileText className="h-3 w-3 text-sky-400/70"    />}
            {hasSummary    && <Sparkles className="h-3 w-3 text-purple-400/70" />}
          </div>
        </div>
      </div>
    </button>
  );
}
