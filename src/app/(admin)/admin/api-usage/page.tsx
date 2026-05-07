'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PlatformRole } from '@prisma/client';
import { ChevronDown, ChevronRight, DollarSign, Users, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanBadge } from '@/components/ui/plan-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
};

const PROVIDER_COLORS: Record<string, string> = {
  gemini: 'hsl(var(--chart-1))',
  openai: 'hsl(var(--chart-2))',
  anthropic: 'hsl(var(--chart-3))',
  ollama: 'hsl(var(--chart-4))',
};

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminApiUsagePage() {
  const [days, setDays] = useState(30);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const summary = trpc.adminApiUsage.getPlatformSummary.useQuery({ days }, { refetchInterval: 30_000 });
  const byUser = trpc.adminApiUsage.getByUser.useQuery({ days }, { refetchInterval: 30_000 });
  const costTimeline = trpc.adminApiUsage.getCostTimeline.useQuery({ days }, { refetchInterval: 60_000 });
  const userDetail = trpc.adminApiUsage.getUserDetail.useQuery(
    { userId: expandedUser!, days },
    { enabled: !!expandedUser, refetchInterval: 30_000 },
  );

  const topProvider = summary.data?.byProvider?.[0] ?? null;

  const timelineChartData = useMemo(() => {
    if (!costTimeline.data) return [];
    const map: Record<string, Record<string, number>> = {};
    for (const row of costTimeline.data) {
      if (!map[row.date]) map[row.date] = {};
      map[row.date][row.provider] = row.cost;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, providers]) => ({ date, ...providers }));
  }, [costTimeline.data]);

  const providers = useMemo(
    () => [...new Set(costTimeline.data?.map((r) => r.provider) ?? [])],
    [costTimeline.data],
  );

  return (
    <div className="space-y-6">
      <div className="stone-card">
        <div className="stone-card-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="stone-card-title">Usage Tracker</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Platform API Usage</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Cost and usage across all users, with quick drill-down into which accounts and features are consuming tokens.
            </p>
          </div>
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-full lg:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{formatCost(summary.data?.totalCost ?? 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{(summary.data?.totalRequests ?? 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tracked Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {byUser.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{byUser.data?.length ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Provider{topProvider ? `: ${PROVIDER_LABELS[topProvider.provider] ?? topProvider.provider}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : topProvider ? (
              <>
                <div className="text-2xl font-bold">{formatCost(topProvider._sum.estimatedCost ?? 0)}</div>
                <div className="text-xs text-muted-foreground">{(topProvider._sum.requestCount ?? 0).toLocaleString()} requests</div>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/50">
        <CardHeader>
          <CardTitle>Cost By Provider Over Time</CardTitle>
          <CardDescription>Last {days} days — stacked by provider.</CardDescription>
        </CardHeader>
        <CardContent>
          {costTimeline.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={timelineChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {providers.map((p) => (
                    <linearGradient key={p} id={`grad-${p}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PROVIDER_COLORS[p] ?? 'hsl(var(--primary))'} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={PROVIDER_COLORS[p] ?? 'hsl(var(--primary))'} stopOpacity={0} />
                    </linearGradient>
                  ))}
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
                  formatter={(v: number, name: string) => [
                    formatCost(v),
                    PROVIDER_LABELS[name] ?? name,
                  ]}
                  labelFormatter={String}
                />
                {providers.map((p) => (
                  <Area
                    key={p}
                    type="monotone"
                    dataKey={p}
                    stackId="1"
                    stroke={PROVIDER_COLORS[p] ?? 'hsl(var(--primary))'}
                    fill={`url(#grad-${p})`}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/60 bg-card/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Tokens In</TableHead>
              <TableHead className="text-right">Tokens Out</TableHead>
              <TableHead className="text-right">Est. Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byUser.isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              : byUser.data?.map((row) => {
                  const user = row.user as {
                    id: string;
                    name: string | null;
                    email: string | null;
                    displayName?: string | null;
                    platformRole?: PlatformRole;
                    tier?: string;
                  };

                  return (
                    <React.Fragment key={user.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-accent/40"
                        onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                      >
                        <TableCell>
                          {expandedUser === user.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/users/${user.id}`} className="block">
                            <div className="font-medium text-foreground">{user.displayName ?? user.name ?? 'Unnamed'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </Link>
                        </TableCell>
                        <TableCell>{user.platformRole && <RoleBadge role={user.platformRole} />}</TableCell>
                        <TableCell>{user.tier && <PlanBadge tier={user.tier} />}</TableCell>
                        <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatTokens(row.tokensIn)}</TableCell>
                        <TableCell className="text-right">{formatTokens(row.tokensOut)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCost(row.estimatedCost)}</TableCell>
                      </TableRow>
                      {expandedUser === user.id && userDetail.data && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/20 p-4">
                            <div className="grid gap-6 lg:grid-cols-2">
                              <div>
                                <h4 className="mb-2 text-sm font-medium text-foreground">By Feature</h4>
                                <div className="space-y-1">
                                  {userDetail.data.byFeature.map((feature) => (
                                    <div key={feature.feature} className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">{feature.feature}</span>
                                      <span>{formatCost(feature._sum.estimatedCost ?? 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="mb-2 text-sm font-medium text-foreground">By Model</h4>
                                <div className="space-y-1">
                                  {userDetail.data.byModel.map((model) => (
                                    <div key={`${model.model}-${model.provider}`} className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">{model.model}</span>
                                      <span>{formatCost(model._sum.estimatedCost ?? 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
