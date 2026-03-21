'use client';

import { cn } from '@/lib/utils';

interface PressureHistoryRowProps {
  label: string;
  currentValue: number;
  history: number[];
  color: string;
}

export function PressureHistoryRow({ label, currentValue, history, color }: PressureHistoryRowProps) {
  const pct = Math.round(currentValue * 100);
  const isCritical = currentValue >= 0.9;
  const isWarning = currentValue >= 0.75 && currentValue < 0.9;

  const points = history.slice(0, 7).reverse();
  const n = points.length;

  let trendArrow = '→';
  if (n >= 2) {
    const diff = points[n - 1] - points[0];
    if (diff > 0.05) trendArrow = '↑';
    else if (diff < -0.05) trendArrow = '↓';
  }

  const svgPoints = points.map((v, i) => {
    const x = n <= 1 ? 30 : (i / (n - 1)) * 60;
    const y = 20 - v * 20;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider w-24 shrink-0">
          {label}
        </span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: isCritical
                ? 'oklch(0.55 0.22 25)'
                : isWarning
                ? 'oklch(0.72 0.18 75)'
                : color,
            }}
          />
          <div className="absolute top-0 h-full w-px bg-yellow-500/40" style={{ left: '75%' }} />
          <div className="absolute top-0 h-full w-px bg-destructive/50" style={{ left: '90%' }} />
        </div>
        {n >= 2 && (
          <svg width={60} height={20} className="shrink-0 overflow-visible">
            <polyline
              points={svgPoints}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.8}
            />
          </svg>
        )}
        <span
          className={cn(
            'text-xs font-mono tabular-nums w-6 text-center shrink-0',
            isCritical ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'
          )}
        >
          {trendArrow}
        </span>
        <span
          className={cn(
            'text-xs font-mono tabular-nums w-8 text-right shrink-0',
            isCritical ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'
          )}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
