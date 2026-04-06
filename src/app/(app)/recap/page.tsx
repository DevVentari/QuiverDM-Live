'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { RecapStatus } from '@prisma/client';

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
    <div className="px-6 py-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <span
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: 'hsl(35 80% 48%)' }}
        >
          Recaps
        </span>
        <h1
          className="font-display text-2xl font-bold mt-0.5"
          style={{ color: 'hsl(35 20% 90%)' }}
        >
          All Campaigns
        </h1>
      </div>

      {/* Amber rule */}
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, hsl(35 60% 28%) 0%, transparent 60%)' }}
      />

      {/* Campaign cards */}
      {campaignsLoading ? (
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 w-44 rounded-sm animate-pulse"
              style={{ background: 'hsl(240 10% 11%)' }}
            />
          ))}
        </div>
      ) : !campaigns?.length ? (
        <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>
          No campaigns found. Create a campaign to get started.
        </p>
      ) : (
        <div className="flex gap-3 flex-wrap">
          {campaigns.map((c) => {
            const isSelected = selectedCampaignIds.includes(c.campaignId);
            return (
              <button
                key={c.campaignId}
                onClick={() => toggleCampaign(c.campaignId)}
                className="rounded-sm border text-left px-4 py-3 transition-colors w-44 shrink-0"
                style={{
                  background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
                  border: `1px solid ${isSelected ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
                }}
              >
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: isSelected ? 'hsl(35 70% 68%)' : 'hsl(35 15% 70%)' }}
                >
                  {c.campaignName}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'hsl(35 5% 40%)' }}>
                  {c.totalRecaps} recap{c.totalRecaps !== 1 ? 's' : ''}
                </p>
                {c.pendingReview > 0 && (
                  <span
                    className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'hsl(35 60% 18%)', color: 'hsl(35 70% 58%)' }}
                  >
                    {c.pendingReview} pending
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
              style={{
                background: isActive ? 'hsl(35 80% 18%)' : 'hsl(240 10% 11%)',
                border: `1px solid ${isActive ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
                color: isActive ? 'hsl(35 80% 70%)' : 'hsl(35 5% 48%)',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Recap list */}
      {recapsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 rounded-sm animate-pulse"
              style={{ background: 'hsl(240 10% 11%)' }}
            />
          ))}
        </div>
      ) : allRecaps.length === 0 ? (
        <div
          className="rounded-sm border border-border/40 px-6 py-12 text-center"
          style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
        >
          <ScrollText className="h-7 w-7 mx-auto mb-3" style={{ color: 'hsl(35 10% 28%)' }} />
          <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>
            {statusFilter !== 'ALL'
              ? 'No recaps match this filter.'
              : 'No recaps yet. Generate one from any session page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {allRecaps.map((r) => (
            <div
              key={r.recapId}
              className="flex items-center gap-4 rounded-sm border border-border/20 px-4 py-3"
              style={{
                background: 'hsl(240 10% 10%)',
                borderLeft:
                  r.status === 'AUTO_GENERATED'
                    ? '2px solid hsl(35 50% 32%)'
                    : '2px solid transparent',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'hsl(35 15% 78%)' }}>
                  {r.sessionTitle}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'hsl(35 5% 40%)' }}>
                  {r.campaignName}
                  {r.sessionDate
                    ? ` · ${format(new Date(r.sessionDate), 'd MMM yyyy')}`
                    : ''}
                </p>
              </div>
              <span
                className="text-[10px] font-medium shrink-0"
                style={{ color: STATUS_COLORS[r.status] ?? 'hsl(35 5% 48%)' }}
              >
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
              <Link
                href={`/campaigns/${r.slug}/sessions/${r.sessionId}/recap`}
                className="text-xs shrink-0 transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'hsl(35 20% 60%)' }}
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
    </div>
  );
}
