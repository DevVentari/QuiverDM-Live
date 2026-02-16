'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Shield } from 'lucide-react';

type HitPoints = {
  current: number;
  max: number;
  temp?: number;
};

type HPTrackerProps = {
  value: HitPoints;
  onApply: (next: HitPoints) => void;
  disabled?: boolean;
};

type Mode = 'damage' | 'heal' | 'temp';

export function HPTracker({ value, onApply, disabled }: HPTrackerProps) {
  const [mode, setMode] = useState<Mode>('damage');
  const [amount, setAmount] = useState(0);

  const temp = value.temp ?? 0;

  const preview = useMemo(() => {
    const next = { ...value, temp };
    const safeAmount = Math.max(0, amount || 0);
    if (mode === 'damage') {
      let damageLeft = safeAmount;
      const tempAbsorb = Math.min(next.temp ?? 0, damageLeft);
      next.temp = (next.temp ?? 0) - tempAbsorb;
      damageLeft -= tempAbsorb;
      next.current = Math.max(0, next.current - damageLeft);
    } else if (mode === 'heal') {
      next.current = Math.min(next.max, next.current + safeAmount);
    } else {
      next.temp = safeAmount;
    }
    return next;
  }, [amount, mode, temp, value]);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Heart className="h-4 w-4 text-red-500 mb-1" />
        <div className="text-3xl font-bold tabular-nums">{value.current}</div>
        <div className="text-muted-foreground mb-1">/ {value.max}</div>
        {temp > 0 && (
          <div className="ml-1 mb-1 inline-flex items-center gap-1 text-sm text-blue-400">
            <Shield className="h-3.5 w-3.5" />+{temp}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === 'damage' ? 'destructive' : 'outline'}
          onClick={() => setMode('damage')}
          disabled={disabled}
        >
          Damage
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'heal' ? 'default' : 'outline'}
          onClick={() => setMode('heal')}
          disabled={disabled}
        >
          Heal
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'temp' ? 'secondary' : 'outline'}
          onClick={() => setMode('temp')}
          disabled={disabled}
        >
          Temp HP
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          className="h-8 w-24"
          disabled={disabled}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => onApply(preview)}
          disabled={disabled}
        >
          Apply
        </Button>
        <div className="text-xs text-muted-foreground">
          Result: {preview.current}/{preview.max}
          {(preview.temp ?? 0) > 0 ? ` (+${preview.temp} temp)` : ''}
        </div>
      </div>
    </div>
  );
}

