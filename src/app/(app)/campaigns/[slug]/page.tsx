'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ContinueActionCard, type ContinueAction } from '@/components/campaign/continue-action-card';
import { deriveSessionPhase } from '@/lib/session-lifecycle';

// ── Derive the hero CTA from the most recent actionable session ──────────────
function computeContinueAction(
  sessions: any[],
  slug: string
): ContinueAction | null {
  if (!sessions.length) return null;

  for (const session of sessions) {
    const phase = deriveSessionPhase({
      status: session.status ?? 'planning',
      aiSummaryStatus: session.aiSummaryStatus ?? 'none',
      aiSummary: session.aiSummary ?? null,
      recordingCount: session.recordings?.length ?? 0,
      hasApprovedRecap: false,
    });

    if (phase === 'complete') continue;

    const base = { sessionId: session.id, sessionNumber: session.sessionNumber, sessionTitle: session.title ?? null };
    const hub = `/campaigns/${slug}/sessions/${session.id}`;

    const actions: Record<string, Omit<ContinueAction, 'sessionId' | 'sessionNumber' | 'sessionTitle'>> = {
      prep:       { phase, icon: '📋', label: 'Continue Prep',     description: 'Finish your session prep before game day',                              href: hub },
      ran:        { phase, icon: '🎮', label: 'End Session',        description: 'Mark session complete and start post-session',                          href: hub },
      processing: { phase, icon: '🎙️', label: 'Upload Recording',   description: 'Upload your audio to generate transcript and summary',                  href: hub },
      summary:    { phase, icon: '✨', label: 'View Summary',        description: session.aiSummaryStatus === 'processing' ? 'Transcript processing…' : 'Generate AI summary', href: hub, loading: session.aiSummaryStatus === 'processing' },
      recap:      { phase, icon: '📰', label: 'Review Recap',        description: 'Review and approve your session recap',                                 href: hub },
    };

    return { ...base, ...actions[phase] };
  }

  // All sessions complete — prompt to start the next one
  const next = sessions[0];
  return {
    sessionId: next.id,
    sessionNumber: (next.sessionNumber ?? 0) + 1,
    sessionTitle: null,
    phase: 'prep',
    icon: '📋',
    label: 'New Session',
    description: 'All sessions complete — start planning the next one',
    href: `/campaigns/${slug}/sessions/prep`,
  };
}

// ── World pressure tracks ─────────────────────────────────────────────────────
const PRESSURE_TRACKS = [
  ['Political',    'pressurePolitical'],
  ['Supernatural', 'pressureSupernatural'],
  ['Economic',     'pressureEconomic'],
  ['Cosmic',       'pressureCosmic'],
  ['Social',       'pressureSocial'],
] as const;

function pressureColor(value: number) {
  if (value > 0.75) return 'hsl(0 62% 50%)';
  if (value > 0.5)  return 'hsl(35 80% 55%)';
  return 'hsl(35 50% 40%)';
}

export default function CampaignOverviewPage() {
  const { campaignId, slug, isDM } = useCampaign();

  const campaignQuery = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 300_000 });
  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 60_000 });
  const stateQuery    = trpc.brain.state.get.useQuery({ campaignId }, { enabled: isDM, staleTime: 60_000 });

  const campaign  = campaignQuery.data;
  const sessions  = (sessionsQuery.data ?? []) as any[];
  const state     = stateQuery.data as Record<string, any> | undefined;
  const hooks     = (Array.isArray(state?.hooks) ? state.hooks : []) as any[];
  const openHooks = hooks
    .filter((h: any) => h.status !== 'resolved')
    .sort((a: any, b: any) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.urgency] ?? 2) - (order[b.urgency] ?? 2);
    })
    .slice(0, 5);

  const nextSession = sessions.find(
    (s: any) => s.status === 'planning' && s.id !== sessions[0]?.id
  );
  const continueAction = computeContinueAction(sessions, slug);
  const hasWorldPressure = PRESSURE_TRACKS.some(([, field]) => (state?.[field] ?? 0) > 0);

  const memberCount = campaign?._count?.members ?? 0;

  if (campaignQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Campaign header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">{campaign?.name ?? 'Campaign'}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {sessions.length} sessions
            {memberCount > 0 ? ` · ${memberCount} members` : ''}
            {campaign?.createdAt ? ` · Active since ${format(new Date(campaign.createdAt), 'MMM yyyy')}` : ''}
          </p>
        </div>
        {isDM && (
          <span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: 'hsl(35 60% 10%)', border: '1px solid hsl(35 60% 28%)', color: 'hsl(35 70% 52%)' }}>
            DM
          </span>
        )}
      </div>

      {/* Hero: continue where you left off */}
      {isDM && <ContinueActionCard action={continueAction} slug={slug} />}

      {/* Next session row */}
      {nextSession && (
        <Link href={`/campaigns/${slug}/sessions/${nextSession.id}`} className="block">
          <div className="stone-card glass-panel flex items-center gap-3 px-4 py-3 hover:border-foreground/20 transition-colors">
            <div className="text-[10px] font-bold px-2 py-1 rounded shrink-0 tabular-nums" style={{ background: 'hsl(240 10% 14%)', border: '1px solid hsl(240 20% 80% / 0.1)', color: 'hsl(240 5% 55%)' }}>
              {nextSession.date ? format(new Date(nextSession.date), 'EEE MMM d') : 'Upcoming'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Session {nextSession.sessionNumber}{nextSession.title ? ` · ${nextSession.title}` : ''}</p>
              <p className="text-xs text-muted-foreground">
                {nextSession.prepStatus === 'complete' ? 'Prep complete' : nextSession.prepStatus === 'draft' ? 'Prep in progress' : 'No prep yet'}
              </p>
            </div>
            {nextSession.prepStatus !== 'none' && (
              <span className="text-xs font-semibold text-amber-400/70 shrink-0">
                {nextSession.prepStatus === 'complete' ? '100%' : 'Prep →'}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* World state — only if Brain data exists */}
      {isDM && (hasWorldPressure || openHooks.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {hasWorldPressure && (
            <div className="stone-card glass-panel">
              <div className="stone-card-header pb-2">
                <span className="stone-card-title text-xs">World Pressure</span>
              </div>
              <div className="stone-card-body space-y-2.5">
                {PRESSURE_TRACKS.map(([label, field]) => {
                  const raw = state?.[field] ?? 0;
                  if (raw === 0) return null;
                  const pct = Math.round(raw * 100);
                  return (
                    <div key={field}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
                        <span className="text-xs font-mono text-amber-400/80">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pressureColor(raw) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {openHooks.length > 0 && (
            <div className="stone-card glass-panel">
              <div className="stone-card-header pb-2">
                <span className="stone-card-title text-xs">Open Hooks</span>
              </div>
              <div className="stone-card-body divide-y divide-border/50">
                {openHooks.map((hook: any) => (
                  <div
                    key={hook.id ?? hook.text}
                    className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0"
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      hook.urgency === 'high' ? 'bg-red-500' : hook.urgency === 'medium' ? 'bg-amber-400' : 'bg-muted-foreground/40'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{hook.text}</p>
                      {hook.ageInSessions != null && (
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{hook.ageInSessions} sessions old</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
