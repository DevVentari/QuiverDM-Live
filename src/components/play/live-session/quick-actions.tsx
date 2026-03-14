'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dice6 } from 'lucide-react';

export function QuickActions() {
  const [lastRoll, setLastRoll] = useState<{ die: number; result: number } | null>(null);

  function roll(die: number) {
    setLastRoll({ die, result: Math.floor(Math.random() * die) + 1 });
  }

  return (
    <div className="border-t border-white/8 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Dice6 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Quick Roll</span>
        {lastRoll && (
          <span className="text-xs font-mono text-amber-400 ml-auto">
            d{lastRoll.die}: <strong>{lastRoll.result}</strong>
          </span>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {[4, 6, 8, 10, 12, 20].map(d => (
          <Button key={d} variant="outline" size="sm" className="h-7 px-2 text-xs font-mono"
            onClick={() => roll(d)}>d{d}</Button>
        ))}
      </div>
    </div>
  );
}
