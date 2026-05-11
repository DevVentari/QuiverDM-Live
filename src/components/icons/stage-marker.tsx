'use client';

import { useId } from 'react';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

export type LifecycleStage = 'prep' | 'run' | 'process' | 'schedule' | 'recap';

const STAGE_ICON: Record<LifecycleStage, string> = {
  prep:     'game/adventure-book',
  run:      'game/combat',
  process:  'game/concentration',
  schedule: 'game/inspiration',
  recap:    'game/source-book',
};

const STAGE_LABEL: Record<LifecycleStage, string> = {
  prep: 'Prep', run: 'Run', process: 'Process', schedule: 'Schedule', recap: 'Recap',
};

export type StageState = 'idle' | 'active' | 'complete';

interface StageMarkerProps {
  stage: LifecycleStage;
  state?: StageState;
  size?: number;
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StageMarker({
  stage,
  state = 'idle',
  size = 56,
  showLabel = true,
  className,
  onClick,
}: StageMarkerProps) {
  const uid = useId().replace(/:/g, '');
  const isActive = state === 'active';
  const isComplete = state === 'complete';

  const rim = isActive
    ? 'oklch(0.78 0.16 70)'
    : isComplete
    ? 'oklch(0.6 0.1 60)'
    : 'oklch(0.4 0.04 60)';
  const rimDeep = isActive
    ? 'oklch(0.4 0.14 55)'
    : isComplete
    ? 'oklch(0.3 0.08 60)'
    : 'oklch(0.2 0.02 60)';
  const glow = isActive ? 'oklch(0.7 0.16 55 / 0.55)' : 'oklch(0.7 0.16 55 / 0)';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={STAGE_LABEL[stage]}
      title={STAGE_LABEL[stage]}
      className={className}
      style={{
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          filter: isActive
            ? `drop-shadow(0 0 ${size * 0.22}px ${glow}) drop-shadow(0 ${size * 0.06}px ${size * 0.1}px rgb(0 0 0 / 0.55))`
            : `drop-shadow(0 ${size * 0.04}px ${size * 0.08}px rgb(0 0 0 / 0.5))`,
          opacity: state === 'idle' ? 0.55 : 1,
          transition: 'all 220ms ease',
        }}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <radialGradient id={`sm-body-${uid}`} cx="42%" cy="34%" r="82%">
              <stop offset="0%"   stopColor="oklch(0.24 0.018 60)" />
              <stop offset="60%"  stopColor="oklch(0.14 0.012 265)" />
              <stop offset="100%" stopColor="oklch(0.06 0.005 265)" />
            </radialGradient>
            <linearGradient id={`sm-rim-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={rim} />
              <stop offset="100%" stopColor={rimDeep} />
            </linearGradient>
            <radialGradient id={`sm-glow-${uid}`} cx="50%" cy="50%" r="55%">
              <stop offset="0%"   stopColor={glow} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <circle cx="50" cy="50" r="46" fill={`url(#sm-glow-${uid})`} opacity="0.85" />
          <circle cx="50" cy="50" r="42" fill={`url(#sm-body-${uid})`} stroke="oklch(0.04 0.005 265)" strokeWidth="0.8" />

          {/* Outer gilded ring */}
          <circle cx="50" cy="50" r="38" fill="none" stroke={`url(#sm-rim-${uid})`} strokeWidth="2" />
          {/* Inner thin guard ring */}
          <circle cx="50" cy="50" r="34" fill="none" stroke={`url(#sm-rim-${uid})`} strokeWidth="0.8" opacity="0.6" />
          {/* Inset shadow on top */}
          <circle cx="50" cy="47" r="38" fill="none" stroke="oklch(0 0 0 / 0.4)" strokeWidth="1.6" opacity="0.4" />

          {/* Decorative 4-cardinal marks */}
          {[0, 90, 180, 270].map((deg) => (
            <circle
              key={deg}
              cx={50 + 38 * Math.cos((deg * Math.PI) / 180)}
              cy={50 + 38 * Math.sin((deg * Math.PI) / 180)}
              r="1.4"
              fill={rim}
            />
          ))}

          <foreignObject x="28" y="28" width="44" height="44">
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: rim,
                filter: 'drop-shadow(0 1px 0 rgb(0 0 0 / 0.7))',
              }}
            >
              <MaskedDndIcon name={STAGE_ICON[stage]} size={Math.round(size * 0.5)} />
            </div>
          </foreignObject>

          {isComplete ? (
            <g>
              <circle cx="78" cy="22" r="9" fill="oklch(0.06 0.005 265)" />
              <circle cx="78" cy="22" r="8.5" fill={`url(#sm-rim-${uid})`} />
              <path
                d="M74 22 L77 25 L82 19"
                fill="none"
                stroke="oklch(0.1 0.005 265)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}
        </svg>
      </div>

      {showLabel ? (
        <span
          style={{
            fontFamily: 'var(--q-font-display, "Cinzel", serif)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: isActive ? rim : 'oklch(0.65 0.01 60)',
            fontWeight: isActive ? 700 : 500,
          }}
        >
          {STAGE_LABEL[stage]}
        </span>
      ) : null}
    </button>
  );
}
