'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { RoleBadge } from '@/components/ui/role-badge';
import { PlanBadge } from '@/components/ui/plan-badge';
import { DollarSign, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import type { PlatformRole } from '@prisma/client';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
};

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export default function AdminApiUsagePage() {
  const [days, setDays] = useState(30);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const summary = trpc.adminApiUsage.getPlatformSummary.useQuery({ days }, { refetchInterval: 30_000 });
  const byUser = trpc.adminApiUsage.getByUser.useQuery({ days }, { refetchInterval: 30_000 });
  const userDetail = trpc.adminApiUsage.getUserDetail.useQuery(
    { userId: expandedUser!, days },
    { enabled: !!expandedUser, refetchInterval: 30_000 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform API Usage</h1>
          <p className="text-muted-foreground">Cost and usage across all users</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(summary.data?.totalCost ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.data?.totalRequests ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        {summary.data?.byProvider.map((p) => (
          <Card key={p.provider}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {PROVIDER_LABELS[p.provider] ?? p.provider}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCost(p._sum.estimatedCost ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{(p._sum.requestCount ?? 0).toLocaleString()} requests</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-User Table */}
      <div className="rounded-lg border border-border/50 bg-card/50">
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
            {byUser.data?.map((row) => {
              const user = row.user as { id: string; name: string | null; email: string | null; displayName?: string | null; platformRole?: PlatformRole; tier?: string };
              return (
                <React.Fragment key={user.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-accent/50"
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
                      <div>
                        <div className="font-medium">{user.displayName ?? user.name ?? 'Unnamed'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
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
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium mb-2">By Feature</h4>
                            <div className="space-y-1">
                              {userDetail.data.byFeature.map((f) => (
                                <div key={f.feature} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{f.feature}</span>
                                  <span>{formatCost(f._sum.estimatedCost ?? 0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">By Model</h4>
                            <div className="space-y-1">
                              {userDetail.data.byModel.map((m) => (
                                <div key={`${m.model}-${m.provider}`} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{m.model}</span>
                                  <span>{formatCost(m._sum.estimatedCost ?? 0)}</span>
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
