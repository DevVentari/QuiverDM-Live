'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/use-debounce';

const TYPE_COLORS: Record<string, string> = {
  NPC: 'text-amber-400',
  PC: 'text-emerald-400',
  FACTION: 'text-purple-400',
  THREAT: 'text-red-400',
  LOCATION: 'text-blue-400',
};

interface BrainCockpitPanelProps {
  campaignId: string;
}

export function BrainCockpitPanel({ campaignId }: BrainCockpitPanelProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const stateQuery = trpc.brain.state.get.useQuery(
    { campaignId },
    { staleTime: 60_000, refetchInterval: 60_000 }
  );

  const entityQuery = trpc.brain.entities.list.useQuery(
    { campaignId, search: debouncedSearch || undefined },
    { enabled: debouncedSearch.length > 0, staleTime: 30_000 }
  );

  const worldState = stateQuery.data;
  const hooks = Array.isArray(worldState?.hooks)
    ? (worldState.hooks as Array<{ text: string; urgency: string; status?: string; id: string }>)
        .filter((h) => h.status !== 'resolved')
        .sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (order[a.urgency] ?? 1) - (order[b.urgency] ?? 1);
        })
        .slice(0, 5)
    : [];

  const threats = Array.isArray(worldState?.threats)
    ? (worldState.threats as Array<{ name: string; urgency: number }>).slice(0, 3)
    : [];

  if (stateQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading Brain…</p>;
  }

  if (!worldState) {
    return <p className="text-xs text-muted-foreground italic">Brain not seeded. Seed from campaign settings.</p>;
  }

  const hasData = hooks.length > 0 || threats.length > 0;

  return (
    <div className="space-y-4">
      {/* Entity search */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Entity Lookup</p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entities…"
          className="h-7 text-xs"
        />
        {debouncedSearch && entityQuery.data && entityQuery.data.length > 0 && (
          <TooltipProvider>
            <div className="mt-1 space-y-0.5">
              {entityQuery.data.slice(0, 6).map((entity) => (
                <Tooltip key={entity.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className={TYPE_COLORS[entity.type] ?? 'text-muted-foreground'}>{entity.type}</span>
                      <span className="truncate">{entity.name}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="w-56 text-xs">
                    <p className="font-semibold">{entity.name}</p>
                    {entity.description && <p className="text-muted-foreground mt-1">{entity.description}</p>}
                    {entity.properties && Object.keys(entity.properties).length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {Object.entries(entity.properties).map(([k, v]) => (
                          <div key={k}><span className="text-muted-foreground">{k}: </span>{String(v)}</div>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Open hooks */}
      {hooks.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Open Hooks</p>
          <div className="space-y-1.5">
            {hooks.map((h) => (
              <div key={h.id} className="rounded border border-border/50 bg-card/30 p-2 text-xs">
                <span className={`mr-1.5 font-medium ${h.urgency === 'high' ? 'text-red-400' : h.urgency === 'medium' ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  [{h.urgency}]
                </span>
                {h.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Threats */}
      {threats.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Active Threats</p>
          <div className="space-y-1">
            {threats.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div
                  className="h-1.5 rounded-full bg-red-500/60"
                  style={{ width: `${Math.round((t.urgency ?? 0.5) * 100)}%`, maxWidth: '60px' }}
                />
                <span className="truncate text-muted-foreground">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <p className="text-xs text-muted-foreground italic">No active hooks or threats. Run a session to populate Brain.</p>
      )}
    </div>
  );
}
