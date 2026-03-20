# Homebrew Card Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three display components — `SpellCard`, `MonsterStatBlock`, and `MagicItemCard` — using the approved design specs, sharing a common set of card design tokens and utilities.

**Architecture:** Each component is a self-contained React client component in `src/components/homebrew/`. Shared design tokens (stone gradient, card inset) are added to `globals.css`. Per-item dynamic values (rarity color, school color) are injected via CSS custom properties on the element's `style` prop. A shared utility module handles rarity/school colour resolution and description bold-text parsing.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript (strict), Tailwind CSS, Vitest (unit tests), Playwright (visual smoke test)

---

## Specs

- Spell cards: `docs/superpowers/specs/2026-03-18-spell-cards-design.md`
- Monster stat block: `docs/superpowers/specs/2026-03-18-monster-stat-block-design.md`
- Magic item cards: `docs/superpowers/specs/2026-03-18-magic-items-design.md`
- Prototypes (visual reference): `E:/Projects/QuiverDM/.superpowers/brainstorm/423867-1773817223/`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/globals.css` | Modify | Add card-specific CSS variables: `--card-stone-bg`, `--card-stone-inset`, `--card-amber`, `--card-amber-light` |
| `src/lib/homebrew-card-utils.ts` | Create | Rarity colour resolver, school colour resolver, bold-text parser, ability modifier formatter |
| `tests/lib/homebrew-card-utils.test.ts` | Create | Unit tests for all utility functions |
| `src/components/homebrew/SpellCard.tsx` | Create | Collapsed/expanded spell card component |
| `src/components/homebrew/MonsterStatBlock.tsx` | Create | Drawer/full-page monster stat block component |
| `src/components/homebrew/MagicItemCard.tsx` | Create | Single-state magic item card component |
| `tests/smoke/homebrew-cards.smoke.spec.ts` | Create | Playwright smoke test: renders all 3 components without crash |

---

## Task 1: Card Design Tokens

**Files:**
- Modify: `src/app/globals.css`

Add card-specific CSS variables that are not in the existing design system. These are used across all three card components.

- [ ] **Step 1: Read globals.css to find the right insertion point**

Read `src/app/globals.css` and locate the end of the `:root` block (after `--ring` declaration, before the closing `}`). Also check there is no existing `--stone-bg` variable.

- [ ] **Step 2: Add card tokens to the .dark block**

In `src/app/globals.css`, inside the `.dark { }` block (these are dark-mode-only components; placing them in `.dark` keeps them isolated from light mode), add after the `--ring` line inside `.dark`:

```css
    /* Card components — homebrew display */
    --card-stone-bg: linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%);
    --card-stone-inset: inset 0 1px 0 hsl(35 60% 50% / 0.08);
    --card-amber: hsl(35, 80%, 48%);
    --card-amber-light: hsl(35, 80%, 62%);
    --card-stone-border: hsl(35, 35%, 20%);
    --card-stone-border-hi: hsl(35, 50%, 28%);
    --card-text-muted: hsl(35, 10%, 55%);
```

- [ ] **Step 3: Verify dev server still starts**

Run: `npm run dev` (port 3847), confirm no CSS parse errors in the terminal output.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add card design tokens to globals.css"
```

---

## Task 2: Utility Functions + Tests (TDD)

**Files:**
- Create: `src/lib/homebrew-card-utils.ts`
- Create: `tests/lib/homebrew-card-utils.test.ts`

Four utility functions shared across all card components:
1. `getRarityVars(rarity)` — returns CSS variable object `{ '--rc', '--rb', '--rg' }`
2. `getSchoolVars(school)` — returns CSS variable object `{ '--school-color', '--school-bg' }`
3. `parseBoldDescription(text)` — parses `**text**` into `{ type: 'bold'|'text', content: string }[]`
4. `formatAbilityMod(score)` — `19 → '+4'`, `8 → '−1'` (uses minus sign U+2212, not hyphen)

---

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/homebrew-card-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getRarityVars,
  getSchoolVars,
  parseBoldDescription,
  formatAbilityMod,
  normalizeRarity,
} from '@/lib/homebrew-card-utils';

describe('getRarityVars', () => {
  it('returns correct colour vars for uncommon', () => {
    const vars = getRarityVars('uncommon');
    expect(vars['--rc']).toBe('hsl(120,40%,46%)');
    expect(vars['--rb']).toBe('hsl(120,25%,12%)');
    expect(vars['--rg']).toBeUndefined();
  });

  it('returns glow var for legendary', () => {
    const vars = getRarityVars('legendary');
    expect(vars['--rc']).toBe('hsl(38,90%,58%)');
    expect(vars['--rg']).toBe('0 0 12px hsl(38 90% 50% / 0.2)');
  });

  it('returns double glow for artifact', () => {
    const vars = getRarityVars('artifact');
    expect(vars['--rg']).toContain('0 0 40px');
  });

  it('handles very-rare (hyphenated) rarity', () => {
    const vars = getRarityVars('very-rare');
    expect(vars['--rc']).toBe('hsl(270,55%,62%)');
  });
});

describe('getSchoolVars', () => {
  it('returns red for evocation', () => {
    const vars = getSchoolVars('evocation');
    expect(vars['--school-color']).toBe('hsl(0,65%,55%)');
  });

  it('returns purple for illusion', () => {
    const vars = getSchoolVars('illusion');
    expect(vars['--school-color']).toBe('hsl(260,55%,62%)');
  });
});

describe('parseBoldDescription', () => {
  it('parses plain text as single text segment', () => {
    const result = parseBoldDescription('just text');
    expect(result).toEqual([{ type: 'text', content: 'just text' }]);
  });

  it('parses **bold** into bold segment', () => {
    const result = parseBoldDescription('deals **8d6** fire damage');
    expect(result).toEqual([
      { type: 'text', content: 'deals ' },
      { type: 'bold', content: '8d6' },
      { type: 'text', content: ' fire damage' },
    ]);
  });

  it('handles multiple bold segments', () => {
    const result = parseBoldDescription('**+3** to hit, **2d6** damage');
    // split produces: ['', '**+3**', ' to hit, ', '**2d6**', ' damage']
    // index 0 = empty text, index 1 = bold '+3', index 3 = bold '2d6'
    expect(result[1]).toEqual({ type: 'bold', content: '+3' });
    expect(result[3]).toEqual({ type: 'bold', content: '2d6' });
  });

  it('returns empty text segment for empty string', () => {
    const result = parseBoldDescription('');
    expect(result).toEqual([{ type: 'text', content: '' }]);
  });
});

describe('normalizeRarity', () => {
  it('maps "very rare" (space) to "very-rare" (hyphen)', () => {
    expect(normalizeRarity('very rare')).toBe('very-rare');
  });

  it('passes through already-hyphenated values unchanged', () => {
    expect(normalizeRarity('legendary')).toBe('legendary');
  });

  it('falls back to common for unknown values', () => {
    expect(normalizeRarity('godlike')).toBe('common');
  });
});

describe('formatAbilityMod', () => {
  it('formats positive modifier with + prefix', () => {
    expect(formatAbilityMod(19)).toBe('+4');
    expect(formatAbilityMod(10)).toBe('+0');
  });

  it('formats negative modifier with minus sign (U+2212)', () => {
    expect(formatAbilityMod(8)).toBe('\u22121');
    expect(formatAbilityMod(3)).toBe('\u22124');
  });

  it('calculates modifier correctly for edge cases', () => {
    expect(formatAbilityMod(1)).toBe('\u22125');
    expect(formatAbilityMod(30)).toBe('+10');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd E:/Projects/QuiverDM && npm test -- homebrew-card-utils
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement the utility functions**

Create `src/lib/homebrew-card-utils.ts`:

```typescript
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact';
export type SpellSchool =
  | 'evocation' | 'illusion' | 'necromancy' | 'abjuration'
  | 'conjuration' | 'divination' | 'enchantment' | 'transmutation';

type RarityVars = { '--rc': string; '--rb': string; '--rg'?: string };
type SchoolVars = { '--school-color': string; '--school-bg': string };

const RARITY_VARS: Record<Rarity, RarityVars> = {
  common:    { '--rc': 'hsl(35,10%,55%)',   '--rb': 'hsl(35,8%,14%)' },
  uncommon:  { '--rc': 'hsl(120,40%,46%)',  '--rb': 'hsl(120,25%,12%)' },
  rare:      { '--rc': 'hsl(210,65%,58%)',  '--rb': 'hsl(210,40%,14%)' },
  'very-rare': { '--rc': 'hsl(270,55%,62%)', '--rb': 'hsl(270,35%,16%)' },
  legendary: {
    '--rc': 'hsl(38,90%,58%)',
    '--rb': 'hsl(38,60%,13%)',
    '--rg': '0 0 12px hsl(38 90% 50% / 0.2)',
  },
  artifact: {
    '--rc': 'hsl(42,100%,62%)',
    '--rb': 'hsl(42,70%,12%)',
    '--rg': '0 0 20px hsl(42 100% 55% / 0.25), 0 0 40px hsl(42 100% 50% / 0.1)',
  },
};

const SCHOOL_VARS: Record<SpellSchool, SchoolVars> = {
  evocation:     { '--school-color': 'hsl(0,65%,55%)',   '--school-bg': 'hsl(0,50%,15%)' },
  illusion:      { '--school-color': 'hsl(260,55%,62%)', '--school-bg': 'hsl(260,40%,18%)' },
  necromancy:    { '--school-color': 'hsl(140,40%,38%)', '--school-bg': 'hsl(140,30%,12%)' },
  abjuration:    { '--school-color': 'hsl(200,60%,50%)', '--school-bg': 'hsl(200,40%,14%)' },
  conjuration:   { '--school-color': 'hsl(40,70%,50%)',  '--school-bg': 'hsl(40,50%,12%)' },
  divination:    { '--school-color': 'hsl(180,50%,45%)', '--school-bg': 'hsl(180,35%,12%)' },
  enchantment:   { '--school-color': 'hsl(320,50%,55%)', '--school-bg': 'hsl(320,35%,14%)' },
  transmutation: { '--school-color': 'hsl(80,45%,42%)',  '--school-bg': 'hsl(80,30%,12%)' },
};

export function getRarityVars(rarity: Rarity): RarityVars {
  return RARITY_VARS[rarity] ?? RARITY_VARS.common;
}

/**
 * Normalise the DB/schema rarity string to the component Rarity type.
 * The dnd-schemas MagicItemSchema uses 'very rare' (space); this component
 * system uses 'very-rare' (hyphen). Use this at the call site.
 * Example: normalizeRarity(dbItem.rarity) → 'very-rare'
 */
export function normalizeRarity(rarity: string): Rarity {
  const normalized = rarity.toLowerCase().replace(/\s+/g, '-') as Rarity;
  return normalized in RARITY_VARS ? normalized : 'common';
}

export function getSchoolVars(school: SpellSchool): SchoolVars {
  return SCHOOL_VARS[school] ?? SCHOOL_VARS.evocation;
}

export type DescriptionSegment = { type: 'text' | 'bold'; content: string };

export function parseBoldDescription(text: string): DescriptionSegment[] {
  if (!text) return [{ type: 'text', content: '' }];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return { type: 'bold' as const, content: part.slice(2, -2) };
    }
    return { type: 'text' as const, content: part };
  });
}

export function formatAbilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `\u2212${Math.abs(mod)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd E:/Projects/QuiverDM && npm test -- homebrew-card-utils
```

Expected: PASS (all 12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/homebrew-card-utils.ts tests/lib/homebrew-card-utils.test.ts
git commit -m "feat: add homebrew card utility functions with tests"
```

---

## Task 3: SpellCard Component

**Files:**
- Create: `src/components/homebrew/SpellCard.tsx`

Spec: `docs/superpowers/specs/2026-03-18-spell-cards-design.md`
Prototype: `.superpowers/brainstorm/423867-1773817223/spell-cards-v1.html`

Two states: `collapsed` (quick reference, single line summary) and `expanded` (full detail with stat grid, components, upcast box).

- [ ] **Step 1: Create the component**

Create `src/components/homebrew/SpellCard.tsx`:

```tsx
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

interface SpellCardProps {
  spell: SpellCardData;
  variant: 'collapsed' | 'expanded';
  onToggle?: () => void;
}

const SCHOOL_ABBR: Record<SpellSchool, string> = {
  evocation: 'Evoc', illusion: 'Illus', necromancy: 'Necro', abjuration: 'Abj',
  conjuration: 'Conj', divination: 'Div', enchantment: 'Ench', transmutation: 'Trans',
};

function levelLabel(level: number | 'cantrip', short = false): string {
  if (level === 'cantrip') return 'Cantrip';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = level <= 3 ? suffixes[level] : 'th';
  return short ? `${level}${suffix}` : `${level}${suffix} Level`;
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

// Collapsed: clock icon
function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="2" x2="5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="5" y1="5.5" x2="7" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// Collapsed: range icon
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
      ? `${levelLabel(spell.level, true)} · ${SCHOOL_ABBR[spell.school]}`
      : levelLabel(spell.level, true);

  const baseClasses = cn(
    'relative overflow-hidden rounded-[3px] border',
    'bg-[image:var(--card-stone-bg)]',
    '[box-shadow:var(--card-stone-inset),0_4px_20px_hsl(240_10%_4%/0.5)]',
  );

  // Left accent bar
  const accentBar = (
    <span
      className="absolute left-0 top-0 bottom-0 w-[3px] opacity-85"
      style={{ background: 'var(--school-color)' }}
      aria-hidden
    />
  );

  // Level badge (pill)
  const LevelBadge = () => (
    <span
      className="text-[10px] font-semibold px-[7px] py-[2px] rounded-full border tracking-[.06em]"
      style={{
        background: 'var(--school-bg)',
        color: 'var(--school-color)',
        borderColor: 'var(--school-color)',
      }}
    >
      {levelBadge}
    </span>
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
        aria-expanded={false}
      >
        {accentBar}
        {/* Row 1 */}
        <div className="flex items-center justify-between mb-1">
          <span
            className="font-serif text-[14px] font-bold tracking-[.03em]"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-cinzel, serif)' }}
          >
            {spell.name}
          </span>
          <LevelBadge />
        </div>
        {/* Row 2 — stat chips */}
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--card-text-muted)' }}>
            <ClockIcon />{spell.castingTime.replace('1 ', '').replace('Action', 'Action')}
          </span>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--card-text-muted)' }}>
            <RangeIcon />{spell.range}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--card-text-muted)' }}>
            {durationShort}
          </span>
        </div>
        {/* Summary line */}
        {spell.save && (
          <p
            className="text-[11px] truncate leading-[1.4]"
            style={{ color: 'var(--card-text-muted)' }}
          >
            {spell.save}
          </p>
        )}
      </div>
    );
  }

  // Expanded
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
      {/* Header */}
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
            {spell.school.charAt(0).toUpperCase() + spell.school.slice(1)} ·{' '}
            {typeof spell.level === 'number' ? levelLabel(spell.level) : 'Cantrip'}
          </div>
        </div>
        <LevelBadge />
      </div>

      {/* Stat grid */}
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

      {/* Component badges */}
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

      {/* Description */}
      <div className="text-[12px] leading-[1.6] mb-2">
        <BoldText text={spell.description} />
      </div>

      {/* At Higher Levels */}
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
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit
```

Expected: no errors in `SpellCard.tsx` or `homebrew-card-utils.ts`

- [ ] **Step 3: Commit**

```bash
git add src/components/homebrew/SpellCard.tsx
git commit -m "feat: add SpellCard component (collapsed + expanded)"
```

---

## Task 4: MonsterStatBlock Component

**Files:**
- Create: `src/components/homebrew/MonsterStatBlock.tsx`

Spec: `docs/superpowers/specs/2026-03-18-monster-stat-block-design.md`
Prototype: `.superpowers/brainstorm/423867-1773817223/monster-stat-v1.html`

Two modes: `drawer` (compact combat reference with drag handle) and `full` (full bestiary page with all sections).

- [ ] **Step 1: Create the component**

Create `src/components/homebrew/MonsterStatBlock.tsx`:

```tsx
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

// Shared ability score grid
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

// Shared vital box
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

// Shared section label
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

// Shared action list item
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
        // Drawer: inline to-hit + damage only
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
        // Full page: full description
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

// CR fraction display
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
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0">
          <div
            className="w-8 h-[3px] rounded-full"
            style={{ background: 'var(--card-stone-border-hi)' }}
          />
        </div>

        {/* Header */}
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

        {/* Vitals */}
        <div
          className="grid grid-cols-3 gap-[6px] px-3 py-2 border-b"
          style={{ borderColor: 'var(--card-stone-border)' }}
        >
          <VitalBox label="HP" value={String(monster.hp)} sub={monster.hpDice} valueColor="hsl(0,60%,62%)" />
          <VitalBox label="AC" value={String(monster.ac)} sub={monster.acNote} />
          <VitalBox label="Speed" value={monster.speed.replace(' ft', '')} sub="ft" />
        </div>

        {/* Abilities */}
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <AbilityGrid abilities={monster.abilities} />
        </div>

        {/* Actions */}
        <div className="px-3 py-2">
          <SectionLabel>Actions</SectionLabel>
          {monster.actions.map((action, i) => (
            <ActionItem key={i} action={action} compact />
          ))}
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div
      className={cn(cardBase, 'rounded-[3px]')}
      style={{ ...baseVars, borderColor: 'var(--card-stone-border)' } as CSSProperties}
    >
      {/* Hero header */}
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
          {/* CR tag */}
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
          {/* Type tag */}
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

      {/* Vitals section */}
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

      {/* Ability scores */}
      <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
        <SectionLabel>Ability Scores</SectionLabel>
        <AbilityGrid abilities={monster.abilities} />
      </div>

      {/* Actions */}
      <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
        <SectionLabel>Actions</SectionLabel>
        {monster.actions.map((action, i) => (
          <ActionItem key={i} action={action} />
        ))}
      </div>

      {/* Traits */}
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

      {/* Bonus Actions */}
      {monster.bonusActions && monster.bonusActions.length > 0 && (
        <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <SectionLabel>Bonus Actions</SectionLabel>
          {monster.bonusActions.map((action, i) => (
            <ActionItem key={i} action={action} />
          ))}
        </div>
      )}

      {/* Reactions */}
      {monster.reactions && monster.reactions.length > 0 && (
        <div className="px-[14px] py-2 border-b" style={{ borderColor: 'var(--card-stone-border)' }}>
          <SectionLabel>Reactions</SectionLabel>
          {monster.reactions.map((action, i) => (
            <ActionItem key={i} action={action} />
          ))}
        </div>
      )}

      {/* Legendary Actions */}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/homebrew/MonsterStatBlock.tsx
git commit -m "feat: add MonsterStatBlock component (drawer + full modes)"
```

---

## Task 5: MagicItemCard Component

**Files:**
- Create: `src/components/homebrew/MagicItemCard.tsx`

Spec: `docs/superpowers/specs/2026-03-18-magic-items-design.md`
Prototype: `.superpowers/brainstorm/423867-1773817223/magic-items-v1.html`

Single state, rarity-driven visual treatment. Charges pip row and lore section always present.

- [ ] **Step 1: Create the component**

Create `src/components/homebrew/MagicItemCard.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { getRarityVars, parseBoldDescription, type Rarity } from '@/lib/homebrew-card-utils';
import { cn } from '@/lib/utils';

export interface MagicItemCardData {
  name: string;
  rarity: Rarity;
  type: string;
  attunement?: boolean;
  attunementNote?: string;
  description: string;
  charges?: {
    max: number;
    current?: number;
    reset: string;
  };
  lore: string;
}

interface MagicItemCardProps {
  item: MagicItemCardData;
}

function BoldText({ text }: { text: string }) {
  const segments = parseBoldDescription(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'bold'
          ? <strong key={i} className="font-semibold" style={{ color: 'var(--rc)' }}>{seg.content}</strong>
          : <span key={i}>{seg.content}</span>
      )}
    </>
  );
}

// Wondrous item bag icon
function WondrousIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <rect x="1.5" y="3" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M3.5 3V2.5a2 2 0 0 1 4 0V3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

// Wand icon
function WandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <line x1="2" y1="9" x2="9" y2="2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="7" y1="2" x2="9" y2="2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="9" y1="2" x2="9" y2="4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

// Generic item icon (plus)
function ItemIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="2" y1="5.5" x2="9" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function getTypeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('wand') || lower.includes('weapon') || lower.includes('sword')) return <WandIcon />;
  return <WondrousIcon />;
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very-rare': 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
};

export function MagicItemCard({ item }: MagicItemCardProps) {
  const rarityVars = getRarityVars(item.rarity);
  const currentCharges = item.charges?.current ?? item.charges?.max ?? 0;

  // Box shadow: use --rg glow if present, else standard card shadow
  const boxShadow = rarityVars['--rg']
    ? `var(--card-stone-inset), ${rarityVars['--rg']}`
    : 'var(--card-stone-inset), 0 4px 16px hsl(240 10% 4% / 0.4)';

  const cardStyle: CSSProperties = {
    ...(rarityVars as CSSProperties),
    boxShadow,
    ...(item.rarity === 'artifact' ? { borderColor: 'hsl(42,60%,28%)' } : {}),
  };

  const attunementLabel = item.attunementNote
    ? `Attunement \u00B7 ${item.attunementNote}`
    : 'Attunement';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[3px] border',
        'bg-[image:var(--card-stone-bg)]',
        'mb-[10px]',
      )}
      style={{ ...cardStyle, borderColor: item.rarity === 'artifact' ? 'hsl(42,60%,28%)' : 'var(--card-stone-border)' }}
    >
      {/* Rarity accent bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-90"
        style={{ background: 'var(--rc)' }}
        aria-hidden
      />

      {/* Card inner */}
      <div className="px-3 pt-[10px] pb-[10px] pl-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-[5px]">
          <span
            className="font-serif text-[14px] font-bold tracking-[.03em] leading-[1.2]"
            style={{ fontFamily: 'var(--font-cinzel, serif)' }}
          >
            {item.name}
          </span>
          <span
            className="flex-shrink-0 text-[9px] font-bold tracking-[.08em] uppercase px-[7px] py-[2px] rounded-full border whitespace-nowrap"
            style={{
              background: 'var(--rb)',
              color: 'var(--rc)',
              borderColor: 'var(--rc)',
            }}
          >
            {RARITY_LABEL[item.rarity]}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-2 mb-[7px]">
          <span
            className="flex items-center gap-[3px] text-[10px]"
            style={{ color: 'var(--card-text-muted)' }}
          >
            {getTypeIcon(item.type)}
            {item.type}
          </span>
          {item.attunement && (
            <span
              className="text-[9px] font-semibold tracking-[.06em] uppercase px-[6px] py-[1px] rounded-[2px] border"
              style={{
                background: 'hsl(260 30% 12%)',
                color: 'hsl(260,45%,62%)',
                borderColor: 'hsl(260,30%,22%)',
              }}
            >
              {attunementLabel}
            </span>
          )}
        </div>

        {/* Effect text */}
        <div className="text-[12px] leading-[1.6]">
          <BoldText text={item.description} />
        </div>

        {/* Charges row */}
        {item.charges && (
          <div className="flex items-center gap-[7px] mt-[7px]">
            <span
              className="text-[9px] uppercase tracking-[.1em] font-semibold"
              style={{ color: 'var(--card-text-muted)' }}
            >
              Charges
            </span>
            <div className="flex gap-[3px]">
              {Array.from({ length: item.charges.max }, (_, i) => (
                <span
                  key={i}
                  className="w-[10px] h-[10px] rounded-full border"
                  style={{
                    background: i < currentCharges ? 'var(--rc)' : 'var(--rb)',
                    borderColor: 'var(--rc)',
                  }}
                />
              ))}
            </div>
            <span
              className="ml-auto text-[9px] italic"
              style={{ color: 'var(--card-text-muted)' }}
            >
              resets {item.charges.reset}
            </span>
          </div>
        )}
      </div>

      {/* Lore section */}
      <div
        className="px-3 pt-2 pb-[9px] pl-4 border-t"
        style={{ background: 'hsl(240 10% 7%)', borderColor: 'var(--card-stone-border)' }}
      >
        <div
          className="text-[9px] uppercase tracking-[.1em] font-semibold mb-1"
          style={{ color: 'var(--card-text-muted)' }}
        >
          Lore
        </div>
        <p
          className="text-[11px] italic leading-[1.6]"
          style={{ color: 'hsl(35 12% 60%)' }}
        >
          {item.lore}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/homebrew/MagicItemCard.tsx
git commit -m "feat: add MagicItemCard component with rarity system"
```

---

## Task 6: Smoke Test

**Files:**
- Create: `tests/smoke/homebrew-cards.smoke.spec.ts`

Verify all three components render without crashing at a Next.js route. This test uses Playwright to navigate to a test fixture page.

**Note:** This test requires a test fixture page to be created first. Create a dev-only page that renders sample instances of all three components.

- [ ] **Step 1: Create a dev-only test fixture page**

Create `src/app/dev/cards/page.tsx` (outside any authenticated route group — no auth required for this fixture):

```tsx
// Dev-only fixture page for visual testing of homebrew card components.
// Not linked from navigation. Will be excluded from production builds via middleware if needed.

import { SpellCard } from '@/components/homebrew/SpellCard';
import { MonsterStatBlock } from '@/components/homebrew/MonsterStatBlock';
import { MagicItemCard } from '@/components/homebrew/MagicItemCard';

const fireball = {
  name: 'Fireball',
  level: 3 as const,
  school: 'evocation' as const,
  castingTime: '1 Action',
  range: '150 ft',
  duration: 'Instantaneous',
  concentration: false,
  components: { verbal: true, somatic: true, material: true, materialDesc: 'a tiny ball of bat guano' },
  description: 'A bright streak flashes from your finger. Each creature in a **20-foot radius** must make a DEX save or take **8d6 fire damage**.',
  higherLevels: '+1d6 per slot level above 3rd.',
  save: 'DEX · Half',
};

const ogre = {
  name: 'Ogre',
  size: 'Large' as const,
  type: 'Giant',
  alignment: 'Chaotic Evil',
  cr: 2,
  xp: 450,
  ac: 11,
  acNote: 'hide armour',
  hp: 59,
  hpDice: '7d10+21',
  speed: '40 ft',
  abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
  senses: 'Darkvision 60 ft',
  passivePerception: 8,
  languages: 'Common, Giant',
  traits: [{ name: 'Aggressive', description: 'As a bonus action, the ogre can move up to its speed toward a hostile creature.' }],
  actions: [
    { name: 'Greatclub', type: 'Melee Weapon Attack', toHit: 6, reach: '10 ft', damage: '2d8+4 bludgeoning', description: '+6 to hit, reach 10 ft, one target.' },
  ],
};

const vorpalSword = {
  name: 'Vorpal Sword',
  rarity: 'legendary' as const,
  type: 'Weapon · Sword',
  attunement: true,
  description: 'You gain a **+3 bonus** to attack and damage rolls. On a roll of **20**, you cut off one of the target\'s heads.',
  lore: '"One, two! One, two! And through and through, the vorpal blade went snicker-snack."',
};

export default function CardFixturePage() {
  return (
    <div className="dark min-h-screen p-6 space-y-8" style={{ background: 'hsl(240 10% 6%)' }}>
      <h1 className="text-lg font-semibold text-white">Card Component Fixtures</h1>
      <section data-testid="spell-cards">
        <h2 className="text-sm text-muted-foreground mb-3">Spell Cards</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <SpellCard spell={fireball} variant="collapsed" />
          <SpellCard spell={fireball} variant="expanded" />
        </div>
      </section>
      <section data-testid="monster-blocks">
        <h2 className="text-sm text-muted-foreground mb-3">Monster Stat Blocks</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <MonsterStatBlock monster={ogre} mode="drawer" />
          <MonsterStatBlock monster={ogre} mode="full" />
        </div>
      </section>
      <section data-testid="magic-item-cards">
        <h2 className="text-sm text-muted-foreground mb-3">Magic Item Cards</h2>
        <div className="max-w-xs">
          <MagicItemCard item={vorpalSword} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write the smoke test**

Create `tests/smoke/homebrew-cards.smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Homebrew card components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/cards');
  });

  test('spell card fixture renders collapsed and expanded', async ({ page }) => {
    const section = page.getByTestId('spell-cards');
    await expect(section).toBeVisible();
    // Both variants visible — check for the spell name
    await expect(section.getByText('Fireball').first()).toBeVisible();
  });

  test('monster stat block renders drawer and full modes', async ({ page }) => {
    const section = page.getByTestId('monster-blocks');
    await expect(section).toBeVisible();
    await expect(section.getByText('Ogre').first()).toBeVisible();
    // Drag handle present in drawer mode — identified by data-testid
    await expect(section.getByTestId('monster-stat-drawer')).toBeVisible();
  });

  test('magic item card renders with lore section', async ({ page }) => {
    const section = page.getByTestId('magic-item-cards');
    await expect(section).toBeVisible();
    await expect(section.getByText('Vorpal Sword')).toBeVisible();
    await expect(section.getByText('Lore')).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the dev server and verify the fixture page loads**

In one terminal: `npm run dev`
In another: navigate to `http://localhost:3847/dev/cards` in a browser and verify all three sections render visually.

- [ ] **Step 4: Run the smoke test**

```bash
cd E:/Projects/QuiverDM && npx playwright test tests/smoke/homebrew-cards.smoke.spec.ts
```

Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/dev/cards/page.tsx tests/smoke/homebrew-cards.smoke.spec.ts
git commit -m "test: add homebrew card component smoke tests with fixture page"
```

---

## Done

All three card components are implemented, tested, and committed. To use them:

```tsx
// Spell card
import { SpellCard } from '@/components/homebrew/SpellCard';
<SpellCard spell={spellData} variant="collapsed" onToggle={handleToggle} />

// Monster stat block
import { MonsterStatBlock } from '@/components/homebrew/MonsterStatBlock';
<MonsterStatBlock monster={monsterData} mode="drawer" onClose={handleClose} />

// Magic item card
import { MagicItemCard } from '@/components/homebrew/MagicItemCard';
<MagicItemCard item={itemData} />
```
