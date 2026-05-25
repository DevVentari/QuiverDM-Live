'use client';

import { useState } from 'react';
import type React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tone = 'amber' | 'arcane' | 'quest' | 'danger' | 'success' | 'neutral';

const TONE_VARS: Record<Tone, { color: string; bg: string; border: string }> = {
  amber:   { color: 'var(--q-accent-primary)',  bg: 'var(--q-accent-primary-trace)',  border: 'var(--q-accent-primary-border)' },
  arcane:  { color: 'var(--q-accent-arcane)',   bg: 'var(--q-accent-arcane-trace)',   border: 'var(--q-accent-arcane-border)' },
  quest:   { color: 'var(--q-accent-quest)',    bg: 'var(--q-accent-quest-trace)',    border: 'var(--q-accent-quest-border)' },
  danger:  { color: 'var(--q-accent-danger)',   bg: 'var(--q-accent-danger-trace)',   border: 'var(--q-accent-danger-border)' },
  success: { color: 'var(--q-accent-success)',  bg: 'var(--q-accent-success-trace)',  border: 'var(--q-accent-success-border)' },
  neutral: { color: 'var(--q-text-faint)',      bg: 'var(--q-accent-neutral-trace)', border: 'var(--q-border-subtle)' },
};

// ── DndIcon ───────────────────────────────────────────────────────────────────

function dndSrc(category: string, name: string) {
  return `/icons/dnd/${category}/${name}.svg`;
}

function DndIcon({
  src,
  size = 24,
  color = 'currentColor',
  className,
  style,
}: {
  src: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: color,
        maskImage: `url(${src})`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        ...style,
      }}
      aria-hidden
    />
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="section-rule" />
      <h2 className="label-overline">{children}</h2>
    </div>
  );
}

// ── Entity Placeholders ───────────────────────────────────────────────────────

const ENTITY_PLACEHOLDERS: { label: string; src: string; tone: Tone; path: string }[] = [
  { label: 'NPC / Person',  src: dndSrc('entity', 'person'),       tone: 'amber',   path: 'entity/person' },
  { label: 'Monster',       src: dndSrc('monster', 'humanoid'),    tone: 'danger',  path: 'monster/humanoid' },
  { label: 'Location',      src: dndSrc('location', 'dungeon'),    tone: 'quest',   path: 'location/dungeon' },
  { label: 'Magic Item',    src: dndSrc('entity', 'magic-item'),   tone: 'arcane',  path: 'entity/magic-item' },
  { label: 'Spell',         src: dndSrc('spell', 'evocation'),     tone: 'arcane',  path: 'spell/evocation' },
  { label: 'Faction / Org', src: dndSrc('entity', 'organization'), tone: 'neutral', path: 'entity/organization' },
  { label: 'Sourcebook',    src: dndSrc('entity', 'book'),         tone: 'amber',   path: 'entity/book' },
  { label: 'Weapon',        src: dndSrc('entity', 'weapon'),       tone: 'neutral', path: 'entity/weapon' },
];

function EntityPlaceholder({ label, src, tone, path }: typeof ENTITY_PLACEHOLDERS[number]) {
  const { color, bg, border } = TONE_VARS[tone];
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-sm overflow-hidden"
        style={{
          width: 112,
          height: 112,
          background: `radial-gradient(circle at 50% 65%, ${bg} 0%, var(--q-surface-sunken) 70%)`,
          border: `1px solid ${border}`,
        }}
      >
        <DndIcon src={src} size={52} color={color} style={{ opacity: 0.85 }} />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-medium" style={{ color }}>{label}</div>
        <code className="text-[8px] font-mono mt-0.5 block" style={{ color: 'var(--q-text-faint)' }}>{path}</code>
      </div>
    </div>
  );
}

// ── DndBadge ──────────────────────────────────────────────────────────────────

function DndBadge({
  src,
  label,
  tone = 'neutral',
  size = 'md',
}: {
  src: string;
  label: string;
  tone?: Tone;
  size?: 'sm' | 'md';
}) {
  const { color, bg, border } = TONE_VARS[tone];
  const iconSize = size === 'sm' ? 10 : 12;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm font-semibold tracking-[.08em] uppercase whitespace-nowrap"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: size === 'sm' ? 9 : 10,
        padding: size === 'sm' ? '2px 5px' : '3px 7px',
      }}
    >
      <DndIcon src={src} size={iconSize} color={color} />
      {label}
    </span>
  );
}

// ── Badge data ────────────────────────────────────────────────────────────────

const CLASS_LIST = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];
const SCHOOL_LIST = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'];
const MONSTER_LIST = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fae', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];
const DAMAGE_LIST = ['fire', 'cold', 'lightning', 'necrotic', 'radiant', 'poison', 'acid', 'psychic', 'thunder', 'force', 'bludgeoning', 'piercing', 'slashing'];

// ── Icon Grid ─────────────────────────────────────────────────────────────────

const ICON_CATEGORIES: { category: string; names: string[] }[] = [
  { category: 'entity',    names: ['person', 'organization', 'location', 'book', 'spellbook', 'magic-item', 'weapon', 'armor', 'potion', 'ring', 'scroll', 'wand', 'map', 'world', 'loot', 'mount', 'ship', 'vehicle', 'tool', 'trinket', 'pack'] },
  { category: 'class',     names: CLASS_LIST },
  { category: 'monster',   names: MONSTER_LIST },
  { category: 'spell',     names: [...SCHOOL_LIST, 'concentration', 'ritual', 'consumed', 'upcast', 'vocal', 'somatic', 'material', 'instantaneous'] },
  { category: 'location',  names: ['dungeon', 'tower', 'castle', 'tavern', 'forest', 'mountain', 'village', 'camp', 'portal', 'bastion', 'hut'] },
  { category: 'damage',    names: DAMAGE_LIST },
  { category: 'condition', names: ['charmed', 'frightened', 'paralyzed', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'blinded', 'deafened', 'exhaustion', 'invisible', 'grappled', 'incapacitated', 'petrified', 'silenced', 'sleep'] },
  { category: 'combat',    names: ['action', 'bonus-action', 'reaction', 'initiative', 'melee', 'ranged', 'reach', 'round', 'target'] },
  { category: 'dice',      names: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'advantage', 'disadvantage', 'roll'] },
  { category: 'ability',   names: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] },
  { category: 'movement',  names: ['walking', 'flying', 'swimming', 'climbing', 'burrowing'] },
  { category: 'target',    names: ['self', 'touch', 'sphere', 'cone', 'line', 'cube', 'cylinder', 'circle', 'wall', 'square', 'emanation'] },
  { category: 'weapon',    names: ['sword', 'dagger', 'bow', 'crossbow', 'staff', 'hammer', 'spear', 'battleaxe', 'handaxe', 'mace', 'arrow', 'rapier', 'lance', 'whip'] },
  { category: 'game',      names: ['dm', 'character', 'monster', 'spell', 'campaign', 'adventure-book', 'source-book', 'combat', 'explore', 'social', 'rest', 'inspiration', 'concentration', 'hazard', 'trap', 'puzzle', 'lock'] },
  { category: 'campaign',  names: ['curse-of-strahd', 'descent-into-avernus', 'rime-of-the-frostmaiden', 'tomb-of-annihilation', 'waterdeep', 'out-of-the-abyss', 'candlekeep', 'elemental-evil'] },
  { category: 'hp',        names: ['full', 'half', 'empty', 'blood', 'temp'] },
];

function IconGrid({ category, names }: { category: string; names: string[] }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] uppercase tracking-[.12em] font-semibold mb-2" style={{ color: 'var(--q-text-faint)' }}>
        {category}
      </div>
      <div className="flex flex-wrap gap-2">
        {names.map((name) => {
          const src = dndSrc(category, name);
          return (
            <div
              key={name}
              className="flex flex-col items-center gap-1 rounded-sm p-2 cursor-default transition-colors hover:border-[var(--q-border-feature)]"
              style={{
                background: 'var(--q-surface-raised)',
                border: '1px solid var(--q-border-subtle)',
                minWidth: 60,
              }}
              title={`/icons/dnd/${category}/${name}.svg`}
            >
              <DndIcon src={src} size={24} color="var(--q-text-dim)" />
              <span className="text-[8px] font-mono text-center leading-tight" style={{ color: 'var(--q-text-faint)' }}>
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IconsPage() {
  const [activeTone, setActiveTone] = useState<Tone>('amber');

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 960, margin: '0 auto' }}>
      <div className="mb-8">
        <div className="label-overline mb-2">Dev</div>
        <h1 className="text-fluid-2xl" style={{ fontFamily: 'var(--q-font-display)', color: 'var(--q-text)' }}>
          Icons
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--q-text-dim)' }}>
          D&D SVG pack — entity placeholders, badges, and full category browser. All rendered via CSS <code className="font-mono text-xs">mask-image</code>.
        </p>
      </div>

      {/* ── Entity Placeholders ─────────────────────────────────────── */}
      <SectionHeading>Entity Card Placeholders</SectionHeading>
      <p className="text-xs mb-5" style={{ color: 'var(--q-text-faint)' }}>
        Type-specific glyph + tone-matched radial gradient. Replaces the generic icon fallback in EntityCard.
      </p>
      <div className="flex flex-wrap gap-5 mb-10">
        {ENTITY_PLACEHOLDERS.map((p) => <EntityPlaceholder key={p.label} {...p} />)}
      </div>

      {/* ── Badges ─────────────────────────────────────────────────── */}
      <SectionHeading>D&D Badges</SectionHeading>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {(Object.keys(TONE_VARS) as Tone[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTone(t)}
            className="text-[10px] uppercase tracking-[.08em] px-2.5 py-1 rounded-sm border transition-colors"
            style={activeTone === t
              ? { background: TONE_VARS[t].bg, borderColor: TONE_VARS[t].border, color: TONE_VARS[t].color }
              : { background: 'transparent', borderColor: 'var(--q-border-subtle)', color: 'var(--q-text-faint)' }
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-5 mb-10">
        {[
          { label: 'Class',         items: CLASS_LIST,   cat: 'class' },
          { label: 'Spell School',  items: SCHOOL_LIST,  cat: 'spell' },
          { label: 'Creature Type', items: MONSTER_LIST, cat: 'monster' },
        ].map(({ label, items, cat }) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-[.1em] mb-2" style={{ color: 'var(--q-text-faint)' }}>{label}</div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((name) => (
                <DndBadge key={name} src={dndSrc(cat, name)} label={name} tone={activeTone} />
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="text-[10px] uppercase tracking-[.1em] mb-2" style={{ color: 'var(--q-text-faint)' }}>Damage Type — sm</div>
          <div className="flex flex-wrap gap-1.5">
            {DAMAGE_LIST.map((name) => (
              <DndBadge key={name} src={dndSrc('damage', name)} label={name} tone={activeTone} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* ── Icon Browser ────────────────────────────────────────────── */}
      <SectionHeading>Icon Browser</SectionHeading>
      <p className="text-xs mb-6" style={{ color: 'var(--q-text-faint)' }}>
        Hover any icon for its path. Source: <code className="font-mono">public/icons/dnd/</code>
      </p>
      {ICON_CATEGORIES.map(({ category, names }) => (
        <IconGrid key={category} category={category} names={names} />
      ))}
    </div>
  );
}
