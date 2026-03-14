'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { NpcListRow } from '@/components/npc/npc-list-row';
import { NpcInspectorPanel } from '@/components/npc/npc-inspector-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Users, Ghost } from 'lucide-react';

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
  const selectedId = searchParams.get('npc');

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: search || undefined },
    { staleTime: 120_000 }
  );
  const factions = trpc.npcs.getFactions.useQuery({ campaignId }, { staleTime: 120_000 });

  function selectNpc(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('npc') === id) {
      params.delete('npc');
    } else {
      params.set('npc', id);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const npcList = (npcs.data ?? []) as any[];
  const hasNpcs = npcList.length > 0;

  return (
    <>
      {/* Mobile: grid view (< md) */}
      <div className="md:hidden space-y-4 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold tracking-wide">NPCs</h2>
          {isDM && (
            <Button asChild size="sm">
              <Link href={`/campaigns/${slug}/npcs/new`}>
                <Plus className="mr-2 h-4 w-4" />
                New NPC
              </Link>
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search NPCs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {npcs.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : hasNpcs ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {npcList.map((npc) => (
              <Link key={npc.id} href={`/campaigns/${slug}/npcs/${npc.id}`}>
                <div className="stone-card glass-panel h-full hover:border-foreground/50 transition-colors cursor-pointer overflow-hidden flex">
                  {npc.imageUrl && (
                    <div className="relative w-[30%] shrink-0 self-stretch">
                      <Image src={npc.imageUrl} alt={npc.name} fill className="object-cover object-top" />
                      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[hsl(240,10%,11%)] to-transparent pointer-events-none" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="stone-card-header pb-2 flex items-start justify-between gap-2">
                      <span className="stone-card-title">{npc.name}</span>
                      {npc.faction && (
                        <Badge variant="outline" className="text-xs shrink-0">{npc.faction}</Badge>
                      )}
                    </div>
                    <div className="stone-card-body pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {npc.description || 'No description'}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <MobileEmpty slug={slug} isDM={isDM} />
        )}
      </div>

      {/* Desktop: split view (md+) */}
      <div className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden border-t border-[hsl(35,35%,18%)] -mx-8 grid-cols-[300px_1fr]">
        {/* Left: NPC List */}
        <div className="flex flex-col overflow-hidden border-r border-[hsl(35,35%,18%)]">
          {/* List header */}
          <div className="flex items-center justify-between px-3 py-2.5 shrink-0 border-b border-[hsl(35,35%,18%)]">
            <p className="label-overline">Characters</p>
            {isDM && (
              <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1">
                <Link href={`/campaigns/${slug}/npcs/new`}>
                  <Plus className="h-3 w-3" />
                  New
                </Link>
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2 shrink-0 border-b border-[hsl(35,35%,18%)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-sm"
              />
            </div>
          </div>

          {/* Faction chips */}
          {factions.data && (factions.data as string[]).length > 0 && (
            <div className="flex gap-1.5 flex-wrap px-3 py-2 shrink-0 border-b border-[hsl(35,35%,18%)]">
              {(factions.data as string[]).map((f) => (
                <Badge
                  key={f}
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-white/5 px-2 py-0"
                  onClick={() => setSearch(f)}
                >
                  {f}
                </Badge>
              ))}
            </div>
          )}

          {/* NPC list */}
          <div className="flex-1 overflow-y-auto">
            {npcs.isLoading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : hasNpcs ? (
              npcList.map((npc) => (
                <NpcListRow
                  key={npc.id}
                  npc={npc}
                  isSelected={selectedId === npc.id}
                  onClick={() => selectNpc(npc.id)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                <Ghost className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No NPCs yet</p>
                {isDM && (
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href={`/campaigns/${slug}/npcs/new`}>Add First NPC</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Inspector panel */}
        <div className="overflow-hidden">
          {selectedId ? (
            <NpcInspectorPanel npcId={selectedId} slug={slug} isDM={isDM} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-[hsl(240,10%,11%)]">
                <Users className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Select an NPC to inspect
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {hasNpcs
                  ? `${npcList.length} NPC${npcList.length !== 1 ? 's' : ''} in this campaign`
                  : 'No NPCs yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MobileEmpty({ slug, isDM }: { slug: string; isDM: boolean }) {
  return (
    <div className="stone-card">
      <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No NPCs yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Add NPCs to track the characters your players encounter.
        </p>
        {isDM && (
          <Button asChild size="sm">
            <Link href={`/campaigns/${slug}/npcs/new`}>New NPC</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
