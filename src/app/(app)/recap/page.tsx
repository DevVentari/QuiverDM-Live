'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { RecapStatus } from '@prisma/client';
import { ScrollText, Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageLayout } from '@/components/layout/page-layout';

const STATUS_FILTERS: Array<{ label: string; value: RecapStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending Review', value: 'AUTO_GENERATED' },
  { label: 'Approved', value: 'REVIEWED' },
  { label: 'Quick-fire', value: 'QUICK_FIRE' },
];

const STATUS_LABELS: Record<string, string> = {
  AUTO_GENERATED: 'Pending Review',
  REVIEWED: 'Approved',
  QUICK_FIRE: 'Quick-fire',
  GENERATING: 'Generating',
  FAILED: 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  AUTO_GENERATED: 'hsl(35 50% 48%)',
  REVIEWED: 'hsl(35 70% 56%)',
  QUICK_FIRE: 'hsl(50 80% 55%)',
  GENERATING: 'hsl(240 10% 55%)',
  FAILED: 'hsl(0 60% 48%)',
};

export default function RecapDashboardPage() {
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<RecapStatus | 'ALL'>('ALL');

  const { data: campaigns, isLoading: campaignsLoading } =
    trpc.recap.getDashboard.useQuery(undefined, { staleTime: 60_000 });

  const effectiveCampaignIds =
    selectedCampaignIds.length > 0
      ? selectedCampaignIds
      : (campaigns?.map((c) => c.campaignId) ?? []);

  const {
    data: recapsData,
    isLoading: recapsLoading,
    fetchNextPage,
    hasNextPage,
  } = trpc.recap.getRecentAcrossCampaigns.useInfiniteQuery(
    {
      campaignIds: effectiveCampaignIds,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      limit: 20,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: effectiveCampaignIds.length > 0,
      staleTime: 30_000,
    }
  );

  const allRecaps = recapsData?.pages.flatMap((p) => p.items) ?? [];

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <PageLayout
      overline="Recaps"
      title="All Campaigns"
      subtitle="Review recap output across your worlds, filter by campaign or status, and jump directly into approval work."
      actions={
        <Button asChild size="sm" className="gap-1.5 text-xs">
          <Link href="/recap/upload">
            <Upload className="h-3 w-3" />
            New Upload
          </Link>
        </Button>
      }
    >
      <div className="stone-card">
        <div className="stone-card-body space-y-4">
          <div className="flex flex-wrap gap-3">
            {campaignsLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-20 w-44 animate-pulse rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)]" />
              ))
            ) : !campaigns?.length ? (
              <p className="text-sm text-[var(--q-text-dim)]">
                No campaigns found. Create a campaign to get started.
              </p>
            ) : (
              campaigns.map((campaign) => {
                const isSelected = selectedCampaignIds.includes(campaign.campaignId);
                return (
                  <button
                    key={campaign.campaignId}
                    onClick={() => toggleCampaign(campaign.campaignId)}
                    className={cn(
                      'w-44 shrink-0 rounded-sm border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-amber-500/35 bg-amber-500/[0.07]'
                        : 'border-border/50 bg-card/25 hover:border-foreground/15 hover:bg-card/40'
                    )}
                  >
                    <p className={cn('truncate text-xs font-semibold', isSelected ? 'text-amber-200' : 'text-foreground/85')}>
                      {campaign.campaignName}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--q-text-dim)]">
                      {campaign.totalRecaps} recap{campaign.totalRecaps !== 1 ? 's' : ''}
                    </p>
                    {campaign.pendingReview > 0 && (
                      <span className="mt-1.5 inline-block rounded-full bg-amber-500/[0.12] px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        {campaign.pendingReview} pending
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.value;
              return (
                <Button
                  key={filter.value}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {campaignsLoading || recapsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-sm bg-[hsl(240_10%_11%)]" />
          ))}
        </div>
      ) : allRecaps.length === 0 ? (
        <div className="rounded-sm border border-border/40 bg-[linear-gradient(180deg,hsl(240_10%_11%)_0%,hsl(240_8%_9%)_100%)] px-6 py-12 text-center">
          <ScrollText className="mx-auto mb-3 h-7 w-7 text-[var(--q-text-dim)]/40" />
          <p className="text-sm text-[var(--q-text-dim)]">
            {statusFilter !== 'ALL'
              ? 'No recaps match this filter.'
              : 'No recaps yet. Generate one from any session page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {allRecaps.map((recap) => (
            <div
              key={recap.recapId}
              className="flex items-center gap-4 rounded-sm border border-border/20 bg-[hsl(240_10%_10%)] px-4 py-3"
              style={{
                borderLeft:
                  recap.status === 'AUTO_GENERATED'
                    ? '2px solid hsl(35 50% 32%)'
                    : '2px solid transparent',
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground/85">
                  {recap.sessionTitle}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--q-text-dim)]">
                  {recap.campaignName}
                  {recap.sessionDate ? ` · ${format(new Date(recap.sessionDate), 'd MMM yyyy')}` : ''}
                </p>
              </div>
              <span
                className="shrink-0 text-[10px] font-medium"
                style={{ color: STATUS_COLORS[recap.status] ?? 'hsl(35 5% 48%)' }}
              >
                {STATUS_LABELS[recap.status] ?? recap.status}
              </span>
              <Link
                href={`/campaigns/${recap.slug}/sessions/${recap.sessionId}/recap`}
                className="shrink-0 text-xs text-amber-300/75 transition-opacity opacity-60 hover:opacity-100"
              >
                View →
              </Link>
            </div>
          ))}

          {hasNextPage && (
            <div className="pt-3 text-center">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => void fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
