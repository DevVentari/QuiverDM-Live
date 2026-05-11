'use client';

import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

export type ConditionType =
  | 'blinded' | 'charmed' | 'deafened' | 'exhaustion' | 'frightened'
  | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified'
  | 'poisoned' | 'prone' | 'restrained' | 'silenced' | 'sleep'
  | 'stunned' | 'unconscious';

const CONDITION_TONE: Record<string, { ring: string; ink: string; bg: string }> = {
  // disabling
  paralyzed:     { ring: 'oklch(0.78 0.16 30)',  ink: 'oklch(0.86 0.14 35)',  bg: 'oklch(0.18 0.04 30 / 0.55)' },
  stunned:       { ring: 'oklch(0.86 0.16 95)',  ink: 'oklch(0.9 0.16 95)',   bg: 'oklch(0.18 0.06 95 / 0.5)' },
  unconscious:   { ring: 'oklch(0.55 0.04 265)', ink: 'oklch(0.7 0.05 265)',  bg: 'oklch(0.16 0.01 265 / 0.7)' },
  incapacitated: { ring: 'oklch(0.6 0.04 265)',  ink: 'oklch(0.78 0.05 265)', bg: 'oklch(0.18 0.01 265 / 0.6)' },
  // controlled
  charmed:       { ring: 'oklch(0.74 0.18 340)', ink: 'oklch(0.85 0.16 340)', bg: 'oklch(0.18 0.06 340 / 0.5)' },
  frightened:    { ring: 'oklch(0.7 0.16 290)',  ink: 'oklch(0.82 0.14 290)', bg: 'oklch(0.18 0.06 290 / 0.5)' },
  // sensory
  blinded:       { ring: 'oklch(0.55 0.05 265)', ink: 'oklch(0.7 0.04 265)',  bg: 'oklch(0.13 0.01 265 / 0.65)' },
  deafened:      { ring: 'oklch(0.55 0.05 265)', ink: 'oklch(0.7 0.04 265)',  bg: 'oklch(0.13 0.01 265 / 0.65)' },
  invisible:     { ring: 'oklch(0.78 0.06 220)', ink: 'oklch(0.85 0.06 220)', bg: 'oklch(0.18 0.02 220 / 0.4)' },
  silenced:      { ring: 'oklch(0.65 0.06 220)', ink: 'oklch(0.78 0.05 220)', bg: 'oklch(0.16 0.01 220 / 0.55)' },
  // physical
  grappled:      { ring: 'oklch(0.65 0.08 60)',  ink: 'oklch(0.78 0.08 60)',  bg: 'oklch(0.18 0.02 60 / 0.55)' },
  prone:         { ring: 'oklch(0.65 0.08 60)',  ink: 'oklch(0.78 0.08 60)',  bg: 'oklch(0.18 0.02 60 / 0.55)' },
  restrained:    { ring: 'oklch(0.65 0.08 60)',  ink: 'oklch(0.78 0.08 60)',  bg: 'oklch(0.18 0.02 60 / 0.55)' },
  petrified:     { ring: 'oklch(0.6 0.04 60)',   ink: 'oklch(0.74 0.04 60)',  bg: 'oklch(0.18 0.01 60 / 0.65)' },
  // damaging
  poisoned:      { ring: 'oklch(0.74 0.18 140)', ink: 'oklch(0.84 0.16 140)', bg: 'oklch(0.18 0.06 140 / 0.5)' },
  exhaustion:    { ring: 'oklch(0.55 0.1 30)',   ink: 'oklch(0.7 0.1 30)',    bg: 'oklch(0.18 0.04 30 / 0.55)' },
  sleep:         { ring: 'oklch(0.65 0.1 280)',  ink: 'oklch(0.78 0.1 280)',  bg: 'oklch(0.18 0.04 280 / 0.5)' },
};

interface ConditionChipProps {
  type: ConditionType;
  rounds?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  onRemove?: () => void;
}

const LABEL: Record<ConditionType, string> = {
  blinded: 'Blinded', charmed: 'Charmed', deafened: 'Deafened',
  exhaustion: 'Exhaustion', frightened: 'Frightened', grappled: 'Grappled',
  incapacitated: 'Incapacitated', invisible: 'Invisible', paralyzed: 'Paralyzed',
  petrified: 'Petrified', poisoned: 'Poisoned', prone: 'Prone',
  restrained: 'Restrained', silenced: 'Silenced', sleep: 'Asleep',
  stunned: 'Stunned', unconscious: 'Unconscious',
};

export function ConditionChip({
  type,
  rounds,
  showLabel = true,
  size = 'md',
  className,
  onRemove,
}: ConditionChipProps) {
  const palette = CONDITION_TONE[type] ?? CONDITION_TONE.incapacitated;
  const small = size === 'sm';
  const padX = small ? 7 : 10;
  const padY = small ? 3 : 5;
  const iconSize = small ? 12 : 14;

  return (
    <span
      className={className}
      title={LABEL[type]}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: small ? 4 : 6,
        padding: `${padY}px ${padX}px`,
        background: `linear-gradient(180deg, oklch(0.18 0.005 265 / 0.55), oklch(0.1 0.005 265 / 0.7))`,
        border: `1px solid ${palette.ring}`,
        borderRadius: 999,
        boxShadow: `inset 0 1px 0 oklch(1 0 0 / 0.05), 0 0 0 1px oklch(0 0 0 / 0.45), 0 0 12px ${palette.bg}`,
        color: palette.ink,
        fontFamily: 'var(--q-font-body, system-ui)',
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <MaskedDndIcon name={`condition/${type}`} size={iconSize} />
      {showLabel ? <span>{LABEL[type]}</span> : null}
      {typeof rounds === 'number' ? (
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: small ? 10 : 11,
            opacity: 0.85,
            paddingLeft: 4,
            borderLeft: `1px solid ${palette.ring}`,
            marginLeft: 2,
          }}
        >
          {rounds}r
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${LABEL[type]}`}
          style={{
            background: 'transparent',
            border: 0,
            color: palette.ink,
            opacity: 0.6,
            cursor: 'pointer',
            padding: 0,
            marginLeft: 2,
            fontSize: small ? 12 : 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
