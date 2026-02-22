'use client';

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatBlockCard } from './stat-block-card';
import { cn } from '@/lib/utils';
import type { SrdMonster } from '@/lib/srd/monsters';

type Tab = 'srd' | 'npcs' | 'homebrew';

interface AddCreaturePayload {
  name: string;
  count: number;
  cr?: string;
  xp?: number;
  sourceType: 'srd' | 'npc' | 'homebrew' | 'custom';
  sourceId?: string;
  statBlock?: Record<string, unknown>;
}

interface MonsterPickerProps {
  campaignId: string;
  onAdd: (creature: AddCreaturePayload) => void;
  className?: string;
}

const CR_OPTIONS = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

export function MonsterPicker({ campaignId, onAdd, className }: MonsterPickerProps) {
  const [tab, setTab] = useState<Tab>('srd');
  const [query, setQuery] = useState('');
  const [crMin, setCrMin] = useState<string>('');
  const [crMax, setCrMax] = useState<string>('');
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const srdQuery = trpc.encounterPlans.searchSrdMonsters.useQuery(
    {
      query,
      crMin: crMin ? parseFloat(crMin === '1/8' ? '0.125' : crMin === '1/4' ? '0.25' : crMin === '1/2' ? '0.5' : crMin) : undefined,
      crMax: crMax ? parseFloat(crMax === '1/8' ? '0.125' : crMax === '1/4' ? '0.25' : crMax === '1/2' ? '0.5' : crMax) : undefined,
      limit: 40,
    },
    { enabled: tab === 'srd', staleTime: 60_000 }
  );

  const npcsQuery = trpc.npcs.getAll.useQuery(
    { campaignId },
    { enabled: tab === 'npcs', staleTime: 30_000 }
  );

  const homebrewQuery = trpc.homebrew.getContent.useQuery(
    { campaignId, type: 'creature' as const },
    { enabled: tab === 'homebrew', staleTime: 30_000 }
  );

  const handleAddSrd = (monster: SrdMonster, count: number) => {
    onAdd({
      name: monster.name,
      count,
      cr: monster.challengeRating,
      xp: monster.xp,
      sourceType: 'srd',
      statBlock: monster as unknown as Record<string, unknown>,
    });
  };

  const handleAddNpc = (npc: { id: string; name: string; stats?: unknown }, count: number) => {
    const stats = npc.stats as Record<string, unknown> | null;
    onAdd({
      name: npc.name,
      count,
      cr: stats?.challengeRating as string | undefined,
      xp: stats?.xp as number | undefined,
      sourceType: 'npc',
      sourceId: npc.id,
      statBlock: stats ?? undefined,
    });
  };

  const handleAddHomebrew = (
    item: { id: string; name: string; data?: unknown },
    count: number
  ) => {
    const data = item.data as Record<string, unknown> | null;
    onAdd({
      name: item.name,
      count,
      cr: data?.challengeRating as string | undefined,
      xp: data?.xp as number | undefined,
      sourceType: 'homebrew',
      sourceId: item.id,
      statBlock: data ?? undefined,
    });
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['srd', 'npcs', 'homebrew'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'srd' ? 'SRD Monsters' : t === 'npcs' ? 'Campaign NPCs' : 'Homebrew'}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="p-2 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tab === 'srd' ? 'Search monsters...' : 'Search...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {tab === 'srd' && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">CR:</span>
            <select
              value={crMin}
              onChange={(e) => setCrMin(e.target.value)}
              className="flex-1 h-7 px-2 rounded border border-border bg-background text-xs"
            >
              <option value="">Min</option>
              {CR_OPTIONS.map((cr) => <option key={cr} value={cr}>{cr}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">–</span>
            <select
              value={crMax}
              onChange={(e) => setCrMax(e.target.value)}
              className="flex-1 h-7 px-2 rounded border border-border bg-background text-xs"
            >
              <option value="">Max</option>
              {CR_OPTIONS.map((cr) => <option key={cr} value={cr}>{cr}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tab === 'srd' && (
          <>
            {srdQuery.isLoading && (
              <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
            )}
            {srdQuery.data?.map((monster) => (
              <StatBlockCard
                key={monster.slug}
                monster={monster}
                compact
                onAdd={(count) => handleAddSrd(monster, count)}
              />
            ))}
            {srdQuery.data?.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No monsters found</div>
            )}
          </>
        )}

        {tab === 'npcs' && (
          <>
            {npcsQuery.isLoading && (
              <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
            )}
            {npcsQuery.data?.map((npc) => (
              <div
                key={npc.id}
                className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted/50 text-sm"
              >
                <div>
                  <div className="font-medium">{npc.name}</div>
                  {npc.faction && (
                    <div className="text-xs text-muted-foreground">{npc.faction}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleAddNpc(npc, 1)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            ))}
            {npcsQuery.data?.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No NPCs in this campaign
              </div>
            )}
          </>
        )}

        {tab === 'homebrew' && (
          <>
            {homebrewQuery.isLoading && (
              <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
            )}
            {homebrewQuery.data?.items
              ?.filter(
                (h: { type: string; name: string }) =>
                  !query || h.name.toLowerCase().includes(query.toLowerCase())
              )
              .map((item: { id: string; name: string; data?: unknown }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted/50 text-sm"
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <Badge variant="outline" className="text-xs">Homebrew</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleAddHomebrew(item, 1)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            {(homebrewQuery.data?.items?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No homebrew creatures in this campaign
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
