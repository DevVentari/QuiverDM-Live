'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Session0HeroCard } from '@/components/campaign/Session0HeroCard';
import { SplitCanvas } from '@/components/layout/split-canvas';
import { SessionInspectorPanel } from '@/components/session/session-inspector-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/primitives';
import { Plus, ScrollText, Mic, FileText, Sparkles, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planning:    { label: 'Planning',    color: 'text-[var(--q-text-faint)] border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)]',  dot: 'bg-[var(--q-text-faint)]' },
  in_progress: { label: 'In Progress', color: 'text-[var(--q-amber)] border-[var(--q-amber-border)] bg-[var(--q-amber-trace)]',             dot: 'bg-[var(--q-amber)]' },
  active:      { label: 'Active',      color: 'text-[var(--q-amber)] border-[var(--q-amber-border)] bg-[var(--q-amber-trace)]',             dot: 'bg-[var(--q-amber)]' },
  completed:   { label: 'Completed',   color: 'text-[var(--q-text-dim)] border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)]',    dot: 'bg-[var(--q-text-dim)]' },
};

type FilterStatus = 'all' | 'planning' | 'in_progress' | 'completed';

export default function SessionsPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const prefersReducedMotion = useReducedMotion();
  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedId, setSelectedSession] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSessions = (sessionsQuery.data ?? []) as any[];

  // Detect Session 0 - show hero card until a real session (sessionNumber >= 1) exists
  const session0 = allSessions.find((s) => s.sessionNumber === 0);
  const hasRealSessions = allSessions.some((s) => s.sessionNumber >= 1);
  const showSession0Card = isDM && !!session0 && !hasRealSessions && (() => {
    try { return !sessionStorage.getItem(`session0-dismissed-${session0.id}`); } catch { return true; }
  })();

  // Exclude session 0 from the visible sessions list
  const allDisplaySessions = allSessions.filter((s) => s.sessionNumber !== 0);

  const activeCount    = allDisplaySessions.filter((s) => s.status === 'in_progress' || s.status === 'active').length;
  const completedCount = allDisplaySessions.filter((s) => s.status === 'completed').length;

  const sessions = filter === 'all'
    ? allDisplaySessions
    : allDisplaySessions.filter((s) => {
        if (filter === 'in_progress') return s.status === 'in_progress' || s.status === 'active';
        if (filter === 'planning') return s.status === 'planning' || !s.status;
        return s.status === filter;
      });

  const counts = {
    all:         allDisplaySessions.length,
    planning:    allDisplaySessions.filter((s) => s.status === 'planning' || !s.status).length,
    in_progress: activeCount,
    completed:   completedCount,
  };

  const selectedSession = allDisplaySessions.find((s) => s.id === selectedId) ?? null;

  const listVariants = {
    hidden: {},
    visible: { transition: prefersReducedMotion ? {} : { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: prefersReducedMotion ? {} : { opacity: 0, y: 8 },
    visible: {
      opacity: 1, y: 0,
      transition: prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 },
    },
  };

  const newSessionAction = isDM ? (
    <Button size="sm" className="gap-1.5" asChild>
      <Link href={`/campaigns/${slug}/sessions/prep`}>
        <Plus className="h-3.5 w-3.5" />
        New Session
      </Link>
    </Button>
  ) : undefined;

  const heroStats = [
    { label: 'total', value: allDisplaySessions.length },
    { label: 'completed', value: completedCount },
    ...(activeCount > 0 ? [{ label: 'active', value: activeCount, alert: true }] : []),
  ];

  const leftPane = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1 px-2 py-2 flex-shrink-0 border-b border-[var(--q-border-subtle)]">
        {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              filter === f
                ? 'bg-[var(--q-amber-trace)] border border-[var(--q-amber-border)] text-[var(--q-amber)]'
                : 'text-[var(--q-text-dim)] hover:text-[var(--q-text)] hover:bg-[var(--q-amber-trace)]'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
            <span className="ml-1 opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessionsQuery.isLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full rounded" />)}
          </div>
        ) : sessions.length > 0 ? (
          <motion.div variants={listVariants} initial="hidden" animate="visible">
            {sessions.map((session) => {
              const sessionNum = session.sessionNumber ?? (allSessions.length - allSessions.indexOf(session));
              const statusKey  = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
              const status     = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
              const hasRec     = (session._count?.recordings ?? 0) > 0 || (session.recordings?.length ?? 0) > 0;
              const hasTx      = (session._count?.transcriptions ?? 0) > 0 || (session.transcriptions?.length ?? 0) > 0;
              const hasSumm    = !!session.aiSummary;
              const isSelected = selectedId === session.id;

              return (
                <motion.button
                  key={session.id}
                  variants={itemVariants}
                  onClick={() => setSelectedSession(isSelected ? null : session.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[var(--q-border-subtle)] transition-colors hover:bg-[var(--q-amber-trace)] ${
                    isSelected ? 'bg-[var(--q-amber-trace)] border-l-2 border-l-[var(--q-amber)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold tabular-nums transition-colors ${
                      isSelected ? 'border-[var(--q-amber-border)] text-[var(--q-amber)]' : 'border-[var(--q-border-subtle)] text-[var(--q-text-dim)]'
                    }`}>
                      {String(sessionNum).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium text-[var(--q-text)]">
                        {session.title || `Session ${sessionNum}`}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                        <span className="text-[10px] text-[var(--q-text-dim)]">{status.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 text-[var(--q-text-faint)]">
                      {hasRec  && <Mic      className="h-3 w-3" />}
                      {hasTx   && <FileText  className="h-3 w-3" />}
                      {hasSumm && <Sparkles  className="h-3 w-3" />}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
            <ScrollText className="h-8 w-8 text-[var(--q-text-faint)] mb-3" />
            <p className="text-sm text-[var(--q-text-dim)]">
              {filter !== 'all' ? 'No sessions match this filter' : 'No sessions yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {showSession0Card && (
        <Session0HeroCard
          session0Id={session0.id}
          campaignSlug={slug}
          initialPrepStatus={session0.prepStatus ?? 'draft'}
        />
      )}

      {/* Mobile: full-page list */}
      <div className="md:hidden p-4 space-y-4">
        {allDisplaySessions.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
                className="rounded-full h-7 px-3 text-xs"
              >
                {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
                <span className="ml-1.5 opacity-70">{counts[f]}</span>
              </Button>
            ))}
          </div>
        )}
        <MobileSessionList sessions={sessions} allSessions={allDisplaySessions} slug={slug} isDM={isDM} filter={filter} />
      </div>

      {/* Desktop: SplitCanvas */}
      <div className="hidden md:flex h-full">
        <SplitCanvas
          overline="Sessions"
          title="Sessions"
          stats={heroStats}
          actions={newSessionAction}
          leftPane={leftPane}
        >
          {selectedSession ? (
            <SessionInspectorPanel session={selectedSession} slug={slug} isDM={isDM} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)]">
                <ScrollText className="h-7 w-7 text-[var(--q-text-faint)]" />
              </div>
              <p className="text-sm font-medium text-[var(--q-text-dim)]">Select a session to inspect</p>
              <p className="text-xs text-[var(--q-text-faint)] mt-1">
                {allDisplaySessions.length > 0
                  ? `${allDisplaySessions.length} session${allDisplaySessions.length !== 1 ? 's' : ''} in this campaign`
                  : 'No sessions yet'}
              </p>
              {isDM && allDisplaySessions.length === 0 && (
                <Button size="sm" className="mt-4 gap-1.5" asChild>
                  <Link href={`/campaigns/${slug}/sessions/prep`}>
                    <Plus className="h-3.5 w-3.5" />
                    New Session
                  </Link>
                </Button>
              )}
            </div>
          )}
        </SplitCanvas>
      </div>
    </>
  );
}

function MobileSessionList({
  sessions, allSessions, slug, isDM, filter,
}: {
  sessions: any[];
  allSessions: any[];
  slug: string;
  isDM: boolean;
  filter: FilterStatus;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-[var(--q-border-subtle)] p-12 text-center">
        <ScrollText className="h-8 w-8 text-[var(--q-text-faint)] mx-auto mb-3" />
        <p className="text-sm text-[var(--q-text-dim)]">
          {filter !== 'all' ? `No ${STATUS_CONFIG[filter]?.label} sessions` : 'No sessions yet'}
        </p>
        {isDM && filter === 'all' && (
          <Button size="sm" className="mt-4 gap-1.5" asChild>
            <Link href={`/campaigns/${slug}/sessions/prep`}>
              <Plus className="h-3.5 w-3.5" />
              Create First Session
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const sessionNum = session.sessionNumber ?? (allSessions.length - allSessions.indexOf(session));
        const statusKey  = session.status === 'active' ? 'in_progress' : (session.status ?? 'planning');
        const status     = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
        const hasRec     = (session._count?.recordings ?? 0) > 0 || (session.recordings?.length ?? 0) > 0;
        const hasTx      = (session._count?.transcriptions ?? 0) > 0 || (session.transcriptions?.length ?? 0) > 0;
        const hasSumm    = !!session.aiSummary;

        return (
          <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
            <Surface variant="utility" className="overflow-hidden hover:border-[var(--q-amber-border)]">
              <div className={`h-1 w-full ${status.dot}`} />
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full border border-[var(--q-border-subtle)] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[var(--q-text-dim)]">{sessionNum}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-[var(--q-text)]">{session.title || `Session ${sessionNum}`}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {session.createdAt && (
                      <span className="flex items-center gap-1 text-xs text-[var(--q-text-dim)]">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.createdAt), 'MMM d, yyyy')}
                      </span>
                    )}
                    <Badge variant="outline" className={`text-xs ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[var(--q-text-faint)]">
                  {hasRec  && <Mic      className="h-3.5 w-3.5" />}
                  {hasTx   && <FileText  className="h-3.5 w-3.5" />}
                  {hasSumm && <Sparkles  className="h-3.5 w-3.5" />}
                </div>
              </div>
            </Surface>
          </Link>
        );
      })}
    </div>
  );
}
