'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PrepNpc } from '@/lib/prep-types';

type CampaignNpc = {
  id: string;
  name: string;
  role?: string | null;
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
  const add = () => onChange([...npcs, { name: '', isNew: true }]);
  const update = (i: number, field: keyof PrepNpc, value: string | boolean) =>
    onChange(npcs.map((npc, j) => (j === i ? { ...npc, [field]: value } : npc)));
  const remove = (i: number) => onChange(npcs.filter((_, j) => j !== i));

  const addFromCampaign = (npc: CampaignNpc) => {
    if (npcs.some((existing) => existing.npcId === npc.id)) return;
    onChange([
      ...npcs,
      {
        npcId: npc.id,
        name: npc.name,
        role: npc.role ?? undefined,
        motivation: npc.motivation ?? undefined,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {npcs.map((npc, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-border bg-card/50 p-4"
        >
          <div className="flex items-start gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <Input
                value={npc.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder="NPC name..."
                className="h-8 text-sm font-medium"
              />
              <Input
                value={npc.role ?? ''}
                onChange={(e) => update(i, 'role', e.target.value)}
                placeholder="Role (optional)..."
                className="h-8 text-sm"
              />
              <Input
                value={npc.motivation ?? ''}
                onChange={(e) => update(i, 'motivation', e.target.value)}
                placeholder="Motivation..."
                className="h-8 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add NPC
        </Button>
      </div>

      {campaignNpcs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Add from campaign NPCs:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {campaignNpcs.slice(0, 20).map((npc) => (
              <button
                key={npc.id}
                onClick={() => addFromCampaign(npc)}
                disabled={npcs.some((existing) => existing.npcId === npc.id)}
                className="rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {npc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

