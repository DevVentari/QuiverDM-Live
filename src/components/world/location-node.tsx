'use client';

import { memo } from 'react';
import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Type → D&D icon (CSS mask-image) ────────────────────────────────────────
const ICON_BY_TYPE: Record<string, string> = {
  LOCATION: '/icons/dnd/location/castle.svg',
  CUSTOM:   '/icons/dnd/entity/location.svg',
  NPC:      '/icons/dnd/entity/person.svg',
  PC:       '/icons/dnd/entity/person.svg',
  FACTION:  '/icons/dnd/entity/organization.svg',
  EVENT:    '/icons/dnd/game/combat.svg',
  ARC:      '/icons/dnd/game/adventure-book.svg',
  THREAT:   '/icons/dnd/game/hazard.svg',
  SECRET:   '/icons/dnd/entity/archive.svg',
  NOTE:     '/icons/dnd/entity/scroll.svg',
};

// ── Type → color ─────────────────────────────────────────────────────────────
interface PinColors { stroke: string; glow: string; dim: string }

const COLORS: Record<string, PinColors> = {
  LOCATION: { stroke: 'oklch(0.82 0.20 55)',  glow: 'oklch(0.82 0.20 55 / 0.55)',  dim: 'oklch(0.50 0.10 55)' },
  CUSTOM:   { stroke: 'oklch(0.82 0.20 55)',  glow: 'oklch(0.82 0.20 55 / 0.55)',  dim: 'oklch(0.50 0.10 55)' },
  NPC:      { stroke: 'oklch(0.76 0.22 288)', glow: 'oklch(0.76 0.22 288 / 0.55)', dim: 'oklch(0.48 0.12 288)' },
  PC:       { stroke: 'oklch(0.76 0.22 288)', glow: 'oklch(0.76 0.22 288 / 0.55)', dim: 'oklch(0.48 0.12 288)' },
  FACTION:  { stroke: 'oklch(0.76 0.20 220)', glow: 'oklch(0.76 0.20 220 / 0.55)', dim: 'oklch(0.48 0.12 220)' },
  EVENT:    { stroke: 'oklch(0.80 0.22 50)',  glow: 'oklch(0.80 0.22 50 / 0.55)',  dim: 'oklch(0.50 0.12 50)' },
  ARC:      { stroke: 'oklch(0.80 0.22 50)',  glow: 'oklch(0.80 0.22 50 / 0.55)',  dim: 'oklch(0.50 0.12 50)' },
  THREAT:   { stroke: 'oklch(0.72 0.26 18)',  glow: 'oklch(0.72 0.26 18 / 0.55)',  dim: 'oklch(0.46 0.16 18)' },
  SECRET:   { stroke: 'oklch(0.74 0.20 290)', glow: 'oklch(0.74 0.20 290 / 0.50)', dim: 'oklch(0.46 0.10 290)' },
  NOTE:     { stroke: 'oklch(0.78 0.10 60)',  glow: 'oklch(0.78 0.10 60 / 0.40)',  dim: 'oklch(0.50 0.06 60)' },
};
const FALLBACK_COLORS = COLORS.LOCATION;

// ── Label pill ────────────────────────────────────────────────────────────────
function LabelPill({ label, stroke, selected }: { label: string; stroke: string; selected: boolean }) {
  return (
    <div
      className="mt-1.5 max-w-[130px] truncate rounded-md px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide backdrop-blur-md"
      style={{
        background: 'oklch(0.11 0.01 260 / 0.92)',
        color: selected ? stroke : 'oklch(0.80 0.04 60)',
        border: `1px solid ${selected ? stroke : 'oklch(1 0 0 / 0.08)'}`,
        boxShadow: '0 2px 12px oklch(0 0 0 / 0.6)',
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </div>
  );
}

// ── Disc pin ──────────────────────────────────────────────────────────────────
interface ND {
  entityId: string;
  label: string;
  type: string;
  imageUrl?: string | null;
  lastEventAt?: string | null;
  chapterColor?: string | null;
  unplaced?: boolean;
  onSelect: () => void;
}

const DISC_SIZE = 38;

function DiscPin({ d, selected, colors }: { d: ND; selected: boolean; colors: PinColors }) {
  const stroke = selected ? colors.stroke : colors.dim;
  const iconSrc = ICON_BY_TYPE[d.type] ?? '/icons/dnd/entity/location.svg';

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{
          filter: `drop-shadow(0 4px 20px ${selected ? colors.glow : 'oklch(0 0 0 / 0.65)'})`,
        }}
      >
        {/* Outer halo ring */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: `1px solid ${stroke}`,
            opacity: selected ? 0.45 : 0.15,
            pointerEvents: 'none',
          }}
        />

        {/* Main disc */}
        <div
          style={{
            width: DISC_SIZE,
            height: DISC_SIZE,
            borderRadius: '50%',
            background: 'oklch(0.10 0.015 265)',
            border: `2px solid ${stroke}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* D&D icon via CSS mask */}
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 18,
              height: 18,
              flexShrink: 0,
              backgroundColor: stroke,
              maskImage: `url(${iconSrc})`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: `url(${iconSrc})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              opacity: 0.9,
            }}
          />

          {/* Activity dot */}
          {d.lastEventAt && (
            <span
              style={{
                position: 'absolute',
                top: 1,
                right: 1,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: colors.stroke,
                border: '1.5px solid oklch(0.08 0.01 265)',
              }}
            />
          )}
        </div>

        {/* Anchor triangle */}
        <div
          style={{
            width: 0,
            height: 0,
            margin: '0 auto',
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${stroke}`,
          }}
        />
      </div>

      <LabelPill label={d.label} stroke={colors.stroke} selected={selected} />
    </div>
  );
}

// ── Main node ─────────────────────────────────────────────────────────────────
export const LocationNode = memo(function LocationNode({ data, selected }: NodeProps) {
  const d = data as unknown as ND;
  const { zoom } = useViewport();

  const baseColors = COLORS[d.type] ?? FALLBACK_COLORS;
  const colors = d.chapterColor
    ? { stroke: d.chapterColor, glow: `${d.chapterColor.replace(/\)$/, '')} / 0.45)`, dim: d.chapterColor }
    : baseColors;

  return (
    <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center bottom' }}>
      <motion.div
        className={cn(
          'group relative flex flex-col items-center cursor-pointer select-none',
          d.unplaced && 'opacity-40',
        )}
        onClick={d.onSelect}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: d.unplaced ? 0.4 : 1 }}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      >
        <DiscPin d={d} selected={!!selected} colors={colors} />

        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <Handle type="target" position={Position.Top}    className="!opacity-0" />
      </motion.div>
    </div>
  );
});
