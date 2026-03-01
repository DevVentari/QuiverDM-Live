'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ItemEffect } from '@/lib/dnd-schemas';

interface EffectConfirmationPanelProps {
  effects: ItemEffect[];
  onChange: (effects: ItemEffect[]) => void;
}

export function EffectConfirmationPanel({ effects, onChange }: EffectConfirmationPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (effects.length === 0) return null;

  function removeEffect(idx: number) {
    onChange(effects.filter((_, i) => i !== idx));
  }

  function updateValue(idx: number, value: string) {
    const parsed = Number(value);
    const updated = effects.map((e, i) => {
      if (i !== idx || !e.mechanic) return e;
      return { ...e, mechanic: { ...e.mechanic, value: isNaN(parsed) ? value : parsed } };
    });
    onChange(updated);
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-medium text-amber-300"
      >
        <Zap className="h-3.5 w-3.5" />
        Detected Mechanics ({effects.length})
        {expanded ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>

      {expanded && (
        <div className="space-y-1.5 pt-1">
          {effects.map((effect, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded bg-background/40 px-2 py-1.5 text-xs">
              <span className="flex-1 font-medium truncate">{effect.name}</span>
              {effect.mechanic && (
                <>
                  <Badge variant="secondary" className="text-xs capitalize shrink-0">
                    {effect.mechanic.type.replace(/_/g, ' ')}
                  </Badge>
                  {effect.mechanic.value != null && (
                    <Input
                      className="h-6 w-14 text-xs px-1.5"
                      value={String(effect.mechanic.value)}
                      onChange={(e) => updateValue(idx, e.target.value)}
                    />
                  )}
                  {effect.mechanic.target && (
                    <span className="text-muted-foreground shrink-0">{effect.mechanic.target}</span>
                  )}
                </>
              )}
              <button type="button" onClick={() => removeEffect(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-0.5">
            Review AI-detected mechanics. Remove any that are wrong.
          </p>
        </div>
      )}
    </div>
  );
}
