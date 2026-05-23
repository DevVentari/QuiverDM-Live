'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface Phase {
  id?: string;
  name: string;
  targetMinutes: number;
  notes: string;
  orderIndex: number;
}

interface PhasePacingSectionProps {
  campaignId: string;
  sessionId: string;
}

export function PhasePacingSection({ campaignId, sessionId }: PhasePacingSectionProps) {
  const { data: saved } = trpc.sessionPhases.list.useQuery({ campaignId, sessionId });
  const [phases, setPhases] = useState<Phase[]>([]);
  const [dirty, setDirty] = useState(false);
  const save = trpc.sessionPhases.upsertMany.useMutation({ onSuccess: () => setDirty(false) });

  useEffect(() => {
    if (saved) {
      setPhases(saved.map(p => ({
        id: p.id,
        name: p.name,
        targetMinutes: p.targetMinutes,
        notes: p.notes ?? '',
        orderIndex: p.orderIndex,
      })));
    }
  }, [saved]);

  function addPhase() {
    setPhases(prev => [...prev, { name: '', targetMinutes: 30, notes: '', orderIndex: prev.length }]);
    setDirty(true);
  }

  function removePhase(i: number) {
    setPhases(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, orderIndex: idx })));
    setDirty(true);
  }

  function updatePhase(i: number, field: keyof Phase, value: string | number) {
    setPhases(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
    setDirty(true);
  }

  const totalMinutes = phases.reduce((sum, p) => sum + p.targetMinutes, 0);

  return (
    <div className="space-y-3">
      {phases.map((phase, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/20">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Phase name"
            value={phase.name}
            onChange={e => updatePhase(i, 'name', e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number"
              min={1}
              value={phase.targetMinutes}
              onChange={e => updatePhase(i, 'targetMinutes', parseInt(e.target.value) || 1)}
              className="w-16 h-8 text-sm text-right"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removePhase(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-2" onClick={addPhase}>
          <Plus className="h-3.5 w-3.5" /> Add phase
        </Button>
        <span className="text-xs text-muted-foreground">Total: {totalMinutes} min</span>
      </div>

      {dirty && (
        <Button
          size="sm"
          onClick={() => save.mutate({ campaignId, sessionId, phases })}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save phases'}
        </Button>
      )}
    </div>
  );
}
