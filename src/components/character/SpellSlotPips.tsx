'use client';

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
  if (!total || total <= 0) return null;

  const available = Math.max(0, total - used);

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
              if (isAvailable) {
                onChangeUsed(Math.min(total, used + 1));
              } else {
                onChangeUsed(Math.max(0, used - 1));
              }
            }}
            className={cn(
              'h-3 w-3 rounded-full border transition-colors',
              isAvailable
                ? 'bg-primary border-primary'
                : 'bg-muted border-muted-foreground/30',
              onChangeUsed && 'hover:opacity-80',
              pipClassName
            )}
            aria-label={isAvailable ? 'Use slot' : 'Restore slot'}
          />
        );
      })}
    </div>
  );
}

