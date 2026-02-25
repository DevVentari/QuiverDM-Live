'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type SpellSlotPipsProps = {
  total: number;
  used: number;
  onChangeUsed?: (used: number) => void;
  disabled?: boolean;
  pipClassName?: string;
};

export function SpellSlotPips({
  total,
  used,
  onChangeUsed,
  disabled,
  pipClassName,
}: SpellSlotPipsProps) {
  // Local state for instant visual feedback while server round-trip completes
  const [localUsed, setLocalUsed] = useState(used);

  // Sync from parent when server data arrives
  useEffect(() => {
    setLocalUsed(used);
  }, [used]);

  if (!total || total <= 0) return null;

  const available = Math.max(0, total - localUsed);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const isAvailable = i < available;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || !onChangeUsed}
            onClick={() => {
              if (!onChangeUsed) return;
              const next = isAvailable
                ? Math.min(total, localUsed + 1)
                : Math.max(0, localUsed - 1);
              setLocalUsed(next);
              onChangeUsed(next);
            }}
            className={cn(
              'h-3 w-3 rounded-full border transition-colors',
              isAvailable
                ? 'bg-primary border-primary'
                : 'bg-muted border-muted-foreground/30',
              onChangeUsed && !disabled && 'hover:opacity-80',
              pipClassName
            )}
            aria-label={isAvailable ? 'Use slot' : 'Restore slot'}
          />
        );
      })}
    </div>
  );
}

