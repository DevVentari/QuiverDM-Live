# Player Character Sheet — Two-State Sheet Design

**Date:** 2026-05-05  
**Status:** Approved

## Overview

Replace the current single-state `PlayerCharacterCard` sheet with a two-state expandable sheet. The compact state serves as a quick mid-session reference (pinned flag tabs on the right edge of the screen). The expanded state reveals a full tabbed character sheet without navigating away from the current page.

---

## Architecture

### State Management

Extend the existing `usePinnedCharacters` Zustand store (`src/store/pinned-characters-store.ts`) with an `isExpanded` flag on `activeSheet`:

```ts
activeSheet: {
  characterId: string;
  campaignId: string;
  name: string;
  portraitUrl: string | null;
  isExpanded: boolean;  // NEW
} | null;
```

Add actions:
- `expandSheet()` — sets `isExpanded: true`
- `collapseSheet()` — sets `isExpanded: false`

No new routes. No new Zustand stores.

### Component Structure

```
PinnedCharacterFlags (existing, src/components/character/PinnedCharacterFlags.tsx)
└── CharacterSheetDrawer (new, src/components/character/CharacterSheetDrawer.tsx)
    ├── CompactSheetBody      (compact state, inline in CharacterSheetDrawer)
    └── ExpandedSheetBody     (expanded state, inline in CharacterSheetDrawer)
        ├── OverviewTab
        ├── CombatTab
        ├── SkillsTab
        └── SpellsTab         (conditional — only rendered if character has spellcasting)
```

The Sheet component's `className` on `SheetContent` switches between `sm:max-w-[400px]` (compact) and `sm:max-w-[85vw] max-w-full` (expanded) driven by `isExpanded`. Framer Motion `AnimatePresence` + `motion.div` handles the width transition on the inner content container.

---

## Data

The existing `trpc.characters.getCharacterSheet` query is used in both states — it's already fetched when the sheet opens. No additional queries needed. All tab content derives from the single character object.

Fields used per tab:

| Tab | Fields |
|-----|--------|
| Compact | `hitPoints`, `armorClass`, `abilityScores` (DEX for init), `proficiencyBonus`, `senses` (passive perc), `inventory` (equipped+damage), `spellcasting.spells` (level 0 attack cantrips) |
| Overview | All compact fields + `savingThrows`, `speed`, `spellcasting.ability` (Spell DC/Atk), `languages`, `resistances` |
| Combat | `inventory` (equipped weapons), `spellcasting` (DC, atk bonus), `spellcasting.spells` (level 0 damage cantrips) |
| Skills | `proficiencies.skills`, `abilityScores`, `proficiencyBonus` |
| Spells | `spellcasting.slots`, `spellcasting.spells` grouped by level |

---

## Compact State (~400px wide)

Shown when `isExpanded: false`. This is what DMs see mid-session from the flag tabs.

**Header row:**
- 40×40px portrait (or placeholder icon)
- Character name + subtitle (race · class level · player name)
- Pin button (amber when pinned, muted when not)
- Close (✕) button

**Body:**
- Vitals row: HP (red tint), AC, Initiative, Passive Perception — 4 chips in a row
- Divider
- "Attacks" overline label
- Attack rows: name | to-hit bonus (amber, mono) | damage + type — for all equipped weapons with damage and all level-0 attack cantrips

**Footer:**
- "Full Sheet ⤢" bar — full-width clickable row, calls `expandSheet()`

---

## Expanded State (~85vw wide)

Shown when `isExpanded: true`. Same Sheet, animated width change.

**Header row:**
- Larger portrait (48×48px)
- Name + full identity line (race · class · level · background)
- Pin button — "Pinned" (amber) or "Pin" (muted) depending on state
- "⤡ Collapse" button — calls `collapseSheet()`
- Close (✕) button

**Tabs:** Overview · Combat · Skills · Spells (Spells tab hidden if `spellcasting` is null)

### Overview Tab

Two-column layout:

**Left column:**
- VITALS section: HP, AC, Speed, Initiative — 4 chips
- ABILITY SCORES section: 3×2 grid, each cell shows mod (amber, large) + raw score + abbreviated name. DnD icon above score.

**Right column:**
- SAVING THROWS section: list of 6 saves with proficiency dot (amber = proficient), save name, total modifier
- KEY STATS section: Prof Bonus, Passive Perception, Spell Save DC, Spell Attack Bonus — 4 chips (DC and Atk only shown if spellcaster)

**Footer bar** (full width, below both columns):
- Languages · Senses · Damage Resistances · Condition Immunities — inline pill lists

### Combat Tab

- ATTACKS section: table-style rows — weapon/cantrip name, attack bonus, damage dice + type, damage type icon
- Spell stats row (if spellcaster): Spell Save DC, Spell Attack Bonus

### Skills Tab

- Two-column grid of all 18 skills
- Each row: proficiency dot (filled=proficient, double-ring=expertise, empty=none) | modifier (mono, amber) | DnD skill icon | skill name
- Sorted alphabetically

### Spells Tab

- Spell slots grid: 9 level badges showing `used/total` (greyed if no slots at that level)
- Spell list grouped by level (Cantrips, Level 1, Level 2…)
- Each spell row: name | school icon | concentration indicator | damage/effect summary

---

## Animation

```tsx
// Width transition on the SheetContent wrapper
<SheetContent
  className={cn(
    'transition-[max-width] duration-300 ease-in-out',
    isExpanded ? 'sm:max-w-[85vw] max-w-full' : 'sm:max-w-[400px]'
  )}
>
```

Tab switching uses `AnimatePresence` with a simple `opacity` + `y` fade-up (100ms). No slide animations on tabs — keeps it snappy for mid-session use.

---

## Existing Code Changes

| File | Change |
|------|--------|
| `src/store/pinned-characters-store.ts` | Add `isExpanded` to `activeSheet`, add `expandSheet` / `collapseSheet` actions |
| `src/components/character/PinnedCharacterFlags.tsx` | Replace inline Sheet JSX with `<CharacterSheetDrawer>` component; pass `isExpanded`, `onExpand`, `onCollapse` from store |
| `src/components/character/PlayerCharacterCard.tsx` | Rename/repurpose: extract compact body and expanded body into separate sub-components |

## New Files

| File | Purpose |
|------|---------|
| `src/components/character/CharacterSheetDrawer.tsx` | Main two-state Sheet component, reads store, renders compact or expanded |
| `src/components/character/sheet-tabs/OverviewTab.tsx` | Overview tab content |
| `src/components/character/sheet-tabs/CombatTab.tsx` | Combat tab content |
| `src/components/character/sheet-tabs/SkillsTab.tsx` | Skills tab content |
| `src/components/character/sheet-tabs/SpellsTab.tsx` | Spells tab content (conditional) |

---

## Out of Scope

- Editing character data from the sheet (read-only, DDB is the source of truth)
- A dedicated full-page route for character details
- Player-facing character view (DM-only app)
- HP tracking / live updates (future feature)
