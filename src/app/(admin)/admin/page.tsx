'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, BookOpen, Coins, Database, ScrollText, ShieldAlert, Sword, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { PLAN_LABELS, PLATFORM_ROLE_LABELS } from '@/lib/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/ui/role-badge';
import { Skeleton } from '@/components/ui/skeleton';

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString();
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminOverviewPage() {
  const [days] = useState(30);

  const overview = trpc.adminOverview.getSummary.useQuery(undefined, { refetchInterval: 30_000 });
  const timeline = trpc.adminOverview.getTimeline.useQuery({ days }, { refetchInterval: 60_000 });

  if (overview.isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        Failed to load overview data.{' '}
        <button onClick={() => void overview.refetch()} className="underline">
          Retry
        </button>
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="space-y-8">
      <section className="stone-card overflow-hidden">
        <div className="stone-card-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="stone-card-title">Platform Overview</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Admin control over accounts, roles, and platform usage.
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              This console is separate from the player-facing app shell. It exposes database-backed health,
              account controls, and usage visibility without dropping you into raw SQL.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Link>
            <Link
              href="/admin/api-usage"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
            >
              <BarChart3 className="h-4 w-4" />
              Usage Tracker
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-8 w-16" />
              </CardHeader>
              <CardContent><Skeleton className="h-3 w-40" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>Total Accounts</CardDescription>
                <CardTitle className="text-3xl">{formatNumber(data?.totals.totalUsers ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatNumber(data?.totals.newUsersLast30Days ?? 0)} joined in the last 30 days.
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>Active Subscriptions</CardDescription>
                <CardTitle className="text-3xl">{formatNumber(data?.totals.activeSubscriptions ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatNumber(data?.totals.suspendedUsers ?? 0)} accounts are suspended.
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>Worlds In Archive</CardDescription>
                <CardTitle className="text-3xl">{formatNumber(data?.totals.totalCampaigns ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatNumber(data?.totals.totalSessions ?? 0)} sessions and {formatNumber(data?.totals.totalHomebrew ?? 0)} homebrew entries.
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>30 Day API Cost</CardDescription>
                <CardTitle className="text-3xl">{formatCost(data?.usage.totalCost ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatNumber(data?.usage.totalRequests ?? 0)} requests in the last 30 days.
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              New Signups (Last {days} Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={timeline.data ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: number) => [v, 'New users']}
                    labelFormatter={String}
                  />
                  <Bar dataKey="newUsers" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              API Cost Trend (Last {days} Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={timeline.data ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: number) => [formatCost(v), 'API cost']}
                    labelFormatter={String}
                  />
                  <Area
                    type="monotone"
                    dataKey="apiCost"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#costGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Database Snapshot
            </CardTitle>
            <CardDescription>Recent entities from the main platform tables.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Sword className="h-4 w-4 text-primary" />
                Recent Campaigns
              </div>
              <div className="space-y-3">
                {overview.isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))
                  : data?.recentCampaigns.map((campaign) => (
                      <div key={campaign.id} className="rounded-lg border border-border/50 bg-background/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Owner: {campaign.user.displayName ?? campaign.user.name ?? 'Unknown'}
                            </p>
                          </div>
                          <Badge variant="outline">{campaign.slug}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(campaign.updatedAt)}</p>
                      </div>
                    ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <ScrollText className="h-4 w-4 text-primary" />
                Recent Sessions
              </div>
              <div className="space-y-3">
                {overview.isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))
                  : data?.recentSessions.map((session) => (
                      <div key={session.id} className="rounded-lg border border-border/50 bg-background/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {session.title ?? `Session ${session.sessionNumber}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.campaign.name} ({session.campaign.slug})
                            </p>
                          </div>
                          <Badge variant="secondary">{session.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(session.updatedAt)}</p>
                      </div>
                    ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Role And Tier Mix
            </CardTitle>
            <CardDescription>Account authority and plan distribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">Platform Roles</p>
              <div className="space-y-2">
                {overview.isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
                  : data?.roleBreakdown.map((item) => (
                      <div key={item.role} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                        <RoleBadge role={item.role} />
                        <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                      </div>
                    ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">Plans</p>
              <div className="space-y-2">
                {overview.isLoading
                  ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
                  : data?.tierBreakdown.map((item) => (
                      <div key={item.tier} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                        <span className="text-sm font-medium text-foreground">{PLAN_LABELS[item.tier] ?? item.tier}</span>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                      </div>
                    ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Provider Usage
            </CardTitle>
            <CardDescription>Last 30 days across all users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
              : data?.usage.providerUsage.map((provider) => (
                  <div key={provider.provider} className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium capitalize text-foreground">{provider.provider}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(provider._sum.requestCount ?? 0)} requests, {formatNumber(provider._sum.tokensIn ?? 0)} in / {formatNumber(provider._sum.tokensOut ?? 0)} out
                        </p>
                      </div>
                      <span className="text-sm font-medium text-primary">
                        {formatCost(provider._sum.estimatedCost ?? 0)}
                      </span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Top Cost Features
            </CardTitle>
            <CardDescription>Where the platform is spending tokens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
              : data?.usage.featureUsage.map((feature) => (
                  <div key={feature.feature} className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{feature.feature}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(feature._sum.requestCount ?? 0)} requests
                        </p>
                      </div>
                      <span className="text-sm font-medium text-primary">
                        {formatCost(feature._sum.estimatedCost ?? 0)}
                      </span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
            <CardDescription>
              {formatNumber(data?.totals.newUsersLast7Days ?? 0)} in the last 7 days,{' '}
              {formatNumber(data?.totals.newUsersLast30Days ?? 0)} in the last 30 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
              : data?.recentUsers.map((user) => (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:bg-accent/40"
                  >
                    <div>
                      <p className="font-medium text-foreground">{user.displayName ?? user.name ?? user.email ?? 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email ?? 'No email'} · {PLATFORM_ROLE_LABELS[user.platformRole]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{PLAN_LABELS[user.tier] ?? user.tier}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</p>
                    </div>
                  </Link>
                ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Top Usage Accounts</CardTitle>
            <CardDescription>Highest API cost over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
              : data?.topUsageUsers.map((entry) => (
                  <Link
                    key={entry.userId}
                    href={`/admin/users/${entry.userId}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:bg-accent/40"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.user?.displayName ?? entry.user?.name ?? entry.user?.email ?? entry.userId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.user?.platformRole ? PLATFORM_ROLE_LABELS[entry.user.platformRole] : 'Unknown role'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">{formatCost(entry.estimatedCost)}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(entry.requestCount)} requests</p>
                    </div>
                  </Link>
                ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
