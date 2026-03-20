'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { useCompendiumRoute } from '@/hooks/use-compendium-route';
import { cn } from '@/lib/utils';

type MonsterItem = {
  id: string;
  name: string;
  data: Record<string, unknown> | null;
};

export function MonstersTab() {
  const [search, setSearch] = useState('');
  const { selectedItemId, selectItem } = useCompendiumStore();
  const { campaignSlug, campaignId } = useCompendiumRoute();

  const { data: result, isLoading } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId!, type: 'creature' },
    { enabled: !!campaignId }
  );
  const monsters: MonsterItem[] = (result?.items ?? []) as MonsterItem[];

  const filtered = useMemo(() =>
    search
      ? monsters.filter((m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          String((m.data as any)?.cr ?? '').includes(search) ||
          String((m.data as any)?.type ?? '').toLowerCase().includes(search.toLowerCase())
        )
      : monsters,
    [monsters, search]
  );

  if (!campaignSlug) {
    return <div className="p-4 text-sm text-muted-foreground">Open a campaign to browse monsters.</div>;
  }
  if (!campaignId || isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(240_20%_85%/0.07)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, CR, type…"
          className="w-full bg-[hsl(240_10%_8%/0.6)] border border-[hsl(240_20%_85%/0.09)] rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--card-amber)]/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground p-2">No monsters found.</p>
        )}
        {filtered.map((monster) => (
          <button
            key={monster.id}
            onClick={() => selectItem(monster.id, 'monster')}
            className={cn(
              'w-full text-left px-3 py-2 rounded border transition-colors',
              selectedItemId === monster.id
                ? 'bg-[hsl(240_10%_14%)] border-[var(--card-stone-border-hi)]'
                : 'bg-[hsl(240_10%_10%/0.5)] border-[hsl(240_20%_85%/0.06)] hover:bg-[hsl(240_10%_12%)]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground/80 truncate">{monster.name}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">CR {(monster.data as any)?.cr ?? '?'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate capitalize">
              {(monster.data as any)?.type ?? ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
