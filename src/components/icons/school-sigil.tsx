'use client';

import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

export type SpellSchool =
  | 'abjuration' | 'conjuration' | 'divination' | 'enchantment'
  | 'evocation' | 'illusion' | 'necromancy' | 'transmutation';

const SCHOOL_COLOR: Record<SpellSchool, string> = {
  abjuration:    'oklch(0.78 0.13 240)',
  conjuration:   'oklch(0.82 0.16 70)',
  divination:    'oklch(0.84 0.1 200)',
  enchantment:   'oklch(0.78 0.18 340)',
  evocation:     'oklch(0.82 0.18 30)',
  illusion:      'oklch(0.78 0.16 290)',
  necromancy:    'oklch(0.7 0.16 320)',
  transmutation: 'oklch(0.78 0.14 145)',
};

interface SchoolSigilProps {
  school: SpellSchool;
  size?: number;
  label?: string;
  className?: string;
  /** Drop shadow strength for legibility on busy backgrounds. 0 disables. */
  shadow?: number;
  /** Override the school's default color (rare). */
  color?: string;
}

export function SchoolSigil({
  school,
  size = 24,
  label,
  className,
  shadow = 1,
  color,
}: SchoolSigilProps) {
  const tint = color ?? SCHOOL_COLOR[school];
  const haloAlpha = 0.25 * Math.max(shadow, 0);

  return (
    <span
      className={className}
      title={label ?? school}
      aria-label={label ?? school}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tint,
        width: size,
        height: size,
        filter:
          shadow > 0
            ? `drop-shadow(0 1px 1px rgb(0 0 0 / ${0.55 * shadow})) drop-shadow(0 0 ${size * 0.18}px ${tint.replace(')', ` / ${haloAlpha})`)})`
            : undefined,
      }}
    >
      <MaskedDndIcon name={`spell/${school}`} size={size} />
    </span>
  );
}

export const SCHOOL_COLORS = SCHOOL_COLOR;
