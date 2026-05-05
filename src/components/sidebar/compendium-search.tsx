'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Eye } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { PinnedEntityType } from '@/store/pinned-items-store';
import { CompendiumItemSheet } from '@/components/compendium/CompendiumItemSheet';

interface CompendiumSearchProps {
  campaignId: string;
  slug: string;
  collapsed: boolean;
  onSearchActive: (active: boolean) => void;
}

const TYPE_LABELS: Record<PinnedEntityType, string> = {
  npc: 'NPCs',
  item: 'Items',
  location: 'Locations',
  spell: 'Spells',
  monster: 'Monsters',
  encounter: 'Encounters',
};

type Result = { id: string; name: string; entityType: PinnedEntityType };

export function CompendiumSearch({ campaignId, slug, collapsed, onSearchActive }: CompendiumSearchProps) {
  const [query, setQuery] = useState('');
  const [sheetItem, setSheetItem] = useState<Result | null>(null);
  const router = useRouter();

  const active = query.length > 0;

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: query },
    { enabled: active && !!campaignId, staleTime: 30_000 }
  );

  const homebrew = trpc.homebrew.getContent.useQuery(
    { campaignId, search: query, limit: 20 },
    { enabled: active && !!campaignId, staleTime: 30_000 }
  );

  const encounters = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { enabled: active && !!campaignId, staleTime: 60_000 }
  );

  function getPath(entityType: PinnedEntityType, id: string): string {
    const base = `/campaigns/${slug}`;
    if (entityType === 'npc') return `${base}/npcs/${id}`;
    if (entityType === 'encounter') return `${base}/encounters/${id}`;
    return `${base}/homebrew/${id}`;
  }

  function buildResults(): { type: PinnedEntityType; items: Result[] }[] {
    const groups: { type: PinnedEntityType; items: Result[] }[] = [];

    const npcItems: Result[] = ((npcs.data as any[]) ?? []).map((n: any) => ({
      id: n.id,
      name: n.name,
      entityType: 'npc' as const,
    }));
    if (npcItems.length) groups.push({ type: 'npc', items: npcItems.slice(0, 5) });

    const hbItems: any[] = (homebrew.data as any)?.items ?? [];
    const byType = hbItems.reduce<Record<string, Result[]>>((acc, i: any) => {
      const t = i.type as PinnedEntityType;
      if (!acc[t]) acc[t] = [];
      acc[t].push({ id: i.id, name: i.name, entityType: t });
      return acc;
    }, {});
    for (const [type, items] of Object.entries(byType)) {
      if (items.length) groups.push({ type: type as PinnedEntityType, items: items.slice(0, 5) });
    }

    const q = query.toLowerCase();
    const encItems: Result[] = ((encounters.data as any[]) ?? [])
      .filter((e: any) => e.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((e: any) => ({ id: e.id, name: e.name, entityType: 'encounter' as const }));
    if (encItems.length) groups.push({ type: 'encounter', items: encItems });

    return groups;
  }

  const handleClear = useCallback(() => {
    setQuery('');
    onSearchActive(false);
  }, [onSearchActive]);

  if (collapsed) return null;

  const results = buildResults();
  const loading = npcs.isLoading || homebrew.isLoading;

  return (
    <div className="px-3 py-2 border-b border-[hsl(35_35%_14%)]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearchActive(e.target.value.length > 0);
          }}
          onKeyDown={(e) => e.key === 'Escape' && handleClear()}
          placeholder="Search campaign…"
          className="w-full bg-white/[0.05] border border-white/[0.09] rounded px-2.5 py-1.5 pl-7 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors"
        />
        {active && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {active && (
        <div className="mt-1 max-h-72 overflow-y-auto">
          {results.length === 0 && !loading ? (
            <p className="text-[11px] text-muted-foreground/50 py-2 px-1">No results</p>
          ) : (
            results.map(({ type, items }) => (
              <div key={type}>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 px-1 pt-2 pb-0.5">
                  {TYPE_LABELS[type]}
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between px-1 py-1 rounded cursor-pointer hover:bg-white/[0.04] transition-colors"
                    onClick={() => {
                      router.push(getPath(item.entityType, item.id));
                      handleClear();
                    }}
                  >
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate">
                      {item.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetItem(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {sheetItem && (
        <CompendiumItemSheet
          entityType={sheetItem.entityType}
          entityId={sheetItem.id}
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
        />
      )}
    </div>
  );
}
