'use client';

import type { CSSProperties } from 'react';
import { parseBoldDescription, getSchoolVars, type SpellSchool } from '@/lib/homebrew-card-utils';
import { cn } from '@/lib/utils';

export interface SpellCardData {
  name: string;
  level: number | 'cantrip';
  school: SpellSchool;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDesc?: string;
  };
  description: string;
  higherLevels?: string;
  save?: string;
  classes?: string[];
}

export interface SpellCardProps {
  spell: SpellCardData;
  variant: 'collapsed' | 'expanded';
  onToggle?: () => void;
}

const SCHOOL_ABBR: Record<SpellSchool, string> = {
  evocation: 'Evoc', illusion: 'Illus', necromancy: 'Necro', abjuration: 'Abj',
  conjuration: 'Conj', divination: 'Div', enchantment: 'Ench', transmutation: 'Trans',
};

function levelLabel(level: number | 'cantrip', short = false): string {
  if (level === 'cantrip' || level < 1) return 'Cantrip';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = level <= 3 ? suffixes[level] : 'th';
  return short ? `${level}${suffix}` : `${level}${suffix} Level`;
}

function LevelBadge({ label }: { label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-[7px] py-[2px] rounded-full border tracking-[.06em]"
      style={{
        background: 'var(--school-bg)',
        color: 'var(--school-color)',
        borderColor: 'var(--school-color)',
      }}
    >
      {label}
    </span>
  );
}

function BoldText({ text, className }: { text: string; className?: string }) {
  const segments = parseBoldDescription(text);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === 'bold'
          ? <strong key={i} className="font-semibold" style={{ color: 'var(--card-amber-light)' }}>{seg.content}</strong>
          : <span key={i}>{seg.content}</span>
      )}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="2" x2="5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="5" y1="5.5" x2="7" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function RangeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="1" x2="5" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function SpellCard({ spell, variant, onToggle }: SpellCardProps) {
  const schoolVars = getSchoolVars(spell.school);
  const cardStyle = { ...schoolVars } as CSSProperties;

  const levelBadge = spell.level === 'cantrip'
    ? 'Cantrip'
    : variant === 'collapsed'
      ? `${levelLabel(spell.level, true)} \u00B7 ${SCHOOL_ABBR[spell.school]}`
      : levelLabel(spell.level, true);

  const baseClasses = cn(
    'relative overflow-hidden rounded-[3px] border',
    'bg-[image:var(--card-stone-bg)]',
    '[box-shadow:var(--card-stone-inset),0_4px_20px_hsl(240_10%_4%/0.5)]',
  );

  const accentBar = (
    <span
      className="absolute left-0 top-0 bottom-0 w-[3px] opacity-85"
      style={{ background: 'var(--school-color)' }}
      aria-hidden
    />
  );

  if (variant === 'collapsed') {
    const durationShort = spell.duration.replace('Instantaneous', 'Instant')
      .replace('Concentration, up to ', '');
    return (
      <div
        className={cn(baseClasses, 'px-4 py-[10px] cursor-pointer')}
        style={cardStyle}
        onClick={onToggle}
        role="button"
      >
        {accentBar}
        <div className="flex items-center justify-between mb-1">
          <span
            className="font-serif text-[14px] font-bold tracking-[.03em]"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-cinzel, serif)' }}
          >
            {spell.name}
          </span>
          <LevelBadge label={levelBadge} />
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--card-text-muted)' }}>
            <ClockIcon />{spell.castingTime}
          </span>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--card-text-muted)' }}>
            <RangeIcon />{spell.range}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--card-text-muted)' }}>
            {durationShort}
          </span>
        </div>
        <p
          className="text-[11px] truncate leading-[1.4]"
          style={{ color: 'var(--card-text-muted)' }}
        >
          {spell.save ?? spell.description}
        </p>
      </div>
    );
  }

  const statItems = [
    { label: 'Casting Time', value: spell.castingTime },
    { label: 'Range', value: spell.range },
    { label: 'Duration', value: spell.duration.replace('Concentration, up to ', 'Conc. ') },
    spell.save
      ? { label: 'Save', value: spell.save }
      : { label: 'Concentration', value: spell.concentration ? 'Yes' : 'No' },
  ];

  return (
    <div
      className={cn(baseClasses, 'px-[18px] py-3')}
      style={cardStyle}
    >
      {accentBar}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div
            className="font-serif text-[16px] font-bold tracking-[.03em] leading-[1.2]"
            style={{ fontFamily: 'var(--font-cinzel, serif)' }}
          >
            {spell.name}
          </div>
          <div
            className="text-[10px] font-semibold tracking-[.1em] uppercase mt-[2px]"
            style={{ color: 'var(--school-color)' }}
          >
            {spell.school.charAt(0).toUpperCase() + spell.school.slice(1)} &middot;{' '}
            {typeof spell.level === 'number' ? levelLabel(spell.level) : 'Cantrip'}
          </div>
        </div>
        <LevelBadge label={levelBadge} />
      </div>

      <div
        className="grid grid-cols-2 gap-x-[10px] gap-y-[6px] mb-[10px] px-[10px] py-2 rounded-[3px] border"
        style={{ background: 'hsl(240 10% 7%)', borderColor: 'var(--card-stone-border)' }}
      >
        {statItems.map(({ label, value }) => (
          <div key={label}>
            <div
              className="text-[9px] uppercase tracking-[.1em] font-semibold"
              style={{ color: 'var(--card-text-muted)' }}
            >
              {label}
            </div>
            <div
              className="text-[12px] font-medium mt-[1px]"
              style={{ color: 'var(--card-amber-light)' }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-[5px] mb-2">
        {(['V', 'S', 'M'] as const).map((c) => {
          const active =
            c === 'V' ? spell.components.verbal
            : c === 'S' ? spell.components.somatic
            : spell.components.material;
          return (
            <span
              key={c}
              className="text-[10px] font-bold w-[22px] h-[22px] flex items-center justify-center rounded-[2px] border"
              style={active ? {
                borderColor: 'var(--card-amber)',
                color: 'var(--card-amber-light)',
                background: 'hsl(35 60% 10%)',
              } : {
                borderColor: 'var(--card-stone-border)',
                color: 'var(--card-text-muted)',
                background: 'hsl(240 10% 13%)',
              }}
            >
              {c}
            </span>
          );
        })}
        {spell.components.material && spell.components.materialDesc && (
          <span
            className="text-[10px] italic self-center"
            style={{ color: 'var(--card-text-muted)' }}
          >
            {spell.components.materialDesc}
          </span>
        )}
      </div>

      <div className="text-[12px] leading-[1.6] mb-2">
        <BoldText text={spell.description} />
      </div>

      {spell.higherLevels && (
        <div
          className="rounded-[3px] px-[10px] py-[7px] border"
          style={{
            background: 'hsl(260 30% 10%)',
            borderColor: 'hsl(260 30% 22%)',
          }}
        >
          <div
            className="text-[9px] uppercase tracking-[.1em] font-semibold mb-[2px]"
            style={{ color: 'hsl(260,50%,55%)' }}
          >
            At Higher Levels
          </div>
          <div className="text-[11px] leading-[1.5]" style={{ color: 'hsl(35,10%,68%)' }}>
            {spell.higherLevels}
          </div>
        </div>
      )}

      {spell.classes && spell.classes.length > 0 && (
        <div className="flex items-center gap-[5px] mt-2 flex-wrap">
          <span className="text-[9px] uppercase tracking-[.1em] font-semibold" style={{ color: 'var(--card-text-muted)' }}>
            Classes
          </span>
          {spell.classes.map((cls) => (
            <span
              key={cls}
              className="text-[9px] px-[6px] py-[1px] rounded-[2px] border"
              style={{ background: 'hsl(240 10% 13%)', borderColor: 'var(--card-stone-border)', color: 'var(--card-text-muted)' }}
            >
              {cls}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

