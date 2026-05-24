'use client';

import { Activity, CheckCircle2, Clock, Database, Layers, RefreshCw, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function timeAgo(iso: string | null): string {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminHealthPage() {
  const health = trpc.adminHealth.getStatus.useQuery(undefined, { refetchInterval: 30_000 });

  return (
    <div className="space-y-8">
      <section className="stone-card overflow-hidden">
        <div className="stone-card-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="stone-card-title">System Health</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Queue Depths &amp; Database State
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--q-text-dim)]">
              Live BullMQ queue status and database row counts. Auto-refreshes every 30 seconds.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${health.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </section>

      {health.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-[var(--q-text-danger)]">
          Failed to load health data.{' '}
          <button onClick={() => void health.refetch()} className="underline">
            Retry
          </button>
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Queue Health</h2>
          <span className="text-sm text-[var(--q-text-dim)]">
            ({health.data?.queues.length ?? 0} queues)
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {health.isLoading
            ? Array.from({ length: 12 }).map((_, i) => (
                <Card key={i} className="border-[var(--q-border)] bg-[var(--q-surface-inset)]">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </CardContent>
                </Card>
              ))
            : health.data?.queues.map((queue) => {
                const hasFailed = queue.failed > 0;
                const highFailed = queue.failed > 10;
                return (
                  <Card
                    key={queue.name}
                    className={`border-[var(--q-border)] bg-[var(--q-surface-inset)] ${highFailed ? 'border-destructive/40' : hasFailed ? 'border-[var(--q-accent-quest-border)]' : ''}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-mono text-foreground">{queue.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5">
                      {queue.waiting > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          {queue.waiting} waiting
                        </Badge>
                      )}
                      {queue.active > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Activity className="mr-1 h-3 w-3" />
                          {queue.active} active
                        </Badge>
                      )}
                      {queue.delayed > 0 && (
                        <Badge variant="outline" className="text-xs text-[var(--q-text-dim)]">
                          {queue.delayed} delayed
                        </Badge>
                      )}
                      {queue.failed === 0 ? (
                        <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          clean
                        </Badge>
                      ) : (
                        <Badge
                          variant={highFailed ? 'destructive' : 'outline'}
                          className={`text-xs ${!highFailed ? 'border-[var(--q-accent-quest-border)] text-[var(--q-accent-quest)]' : ''}`}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          {queue.failed} failed
                        </Badge>
                      )}
                      {'error' in queue && (
                        <Badge variant="destructive" className="text-xs">
                          unreachable
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Database Tables</h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {health.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-[var(--q-border-subtle)] bg-[var(--q-surface-inset)] p-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-5 w-12" />
                </div>
              ))
            : health.data?.tableCounts.map((row) => (
                <div key={row.table} className="rounded-lg border border-[var(--q-border-subtle)] bg-[var(--q-surface-inset)] p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--q-text-dim)]">{row.table}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{row.count.toLocaleString()}</p>
                </div>
              ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <XCircle className="h-5 w-5 text-[var(--q-text-danger)]" />
          <h2 className="text-lg font-semibold text-foreground">Recent Failed Jobs</h2>
        </div>

        <Card className="border-[var(--q-border)] bg-[var(--q-surface-inset)]">
          <CardContent className="pt-6">
            {health.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : !health.data?.recentFailed.length ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[var(--q-text-dim)]">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                No failed jobs across all queues.
              </div>
            ) : (
              <div className="space-y-3">
                {health.data.recentFailed.map((job, i) => (
                  <div key={i} className="rounded-lg border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{job.queue}</Badge>
                      <span className="text-sm font-medium text-foreground">{job.jobName}</span>
                      <span className="ml-auto text-xs text-[var(--q-text-dim)]">{timeAgo(job.failedAt)}</span>
                    </div>
                    {job.error && (
                      <p className="mt-2 font-mono text-xs text-[var(--q-text-danger)]/80 line-clamp-2">{job.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
