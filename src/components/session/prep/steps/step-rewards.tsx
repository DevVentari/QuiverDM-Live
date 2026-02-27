'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PrepReward } from '@/lib/prep-types';

export function StepRewards({
  rewards,
  onChange,
}: {
  rewards: PrepReward[];
  onChange: (rewards: PrepReward[]) => void;
}) {
  const add = () => onChange([...rewards, { name: '', source: 'custom' }]);
  const update = (i: number, field: keyof PrepReward, value: string) =>
    onChange(rewards.map((reward, j) => (j === i ? { ...reward, [field]: value } : reward)));
  const remove = (i: number) => onChange(rewards.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {rewards.map((reward, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-border bg-card/50 p-3"
        >
          <div className="flex gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Input
                value={reward.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder="Reward name..."
                className="h-8 text-sm"
              />
              <Input
                value={reward.rarity ?? ''}
                onChange={(e) => update(i, 'rarity', e.target.value)}
                placeholder="Rarity (optional)..."
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
          <Textarea
            value={reward.notes ?? ''}
            onChange={(e) => update(i, 'notes', e.target.value)}
            placeholder="Notes, where to find it, conditions..."
            className="min-h-[50px] resize-none text-xs"
          />
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add Reward
      </Button>
    </div>
  );
}

