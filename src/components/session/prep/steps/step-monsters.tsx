'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PrepMonster } from '@/lib/prep-types';

export function StepMonsters({
  monsters,
  onChange,
}: {
  monsters: PrepMonster[];
  onChange: (monsters: PrepMonster[]) => void;
}) {
  const add = () => onChange([...monsters, { name: '', source: 'custom', count: 1 }]);
  const update = (i: number, field: keyof PrepMonster, value: string | number) =>
    onChange(monsters.map((monster, j) => (j === i ? { ...monster, [field]: value } : monster)));
  const remove = (i: number) => onChange(monsters.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {monsters.map((monster, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2"
        >
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <Input
              value={monster.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              placeholder="Monster name..."
              className="h-8 text-sm"
            />
            <Input
              value={monster.cr ?? ''}
              onChange={(e) => update(i, 'cr', e.target.value)}
              placeholder="CR (e.g. 2, 1/2)..."
              className="h-8 text-sm"
            />
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => update(i, 'count', Math.max(1, monster.count - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">{monster.count}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => update(i, 'count', monster.count + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
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
      ))}

      <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add Monster
      </Button>
    </div>
  );
}

