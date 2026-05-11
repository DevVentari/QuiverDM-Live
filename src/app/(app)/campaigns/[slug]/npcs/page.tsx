'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { NpcCreateSheet } from '@/components/npc/npc-create-sheet';
import { NpcInspectorPanel } from '@/components/npc/npc-inspector-panel';
import { NpcCard, type NpcCardData } from '@/components/npc/npc-card';
import { NpcFilterRail, type NpcSourceFilter } from '@/components/npc/npc-filter-rail';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface ApiNpc extends NpcCardData {
  faction: string | null;
}

export default function NPCsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5" />}>
      <NPCsPageInner />
    </Suspense>
  );
}

function NPCsPageInner() {
  const { campaignId, slug, isDM } = useCampaign();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<NpcSourceFilter>('all');
  const [factionFilter, setFactionFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === 'true');
  const selectedId = searchParams.get('npc');

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: search || undefined },
    { staleTime: 120_000 },
  );

  useEffect(() => {
    if (searchParams.get('create') === 'true') setCreateOpen(true);
  }, [searchParams]);

  function updateUrlParams(params: URLSearchParams) {
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }
  function setCreateSheetOpen(open: boolean) {
    setCreateOpen(open);
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set('create', 'true');
    else params.delete('create');
    updateUrlParams(params);
  }
  function setSelectedNpc(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('npc', id);
    else params.delete('npc');
    params.delete('create');
    updateUrlParams(params);
  }

  const npcList = (npcs.data ?? []) as ApiNpc[];

  const factions = useMemo(() => {
    const set = new Set<string>();
    for (const n of npcList) if (n.faction) set.add(n.faction);
    return Array.from(set).sort();
  }, [npcList]);

  const counts = useMemo(
    () => ({
      all: npcList.length,
      dm: npcList.filter((n) => n._source === 'npc').length,
      imported: npcList.filter((n) => n._fromSourcebook).length,
      seen: npcList.filter((n) => n._seen).length,
    }),
    [npcList],
  );

  const filtered = useMemo(() => {
    return npcList.filter((n) => {
      if (sourceFilter === 'dm' && n._source !== 'npc') return false;
      if (sourceFilter === 'imported' && !n._fromSourcebook) return false;
      if (sourceFilter === 'seen' && !n._seen) return false;
      if (factionFilter && n.faction !== factionFilter) return false;
      return true;
    });
  }, [npcList, sourceFilter, factionFilter]);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
            Campaign
          </p>
          <h1 className="font-[var(--q-font-display)] text-3xl md:text-4xl text-[var(--q-text)] mt-1">
            NPCs
          </h1>
        </div>
        <div className="text-right">
          <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] tabular-nums">
            {filtered.length}
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            {filtered.length === npcList.length ? 'in campaign' : `of ${npcList.length}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <NpcFilterRail
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          factionFilter={factionFilter}
          onFactionFilterChange={setFactionFilter}
          factions={factions}
          search={search}
          onSearchChange={setSearch}
          counts={counts}
          isDM={isDM}
          onCreate={() => setCreateSheetOpen(true)}
        />

        <div className="min-w-0">
          {npcs.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[var(--q-text-dim)]">
              <Users size={32} className="text-[var(--q-text-faint)]/40" />
              <p className="text-sm">
                {npcList.length === 0 ? 'No NPCs yet' : 'No NPCs match those filters'}
              </p>
              {isDM && npcList.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => setCreateSheetOpen(true)}>
                  Add First NPC
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {filtered.map((npc) => (
                <NpcCard key={npc.id} npc={npc} onClick={() => setSelectedNpc(npc.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedNpc(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 overflow-y-auto"
          data-testid="npc-inspector-sheet"
        >
          {selectedId && <NpcInspectorPanel npcId={selectedId} slug={slug} isDM={isDM} />}
        </SheetContent>
      </Sheet>

      <NpcCreateSheet
        open={createOpen}
        onOpenChange={setCreateSheetOpen}
        onSuccess={(id) => {
          setCreateOpen(false);
          setSelectedNpc(id);
        }}
      />
    </div>
  );
}
