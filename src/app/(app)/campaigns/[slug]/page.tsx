'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ContinueActionCard, type ContinueAction } from '@/components/campaign/continue-action-card';
import { deriveSessionPhase } from '@/lib/session-lifecycle';
import { PageLayout } from '@/components/layout/page-layout';

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
      hasApprovedRecap: ((session._count as { recaps?: number } | undefined)?.recaps ?? 0) > 0,
    });

    if (phase === 'complete') continue;

    const base = { sessionId: session.id, sessionNumber: session.sessionNumber, sessionTitle: session.title ?? null };
    const hub = `/campaigns/${slug}/sessions/${session.id}`;

    const actions: Record<string, Omit<ContinueAction, 'sessionId' | 'sessionNumber' | 'sessionTitle'>> = {
      prep: { phase, icon: '📋', label: 'Continue Prep', description: 'Finish your session prep before game day', href: hub },
      ran: { phase, icon: '🎮', label: 'End Session', description: 'Mark session complete and start post-session', href: hub },
      processing: { phase, icon: '🎙️', label: 'Upload Recording', description: 'Upload your audio to generate transcript and summary', href: hub },
      summary: {
        phase,
        icon: '✨',
        label: 'View Summary',
        description: session.aiSummaryStatus === 'processing' ? 'Transcript processing...' : 'Generate AI summary',
        href: hub,
        loading: session.aiSummaryStatus === 'processing',
      },
      recap: { phase, icon: '📰', label: 'Review Recap', description: 'Review and approve your session recap', href: hub },
    };

    return { ...base, ...actions[phase] };
  }

  const next = sessions[0];
  return {
    sessionId: next.id,
    sessionNumber: (next.sessionNumber ?? 0) + 1,
    sessionTitle: null,
    phase: 'prep',
    icon: '📋',
    label: 'New Session',
    description: 'All sessions complete. Start planning the next one.',
    href: `/campaigns/${slug}/sessions/prep`,
  };
}

const PRESSURE_TRACKS = [
  ['Political', 'pressurePolitical'],
  ['Supernatural', 'pressureSupernatural'],
  ['Economic', 'pressureEconomic'],
  ['Cosmic', 'pressureCosmic'],
  ['Social', 'pressureSocial'],
] as const;

function pressureColor(value: number) {
  if (value > 0.75) return 'hsl(0 62% 50%)';
  if (value > 0.5) return 'hsl(35 80% 55%)';
  return 'hsl(35 50% 40%)';
}

export default function CampaignOverviewPage() {
  const { campaignId, slug, isDM } = useCampaign();

  const campaignQuery = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 300_000 });
  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 60_000 });
  const stateQuery = trpc.brain.state.get.useQuery({ campaignId }, { enabled: isDM, staleTime: 60_000 });

  const campaign = campaignQuery.data;
  const sessions = (sessionsQuery.data ?? []) as any[];
  const state = stateQuery.data as Record<string, any> | undefined;
  const hooks = (Array.isArray(state?.hooks) ? state.hooks : []) as any[];
  const openHooks = hooks
    .filter((hook: any) => hook.status !== 'resolved')
    .sort((a: any, b: any) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.urgency] ?? 2) - (order[b.urgency] ?? 2);
    })
    .slice(0, 5);

  const continueAction = computeContinueAction(sessions, slug);
  const heroSessionId = continueAction?.sessionId;
  const nextSession = sessions.find(
    (session: any) =>
      session.status === 'planning' &&
      session.id !== heroSessionId &&
      session.date &&
      new Date(session.date) > new Date()
  );
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
    <PageLayout
      overline="Campaign"
      title={campaign?.name ?? 'Campaign'}
      subtitle={`${sessions.length} sessions${memberCount > 0 ? ` · ${memberCount} members` : ''}${campaign?.createdAt ? ` · Active since ${format(new Date(campaign.createdAt), 'MMM yyyy')}` : ''}`}
      maxWidth="lg"
      actions={
        isDM ? (
          <span className="rounded-full border border-amber-500/35 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Dungeon Master
          </span>
        ) : undefined
      }
    >
      {isDM && <ContinueActionCard action={continueAction} slug={slug} />}

      {nextSession && (
        <Link href={`/campaigns/${slug}/sessions/${nextSession.id}`} className="block">
          <div className="stone-card glass-panel flex items-center gap-3 px-4 py-3 transition-colors hover:border-foreground/20">
            <div className="shrink-0 rounded border border-[hsl(240_20%_80%_/_0.1)] bg-[hsl(240_10%_14%)] px-2 py-1 text-[10px] font-bold tabular-nums text-[hsl(240_5%_55%)]">
              {nextSession.date ? format(new Date(nextSession.date), 'EEE MMM d') : 'Upcoming'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Session {nextSession.sessionNumber}
                {nextSession.title ? ` · ${nextSession.title}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {nextSession.prepStatus === 'complete'
                  ? 'Prep complete'
                  : nextSession.prepStatus === 'draft'
                    ? 'Prep in progress'
                    : 'No prep yet'}
              </p>
            </div>
            {nextSession.prepStatus !== 'none' && (
              <span className="shrink-0 text-xs font-semibold text-amber-400/70">
                {nextSession.prepStatus === 'complete' ? '100%' : 'Prep →'}
              </span>
            )}
          </div>
        </Link>
      )}

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
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
                        <span className="text-xs font-mono text-amber-400/80">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
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
                  <div key={hook.id ?? hook.text} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        hook.urgency === 'high'
                          ? 'bg-red-500'
                          : hook.urgency === 'medium'
                            ? 'bg-amber-400'
                            : 'bg-muted-foreground/40'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs text-muted-foreground">{hook.text}</p>
                      {hook.ageInSessions != null && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground/40">{hook.ageInSessions} sessions old</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
