'use client';

import { type ReactNode } from 'react';
import { Check, Layers, Palette, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORLD_MAP_PALETTES, type WorldMapPalette, type WorldMapPaletteKey } from './world-map-palettes';

interface WorldMapStyleCardProps {
  currentPaletteKey: WorldMapPaletteKey;
  atmosphereIntensity: number;
  onSelectPalette: (paletteKey: WorldMapPaletteKey) => void;
  onAtmosphereChange: (v: number) => void;
  onCyclePalette?: () => void;
  onClose?: () => void;
  className?: string;
}

function CardShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'absolute pointer-events-auto rounded-[1.1rem] border p-3',
        'shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md',
        className,
      )}
      style={{
        borderColor: 'var(--wm-border)',
        background: 'linear-gradient(180deg, var(--wm-raised), var(--wm-surface))',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 color-mix(in oklab, var(--wm-text) 6%, transparent)',
      }}
    >
      {children}
    </div>
  );
}

function PaletteBand({ palette }: { palette: WorldMapPalette }) {
  const stops = [
    palette.surface,
    palette.raised,
    palette.border,
    palette.accent,
  ];

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border }}>
      <div className="grid h-16 grid-cols-4">
        {stops.map((color) => (
          <div key={color} style={{ background: color }} />
        ))}
      </div>
    </div>
  );
}

function atmosphereLabel(v: number): string {
  if (v === 0) return 'None';
  if (v < 0.35) return 'Subtle';
  if (v < 0.7) return 'Immersive';
  return 'Cinematic';
}

export function WorldMapStyleCard({
  currentPaletteKey,
  atmosphereIntensity,
  onSelectPalette,
  onAtmosphereChange,
  onCyclePalette,
  onClose,
  className,
}: WorldMapStyleCardProps) {
  const currentPalette = WORLD_MAP_PALETTES.find((palette) => palette.key === currentPaletteKey) ?? WORLD_MAP_PALETTES[0];

  return (
    <CardShell className={cn('right-5 top-16 z-30 w-[23rem] max-[900px]:hidden', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg border"
              style={{
                borderColor: 'var(--wm-accent-border)',
                background: 'var(--wm-accent-trace)',
                color: 'var(--wm-accent)',
              }}
            >
              <Palette className="h-3.5 w-3.5" />
            </span>
            <p className="font-display text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--wm-muted)' }}>
              Unified Palette
            </p>
          </div>
          <p className="font-display text-sm font-semibold" style={{ color: 'var(--wm-text)' }}>
            Full theme set
          </p>
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--wm-soft-text)' }}>
            One surface system, five skins. Click a palette to recolor the map chrome, cards, and accents together.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close palette card"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:opacity-90"
            style={{
              borderColor: 'var(--wm-border)',
              color: 'var(--wm-soft-text)',
              background: 'color-mix(in oklab, var(--wm-surface) 88%, black)',
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {WORLD_MAP_PALETTES.map((palette) => {
          const selected = palette.key === currentPaletteKey;
          return (
            <button
              key={palette.key}
              type="button"
              onClick={() => onSelectPalette(palette.key)}
              className="group w-full rounded-[1rem] border p-2 text-left transition-transform hover:-translate-y-[1px]"
              style={{
                borderColor: selected ? 'var(--wm-accent-border)' : 'color-mix(in oklab, var(--wm-border) 72%, transparent)',
                background: selected
                  ? 'color-mix(in oklab, var(--wm-surface) 76%, var(--wm-accent) 24%)'
                  : 'color-mix(in oklab, var(--wm-surface) 88%, black)',
                boxShadow: selected
                  ? '0 0 0 1px color-mix(in oklab, var(--wm-accent) 22%, transparent), inset 0 1px 0 color-mix(in oklab, var(--wm-text) 6%, transparent)'
                  : 'inset 0 1px 0 color-mix(in oklab, var(--wm-text) 5%, transparent)',
              }}
            >
              <div className="flex gap-3">
                <div className="w-16 shrink-0">
                  <PaletteBand palette={palette} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold" style={{ color: 'var(--wm-text)' }}>
                        {palette.title}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
                        {palette.feel}
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]"
                      style={{
                        borderColor: selected ? 'var(--wm-accent-border)' : 'var(--wm-border)',
                        color: selected ? 'var(--wm-accent)' : 'var(--wm-soft-text)',
                        background: 'color-mix(in oklab, var(--wm-surface) 84%, black)',
                      }}
                    >
                      {palette.label}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      ['Surface', palette.surface],
                      ['Raised', palette.raised],
                      ['Border', palette.border],
                      ['Accent', palette.accent],
                    ].map(([label, color]) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.12em]"
                        style={{
                          borderColor: 'var(--wm-border)',
                          color: 'var(--wm-soft-text)',
                          background: 'color-mix(in oklab, var(--wm-surface) 90%, black)',
                        }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: color as string, borderColor: 'color-mix(in oklab, white 12%, transparent)' }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                {selected && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: 'var(--wm-accent-border)', color: 'var(--wm-accent)' }}>
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--wm-border)' }}>
        <div className="mb-3 flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg border"
            style={{
              borderColor: 'var(--wm-accent-border)',
              background: 'var(--wm-accent-trace)',
              color: 'var(--wm-accent)',
            }}
          >
            <Layers className="h-3.5 w-3.5" />
          </span>
          <p className="font-display text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--wm-muted)' }}>
            Atmosphere
          </p>
          <span className="ml-auto text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
            {atmosphereLabel(atmosphereIntensity)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={atmosphereIntensity}
          onChange={(e) => onAtmosphereChange(parseFloat(e.target.value))}
          className="w-full cursor-pointer accent-[var(--wm-accent)]"
          style={{ accentColor: 'var(--wm-accent)' }}
        />
        <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.12em]" style={{ color: 'var(--wm-muted)' }}>
          <span>None</span>
          <span>Subtle</span>
          <span>Immersive</span>
          <span>Cinematic</span>
        </div>
      </div>

      {onCyclePalette && (
        <button
          type="button"
          onClick={onCyclePalette}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors hover:opacity-90"
          style={{
            borderColor: 'var(--wm-accent-border)',
            background: 'var(--wm-accent-trace)',
            color: 'var(--wm-accent)',
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Cycle theme
        </button>
      )}

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--wm-border)' }}>
        <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--wm-muted)' }}>
          Active
        </p>
        <p className="mt-1 font-display text-sm font-semibold" style={{ color: 'var(--wm-text)' }}>
          {currentPalette.title}
        </p>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
          {currentPalette.feel}
        </p>
      </div>
    </CardShell>
  );
}
