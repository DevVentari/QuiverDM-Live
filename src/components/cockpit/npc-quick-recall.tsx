'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, User } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface NpcQuickRecallProps {
  campaignId: string;
}

interface NpcCardPopupProps {
  npc: any;
  onClose: () => void;
}

function NpcCardPopup({ npc, onClose }: NpcCardPopupProps) {
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2.5 relative">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="pr-5">
        <p className="font-semibold text-sm">{npc.name}</p>
        {(npc.faction || npc.role) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {npc.faction && (
              <Badge variant="outline" className="text-[10px] py-0 h-4">{npc.faction}</Badge>
            )}
            {npc.role && (
              <span className="text-[10px] text-muted-foreground">{npc.role}</span>
            )}
          </div>
        )}
      </div>

      {npc.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{npc.description}</p>
      )}

      {npc.secrets && (
        <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 mb-1">Secret</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">{npc.secrets}</p>
        </div>
      )}
    </div>
  );
}

export function NpcQuickRecall({ campaignId }: NpcQuickRecallProps) {
  const [search, setSearch] = useState('');
  const [selectedNpc, setSelectedNpc] = useState<any | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const query = trpc.npcs.getAll.useQuery(
    { campaignId, search: debouncedSearch || undefined },
    { staleTime: 10_000 }
  );

  const handleSelect = useCallback((npc: any) => {
    setSelectedNpc(npc);
  }, []);

  return (
    <div className="space-y-2">
      {selectedNpc && (
        <NpcCardPopup npc={selectedNpc} onClose={() => setSelectedNpc(null)} />
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search NPCs..."
          className="pl-8 h-8 text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {query.isLoading && (
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-1">
        {(query.data ?? []).map((npc: any) => (
          <button
            key={npc.id}
            type="button"
            onClick={() => handleSelect(npc)}
            className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
          >
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{npc.name}</p>
              {(npc.faction || npc.role) && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {[npc.faction, npc.role].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </button>
        ))}

        {query.data?.length === 0 && search && (
          <p className="text-xs text-muted-foreground text-center py-3 italic">
            No NPCs matching "{search}"
          </p>
        )}

        {query.data?.length === 0 && !search && (
          <p className="text-xs text-muted-foreground text-center py-3 italic">
            No NPCs in this campaign
          </p>
        )}
      </div>
    </div>
  );
}
