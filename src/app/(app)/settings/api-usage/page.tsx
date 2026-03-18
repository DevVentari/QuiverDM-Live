'use client';

import { trpc } from '@/lib/trpc';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  FileText,
  Brain,
  Search,
  Image as ImageIcon,
  Swords,
  BookOpen,
  Zap,
  HelpCircle,
} from 'lucide-react';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (Local)',
};

const FEATURE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  extraction: { label: 'Extraction', icon: FileText },
  recap: { label: 'Recap', icon: Brain },
  search: { label: 'Search', icon: Search },
  image_gen: { label: 'Image Generation', icon: ImageIcon },
  encounter_gen: { label: 'Encounter Generation', icon: Swords },
  rules_qa: { label: 'Rules Q&A', icon: BookOpen },
  obsidian_import: { label: 'Obsidian Import', icon: FileText },
  derailment: { label: 'Derailment', icon: Zap },
  combat_copilot: { label: 'Combat Copilot', icon: Swords },
};

function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function getFeatureConfig(feature: string) {
  return FEATURE_CONFIG[feature] ?? { label: feature, icon: HelpCircle };
}

export default function ApiUsagePage() {
  const summary = trpc.apiUsage.getSummary.useQuery(undefined, { refetchInterval: 30_000 });
  const byFeature = trpc.apiUsage.getByFeature.useQuery(undefined, { refetchInterval: 30_000 });
  const byModel = trpc.apiUsage.getByModel.useQuery(undefined, { refetchInterval: 30_000 });
  const recentCalls = trpc.apiUsage.getRecentCalls.useQuery(undefined, { refetchInterval: 30_000 });

  const isLoading = summary.isLoading || byFeature.isLoading || byModel.isLoading || recentCalls.isLoading;

  const totalCost = summary.data?.providers.reduce((sum, p) => sum + p.estimatedCost, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-48" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">API Usage</h1>
        <Badge variant="secondary" className="text-sm">
          {formatCost(totalCost)} this period
        </Badge>
      </div>

      {/* Provider Summary Cards */}
      {summary.data && summary.data.providers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {summary.data.providers.map((provider) => (
            <Card key={provider.provider}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {PROVIDER_LABELS[provider.provider] ?? provider.provider}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold text-primary">
                  {formatCost(provider.estimatedCost)}
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{provider.requests.toLocaleString()} requests</p>
                  <p>
                    {formatTokens(provider.tokensIn)} tokens in / {formatTokens(provider.tokensOut)} tokens out
                  </p>
                  {provider.provider === 'gemini' && (
                    <p className="text-emerald-400">
                      {Math.max(0, 1000 - (summary.data?.geminiRequestsToday ?? 0)).toLocaleString()} free requests remaining today
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No API usage recorded yet. Usage will appear here once you use AI features.
          </CardContent>
        </Card>
      )}

      {/* Usage by Feature */}
      {byFeature.data && byFeature.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens In</TableHead>
                  <TableHead className="text-right">Tokens Out</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byFeature.data.map((row) => {
                  const config = getFeatureConfig(row.feature);
                  const Icon = config.icon;
                  return (
                    <TableRow key={row.feature}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{config.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatTokens(row.tokensIn)}</TableCell>
                      <TableCell className="text-right">{formatTokens(row.tokensOut)}</TableCell>
                      <TableCell className="text-right">{formatCost(row.estimatedCost)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Usage by Model */}
      {byModel.data && byModel.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens In</TableHead>
                  <TableHead className="text-right">Tokens Out</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byModel.data.map((row) => (
                  <TableRow key={`${row.model}-${row.provider}`}>
                    <TableCell className="font-mono text-sm">{row.model}</TableCell>
                    <TableCell>{PROVIDER_LABELS[row.provider] ?? row.provider}</TableCell>
                    <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatTokens(row.tokensIn)}</TableCell>
                    <TableCell className="text-right">{formatTokens(row.tokensOut)}</TableCell>
                    <TableCell className="text-right">{formatCost(row.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent API Calls */}
      {recentCalls.data && recentCalls.data.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent API Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCalls.data.items.map((call) => {
                  const config = getFeatureConfig(call.feature);
                  const Icon = config.icon;
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(call.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{config.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{call.model}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatTokens(call.tokensIn + call.tokensOut)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatCost(call.estimatedCost)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Period info */}
      {summary.data && (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground text-center">
          Period: {new Date(summary.data.periodStart).toLocaleDateString()} — {new Date(summary.data.periodEnd).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
