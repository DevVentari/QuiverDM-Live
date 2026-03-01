'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Plus,
  Mail,
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
    { enabled: !isDM, staleTime: 120_000 }
  );

  const isLoading =
    campaignQuery.isLoading || sessionsQuery.isLoading;

  const campaign = campaignQuery.data;
  const lastSession = sessionsQuery.data?.[0] ?? null;
  const statPills = (
    <div className="flex gap-3 flex-wrap">
      <Badge variant="secondary">Campaign</Badge>
      <Badge variant="outline">
        {sessionsQuery.data?.length ?? 0} Session{(sessionsQuery.data?.length ?? 0) === 1 ? '' : 's'}
      </Badge>
      <Badge variant="outline">
        {membersQuery.data?.length ?? 0} Member{(membersQuery.data?.length ?? 0) === 1 ? '' : 's'}
      </Badge>
      {campaign?.isPublic ? <Badge>Public</Badge> : <Badge variant="secondary">Private</Badge>}
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
    <Card className="relative overflow-hidden md:col-span-2">
      {lastSession && (
        <span className="absolute right-4 top-2 text-8xl font-bold text-foreground/5 select-none leading-none pointer-events-none">
          #{lastSession.sessionNumber}
        </span>
      )}
      <CardHeader>
        <CardTitle className="text-base">Last Session</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );

  // ─── Quick actions (DM) / Members (player) ───────────────────────────────────
  const sidePanel = isDM ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button asChild variant="outline" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/sessions`}>
            <Play className="h-4 w-4" />
            Start Session
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/npcs`}>
            <Plus className="h-4 w-4" />
            Add NPC
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/members`}>
            <Mail className="h-4 w-4" />
            Invite Player
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start gap-3 h-11">
          <Link href={`/campaigns/${slug}/settings`}>
            <Settings className="h-4 w-4" />
            Campaign Settings
          </Link>
        </Button>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Party</CardTitle>
      </CardHeader>
      <CardContent>
        {membersQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        ) : membersQuery.data && membersQuery.data.length > 0 ? (
          <ul className="space-y-1.5">
            {membersQuery.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{m.user?.displayName ?? m.user?.name ?? m.user?.email ?? 'Unknown'}</span>
                <Badge variant="outline" className="text-xs capitalize shrink-0">
                  {m.role.toLowerCase().replace('_', ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {statPills}
      <div>
        <p className="label-overline mb-1">Session History</p>
        <div className="section-rule" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {lastSessionCard}
        {sidePanel}
      </div>
    </div>
  );
}
