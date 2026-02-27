'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ScrollText, Mic, FileText, Sparkles, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planning:    { label: 'Planning',    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10',   dot: 'bg-slate-500' },
  in_progress: { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',   dot: 'bg-amber-400' },
  active:      { label: 'Active',      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',   dot: 'bg-amber-400' },
  completed:   { label: 'Completed',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-500' },
};

type FilterStatus = 'all' | 'planning' | 'in_progress' | 'completed';

export default function SessionsPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const prefersReducedMotion = useReducedMotion();
  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });
  const [filter, setFilter] = useState<FilterStatus>('all');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSessions = (sessionsQuery.data ?? []) as any[];
  const sessions = filter === 'all'
    ? allSessions
    : allSessions.filter((s) => {
        if (filter === 'in_progress') return s.status === 'in_progress' || s.status === 'active';
        if (filter === 'planning') return s.status === 'planning' || !s.status;
        return s.status === filter;
      });

  const counts = {
    all:         allSessions.length,
    planning:    allSessions.filter((s) => s.status === 'planning' || !s.status).length,
    in_progress: allSessions.filter((s) => s.status === 'in_progress' || s.status === 'active').length,
    completed:   allSessions.filter((s) => s.status === 'completed').length,
  };

  const listVariants = {
    hidden: {},
    visible: {
      transition: prefersReducedMotion ? {} : { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: prefersReducedMotion ? {} : { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { type: 'spring', stiffness: 320, damping: 28 },
    },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        className="flex items-end justify-between"
        initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Sessions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {allSessions.length} {allSessions.length === 1 ? 'session' : 'sessions'} recorded
          </p>
        </div>
        {isDM && (
          <Button size="sm" className="gap-1.5" asChild>
            <Link href={`/campaigns/${slug}/sessions/prep`}>
              <Plus className="h-3.5 w-3.5" />
              New Session
            </Link>
          </Button>
        )}
      </motion.div>

      {/* Status filter pills */}
      {allSessions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
              <span className="ml-1.5 opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Session list */}
      {sessionsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : sessionsQuery.isError ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load sessions.</p>
        </div>
      ) : sessions.length > 0 ? (
        <div className="relative">
          {/* Vertical timeline connector */}
          <div className="absolute left-[23px] top-7 bottom-7 w-px bg-border/50 hidden sm:block" />

          <motion.div
            className="space-y-2"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {sessions.map((session) => {
              const sessionNum = session.sessionNumber ?? (allSessions.length - allSessions.indexOf(session));
              const statusKey = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
              const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
              const hasRecording  = (session._count?.recordings ?? 0) > 0 || (session.recordings?.length ?? 0) > 0;
              const hasTranscript = (session._count?.transcriptions ?? 0) > 0 || (session.transcriptions?.length ?? 0) > 0;
              const hasSummary    = !!session.aiSummary;
              const isPlanning    = session.status === 'planning' || !session.status;

              return (
                <motion.div key={session.id} variants={itemVariants}>
                  <Link href={`/campaigns/${slug}/sessions/${session.id}`}>
                    <div className="flex gap-4 group cursor-pointer">
                      {/* Session number bubble */}
                      <div className="relative z-10 shrink-0 hidden sm:flex items-start pt-1.5">
                        <div className={`w-12 h-12 rounded-full border-2 bg-card group-hover:border-primary/50 transition-all duration-200 flex items-center justify-center ${isPlanning ? 'border-dashed border-border/70' : 'border-border'}`}>
                          <span className="font-display text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors tabular-nums">
                            {String(sessionNum).padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      {/* Card */}
                      <div className="flex-1 min-w-0 rounded-lg border border-border bg-card hover:border-foreground/20 hover:bg-card/80 transition-all duration-150 px-4 py-3 flex items-center gap-3 mb-1">
                        {/* Mobile number */}
                        <div className="sm:hidden shrink-0 w-8 h-8 rounded-full border border-border flex items-center justify-center">
                          <span className="font-display text-[10px] font-bold text-muted-foreground">{sessionNum}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {session.title || `Session ${sessionNum}`}
                            </span>
                            {!isPlanning && session.status !== 'completed' && (
                              <Badge variant="outline" className={`text-xs capitalize shrink-0 ${status.color}`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
                                {status.label}
                              </Badge>
                            )}
                            {isPlanning && (
                              <Badge variant="outline" className="text-xs shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/10">
                                Planning
                              </Badge>
                            )}
                            {session.prepStatus === 'draft' && (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 hover:border-amber-400/50"
                              >
                                <Link href={`/campaigns/${slug}/sessions/prep?sessionId=${session.id}`}>
                                  Prep Draft
                                </Link>
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            {session.createdAt && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(session.createdAt), 'MMM d, yyyy')}
                              </span>
                            )}
                            {session.quickNotes && (
                              <span className="text-xs text-muted-foreground/70 truncate max-w-[220px]">
                                {session.quickNotes}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Feature pips + chevron */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasRecording && (
                            <span className="w-6 h-6 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center" title="Recording">
                              <Mic className="h-3 w-3 text-red-400" />
                            </span>
                          )}
                          {hasTranscript && (
                            <span className="w-6 h-6 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center" title="Transcript">
                              <FileText className="h-3 w-3 text-sky-400" />
                            </span>
                          )}
                          {hasSummary && (
                            <span className="w-6 h-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center" title="AI Summary">
                              <Sparkles className="h-3 w-3 text-purple-400" />
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      ) : (
        <motion.div
          className="relative rounded-lg border border-dashed border-border overflow-hidden"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-5">
              <ScrollText className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">
              {filter !== 'all' ? `No ${STATUS_CONFIG[filter]?.label} sessions` : 'No sessions yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {filter !== 'all'
                ? 'Try a different filter above.'
                : 'Sessions track your D&D game nights — recordings, transcripts, and AI recaps all live here.'}
            </p>
            {isDM && filter === 'all' && (
              <Button size="sm" className="gap-1.5" asChild>
                <Link href={`/campaigns/${slug}/sessions/new`}>
                  <Plus className="h-3.5 w-3.5" />
                  Create First Session
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
