'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type EncounterPlanRow = {
  id: string;
  name: string;
  difficulty: string | null;
  lastRunAt: Date | string | null;
  timesRun: number;
  _count: { creatures: number };
};

function getStatusBadge(plan: { lastRunAt: Date | string | null; timesRun: number; _count: { creatures: number } }) {
  if (plan.lastRunAt) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(35_50%_15%)] text-[var(--card-amber)] border border-[var(--card-stone-border)] uppercase tracking-wide">
        Run {format(new Date(plan.lastRunAt), 'MMM d')}
      </span>
    );
  }
  if (plan._count.creatures > 0) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(120_30%_10%)] text-emerald-400 border border-emerald-900/40 uppercase tracking-wide">
        Prepped
      </span>
    );
  }
  return null;
}

export function EncountersTab() {
  const [search, setSearch] = useState('');
  const { selectedItemId, selectItem } = useCompendiumStore();
  const pathname = usePathname();
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );
  const campaignId = campaignData?.id;

  const { data: chapters = [], isLoading } = trpc.encounterPlans.getBySourcebook.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  if (!campaignSlug) {
    return <div className="p-4 text-sm text-muted-foreground">Open a campaign to browse encounters.</div>;
  }
  if (!campaignId || isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (chapters.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No sourcebook encounters found. Import a sourcebook first.</div>;
  }

  const filtered = search
    ? chapters.map((ch) => ({
        ...ch,
        plans: ch.plans.filter((p: EncounterPlanRow) =>
          p.name.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((ch) => ch.plans.length > 0)
    : chapters;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(240_20%_85%/0.07)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search encounters…"
          className="w-full bg-[hsl(240_10%_8%/0.6)] border border-[hsl(240_20%_85%/0.09)] rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--card-amber)]/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {filtered.map((chapter) => (
          <div key={chapter.ddbChapterId}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">
              {chapter.chapterName}
            </p>
            <div className="space-y-1">
              {chapter.plans.map((plan: EncounterPlanRow) => (
                <button
                  key={plan.id}
                  onClick={() => selectItem(plan.id, 'encounter')}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded border transition-colors',
                    selectedItemId === plan.id
                      ? 'bg-[hsl(240_10%_14%)] border-[var(--card-stone-border-hi)]'
                      : 'bg-[hsl(240_10%_10%/0.5)] border-[hsl(240_20%_85%/0.06)] hover:bg-[hsl(240_10%_12%)]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-foreground/80 truncate">{plan.name}</span>
                    {getStatusBadge(plan)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{plan.difficulty}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
