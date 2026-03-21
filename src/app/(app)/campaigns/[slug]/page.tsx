'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Plus,
  Brain,
  Settings,
  ArrowRight,
  Scroll,
} from 'lucide-react';

export default function CampaignOverviewPage() {
  const { campaignId, slug, isDM } = useCampaign();

  const campaignQuery = trpc.campaigns.getBySlug.useQuery(
    { slug },
    { staleTime: 300_000 }
  );
  const sessionsQuery = trpc.sessions.getAll.useQuery(
    { campaignId },
    { staleTime: 60_000 }
  );
  const membersQuery = trpc.members.getAll.useQuery(
    { campaignId },
    { staleTime: 120_000 }
  );
  const stateQuery = trpc.brain.state.get.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );

  const isLoading =
    campaignQuery.isLoading || sessionsQuery.isLoading;

  const campaign = campaignQuery.data;
  const lastSession = sessionsQuery.data?.[0] ?? null;
  const pressures = stateQuery.data as any;

  const statStrip = (
    <div className="stone-card flex divide-x" style={{ borderColor: 'hsl(35 35% 18%)' }}>
      {[
        { value: sessionsQuery.data?.length ?? 0, label: 'Sessions' },
        { value: membersQuery.data?.length ?? 0, label: 'Members' },
        { value: campaign?.isPublic ? 'Public' : 'Private', label: 'Visibility' },
      ].map(({ value, label }) => (
        <div key={label} className="stone-card-body flex-1 text-center" style={{ borderColor: 'hsl(35 35% 18%)' }}>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );

  // ─── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded" />
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-2 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  // ─── Last session card ───────────────────────────────────────────────────────
  const lastSessionCard = (
    <div className="stone-card relative overflow-hidden md:col-span-2">
      {lastSession && (
        <span className="absolute right-4 top-2 text-8xl font-bold text-foreground/5 select-none leading-none pointer-events-none">
          #{lastSession.sessionNumber}
        </span>
      )}
      <div className="stone-card-header">
        <span className="stone-card-title">Last Session</span>
      </div>
      <div className="stone-card-body">
        {lastSession ? (
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-lg leading-tight">
                {lastSession.title ?? `Session ${lastSession.sessionNumber}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lastSession.date
                  ? formatDistanceToNow(new Date(lastSession.date), { addSuffix: true })
                  : lastSession.createdAt
                  ? formatDistanceToNow(new Date(lastSession.createdAt), { addSuffix: true })
                  : null}
              </p>
            </div>
            {lastSession.aiSummary && typeof lastSession.aiSummary === 'string' && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {lastSession.aiSummary}
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/campaigns/${slug}/sessions/${lastSession.id}`}>
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <Scroll className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No sessions yet — start your first!</p>
            {isDM && (
              <Button asChild size="sm" className="mt-3">
                <Link href={`/campaigns/${slug}/sessions`}>
                  Create Session
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ─── DM Quick Actions ────────────────────────────────────────────────────────
  const sidePanel = (
    <div className="stone-card">
      <div className="stone-card-header">
        <span className="stone-card-title">Quick Actions</span>
      </div>
      <div className="stone-card-body flex flex-col gap-2">
        <Button asChild className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/sessions/prep`}>
            <Play className="h-4 w-4" />
            New Session
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/npcs/new`}>
            <Plus className="h-4 w-4" />
            Add NPC
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/brain`}>
            <Brain className="h-4 w-4" />
            Open Brain
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/settings`}>
            <Settings className="h-4 w-4" />
            Campaign Settings
          </Link>
        </Button>
      </div>
    </div>
  );

  // ─── World Pressure card (always shown) ─────────────────────────────────────
  const pressureCard = (
    <div className="stone-card">
      <div className="stone-card-header">
        <span className="stone-card-title">World Pressure</span>
      </div>
      <div className="stone-card-body space-y-2">
        {([
          ['Political', 'pressurePolitical'],
          ['Supernatural', 'pressureSupernatural'],
          ['Economic', 'pressureEconomic'],
          ['Cosmic', 'pressureCosmic'],
          ['Social', 'pressureSocial'],
        ] as const).some(([, field]) => typeof pressures?.[field] === 'number' && (pressures[field] as number) > 0) ? (
          ([
            ['Political', 'pressurePolitical'],
            ['Supernatural', 'pressureSupernatural'],
            ['Economic', 'pressureEconomic'],
            ['Cosmic', 'pressureCosmic'],
            ['Social', 'pressureSocial'],
          ] as const).map(([label, field]) => {
            const raw = typeof pressures[field] === 'number' ? pressures[field] : 0;
            const value = Math.round(raw * 100);
            if (value === 0) return null;
            return (
              <div key={field} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
                  <span className="text-xs font-mono text-amber-400/80">{value}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${value}%`,
                      background: value > 75
                        ? 'hsl(0 62% 50%)'
                        : value > 50
                        ? 'hsl(35 80% 55%)'
                        : 'hsl(35 50% 40%)',
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">No active pressures — the world is stable.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {statStrip}
      <div>
        <p className="label-overline mb-1">Session History</p>
        <div className="section-rule" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {lastSessionCard}
        {sidePanel}
        {pressureCard}
      </div>
      {isDM && membersQuery.data && membersQuery.data.length > 0 && (
        <div>
          <p className="label-overline mb-1">Party</p>
          <div className="section-rule mb-4" />
          <div className="stone-card">
            <div className="stone-card-body">
              <ul className="space-y-1.5">
                {membersQuery.data.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{m.user?.displayName ?? m.user?.name ?? m.user?.email ?? 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground capitalize">{m.role.toLowerCase().replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
