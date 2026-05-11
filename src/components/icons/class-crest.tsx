'use client';

import { useId } from 'react';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

export type DndClass =
  | 'artificer' | 'barbarian' | 'bard' | 'cleric' | 'druid'
  | 'fighter' | 'monk' | 'paladin' | 'ranger' | 'rogue'
  | 'sorcerer' | 'warlock' | 'wizard';

const CLASS_TONE: Record<DndClass, { rim: string; rimDeep: string; glow: string }> = {
  artificer:  { rim: 'oklch(0.74 0.13 60)',  rimDeep: 'oklch(0.36 0.1 60)',  glow: 'oklch(0.6 0.14 60 / 0.4)' },
  barbarian:  { rim: 'oklch(0.7 0.18 25)',   rimDeep: 'oklch(0.32 0.14 25)', glow: 'oklch(0.55 0.18 25 / 0.45)' },
  bard:       { rim: 'oklch(0.78 0.15 320)', rimDeep: 'oklch(0.4 0.14 320)', glow: 'oklch(0.65 0.18 320 / 0.45)' },
  cleric:     { rim: 'oklch(0.86 0.12 90)',  rimDeep: 'oklch(0.5 0.12 80)',  glow: 'oklch(0.78 0.14 85 / 0.45)' },
  druid:      { rim: 'oklch(0.74 0.14 145)', rimDeep: 'oklch(0.36 0.12 145)', glow: 'oklch(0.6 0.16 145 / 0.45)' },
  fighter:    { rim: 'oklch(0.72 0.06 60)',  rimDeep: 'oklch(0.36 0.04 60)', glow: 'oklch(0.6 0.06 60 / 0.4)' },
  monk:       { rim: 'oklch(0.78 0.1 200)',  rimDeep: 'oklch(0.4 0.08 200)', glow: 'oklch(0.6 0.12 200 / 0.4)' },
  paladin:    { rim: 'oklch(0.84 0.14 75)',  rimDeep: 'oklch(0.44 0.12 70)', glow: 'oklch(0.7 0.16 75 / 0.5)' },
  ranger:     { rim: 'oklch(0.7 0.12 145)',  rimDeep: 'oklch(0.32 0.1 145)', glow: 'oklch(0.55 0.14 145 / 0.4)' },
  rogue:      { rim: 'oklch(0.6 0.04 265)',  rimDeep: 'oklch(0.24 0.02 265)', glow: 'oklch(0.4 0.06 265 / 0.4)' },
  sorcerer:   { rim: 'oklch(0.74 0.18 30)',  rimDeep: 'oklch(0.36 0.16 30)', glow: 'oklch(0.6 0.2 30 / 0.45)' },
  warlock:    { rim: 'oklch(0.62 0.16 290)', rimDeep: 'oklch(0.26 0.14 290)', glow: 'oklch(0.45 0.18 290 / 0.45)' },
  wizard:     { rim: 'oklch(0.72 0.16 260)', rimDeep: 'oklch(0.34 0.14 260)', glow: 'oklch(0.55 0.18 260 / 0.45)' },
};

interface ClassCrestProps {
  dndClass: DndClass;
  level?: number;
  size?: number;
  label?: string;
  className?: string;
}

export function ClassCrest({ dndClass, level, size = 64, label, className }: ClassCrestProps) {
  const uid = useId().replace(/:/g, '');
  const palette = CLASS_TONE[dndClass];

  // Heraldic shield path (flat top, tapered point bottom)
  const shield = 'M14 8 H86 L86 50 C86 72 70 86 50 92 C30 86 14 72 14 50 Z';

  return (
    <div
      className={className}
      title={label ?? dndClass}
      aria-label={label ?? dndClass}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-block',
        filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgb(0 0 0 / 0.55))`,
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <radialGradient id={`cc-body-${uid}`} cx="42%" cy="32%" r="86%">
            <stop offset="0%"   stopColor="oklch(0.24 0.018 60)" />
            <stop offset="60%"  stopColor="oklch(0.14 0.012 265)" />
            <stop offset="100%" stopColor="oklch(0.05 0.005 265)" />
          </radialGradient>
          <linearGradient id={`cc-rim-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={palette.rim} />
            <stop offset="100%" stopColor={palette.rimDeep} />
          </linearGradient>
          <radialGradient id={`cc-glow-${uid}`} cx="50%" cy="55%" r="55%">
            <stop offset="0%"   stopColor={palette.glow} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <path d={shield} fill={`url(#cc-glow-${uid})`} opacity="0.7" />
        <path d={shield} fill={`url(#cc-body-${uid})`} stroke="oklch(0.04 0.005 265)" strokeWidth="0.8" />

        {/* Inner gilded shield border */}
        <path
          d={shield}
          fill="none"
          stroke={`url(#cc-rim-${uid})`}
          strokeWidth="1.8"
          transform="translate(50 50) scale(0.86) translate(-50 -50)"
        />
        <path
          d={shield}
          fill="none"
          stroke="oklch(0.04 0.005 265 / 0.55)"
          strokeWidth="0.5"
          transform="translate(50 50) scale(0.86) translate(-50 -50)"
        />

        <foreignObject x="28" y="22" width="44" height="44">
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
            <MaskedDndIcon name={`class/${dndClass}`} size={Math.round(size * 0.55)} />
          </div>
        </foreignObject>

        {typeof level === 'number' ? (
          <g>
            <rect x="36" y="76" width="28" height="14" rx="2" fill="oklch(0.06 0.005 265)" />
            <rect x="36.5" y="76.5" width="27" height="13" rx="2" fill={`url(#cc-rim-${uid})`} />
            <rect
              x="36.5" y="76.5" width="27" height="13" rx="2"
              fill="none" stroke="oklch(0.04 0.005 265 / 0.6)" strokeWidth="0.5"
            />
            <text
              x="50"
              y="83.5"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="'Cinzel', serif"
              fontSize="9"
              fontWeight="700"
              fill="oklch(0.1 0.005 265)"
              letterSpacing="0.08em"
            >
              LV {level}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
