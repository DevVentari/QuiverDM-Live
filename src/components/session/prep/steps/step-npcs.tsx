'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, UserCircle2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PrepNpc } from '@/lib/prep-types';

type CampaignNpc = {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  motivation?: string | null;
};

export function StepNpcs({
  npcs,
  campaignNpcs,
  onChange,
}: {
  npcs: PrepNpc[];
  campaignNpcs: CampaignNpc[];
  onChange: (npcs: PrepNpc[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newNpc, setNewNpc] = useState({ name: '', role: '', motivation: '' });

  const addFromCampaign = (npc: CampaignNpc) => {
    if (npcs.some((e) => e.npcId === npc.id)) return;
    onChange([
      ...npcs,
      { npcId: npc.id, name: npc.name, role: npc.role ?? undefined, motivation: npc.motivation ?? undefined },
    ]);
  };

  const removeNpc = (i: number) => onChange(npcs.filter((_, j) => j !== i));

  const updateNpc = (i: number, field: keyof PrepNpc, value: string) =>
    onChange(npcs.map((npc, j) => (j === i ? { ...npc, [field]: value } : npc)));

  const commitNew = () => {
    if (!newNpc.name.trim()) return;
    onChange([...npcs, { name: newNpc.name.trim(), role: newNpc.role || undefined, motivation: newNpc.motivation || undefined, isNew: true }]);
    setNewNpc({ name: '', role: '', motivation: '' });
    setShowNewForm(false);
  };

  const filteredCampaignNpcs = campaignNpcs.filter((npc) => {
    const q = search.toLowerCase();
    return (
      npc.name.toLowerCase().includes(q) ||
      (npc.role ?? '').toLowerCase().includes(q)
    );
  });

  const featuredIds = new Set(npcs.map((n) => n.npcId).filter(Boolean));

  return (
    <div className="space-y-6">
      {/* Featured tonight */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
            Featured Tonight
          </h3>
          <span className="text-xs text-muted-foreground">{npcs.length} selected</span>
        </div>

        {npcs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-card/20 py-10 text-center">
            <UserCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">No NPCs featured yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground/30">
              Pick from your campaign below or create a new one
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {npcs.map((npc, i) => (
              <div
                key={i}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:bg-card/60"
              >
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-sm font-display font-semibold">{npc.name.charAt(0)}</span>
                </div>
                {/* Fields */}
                <div className="flex flex-1 flex-col gap-2 min-w-0">
                  <div className="flex gap-2">
                    <Input
                      value={npc.name}
                      onChange={(e) => updateNpc(i, 'name', e.target.value)}
                      placeholder="Name..."
                      className="h-7 flex-1 border-0 bg-transparent px-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Input
                      value={npc.role ?? ''}
                      onChange={(e) => updateNpc(i, 'role', e.target.value)}
                      placeholder="Role..."
                      className="h-7 w-32 border-0 bg-transparent px-0 text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <Input
                    value={npc.motivation ?? ''}
                    onChange={(e) => updateNpc(i, 'motivation', e.target.value)}
                    placeholder="What do they want tonight?"
                    className="h-7 border-0 bg-transparent px-0 text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  onClick={() => removeNpc(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* New NPC form */}
        {showNewForm ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={newNpc.name}
                onChange={(e) => setNewNpc((p) => ({ ...p, name: e.target.value }))}
                placeholder="NPC name *"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && commitNew()}
              />
              <Input
                value={newNpc.role}
                onChange={(e) => setNewNpc((p) => ({ ...p, role: e.target.value }))}
                placeholder="Role..."
                className="h-8 w-32 text-sm"
              />
            </div>
            <Input
              value={newNpc.motivation}
              onChange={(e) => setNewNpc((p) => ({ ...p, motivation: e.target.value }))}
              placeholder="Motivation / what do they want tonight?"
              className="h-8 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={commitNew} disabled={!newNpc.name.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewForm(true)}
            className="gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            New NPC
          </Button>
        )}
      </section>

      {/* Campaign NPC picker */}
      {campaignNpcs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
              Campaign NPCs
            </h3>
            <span className="text-xs text-muted-foreground">{campaignNpcs.length} available</span>
          </div>

          {campaignNpcs.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search NPCs..."
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {filteredCampaignNpcs.map((npc) => {
              const isAdded = featuredIds.has(npc.id);
              return (
                <button
                  key={npc.id}
                  onClick={() => !isAdded && addFromCampaign(npc)}
                  disabled={isAdded}
                  className={cn(
                    'group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150',
                    isAdded
                      ? 'border-primary/30 bg-primary/8 cursor-default'
                      : 'border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/60 cursor-pointer'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-display font-semibold transition-colors',
                      isAdded ? 'bg-primary/20 text-primary' : 'bg-foreground/8 text-foreground/50'
                    )}
                  >
                    {npc.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium truncate', isAdded ? 'text-primary' : 'text-foreground/80')}>
                        {npc.name}
                      </span>
                      {isAdded && (
                        <Badge variant="outline" className="shrink-0 border-primary/30 text-primary text-[10px] px-1.5 py-0">
                          Added
                        </Badge>
                      )}
                    </div>
                    {npc.role && (
                      <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{npc.role}</p>
                    )}
                    {npc.description && !npc.role && (
                      <p className="text-xs text-muted-foreground/50 line-clamp-1 mt-0.5">{npc.description}</p>
                    )}
                  </div>

                  {!isAdded && (
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {filteredCampaignNpcs.length === 0 && search && (
            <p className="text-sm text-center text-muted-foreground/50 py-4">
              No NPCs match "{search}"
            </p>
          )}
        </section>
      )}
    </div>
  );
}
