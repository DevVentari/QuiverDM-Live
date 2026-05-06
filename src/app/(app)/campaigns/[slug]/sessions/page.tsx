'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useCampaignPageSlot } from '@/hooks/use-campaign-page-slot';
import { PageLayout } from '@/components/layout/page-layout';
import { SessionInspectorPanel } from '@/components/session/session-inspector-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ScrollText, Mic, FileText, Sparkles, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planning:    { label: 'Planning',    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10',       dot: 'bg-slate-500' },
  in_progress: { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       dot: 'bg-amber-400' },
  active:      { label: 'Active',      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       dot: 'bg-amber-400' },
  completed:   { label: 'Completed',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-500' },
};

type FilterStatus = 'all' | 'planning' | 'in_progress' | 'completed';

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5" />}>
      <SessionsPageInner />
    </Suspense>
  );
}

function SessionsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { campaignId, slug, isDM } = useCampaign();
  const prefersReducedMotion = useReducedMotion();
  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });
  const [filter, setFilter] = useState<FilterStatus>('all');

  const selectedId = searchParams.get('session');

  function setSelectedSession(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('session', id);
    else params.delete('session');
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSessions = (sessionsQuery.data ?? []) as any[];
  const activeCount    = allSessions.filter((s) => s.status === 'in_progress' || s.status === 'active').length;
  const completedCount = allSessions.filter((s) => s.status === 'completed').length;

  useCampaignPageSlot('Sessions', [
    { label: allSessions.length === 1 ? 'session' : 'sessions', value: allSessions.length },
    ...(activeCount > 0 ? [{ label: 'active', value: activeCount, alert: true }] : []),
  ]);

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
    in_progress: activeCount,
    completed:   completedCount,
  };

  const selectedSession = allSessions.find((s) => s.id === selectedId) ?? null;

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
    { label: 'total', value: allSessions.length },
    { label: 'completed', value: completedCount },
    ...(activeCount > 0 ? [{ label: 'active', value: activeCount, alert: true }] : []),
  ];

  return (
    <PageLayout overline="Sessions" title="Sessions" stats={heroStats} actions={newSessionAction}>
      {/* Mobile list */}
      <div className="md:hidden space-y-4">
        {allSessions.length > 0 && (
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
        <MobileSessionList sessions={sessions} allSessions={allSessions} slug={slug} isDM={isDM} filter={filter} />
      </div>

      {/* Desktop master-detail */}
      <div className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden border-t border-[hsl(35,35%,18%)] -mx-8 grid-cols-[280px_1fr]">
        {/* Left: filter + list */}
        <div className="flex flex-col overflow-hidden border-r border-[hsl(35,35%,18%)]">
          <div className="px-2 py-2 shrink-0 border-b border-[hsl(35,35%,18%)]">
            <div className="flex flex-wrap gap-1">
              {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
                  <span className="ml-1 opacity-70">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

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
                      className={`w-full text-left px-3 py-2.5 border-b border-[hsl(35,35%,18%)] transition-colors hover:bg-white/[0.03] ${
                        isSelected ? 'bg-amber-500/[0.06] border-l-2 border-l-amber-500/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold tabular-nums transition-colors ${
                          isSelected ? 'border-primary/60 text-primary' : 'border-border text-muted-foreground'
                        }`}>
                          {String(sessionNum).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate font-medium">
                            {session.title || `Session ${sessionNum}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                            <span className="text-[10px] text-muted-foreground">{status.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {hasRec  && <Mic      className="h-3 w-3 text-red-400/70" />}
                          {hasTx   && <FileText  className="h-3 w-3 text-sky-400/70" />}
                          {hasSumm && <Sparkles  className="h-3 w-3 text-purple-400/70" />}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                <ScrollText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {filter !== 'all' ? 'No sessions match this filter' : 'No sessions yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: inspector */}
        <div className="overflow-hidden">
          {selectedSession ? (
            <SessionInspectorPanel session={selectedSession} slug={slug} isDM={isDM} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-[hsl(240,10%,11%)]">
                <ScrollText className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Select a session to inspect</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {allSessions.length > 0
                  ? `${allSessions.length} session${allSessions.length !== 1 ? 's' : ''} in this campaign`
                  : 'No sessions yet'}
              </p>
              {isDM && allSessions.length === 0 && (
                <Button size="sm" className="mt-4 gap-1.5" asChild>
                  <Link href={`/campaigns/${slug}/sessions/prep`}>
                    <Plus className="h-3.5 w-3.5" />
                    New Session
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
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
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <ScrollText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
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
            <div className="glass-panel rounded-lg border border-border hover:border-foreground/20 transition-all overflow-hidden">
              <div className={`h-1 w-full ${status.dot}`} />
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full border border-border flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground">{sessionNum}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{session.title || `Session ${sessionNum}`}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {session.createdAt && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.createdAt), 'MMM d, yyyy')}
                      </span>
                    )}
                    <Badge variant="outline" className={`text-xs ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {hasRec  && <Mic      className="h-3.5 w-3.5 text-red-400/70" />}
                  {hasTx   && <FileText  className="h-3.5 w-3.5 text-sky-400/70" />}
                  {hasSumm && <Sparkles  className="h-3.5 w-3.5 text-purple-400/70" />}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
