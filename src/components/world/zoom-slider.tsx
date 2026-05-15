'use client';

import { useReactFlow, useViewport } from '@xyflow/react';
import { useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const STEP = 0.01;

export function ZoomSlider() {
  const { zoomTo } = useReactFlow();
  const { zoom } = useViewport();

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      zoomTo(parseFloat(e.target.value), { duration: 0 });
    },
    [zoomTo],
  );

  const nudge = useCallback(
    (delta: number) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
      zoomTo(next, { duration: 120 });
    },
    [zoom, zoomTo],
  );

  const pct = Math.round(zoom * 100);

  return (
    <div
      className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md"
      style={{
        borderColor: 'var(--wm-border)',
        background: 'color-mix(in oklab, var(--wm-surface) 88%, black)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      }}
    >
      <button
        type="button"
        onClick={() => nudge(-0.1)}
        className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{ color: 'var(--wm-muted)' }}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>

      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={STEP}
        value={zoom}
        onChange={handleSlider}
        className="h-1 w-32 cursor-pointer appearance-none rounded-full"
        style={{
          accentColor: 'var(--wm-accent)',
          background: `linear-gradient(to right, var(--wm-accent) ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, color-mix(in oklab, var(--wm-border) 80%, transparent) 0%)`,
        }}
      />

      <button
        type="button"
        onClick={() => nudge(0.1)}
        className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{ color: 'var(--wm-muted)' }}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>

      <span
        className="w-9 text-center font-mono text-[10px] tabular-nums"
        style={{ color: 'var(--wm-soft-text)' }}
      >
        {pct}%
      </span>
    </div>
  );
}
