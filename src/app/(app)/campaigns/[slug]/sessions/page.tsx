'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useCampaignPageSlot } from '@/hooks/use-campaign-page-slot';
import { PageLayout } from '@/components/layout/page-layout';
import { SessionListRow } from '@/components/session/session-list-row';
import { SessionInspectorPanel } from '@/components/session/session-inspector-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ScrollText, Mic, FileText, Sparkles, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planning:    { label: 'Planning',    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10',      dot: 'bg-slate-500'  },
  in_progress: { label: 'In Progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',      dot: 'bg-amber-400'  },
  active:      { label: 'Active',      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',      dot: 'bg-amber-400'  },
  completed:   { label: 'Completed',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-500' },
};

type FilterStatus = 'all' | 'planning' | 'in_progress' | 'completed';

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5 rounded-lg" />}>
      <SessionsPageInner />
    </Suspense>
  );
}

function SessionsPageInner() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { campaignId, slug, isDM } = useCampaign();
  const prefersReducedMotion = useReducedMotion();

  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });
  const [filter, setFilter] = useState<FilterStatus>('all');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSessions = (sessionsQuery.data ?? []) as any[];
  const activeCount = allSessions.filter((s) => s.status === 'in_progress' || s.status === 'active').length;

  useCampaignPageSlot('Sessions', [
    { label: allSessions.length === 1 ? 'session' : 'sessions', value: allSessions.length },
    ...(activeCount > 0 ? [{ label: 'active', value: activeCount, alert: true }] : []),
  ]);

  const sessions = filter === 'all'
    ? allSessions
    : allSessions.filter((s) => {
        if (filter === 'in_progress') return s.status === 'in_progress' || s.status === 'active';
        if (filter === 'planning')    return s.status === 'planning' || !s.status;
        return s.status === filter;
      });

  const counts = {
    all:         allSessions.length,
    planning:    allSessions.filter((s) => s.status === 'planning' || !s.status).length,
    in_progress: allSessions.filter((s) => s.status === 'in_progress' || s.status === 'active').length,
    completed:   allSessions.filter((s) => s.status === 'completed').length,
  };

  const selectedId = searchParams.get('session');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedSession = (allSessions.find((s: any) => s.id === selectedId) ?? null) as any;

  function selectSession(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId === id) {
      params.delete('session');
    } else {
      params.set('session', id);
    }
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  const listVariants = {
    hidden: {},
    visible: { transition: prefersReducedMotion ? {} : { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden:  prefersReducedMotion ? {} : { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 } },
  };

  const newSessionAction = isDM ? (
    <Button size="sm" className="gap-1.5" asChild>
      <Link href={`/campaigns/${slug}/sessions/prep`}>
        <Plus className="h-3.5 w-3.5" />
        New Session
      </Link>
    </Button>
  ) : undefined;

  return (
    <PageLayout
      overline="Sessions"
      title="Sessions"
      stats={[
        { label: 'Total',     value: allSessions.length },
        { label: 'Completed', value: counts.completed },
        ...(activeCount > 0 ? [{ label: 'Active', value: activeCount, alert: true }] : []),
      ]}
      actions={newSessionAction}
    >
      {/* ── Mobile layout (unchanged) ── */}
      <div className="md:hidden space-y-4">
        {allSessions.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)} className="rounded-full h-7 px-3 text-xs">
                {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
                <span className="ml-1.5 opacity-70">{counts[f]}</span>
              </Button>
            ))}
          </div>
        )}

        {sessionsQuery.isLoading ? (
          <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
        ) : sessions.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[23px] top-7 bottom-7 w-px bg-border/50 hidden sm:block" />
            <motion.div className="space-y-2" variants={listVariants} initial="hidden" animate="visible">
              {sessions.map((session) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const s = session as any;
                const sessionNum = s.sessionNumber ?? (allSessions.length - allSessions.indexOf(session));
                const statusKey  = s.status === 'active' ? 'in_progress' : (s.status ?? 'planning');
                const status     = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.planning;
                const isPlanning = s.status === 'planning' || !s.status;
                const hasRecording  = (s._count?.recordings ?? 0) > 0 || (s.recordings?.length ?? 0) > 0;
                const hasTranscript = (s._count?.transcriptions ?? 0) > 0 || (s.transcriptions?.length ?? 0) > 0;
                const hasSummary    = !!s.aiSummary;

                return (
                  <motion.div key={s.id} variants={itemVariants}>
                    <Link href={`/campaigns/${slug}/sessions/${s.id}`}>
                      <div className="flex gap-4 group cursor-pointer">
                        <div className="relative z-10 shrink-0 hidden sm:flex items-start pt-1.5">
                          <div className={`w-12 h-12 rounded-full border-2 bg-card group-hover:border-primary/50 transition-all duration-200 flex items-center justify-center ${isPlanning ? 'border-dashed border-border/70' : 'border-border'}`}>
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors tabular-nums">
                              {String(sessionNum).padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                        <div className="relative flex-1 min-w-0 glass-panel rounded-lg border border-border hover:border-foreground/20 transition-all duration-150 overflow-hidden mb-1">
                          <div className={`h-1 w-full ${status.dot}`} />
                          <div className="px-4 py-3 flex items-center gap-3">
                            <div className="sm:hidden shrink-0 w-8 h-8 rounded-full border border-border flex items-center justify-center">
                              <span className="text-[10px] font-bold text-muted-foreground">{sessionNum}</span>
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{s.title || `Session ${sessionNum}`}</span>
                                {!isPlanning && s.status !== 'completed' && (
                                  <Badge variant="outline" className={`text-xs capitalize shrink-0 ${status.color}`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
                                    {status.label}
                                  </Badge>
                                )}
                                {isPlanning && <Badge variant="outline" className="text-xs shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/10">Planning</Badge>}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                {s.createdAt && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(s.createdAt), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasRecording  && <span className="w-6 h-6 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center"><Mic      className="h-3 w-3 text-red-400"    /></span>}
                              {hasTranscript && <span className="w-6 h-6 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center"><FileText className="h-3 w-3 text-sky-400"    /></span>}
                              {hasSummary    && <span className="w-6 h-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"><Sparkles className="h-3 w-3 text-purple-400" /></span>}
                              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-1" />
                            </div>
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
          <div className="relative rounded-lg border border-dashed border-border overflow-hidden">
            <div className="relative flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-5">
                <ScrollText className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">No sessions yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">Sessions track your D&D game nights.</p>
              {isDM && (
                <Button size="sm" className="gap-1.5" asChild>
                  <Link href={`/campaigns/${slug}/sessions/prep`}><Plus className="h-3.5 w-3.5" />Create First Session</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop master-detail layout ── */}
      <div className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden border-t border-[hsl(35,35%,18%)] -mx-8 grid-cols-[280px_1fr]">
        {/* Left: filter pills + session list */}
        <div className="flex flex-col overflow-hidden border-r border-[hsl(35,35%,18%)]">
          <div className="flex gap-1 flex-wrap p-2.5 border-b border-[hsl(35,35%,18%)] shrink-0">
            {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'}
                onClick={() => setFilter(f)} className="h-6 px-2.5 text-[11px] rounded-full">
                {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
                <span className="ml-1 opacity-60">{counts[f]}</span>
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessionsQuery.isLoading ? (
              <div className="space-y-1 p-2">
                {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
              </div>
            ) : sessions.length > 0 ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sessions.map((session: any) => (
                <SessionListRow
                  key={session.id}
                  session={session}
                  isSelected={selectedId === session.id}
                  onClick={() => selectSession(session.id)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                <ScrollText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No sessions</p>
                {isDM && (
                  <Button size="sm" variant="outline" className="mt-3" asChild>
                    <Link href={`/campaigns/${slug}/sessions/prep`}>Create First</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: inspector or empty state */}
        <div className="overflow-hidden">
          {selectedSession ? (
            <SessionInspectorPanel session={selectedSession} slug={slug} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-[hsl(240,10%,11%)]">
                <ScrollText className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Select a session to inspect</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} in this campaign
              </p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
