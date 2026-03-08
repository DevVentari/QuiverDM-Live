'use client';

import { cn } from '@/lib/utils';

interface PressureTrack {
  label: string;
  value: number;
  color: string;
}

interface PressureState {
  pressurePolitical: number;
  pressureSupernatural: number;
  pressureEconomic: number;
  pressureCosmic: number;
  pressureSocial: number;
}

export function PressureGauges({ state }: { state: PressureState }) {
  const tracks: PressureTrack[] = [
    { label: 'Political', value: state.pressurePolitical, color: 'oklch(0.65 0.16 55)' },
    { label: 'Supernatural', value: state.pressureSupernatural, color: 'oklch(0.55 0.2 280)' },
    { label: 'Economic', value: state.pressureEconomic, color: 'oklch(0.60 0.15 160)' },
    { label: 'Cosmic', value: state.pressureCosmic, color: 'oklch(0.50 0.22 300)' },
    { label: 'Social', value: state.pressureSocial, color: 'oklch(0.65 0.18 25)' },
  ];

  return (
    <div className="space-y-3">
      {tracks.map((track) => {
        const pct = Math.round(track.value * 100);
        const isCritical = track.value >= 0.9;
        const isWarning = track.value >= 0.75 && track.value < 0.9;

        return (
          <div key={track.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {track.label}
              </span>
              <span
                className={cn(
                  'text-xs font-mono tabular-nums',
                  isCritical ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'
                )}
              >
                {pct}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isCritical
                    ? 'oklch(0.55 0.22 25)'
                    : isWarning
                    ? 'oklch(0.72 0.18 75)'
                    : track.color,
                }}
              />
              {/* Warning threshold marker at 75% */}
              <div
                className="absolute top-0 h-full w-px bg-yellow-500/40"
                style={{ left: '75%' }}
              />
              {/* Critical threshold marker at 90% */}
              <div
                className="absolute top-0 h-full w-px bg-destructive/50"
                style={{ left: '90%' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
