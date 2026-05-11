'use client';

import { useId } from 'react';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';

const DAMAGE_TONE: Record<DamageType, { rim: string; rimDeep: string; glow: string }> = {
  acid:        { rim: 'oklch(0.78 0.18 140)', rimDeep: 'oklch(0.36 0.12 140)', glow: 'oklch(0.7 0.18 140 / 0.4)' },
  bludgeoning: { rim: 'oklch(0.7 0.04 60)',   rimDeep: 'oklch(0.35 0.02 60)',  glow: 'oklch(0.6 0.04 60 / 0.3)' },
  cold:        { rim: 'oklch(0.82 0.12 220)', rimDeep: 'oklch(0.4 0.1 230)',   glow: 'oklch(0.7 0.14 230 / 0.4)' },
  fire:        { rim: 'oklch(0.78 0.18 40)',  rimDeep: 'oklch(0.4 0.16 30)',   glow: 'oklch(0.7 0.2 35 / 0.5)' },
  force:       { rim: 'oklch(0.78 0.14 290)', rimDeep: 'oklch(0.4 0.14 290)',  glow: 'oklch(0.65 0.18 290 / 0.45)' },
  lightning:   { rim: 'oklch(0.86 0.16 95)',  rimDeep: 'oklch(0.46 0.14 95)',  glow: 'oklch(0.75 0.18 95 / 0.5)' },
  necrotic:    { rim: 'oklch(0.55 0.15 320)', rimDeep: 'oklch(0.22 0.12 320)', glow: 'oklch(0.4 0.16 320 / 0.5)' },
  piercing:    { rim: 'oklch(0.7 0.04 60)',   rimDeep: 'oklch(0.35 0.02 60)',  glow: 'oklch(0.6 0.04 60 / 0.3)' },
  poison:      { rim: 'oklch(0.74 0.18 140)', rimDeep: 'oklch(0.34 0.14 140)', glow: 'oklch(0.6 0.18 140 / 0.45)' },
  psychic:     { rim: 'oklch(0.74 0.18 340)', rimDeep: 'oklch(0.36 0.16 340)', glow: 'oklch(0.6 0.2 340 / 0.45)' },
  radiant:     { rim: 'oklch(0.92 0.1 90)',   rimDeep: 'oklch(0.5 0.12 80)',   glow: 'oklch(0.85 0.14 85 / 0.55)' },
  slashing:    { rim: 'oklch(0.7 0.04 60)',   rimDeep: 'oklch(0.35 0.02 60)',  glow: 'oklch(0.6 0.04 60 / 0.3)' },
  thunder:     { rim: 'oklch(0.74 0.13 250)', rimDeep: 'oklch(0.36 0.12 250)', glow: 'oklch(0.6 0.16 250 / 0.45)' },
};

interface DamageBadgeProps {
  type: DamageType;
  value?: string | number;
  size?: number;
  label?: string;
  className?: string;
}

export function DamageBadge({ type, value, size = 36, label, className }: DamageBadgeProps) {
  const uid = useId().replace(/:/g, '');
  const palette = DAMAGE_TONE[type];

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div
        title={label ?? type}
        aria-label={label ?? type}
        style={{
          position: 'relative',
          width: size,
          height: size,
          filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.1}px rgb(0 0 0 / 0.5))`,
        }}
      >
        <svg viewBox="0 0 36 36" width="100%" height="100%">
          <defs>
            <radialGradient id={`db-body-${uid}`} cx="40%" cy="34%" r="82%">
              <stop offset="0%"   stopColor="oklch(0.24 0.018 60)" />
              <stop offset="60%"  stopColor="oklch(0.14 0.012 265)" />
              <stop offset="100%" stopColor="oklch(0.06 0.005 265)" />
            </radialGradient>
            <linearGradient id={`db-rim-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={palette.rim} />
              <stop offset="100%" stopColor={palette.rimDeep} />
            </linearGradient>
            <radialGradient id={`db-glow-${uid}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%"   stopColor={palette.glow} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <circle cx="18" cy="18" r="17" fill={`url(#db-glow-${uid})`} opacity="0.7" />
          <circle cx="18" cy="18" r="15" fill={`url(#db-body-${uid})`} stroke="oklch(0.04 0.005 265)" strokeWidth="0.6" />
          <circle cx="18" cy="18" r="13" fill="none" stroke={`url(#db-rim-${uid})`} strokeWidth="1.4" />
          <circle cx="18" cy="18" r="12.4" fill="none" stroke="oklch(0.04 0.005 265 / 0.7)" strokeWidth="0.4" />

          <foreignObject x="9" y="9" width="18" height="18">
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: palette.rim,
                filter: 'drop-shadow(0 1px 0 rgb(0 0 0 / 0.7))',
              }}
            >
              <MaskedDndIcon name={`damage/${type}`} size={Math.round(size * 0.5)} />
            </div>
          </foreignObject>
        </svg>
      </div>
      {value !== undefined ? (
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: Math.round(size * 0.36),
            fontWeight: 700,
            color: palette.rim,
            letterSpacing: '0.02em',
          }}
        >
          {value}
        </span>
      ) : null}
    </div>
  );
}
