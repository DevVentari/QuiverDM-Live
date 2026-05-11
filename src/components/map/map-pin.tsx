'use client';

import { type ComponentType, type SVGProps, useId } from 'react';
import { Skull } from 'lucide-react';
import type { DndIconName } from '@/components/ui/dnd-icon';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;
export type MapPinIcon = LucideIcon | { dnd: DndIconName };

export type MapPinTone = 'amber' | 'crimson' | 'azure' | 'verdant';
export type MapPinState = 'idle' | 'active' | 'visited';

export interface MapPinProps {
  icon?: MapPinIcon;
  count?: number;
  size?: number;
  tone?: MapPinTone;
  state?: MapPinState;
  label?: string;
  className?: string;
  onClick?: () => void;
}

function isDndIcon(icon: MapPinIcon): icon is { dnd: DndIconName } {
  return typeof icon === 'object' && icon !== null && 'dnd' in icon;
}

const TONE: Record<MapPinTone, { rim: string; rimDeep: string; glow: string }> = {
  amber:   { rim: 'oklch(0.78 0.16 70)',  rimDeep: 'oklch(0.42 0.12 55)',  glow: 'oklch(0.7 0.16 55 / 0.55)' },
  crimson: { rim: 'oklch(0.72 0.18 25)',  rimDeep: 'oklch(0.36 0.14 25)',  glow: 'oklch(0.6 0.18 25 / 0.55)' },
  azure:   { rim: 'oklch(0.74 0.13 240)', rimDeep: 'oklch(0.38 0.10 240)', glow: 'oklch(0.6 0.16 240 / 0.55)' },
  verdant: { rim: 'oklch(0.74 0.13 145)', rimDeep: 'oklch(0.38 0.10 145)', glow: 'oklch(0.6 0.14 145 / 0.55)' },
};

export function MapPin({
  icon = Skull,
  count,
  size = 56,
  tone = 'amber',
  state = 'idle',
  label,
  className,
  onClick,
}: MapPinProps) {
  const uid = useId().replace(/:/g, '');
  const palette = TONE[tone];
  const Icon = icon;

  const w = 64;
  const h = 84;

  const dim = state === 'visited' ? 0.55 : 1;
  const activeRing = state === 'active';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={className}
      style={{
        width: size,
        height: (size * h) / w,
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-block',
        opacity: dim,
        filter: activeRing
          ? `drop-shadow(0 0 ${size * 0.22}px ${palette.glow})`
          : `drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgb(0 0 0 / 0.55))`,
        transition: 'transform 180ms ease, filter 220ms ease, opacity 220ms ease',
      }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
      >
        <defs>
          {/* Outer body — rounded teardrop, aged warm metal */}
          <radialGradient id={`body-${uid}`} cx="42%" cy="36%" r="80%">
            <stop offset="0%"   stopColor="oklch(0.26 0.022 65)" />
            <stop offset="55%"  stopColor="oklch(0.15 0.014 60)" />
            <stop offset="100%" stopColor="oklch(0.06 0.005 60)" />
          </radialGradient>

          {/* Inner amber bevel ring */}
          <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={palette.rim} />
            <stop offset="55%"  stopColor="oklch(0.55 0.14 55)" />
            <stop offset="100%" stopColor={palette.rimDeep} />
          </linearGradient>

          {/* Recessed well — warm parchment-toned dark, lit from center */}
          <radialGradient id={`well-${uid}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="oklch(0.24 0.04 65)" />
            <stop offset="60%"  stopColor="oklch(0.12 0.018 60)" />
            <stop offset="100%" stopColor="oklch(0.06 0.008 60)" />
          </radialGradient>

          {/* Inner candle glow — soft amber light behind the icon */}
          <radialGradient id={`well-glow-${uid}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="oklch(0.78 0.16 65 / 0.35)" />
            <stop offset="60%"  stopColor="oklch(0.7 0.14 55 / 0.08)" />
            <stop offset="100%" stopColor="oklch(0.7 0.14 55 / 0)" />
          </radialGradient>

          {/* Amber ground glow at tail tip */}
          <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={palette.glow} />
            <stop offset="100%" stopColor="oklch(0.7 0.16 55 / 0)" />
          </radialGradient>

          {/* Badge */}
          <radialGradient id={`badge-${uid}`} cx="35%" cy="30%" r="80%">
            <stop offset="0%"   stopColor="oklch(0.86 0.14 75)" />
            <stop offset="55%"  stopColor={palette.rim} />
            <stop offset="100%" stopColor={palette.rimDeep} />
          </radialGradient>

          {/* Teardrop / pin path. Round head + tapering tail to a soft point. */}
          <path
            id={`shape-${uid}`}
            d="M32 4
               C 47.5 4 60 16.5 60 32
               C 60 44.5 51.5 53.5 42 60
               C 38 62.5 35.4 65.4 33.6 70
               L 32 74
               L 30.4 70
               C 28.6 65.4 26 62.5 22 60
               C 12.5 53.5 4 44.5 4 32
               C 4 16.5 16.5 4 32 4 Z"
          />
        </defs>

        {/* Tail-tip ground glow */}
        <ellipse cx="32" cy="74" rx="11" ry="3.5" fill={`url(#glow-${uid})`} opacity="0.85" />

        {/* Body */}
        <use href={`#shape-${uid}`} fill={`url(#body-${uid})`} />

        {/* Outer thin dark stroke for crisp edge */}
        <use href={`#shape-${uid}`} fill="none" stroke="oklch(0.04 0.005 265)" strokeWidth="1" />

        {/* Inner amber bevel ring (head only) */}
        <circle cx="32" cy="32" r="20" fill="none" stroke={`url(#rim-${uid})`} strokeWidth="2.4" />
        <circle cx="32" cy="32" r="20" fill="none" stroke="oklch(0.04 0.005 60 / 0.6)" strokeWidth="0.6" />

        {/* Recessed well — warm parchment dark base */}
        <circle cx="32" cy="32" r="18" fill={`url(#well-${uid})`} />

        {/* Inner candle glow — pulses warmth behind icon */}
        <circle cx="32" cy="32" r="17" fill={`url(#well-glow-${uid})`} />

        {/* Subtle inner shadow on the well (top edge darker for inset feel) */}
        <circle cx="32" cy="29" r="18" fill="none" stroke="oklch(0 0 0 / 0.55)" strokeWidth="2" opacity="0.4" />

        {/* Active state ring */}
        {activeRing ? (
          <circle
            cx="32"
            cy="32"
            r="22.5"
            fill="none"
            stroke={palette.rim}
            strokeWidth="0.8"
            opacity="0.85"
          />
        ) : null}

        {/* Icon — foreignObject to support both Lucide and masked DndIcon */}
        <foreignObject x="18" y="18" width="28" height="28">
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.rim,
              filter: 'drop-shadow(0 1px 0 rgb(0 0 0 / 0.6))',
            }}
          >
            {isDndIcon(Icon) ? (
              <MaskedDndIcon name={Icon.dnd} size={20} />
            ) : (
              <Icon width={20} height={20} strokeWidth={2.2} />
            )}
          </div>
        </foreignObject>

        {/* Count badge */}
        {typeof count === 'number' ? (
          <g>
            <circle cx="50" cy="14" r="8.5" fill="oklch(0.06 0.005 265)" />
            <circle cx="50" cy="14" r="8" fill={`url(#badge-${uid})`} />
            <circle cx="50" cy="14" r="8" fill="none" stroke="oklch(0.04 0.005 265 / 0.7)" strokeWidth="0.6" />
            <text
              x="50"
              y="14"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="9"
              fontWeight="700"
              fill="oklch(0.12 0.005 265)"
            >
              {count > 99 ? '99+' : count}
            </text>
          </g>
        ) : null}
      </svg>
    </button>
  );
}
