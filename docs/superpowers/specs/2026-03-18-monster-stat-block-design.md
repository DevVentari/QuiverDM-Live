# QuiverDM Monster / NPC Stat Block — Design Spec

**Goal:** Dual-mode stat block — compact combat drawer and full bestiary page — for the same monster/NPC entity.

**Status:** Design approved. Ready for implementation.

---

## Two Modes

### Combat Drawer
Slides up as a sheet over the current screen (encounter view). Stays in context — DM doesn't leave the encounter.

Structure (top to bottom):
1. **Drag handle** — 32px wide pill, signals swipe-to-dismiss
2. **Header** — name (Cinzel 700 15px) + meta line (size/type/alignment) + CR badge (top-right)
3. **Vitals row** — 3-column grid: HP (red), AC, Speed
4. **Ability scores** — 6-column grid (STR/DEX/CON/INT/WIS/CHA), score + modifier
5. **Actions** — name + type label + to-hit/damage inline (no traits, no senses)

### Full Bestiary Page
Full-screen dedicated view. Accessed from bestiary browser or tapping monster name outside combat.

Structure (top to bottom):
1. **Hero header** — name (Cinzel 18px) + meta + tag row (CR, type, alignment)
2. **Vitals section** — HP/AC/Speed grid + passive perception, senses, languages
3. **Ability scores** — same 6-column grid
4. **Actions section** — full text with to-hit and damage bolded
5. **Traits section** — italic trait name + description
6. **Bonus Actions** — if present
7. **Reactions** — if present
8. **Legendary Actions** — if present (boss monsters)

---

## Component Structure

```tsx
<MonsterStatBlock
  monster={monster}
  mode="drawer" | "full"
  onClose={() => void}        // drawer only
/>
```

### Monster data shape
```typescript
interface Monster {
  name: string
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'
  type: string                  // "Giant", "Undead", "Beast", etc.
  alignment: string
  cr: number | string           // 0.125, 0.25, 0.5, 1–30
  xp: number
  ac: number
  acNote?: string               // "hide armour", "natural armour"
  hp: number
  hpDice: string                // "7d10+21"
  speed: string                 // "40 ft", "30 ft, fly 60 ft"
  abilities: {
    str: number; dex: number; con: number
    int: number; wis: number; cha: number
  }
  savingThrows?: Partial<Record<AbilityKey, number>>
  skills?: Record<string, number>
  damageImmunities?: string[]
  damageResistances?: string[]
  conditionImmunities?: string[]
  senses: string               // "Darkvision 60 ft"
  passivePerception: number
  languages: string
  traits?: Trait[]
  actions: Action[]
  bonusActions?: Action[]
  reactions?: Action[]
  legendaryActions?: { count: number; actions: Action[] }
}

interface Action {
  name: string
  type?: string                // "Melee Weapon Attack", "Ranged Weapon Attack", "Multiattack"
  toHit?: number
  reach?: string
  range?: string
  targets?: string
  damage?: string              // "2d8+4 bludgeoning"
  description: string
}
```

---

## Visual Details

### Colours
- **HP value:** `hsl(0, 60%, 62%)` — red, distinct from amber (tracks damage)
- **To-hit / damage rolls:** `var(--amber-light)` + `font-weight: 600` — jump out in combat scan
- **CR badge:** amber border/bg/text (same as amber pill pattern)
- **Section labels:** amber overline style (9px, uppercase, letter-spacing .14em)
- **Action type label:** `var(--text-muted)`, uppercase, 9px — secondary to action name

### Ability Score Boxes
- Background: `hsl(240 10% 7%)` (darker inset)
- Border: `var(--border)`
- Abbreviation: amber, 8px, bold
- Score: 13px, semi-bold
- Modifier: 9px, muted — negative modifiers use `−` (minus sign, not hyphen)

### Vitals Grid (3-col)
- Each cell: same inset box as ability scores
- Label: 8px uppercase muted
- Value: 14px bold, colour by type (red for HP, amber-light for others)
- Sub-line: 9px muted (hit dice, armour type)

### Drawer specifics
- Border-radius: `6px 6px 3px 3px` (rounded top, square bottom — sheet feel)
- Top shadow: `0 -4px 20px hsl(240 10% 4% / 0.6)`
- Sections divided by `var(--border)` horizontal rules
- No traits, no senses/languages — combat-only info

### Full page specifics
- Hero header background: `hsl(240 10% 10%)` — slightly lifted from card bg
- Tags: pill badges (CR amber, type + alignment neutral)
- Traits: italic name inline with description (Monster Manual style)
- Legendary Actions: count shown in section header ("3/round")

---

## Legendary Actions (boss monsters)
Section appears only when `legendaryActions` is present. Header shows: "Legendary Actions · 3/round". Each action listed with cost in brackets e.g. `[2]` for 2-action cost.

---

## Live HP Tracker (drawer — future enhancement)
Drawer HP display can become interactive: tap to open a damage/heal input. Current HP tracked in encounter state, not monster data. Out of scope for this spec — flag for encounter system design.

---

## Reference
Prototype: `E:/Projects/QuiverDM/.superpowers/brainstorm/423867-1773817223/monster-stat-v1.html`
