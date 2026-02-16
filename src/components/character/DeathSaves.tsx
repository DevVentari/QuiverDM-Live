'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DeathSavesValue = {
  successes: number;
  failures: number;
};

type DeathSavesProps = {
  value: DeathSavesValue;
  onChange: (next: DeathSavesValue) => void;
  disabled?: boolean;
};

function ToggleTrack({
  label,
  count,
  max,
  onSetCount,
  activeClassName,
  disabled,
}: {
  label: string;
  count: number;
  max: number;
  onSetCount: (count: number) => void;
  activeClassName: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => {
          const isActive = i < count;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => {
                const next = i + 1 === count ? i : i + 1;
                onSetCount(next);
              }}
              className={cn(
                'h-4 w-4 rounded-full border transition-colors',
                isActive ? activeClassName : 'border-muted-foreground/30 bg-muted',
                !disabled && 'hover:opacity-80'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DeathSaves({ value, onChange, disabled }: DeathSavesProps) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Death Saves</div>
        {(value.successes >= 3 || value.failures >= 3) && (
          <Badge variant={value.successes >= 3 ? 'default' : 'destructive'}>
            {value.successes >= 3 ? 'Stabilized' : 'Dead'}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ToggleTrack
          label="Successes"
          count={value.successes}
          max={3}
          onSetCount={(successes) =>
            onChange({ successes: Math.max(0, Math.min(3, successes)), failures: value.failures })
          }
          activeClassName="border-emerald-500 bg-emerald-500/80"
          disabled={disabled}
        />
        <ToggleTrack
          label="Failures"
          count={value.failures}
          max={3}
          onSetCount={(failures) =>
            onChange({ successes: value.successes, failures: Math.max(0, Math.min(3, failures)) })
          }
          activeClassName="border-red-500 bg-red-500/80"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

