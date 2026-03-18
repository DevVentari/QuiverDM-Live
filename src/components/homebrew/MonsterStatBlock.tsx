'use client';

import type { CSSProperties, ReactNode } from 'react';
import { formatAbilityMod } from '@/lib/homebrew-card-utils';
import { cn } from '@/lib/utils';

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface MonsterAction {
  name: string;
  type?: string;
  toHit?: number;
  reach?: string;
  range?: string;
  targets?: string;
  damage?: string;
  description: string;
}

export interface MonsterTrait {
  name: string;
  description: string;
}

export interface MonsterStatBlockData {
  name: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string;
  alignment: string;
  cr: number | string;
  xp: number;
  ac: number;
  acNote?: string;
  hp: number;
  hpDice: string;
  speed: string;
  abilities: Record<AbilityKey, number>;
  savingThrows?: Partial<Record<AbilityKey, number>>;
  skills?: Record<string, number>;
  damageImmunities?: string[];
  damageResistances?: string[];
  conditionImmunities?: string[];
  senses: string;
  passivePerception: number;
  languages: string;
  traits?: MonsterTrait[];
  actions: MonsterAction[];
  bonusActions?: MonsterAction[];
  reactions?: MonsterAction[];
  legendaryActions?: { count: number; actions: MonsterAction[] };
}

interface MonsterStatBlockProps {
  monster: MonsterStatBlockData;
  mode: 'drawer' | 'full';
  onClose?: () => void;
}

const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function AbilityGrid({ abilities }: { abilities: Record<AbilityKey, number> }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {ABILITY_KEYS.map((key) => (
        <div
          key={key}
          className="rounded-[3px] border px-[2px] py-1 text-center"
          style={{ background: 'hsl(240 10% 7%)', borderColor: 'var(--card-stone-border)' }}
        >
          <div
            className="text-[8px] font-bold tracking-[.06em] uppercase"
            style={{ color: 'var(--card-amber)' }}
          >
            {key.toUpperCase()}
          </div>
          <div className="text-[13px] font-semibold leading-[1.2]">{abilities[key]}</div>
          <div className="text-[9px]" style={{ color: 'var(--card-text-muted)' }}>
            {formatAbilityMod(abilities[key])}
          </div>
        </div>
      ))}
    </div>
  );
}

function VitalBox({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-[3px] border px-[6px] py-[5px] text-center"
      style={{ background: 'hsl(240 10% 7%)', borderColor: 'var(--card-stone-border)' }}
    >
      <div
        className="text-[8px] uppercase tracking-[.1em] font-semibold"
        style={{ color: 'var(--card-text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-[14px] font-bold leading-[1.2] mt-[1px]"
        style={{ color: valueColor ?? 'var(--card-amber-light)' }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[9px]" style={{ color: 'var(--card-text-muted)' }}>{sub}</div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[9px] font-semibold tracking-[.14em] uppercase mb-[5px] pb-1 border-b"
      style={{ color: 'var(--card-amber)', borderColor: 'var(--card-stone-border)' }}
    >
      {children}
    </div>
  );
}

function ActionItem({ action, compact = false }: { action: MonsterAction; compact?: boolean }) {
  return (
    <div
      className="py-[5px] border-b last:border-0"
      style={{ borderColor: 'hsl(35 35% 14%)' }}
    >
      <span
        className="font-semibold text-[11px]"
        style={{ color: 'var(--card-amber-light)' }}
      >
        {action.name}
      </span>
      {action.type && (
        <span
          className="text-[9px] uppercase tracking-[.08em] ml-[5px]"
          style={{ color: 'var(--card-text-muted)' }}
        >
          {action.type}
        </span>
      )}
      {compact ? (
        <div className="text-[11px] mt-[2px]" style={{ color: 'hsl(35 15% 72%)' }}>
          {action.toHit !== undefined && (
            <>
              <span className="font-semibold" style={{ color: 'var(--card-amber-light)' }}>
                +{action.toHit} to hit
              </span>
              {' · '}
            </>
          )}
          {action.reach && `${action.reach} · `}
          {action.range && `${action.range} · `}
          {action.damage && (
            <span className="font-semibold" style={{ color: 'var(--card-amber-light)' }}>
              {action.damage}
            </span>
          )}
        </div>
      ) : (
        <div className="text-[11px] mt-[2px] leading-[1.5]" style={{ color: 'hsl(35 15% 72%)' }}>
          {action.toHit !== undefined && (
            <span className="font-semibold" style={{ color: 'var(--card-amber-light)' }}>
              +{action.toHit} to hit
            </span>
          )}
          {action.description && ` ${action.description}`}
        </div>
      )}
    </div>
  );
}

function formatCR(cr: number | string): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

export function MonsterStatBlock({ monster, mode, onClose }: MonsterStatBlockProps) {
  const baseVars = {
    '--card-amber': 'var(--card-amber)',
    '--card-amber-light': 'var(--card-amber-light)',
  } as CSSProperties;

  const cardBase = cn(
    'bg-[image:var(--card-stone-bg)] border overflow-hidden',
    '[box-shadow:var(--card-stone-inset)]',
  );

  const crBadge = (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] border px-[7px] py-[2px] text-[10px] font-semibold tracking-[.05em]"
      style={{
        background: 'hsl(35 60% 10%)',
        borderColor: 'var(--card-amber)',
        color: 'var(--card-amber-light)',
      }}
    >
      CR {formatCR(monster.cr)} · {monster.xp.toLocaleString()} XP
    </span>
  );

  if (mode === 'drawer') {
    return (
      <div
        data-testid="monster-stat-drawer"
        className={cn(cardBase, 'rounded-t-[6px] rounded-b-[3px]')}
        style={{
          ...baseVars,
          borderColor: 'var(--card-stone-border)',
          boxShadow: 'var(--card-stone-inset), 0 -4px 20px hsl(240 10% 4% / 0.6)',
        } as CSSProperties}
      >
        <div className="flex justify-center pt-2 pb-0">
          <div
            className="w-8 h-[3px] rounded-full"
            style={{ background: 'var(--card-stone-border-hi)' }}
          />
        </div>

        <div
          className="flex justify-between items-start px-3 pt-[10px] pb-2 border-b"
          style={{ borderColor: 'var(--card-stone-border)' }}
        >
          <div>
            <div
              className="font-serif text-[15px] font-bold"
              style={{ fontFamily: 'var(--font-cinzel, serif)' }}
            >
              {monster.name}
            </div>
            <div className="text-[10px] mt-[1px]" style={{ color: 'var(--card-text-muted)' }}>
              {monster.size} {monster.type} · {monster.alignment}
            </div>
          </div>
          {crBadge}
        </div>

        <div
          className="grid grid-cols-3 gap-[6px] px-3 py-2 border-b"
          style={{ borderColor: 'var(--card-stone-border)' }}
        >
          <VitalBox label="HP" value={String(monster.hp)} sub={monster.hpDice} valueColor="hsl(0,60%,62%)" />
          <VitalBox label="AC" value={String(monster.ac)} sub={monster.acNote} />
          <VitalBox label="Speed" value={monster.speed.replace(' ft', '')} sub="ft" />
        </div>

        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <AbilityGrid abilities={monster.abilities} />
        </div>

        <div className="px-3 py-2">
          <SectionLabel>Actions</SectionLabel>
          {monster.actions.map((action, i) => (
            <ActionItem key={i} action={action} compact />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(cardBase, 'rounded-[3px]')}
      style={{ ...baseVars, borderColor: 'var(--card-stone-border)' } as CSSProperties}
    >
      <div
        className="px-[14px] pt-3 pb-[10px] border-b"
        style={{ background: 'hsl(240 10% 10%)', borderColor: 'var(--card-stone-border)' }}
      >
        <div
          className="font-serif text-[18px] font-bold tracking-[.02em]"
          style={{ fontFamily: 'var(--font-cinzel, serif)' }}
        >
          {monster.name}
        </div>
        <div className="text-[11px] mt-[2px]" style={{ color: 'var(--card-text-muted)' }}>
          {monster.size} {monster.type}, {monster.alignment}
        </div>
        <div className="flex flex-wrap gap-[5px] mt-[7px]">
          <span
            className="text-[9px] font-semibold tracking-[.08em] uppercase px-[7px] py-[2px] rounded-full border"
            style={{
              background: 'hsl(35 60% 10%)',
              borderColor: 'var(--card-amber)',
              color: 'var(--card-amber-light)',
            }}
          >
            CR {formatCR(monster.cr)} · {monster.xp.toLocaleString()} XP
          </span>
          <span
            className="text-[9px] font-semibold tracking-[.08em] uppercase px-[7px] py-[2px] rounded-full border"
            style={{
              background: 'hsl(240 10% 14%)',
              borderColor: 'var(--card-stone-border-hi)',
              color: 'var(--card-text-muted)',
            }}
          >
            {monster.type}
          </span>
          <span
            className="text-[9px] font-semibold tracking-[.08em] uppercase px-[7px] py-[2px] rounded-full border"
            style={{
              background: 'hsl(240 10% 14%)',
              borderColor: 'var(--card-stone-border)',
              color: 'var(--card-text-muted)',
            }}
          >
            {monster.alignment}
          </span>
        </div>
      </div>

      <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
        <div className="grid grid-cols-3 gap-[6px]">
          <VitalBox label="HP" value={String(monster.hp)} sub={monster.hpDice} valueColor="hsl(0,60%,62%)" />
          <VitalBox label="AC" value={String(monster.ac)} sub={monster.acNote} />
          <VitalBox label="Speed" value={monster.speed} />
        </div>
        {[
          { label: 'Passive Perception', value: String(monster.passivePerception) },
          { label: 'Senses', value: monster.senses },
          { label: 'Languages', value: monster.languages },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center text-[11px] mt-[6px]"
            style={{ color: 'var(--card-text-muted)' }}
          >
            {label}
            <span className="ml-auto font-semibold" style={{ color: 'var(--card-amber-light)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
        <SectionLabel>Ability Scores</SectionLabel>
        <AbilityGrid abilities={monster.abilities} />
      </div>

      <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
        <SectionLabel>Actions</SectionLabel>
        {monster.actions.map((action, i) => (
          <ActionItem key={i} action={action} />
        ))}
      </div>

      {monster.traits && monster.traits.length > 0 && (
        <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <SectionLabel>Traits</SectionLabel>
          {monster.traits.map((trait, i) => (
            <div key={i} className="py-1 text-[11px] leading-[1.5]">
              <span className="font-semibold italic">{trait.name}. </span>
              <span style={{ color: 'hsl(35 15% 68%)' }}>{trait.description}</span>
            </div>
          ))}
        </div>
      )}

      {monster.bonusActions && monster.bonusActions.length > 0 && (
        <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <SectionLabel>Bonus Actions</SectionLabel>
          {monster.bonusActions.map((action, i) => (
            <ActionItem key={i} action={action} />
          ))}
        </div>
      )}

      {monster.reactions && monster.reactions.length > 0 && (
        <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <SectionLabel>Reactions</SectionLabel>
          {monster.reactions.map((action, i) => (
            <ActionItem key={i} action={action} />
          ))}
        </div>
      )}

      {monster.legendaryActions && (
        <div className="px-[14px] py-2">
          <SectionLabel>Legendary Actions · {monster.legendaryActions.count}/round</SectionLabel>
          {monster.legendaryActions.actions.map((action, i) => (
            <ActionItem key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
