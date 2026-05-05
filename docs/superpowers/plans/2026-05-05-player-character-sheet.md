# Player Character Sheet — Two-State Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-state `PlayerCharacterCard` sheet with a two-state expandable drawer: compact (vitals + attacks) and expanded (full tabbed sheet: Overview / Combat / Skills / Spells).

**Architecture:** A Zustand store extension adds `isExpanded` to `activeSheet` and `expandSheet`/`collapseSheet` actions. A new `CharacterSheetDrawer` component renders inside `PinnedCharacterFlags` and switches between a compact body and a full tabbed body, animated via CSS `max-width` transition on `SheetContent`. All character data comes from the existing `trpc.characters.getCharacterSheet` query.

**Tech Stack:** Next.js 15, tRPC v11, Zustand, shadcn/ui Sheet + Tabs, Tailwind CSS, Lucide icons, DndIcon component at `src/components/ui/dnd-icon.tsx`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/store/pinned-characters-store.ts` | Add `isExpanded`, `expandSheet`, `collapseSheet` |
| Create | `src/components/character/sheet-utils.ts` | Shared helpers + TypeScript types |
| Create | `src/components/character/sheet-tabs/OverviewTab.tsx` | Overview tab (vitals, ability scores, saves, key stats) |
| Create | `src/components/character/sheet-tabs/CombatTab.tsx` | Combat tab (attacks, spell stats) |
| Create | `src/components/character/sheet-tabs/SkillsTab.tsx` | Skills tab (18 skills with proficiency + mods) |
| Create | `src/components/character/sheet-tabs/SpellsTab.tsx` | Spells tab (slots grid + spell list by level) |
| Create | `src/components/character/CharacterSheetDrawer.tsx` | Two-state Sheet (compact ↔ expanded) |
| Modify | `src/components/character/PinnedCharacterFlags.tsx` | Swap inline Sheet for CharacterSheetDrawer |
| Delete | `src/components/character/PlayerCharacterCard.tsx` | Replaced by CharacterSheetDrawer + tabs |

---

## Task 1: Extend Zustand store with `isExpanded`

**Files:**
- Modify: `src/store/pinned-characters-store.ts`

- [ ] **Step 1: Replace the file with the extended store**

```ts
import { create } from 'zustand';

export interface PinnedCharacter {
  characterId: string;
  campaignId: string;
  name: string;
  portraitUrl: string | null;
}

interface ActiveSheet extends PinnedCharacter {
  isExpanded: boolean;
}

interface PinnedCharactersStore {
  pinned: PinnedCharacter[];
  activeSheet: ActiveSheet | null;
  pin: (char: PinnedCharacter) => void;
  unpin: (characterId: string) => void;
  isPinned: (characterId: string) => boolean;
  openSheet: (char: PinnedCharacter) => void;
  closeSheet: () => void;
  expandSheet: () => void;
  collapseSheet: () => void;
}

export const usePinnedCharacters = create<PinnedCharactersStore>((set, get) => ({
  pinned: [],
  activeSheet: null,
  pin: (char) =>
    set((s) => ({
      pinned: s.pinned.some((p) => p.characterId === char.characterId)
        ? s.pinned
        : [...s.pinned, char],
    })),
  unpin: (characterId) =>
    set((s) => ({
      pinned: s.pinned.filter((p) => p.characterId !== characterId),
      activeSheet:
        s.activeSheet?.characterId === characterId ? null : s.activeSheet,
    })),
  isPinned: (characterId) => get().pinned.some((p) => p.characterId === characterId),
  openSheet: (char) => set({ activeSheet: { ...char, isExpanded: false } }),
  closeSheet: () => set({ activeSheet: null }),
  expandSheet: () =>
    set((s) => ({
      activeSheet: s.activeSheet ? { ...s.activeSheet, isExpanded: true } : null,
    })),
  collapseSheet: () =>
    set((s) => ({
      activeSheet: s.activeSheet ? { ...s.activeSheet, isExpanded: false } : null,
    })),
}));
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "pinned-characters-store"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/store/pinned-characters-store.ts
git commit -m "feat(store): add isExpanded + expandSheet/collapseSheet to pinned characters store"
```

---

## Task 2: Create shared sheet utilities

**Files:**
- Create: `src/components/character/sheet-utils.ts`

- [ ] **Step 1: Create the file**

```ts
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];

export interface CharHp { current: number; max: number; temp?: number }
export interface CharSkill { name: string; ability: string; proficient: boolean; expertise: boolean }
export interface CharInventoryItem {
  name: string;
  quantity?: number;
  equipped?: boolean;
  damage?: string;
  damageType?: string;
  attackType?: string;
  properties?: string[];
  magicBonus?: number;
}
export interface CharSpell {
  name: string;
  level: number;
  damage?: string;
  school?: string;
  concentration?: boolean;
  description?: string;
}
export interface CharSpellcasting {
  ability?: string;
  spells?: CharSpell[];
  slots?: Record<string, { total: number; used: number }>;
}
export interface CharFeature { name: string; description?: string }

export interface CharacterSheetData {
  id: string;
  name: string;
  race: string | null;
  class: string | null;
  subclass: string | null;
  level: number | null;
  background: string | null;
  portraitUrl: string | null;
  armorClass: number | null;
  speed: number | null;
  proficiencyBonus: number | null;
  abilityScores: Record<AbilityKey, number> | null;
  hitPoints: CharHp | null;
  savingThrows: Record<AbilityKey, { proficient: boolean }> | null;
  proficiencies: { skills?: CharSkill[] } | null;
  senses: Record<string, unknown> | null;
  languages: string[] | null;
  resistances: { damage?: string[]; conditions?: string[] } | null;
  inventory: CharInventoryItem[] | null;
  spellcasting: CharSpellcasting | null;
  features: CharFeature[] | null;
  backstory: string | null;
  user?: { name?: string | null; displayName?: string | null } | null;
}

export function computeWeaponAttacks(
  inventory: CharInventoryItem[] | null,
  abilities: Record<AbilityKey, number> | null,
  profBonus: number
) {
  return (inventory ?? [])
    .filter((item) => item.equipped && item.damage)
    .map((item) => {
      const strMod = abilities ? abilityMod(abilities.str ?? 10) : 0;
      const dexMod = abilities ? abilityMod(abilities.dex ?? 10) : 0;
      const isRanged = item.attackType === 'Ranged';
      const isFinesse = (item.properties ?? []).some((p) => p.toLowerCase() === 'finesse');
      const abilityModVal = isRanged ? dexMod : isFinesse ? Math.max(strMod, dexMod) : strMod;
      const magic = item.magicBonus ?? 0;
      const attackBonus = abilityModVal + profBonus + magic;
      const damageBonus = abilityModVal + magic;
      return {
        name: item.name,
        attackBonus,
        damage:
          item.damage +
          (damageBonus !== 0 ? (damageBonus >= 0 ? `+${damageBonus}` : `${damageBonus}`) : ''),
        damageType: item.damageType ?? '',
      };
    });
}

export function computeSpellStats(
  spellcasting: CharSpellcasting | null,
  abilities: Record<AbilityKey, number> | null,
  profBonus: number
): { spellSaveDC: number | null; spellAttackBonus: number | null } {
  const spellAbility = spellcasting?.ability as AbilityKey | undefined;
  const spellAbilityMod =
    spellAbility && abilities ? abilityMod(abilities[spellAbility] ?? 10) : null;
  return {
    spellSaveDC: spellAbilityMod != null ? 8 + profBonus + spellAbilityMod : null,
    spellAttackBonus: spellAbilityMod != null ? profBonus + spellAbilityMod : null,
  };
}

export function computeSkillMod(
  skillName: string,
  skills: CharSkill[] | undefined,
  abilities: Record<AbilityKey, number> | null,
  profBonus: number
): number {
  const skill = skills?.find((s) => s.name === skillName);
  if (!skill || !abilities) return 0;
  const score = abilities[skill.ability as AbilityKey] ?? 10;
  let mod = abilityMod(score);
  if (skill.proficient) mod += profBonus;
  if (skill.expertise) mod += profBonus;
  return mod;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "sheet-utils"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/sheet-utils.ts
git commit -m "feat(character): add shared sheet utilities and types"
```

---

## Task 3: Create OverviewTab

**Files:**
- Create: `src/components/character/sheet-tabs/OverviewTab.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { DndIcon, ABILITY_ICONS } from '@/components/ui/dnd-icon';
import { abilityMod, fmt, ABILITY_KEYS, type AbilityKey, type CharacterSheetData, computeSkillMod, computeSpellStats } from '../sheet-utils';

function Chip({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded border py-2 px-1 ${highlight ? 'border-red-900/40 bg-red-950/20' : 'border-amber-800/20 bg-amber-950/15'}`}>
      <span className={`text-base font-bold tabular-nums ${highlight ? 'text-red-400' : ''}`}>{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5 text-center">{label}</span>
    </div>
  );
}

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface OverviewTabProps {
  char: CharacterSheetData;
}

export function OverviewTab({ char }: OverviewTabProps) {
  const abilities = char.abilityScores;
  const hp = char.hitPoints;
  const saves = char.savingThrows;
  const profBonus = char.proficiencyBonus ?? 2;
  const skills = char.proficiencies?.skills;
  const { spellSaveDC, spellAttackBonus } = computeSpellStats(char.spellcasting, abilities, profBonus);
  const passivePerception = 10 + computeSkillMod('Perception', skills, abilities, profBonus);
  const initiative = abilities ? abilityMod(abilities.dex ?? 10) : null;

  const senses = char.senses;
  const languages = char.languages;
  const resistances = char.resistances;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          <div>
            <OverlineLabel>Vitals</OverlineLabel>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="col-span-2 flex flex-col items-center rounded border border-red-900/40 bg-red-950/20 py-2 px-1">
                <span className="text-base font-bold tabular-nums text-red-400">
                  {hp ? `${hp.current}/${hp.max}` : '—'}
                </span>
                {hp?.temp ? (
                  <span className="text-[9px] text-amber-400/70 tabular-nums">+{hp.temp} temp</span>
                ) : null}
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5">HP</span>
              </div>
              <Chip label="AC" value={char.armorClass ?? '—'} />
              <Chip label="Speed" value={`${char.speed ?? 30}ft`} />
              <Chip label="Initiative" value={initiative != null ? fmt(initiative) : '—'} />
              <Chip label="Prof Bonus" value={fmt(profBonus)} />
              <Chip label="Passive Perc" value={passivePerception} />
              {spellSaveDC != null && <Chip label="Spell DC" value={spellSaveDC} />}
              {spellAttackBonus != null && <Chip label="Spell Atk" value={fmt(spellAttackBonus)} />}
            </div>
          </div>

          {abilities && (
            <div>
              <OverlineLabel>Ability Scores</OverlineLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {ABILITY_KEYS.map((key) => {
                  const score = abilities[key] ?? 10;
                  const mod = abilityMod(score);
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 pt-2 pb-1.5 px-1"
                    >
                      <DndIcon name={ABILITY_ICONS[key]} className="h-5 w-5 opacity-60 mb-0.5" />
                      <span className="text-base font-bold tabular-nums">{score}</span>
                      <span className="text-sm font-semibold tabular-nums text-primary">{fmt(mod)}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/40 mt-0.5">
                        {key.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        {saves && (
          <div>
            <OverlineLabel>Saving Throws</OverlineLabel>
            <div className="space-y-1">
              {ABILITY_KEYS.map((key) => {
                const score = abilities?.[key] ?? 10;
                const base = abilityMod(score);
                const proficient = saves[key]?.proficient ?? false;
                const total = base + (proficient ? profBonus : 0);
                return (
                  <div key={key} className="flex items-center gap-2 py-0.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                        proficient ? 'bg-amber-500 border-amber-500' : 'border-muted-foreground/30'
                      }`}
                    />
                    <DndIcon name={ABILITY_ICONS[key]} className="h-3.5 w-3.5 opacity-50 shrink-0" />
                    <span className={`flex-1 text-xs ${proficient ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                      {key.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs font-bold text-primary tabular-nums">{fmt(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer: senses / languages / resistances */}
      {(senses || languages || resistances) && (
        <div className="border-t border-amber-800/20 pt-4 space-y-1.5 text-xs text-muted-foreground">
          {senses && Object.entries(senses).length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Senses </span>
              {Object.entries(senses).map(([k, v]) => `${k} ${v}`).join(', ')}
            </p>
          )}
          {languages && languages.length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Languages </span>
              {languages.join(', ')}
            </p>
          )}
          {resistances?.damage && resistances.damage.length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Resistances </span>
              {resistances.damage.join(', ')}
            </p>
          )}
          {resistances?.conditions && resistances.conditions.length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Immune </span>
              {resistances.conditions.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "OverviewTab"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/sheet-tabs/OverviewTab.tsx
git commit -m "feat(character): add OverviewTab for expanded character sheet"
```

---

## Task 4: Create CombatTab

**Files:**
- Create: `src/components/character/sheet-tabs/CombatTab.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { DndIcon, DAMAGE_ICONS } from '@/components/ui/dnd-icon';
import { fmt, type CharacterSheetData, computeWeaponAttacks, computeSpellStats } from '../sheet-utils';

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface CombatTabProps {
  char: CharacterSheetData;
}

export function CombatTab({ char }: CombatTabProps) {
  const abilities = char.abilityScores;
  const profBonus = char.proficiencyBonus ?? 2;
  const weaponAttacks = computeWeaponAttacks(char.inventory, abilities, profBonus);
  const { spellSaveDC, spellAttackBonus } = computeSpellStats(char.spellcasting, abilities, profBonus);

  const attackCantrips = (char.spellcasting?.spells ?? [])
    .filter((s) => s.level === 0 && s.damage)
    .map((s) => ({ name: s.name, damage: s.damage as string, school: s.school }));

  const hasAttacks = weaponAttacks.length > 0 || attackCantrips.length > 0;

  return (
    <div className="space-y-5">
      {(spellSaveDC != null || spellAttackBonus != null) && (
        <div>
          <OverlineLabel>Spellcasting</OverlineLabel>
          <div className="flex gap-2">
            {spellSaveDC != null && (
              <div className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 py-2 px-4">
                <span className="text-base font-bold tabular-nums">{spellSaveDC}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5">Spell Save DC</span>
              </div>
            )}
            {spellAttackBonus != null && (
              <div className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 py-2 px-4">
                <span className="text-base font-bold tabular-nums">{fmt(spellAttackBonus)}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5">Spell Attack</span>
              </div>
            )}
          </div>
        </div>
      )}

      {hasAttacks && (
        <div>
          <OverlineLabel>Attacks</OverlineLabel>
          <div className="space-y-1.5">
            {weaponAttacks.map((atk) => (
              <div
                key={atk.name}
                className="flex items-center gap-3 rounded border border-border/40 px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium truncate">{atk.name}</span>
                <span className="font-mono text-sm font-bold text-primary shrink-0">
                  {atk.attackBonus >= 0 ? `+${atk.attackBonus}` : atk.attackBonus}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  {atk.damage}
                  {atk.damageType && DAMAGE_ICONS[atk.damageType.toLowerCase()] && (
                    <DndIcon
                      name={DAMAGE_ICONS[atk.damageType.toLowerCase()]}
                      className="h-3.5 w-3.5 opacity-70"
                    />
                  )}
                  {atk.damageType && !DAMAGE_ICONS[atk.damageType.toLowerCase()] && ` ${atk.damageType}`}
                </span>
              </div>
            ))}
            {attackCantrips.map((spell) => (
              <div
                key={spell.name}
                className="flex items-center gap-3 rounded border border-border/40 px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium truncate">{spell.name}</span>
                <span className="text-xs text-muted-foreground/60 shrink-0 italic">cantrip</span>
                <span className="text-xs text-muted-foreground shrink-0">{spell.damage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAttacks && spellSaveDC == null && (
        <p className="text-sm text-muted-foreground/50 italic">No attack data available.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "CombatTab"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/sheet-tabs/CombatTab.tsx
git commit -m "feat(character): add CombatTab for expanded character sheet"
```

---

## Task 5: Create SkillsTab

**Files:**
- Create: `src/components/character/sheet-tabs/SkillsTab.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { DndIcon, SKILL_ICONS } from '@/components/ui/dnd-icon';
import { abilityMod, fmt, type CharacterSheetData, type AbilityKey } from '../sheet-utils';

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface SkillsTabProps {
  char: CharacterSheetData;
}

export function SkillsTab({ char }: SkillsTabProps) {
  const abilities = char.abilityScores;
  const profBonus = char.proficiencyBonus ?? 2;
  const skills = char.proficiencies?.skills ?? [];

  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground/50 italic">No skill data available.</p>;
  }

  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <OverlineLabel>Skills</OverlineLabel>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0">
        {sorted.map((skill) => {
          const score = abilities?.[skill.ability as AbilityKey] ?? 10;
          const base = abilityMod(score);
          let total = base;
          if (skill.proficient) total += profBonus;
          if (skill.expertise) total += profBonus;
          return (
            <div key={skill.name} className="flex items-center gap-1.5 py-[3px]">
              <div
                className={`h-2 w-2 rounded-full border shrink-0 ${
                  skill.expertise
                    ? 'bg-amber-500 border-amber-500 ring-1 ring-amber-500/30'
                    : skill.proficient
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-muted-foreground/30'
                }`}
              />
              <span className="font-mono w-6 text-right text-xs tabular-nums font-semibold shrink-0 text-primary">
                {fmt(total)}
              </span>
              {SKILL_ICONS[skill.name] && (
                <DndIcon name={SKILL_ICONS[skill.name]} className="h-3 w-3 opacity-50 shrink-0" />
              )}
              <span
                className={`text-xs truncate ${
                  skill.proficient ? 'text-foreground' : 'text-muted-foreground/60'
                }`}
              >
                {skill.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "SkillsTab"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/sheet-tabs/SkillsTab.tsx
git commit -m "feat(character): add SkillsTab for expanded character sheet"
```

---

## Task 6: Create SpellsTab

**Files:**
- Create: `src/components/character/sheet-tabs/SpellsTab.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { type CharacterSheetData, type CharSpell } from '../sheet-utils';

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface SpellsTabProps {
  char: CharacterSheetData;
}

export function SpellsTab({ char }: SpellsTabProps) {
  const spellcasting = char.spellcasting;
  if (!spellcasting) {
    return <p className="text-sm text-muted-foreground/50 italic">No spellcasting data available.</p>;
  }

  const slots = spellcasting.slots ?? {};
  const spells = spellcasting.spells ?? [];

  const byLevel = spells.reduce<Record<number, CharSpell[]>>((acc, spell) => {
    const lvl = spell.level ?? 0;
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push(spell);
    return acc;
  }, {});

  const levels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {/* Spell slots */}
      {Object.keys(slots).length > 0 && (
        <div>
          <OverlineLabel>Spell Slots</OverlineLabel>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
              const slot = slots[lvl] ?? slots[String(lvl)];
              if (!slot) return null;
              const used = slot.used ?? 0;
              const total = slot.total ?? 0;
              const remaining = total - used;
              return (
                <div
                  key={lvl}
                  className={`flex flex-col items-center rounded border px-3 py-1.5 ${
                    remaining === 0
                      ? 'border-muted/20 bg-muted/5 opacity-40'
                      : 'border-amber-800/25 bg-amber-950/15'
                  }`}
                >
                  <span className="text-sm font-bold tabular-nums">{remaining}/{total}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
                    Lvl {lvl}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spell list */}
      {levels.map((lvl) => (
        <div key={lvl}>
          <OverlineLabel>{lvl === 0 ? 'Cantrips' : `Level ${lvl}`}</OverlineLabel>
          <div className="space-y-1">
            {(byLevel[lvl] ?? []).map((spell) => (
              <div
                key={spell.name}
                className="flex items-center gap-2 rounded border border-border/30 px-3 py-1.5"
              >
                <span className="flex-1 text-sm font-medium truncate">{spell.name}</span>
                {spell.concentration && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600/60 shrink-0">
                    Conc
                  </span>
                )}
                {spell.damage && (
                  <span className="text-xs text-muted-foreground shrink-0">{spell.damage}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {levels.length === 0 && (
        <p className="text-sm text-muted-foreground/50 italic">No spells known.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "SpellsTab"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/sheet-tabs/SpellsTab.tsx
git commit -m "feat(character): add SpellsTab for expanded character sheet"
```

---

## Task 7: Create CharacterSheetDrawer

**Files:**
- Create: `src/components/character/CharacterSheetDrawer.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Users, Pin, PinOff, Maximize2, Minimize2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { usePinnedCharacters } from '@/store/pinned-characters-store';
import { DndIcon, CLASS_ICONS, DAMAGE_ICONS } from '@/components/ui/dnd-icon';
import { OverviewTab } from './sheet-tabs/OverviewTab';
import { CombatTab } from './sheet-tabs/CombatTab';
import { SkillsTab } from './sheet-tabs/SkillsTab';
import { SpellsTab } from './sheet-tabs/SpellsTab';
import {
  fmt,
  abilityMod,
  ABILITY_KEYS,
  computeWeaponAttacks,
  type CharacterSheetData,
} from './sheet-utils';

function Portrait({ url, name, size }: { url: string | null; name: string; size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  return (
    <div className={`relative ${dim} shrink-0 rounded overflow-hidden border border-amber-800/30`}>
      {url ? (
        <Image src={url} alt={name} fill className="object-cover object-top" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-amber-950/30">
          <Users className="h-5 w-5 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}

interface CompactBodyProps {
  char: CharacterSheetData;
  onExpand: () => void;
  isPinned: boolean;
  onPin: () => void;
  onClose: () => void;
}

function CompactBody({ char, onExpand, isPinned, onPin, onClose }: CompactBodyProps) {
  const abilities = char.abilityScores;
  const hp = char.hitPoints;
  const profBonus = char.proficiencyBonus ?? 2;
  const initiative = abilities ? abilityMod(abilities.dex ?? 10) : null;
  const passivePerc = 10 + (abilities ? abilityMod(abilities.wis ?? 10) : 0);
  const weaponAttacks = computeWeaponAttacks(char.inventory, abilities, profBonus);
  const attackCantrips = (char.spellcasting?.spells ?? [])
    .filter((s) => s.level === 0 && s.damage)
    .map((s) => ({ name: s.name, damage: s.damage as string }));

  const classLine = [char.class, char.subclass].filter(Boolean).join(' / ');
  const identity = [char.race, classLine ? `${classLine} · Lvl ${char.level}` : `Lvl ${char.level}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border/50">
        <Portrait url={char.portraitUrl} name={char.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate leading-tight">{char.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{identity}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className={cn('h-7 w-7 shrink-0', isPinned ? 'text-amber-400' : 'text-muted-foreground')}
          onClick={onPin}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Vitals row */}
      <div className="grid grid-cols-4 gap-1 p-3 pb-0">
        <div className="col-span-2 flex flex-col items-center rounded border border-red-900/40 bg-red-950/20 py-1.5 px-1">
          <span className="text-sm font-bold tabular-nums text-red-400">
            {hp ? `${hp.current}/${hp.max}` : '—'}
          </span>
          {hp?.temp ? (
            <span className="text-[8px] text-amber-400/70">+{hp.temp} temp</span>
          ) : null}
          <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/50">HP</span>
        </div>
        {[
          { label: 'AC', value: char.armorClass ?? '—' },
          { label: 'Init', value: initiative != null ? fmt(initiative) : '—' },
          { label: 'Perc', value: passivePerc },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 py-1.5 px-1">
            <span className="text-sm font-bold tabular-nums">{value}</span>
            <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Attacks */}
      {(weaponAttacks.length > 0 || attackCantrips.length > 0) && (
        <div className="p-3 pt-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-amber-600/60 mb-1.5">Attacks</p>
          <div className="space-y-1">
            {weaponAttacks.map((atk) => (
              <div key={atk.name} className="flex items-center gap-2 rounded border border-border/30 px-2 py-1">
                <span className="flex-1 text-xs font-medium truncate">{atk.name}</span>
                <span className="font-mono text-xs font-bold text-primary shrink-0">
                  {atk.attackBonus >= 0 ? `+${atk.attackBonus}` : atk.attackBonus}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  {atk.damage}
                  {atk.damageType && DAMAGE_ICONS[atk.damageType.toLowerCase()] && (
                    <DndIcon name={DAMAGE_ICONS[atk.damageType.toLowerCase()]} className="h-3 w-3 opacity-60" />
                  )}
                </span>
              </div>
            ))}
            {attackCantrips.map((spell) => (
              <div key={spell.name} className="flex items-center gap-2 rounded border border-border/30 px-2 py-1">
                <span className="flex-1 text-xs font-medium truncate">{spell.name}</span>
                <span className="text-[11px] text-muted-foreground">{spell.damage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand bar */}
      <button
        onClick={onExpand}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-border/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/5 transition-colors"
      >
        <span>Full Sheet</span>
        <Maximize2 className="h-3 w-3" />
      </button>
    </>
  );
}

interface ExpandedBodyProps {
  char: CharacterSheetData;
  onCollapse: () => void;
  isPinned: boolean;
  onPin: () => void;
  onClose: () => void;
}

function ExpandedBody({ char, onCollapse, isPinned, onPin, onClose }: ExpandedBodyProps) {
  const [tab, setTab] = useState('overview');
  const hasSpells = !!char.spellcasting;

  const classLine = [char.class, char.subclass].filter(Boolean).join(' / ');
  const identity = [
    char.race,
    classLine ? `${classLine} · Level ${char.level}` : `Level ${char.level}`,
    char.background,
  ]
    .filter(Boolean)
    .join(' · ');

  const user = char.user;
  const playerName = user?.displayName ?? user?.name ?? null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
        <Portrait url={char.portraitUrl} name={char.name} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-base leading-tight truncate">{char.name}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
            {char.class && CLASS_ICONS[char.class] && (
              <DndIcon name={CLASS_ICONS[char.class]} className="h-3.5 w-3.5 opacity-60 shrink-0" />
            )}
            {identity}
          </p>
          {playerName && (
            <p className="text-[11px] text-amber-600/60 mt-0.5">{playerName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className={cn('h-8 gap-1.5 text-xs', isPinned ? 'text-amber-400' : 'text-muted-foreground')}
            onClick={onPin}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isPinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={onCollapse}>
            <Minimize2 className="h-3.5 w-3.5" />
            Collapse
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent h-auto px-5 gap-0">
          {['overview', 'combat', 'skills', ...(hasSpells ? ['spells'] : [])].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:text-amber-400 text-xs uppercase tracking-wider font-semibold px-4 py-2.5"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto p-5">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab char={char} />
          </TabsContent>
          <TabsContent value="combat" className="mt-0">
            <CombatTab char={char} />
          </TabsContent>
          <TabsContent value="skills" className="mt-0">
            <SkillsTab char={char} />
          </TabsContent>
          {hasSpells && (
            <TabsContent value="spells" className="mt-0">
              <SpellsTab char={char} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </>
  );
}

export function CharacterSheetDrawer() {
  const { activeSheet, closeSheet, expandSheet, collapseSheet, isPinned, pin, unpin } =
    usePinnedCharacters();

  const isExpanded = activeSheet?.isExpanded ?? false;

  const { data, isLoading } = trpc.characters.getCharacterSheet.useQuery(
    {
      characterId: activeSheet?.characterId ?? '',
      campaignId: activeSheet?.campaignId ?? '',
    },
    { enabled: !!activeSheet, staleTime: 120_000 }
  );

  const char = data as CharacterSheetData | undefined;
  const pinned = activeSheet ? isPinned(activeSheet.characterId) : false;

  function handlePin() {
    if (!activeSheet) return;
    if (pinned) {
      unpin(activeSheet.characterId);
    } else {
      pin(activeSheet);
    }
  }

  return (
    <Sheet open={!!activeSheet} onOpenChange={(open) => { if (!open) closeSheet(); }}>
      <SheetContent
        className={cn(
          'w-full p-0 flex flex-col gap-0 overflow-hidden',
          isExpanded ? 'sm:max-w-[85vw]' : 'sm:max-w-[400px]'
        )}
        style={{ transition: 'max-width 300ms ease-in-out' }}
      >
        {isLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {char && !isExpanded && (
          <CompactBody
            char={char}
            onExpand={expandSheet}
            isPinned={pinned}
            onPin={handlePin}
            onClose={closeSheet}
          />
        )}
        {char && isExpanded && (
          <ExpandedBody
            char={char}
            onCollapse={collapseSheet}
            isPinned={pinned}
            onPin={handlePin}
            onClose={closeSheet}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify Tabs component exists in shadcn**

```bash
ls src/components/ui/tabs.tsx
```

If it doesn't exist, add it:

```bash
npx shadcn@latest add tabs
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "charactersheetdrawer\|sheet-utils\|overviewtab\|combattab\|skillstab\|spellstab" | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/character/CharacterSheetDrawer.tsx
git commit -m "feat(character): add two-state CharacterSheetDrawer with compact and expanded modes"
```

---

## Task 8: Update PinnedCharacterFlags to use CharacterSheetDrawer

**Files:**
- Modify: `src/components/character/PinnedCharacterFlags.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { usePinnedCharacters } from '@/store/pinned-characters-store';
import { CharacterSheetDrawer } from '@/components/character/CharacterSheetDrawer';

export function PinnedCharacterFlags() {
  const { pinned, openSheet, unpin } = usePinnedCharacters();

  return (
    <>
      <CharacterSheetDrawer />

      {pinned.length > 0 && (
        <div
          className="fixed right-0 z-40 flex flex-col gap-1.5 pointer-events-none"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          {pinned.map((char) => (
            <div key={char.characterId} className="group relative pointer-events-auto">
              <button
                onClick={() => openSheet(char)}
                className="flex items-center justify-center w-11 h-[52px] rounded-l-xl border border-r-0 border-amber-800/35 bg-[hsl(240,10%,8%)] hover:bg-[hsl(240,10%,11%)] hover:border-amber-700/50 transition-all duration-150 shadow-[-2px_0_8px_rgba(0,0,0,0.4)]"
                title={char.name}
              >
                {char.portraitUrl ? (
                  <div className="relative h-8 w-8 rounded-full overflow-hidden border border-amber-800/40 shrink-0">
                    <Image
                      src={char.portraitUrl}
                      alt={char.name}
                      fill
                      className="object-cover object-top"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full border border-amber-800/30 bg-amber-950/40 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-600/80 font-display">
                      {char.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </button>

              <div className="absolute right-11 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap">
                <div className="rounded-l-md border border-r-0 border-amber-800/35 bg-[hsl(240,10%,8%)] px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-[-2px_0_8px_rgba(0,0,0,0.4)]">
                  {char.name}
                </div>
              </div>

              <button
                onClick={() => unpin(char.characterId)}
                className="absolute -top-1 -left-1.5 h-4 w-4 rounded-full bg-[hsl(240,10%,14%)] border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80 hover:border-destructive/60"
                title="Unpin"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "PinnedCharacterFlags" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/PinnedCharacterFlags.tsx
git commit -m "feat(character): wire PinnedCharacterFlags to use CharacterSheetDrawer"
```

---

## Task 9: Remove PlayerCharacterCard and verify build

**Files:**
- Delete: `src/components/character/PlayerCharacterCard.tsx`

- [ ] **Step 1: Confirm no remaining imports**

```bash
grep -r "PlayerCharacterCard" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: no output (the file is no longer imported anywhere).

- [ ] **Step 2: Delete the file**

```bash
rm src/components/character/PlayerCharacterCard.tsx
```

- [ ] **Step 3: Full type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(character): replace PlayerCharacterCard with two-state CharacterSheetDrawer"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```
