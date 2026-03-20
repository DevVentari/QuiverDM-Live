# QuiverDM Spell Cards — Design Spec

**Goal:** A dual-state spell card component — collapsed for mid-combat quick reference, expanded for full spellbook detail.

**Status:** Design approved. Ready for implementation.

---

## States

### Collapsed (combat quick-reference)
Minimal — key stats at a glance, single line summary.

Layout (top to bottom):
1. **Row 1:** Spell name (Cinzel 700 14px) + level/school badge (pill, school colour)
2. **Row 2:** Stat chips — casting time icon, range icon, duration
3. **Summary line:** One-liner (damage dice, effect, save type) — truncated with ellipsis

### Expanded (spellbook detail)
Full — everything a caster needs to know.

Layout (top to bottom):
1. **Header:** Name (Cinzel 16px) + school label + level badge
2. **Stat grid:** 2×2 — Casting Time, Range, Duration, Save/Concentration
3. **Component badges:** V / S / M as individual badges (active = amber, inactive = dimmed) + material description inline
4. **Description:** Body text, key damage/effect bolded in amber
5. **Upcast box:** Purple-tinted container, only shown if spell has "At Higher Levels" text

---

## School Colour System

Each school has a `--school-color` (text/border) and `--school-bg` (badge/tint fill):

| School | Color | Background |
|--------|-------|------------|
| Evocation | `hsl(0, 65%, 55%)` red | `hsl(0, 50%, 15%)` |
| Illusion | `hsl(260, 55%, 62%)` purple | `hsl(260, 40%, 18%)` |
| Necromancy | `hsl(140, 40%, 38%)` green | `hsl(140, 30%, 12%)` |
| Abjuration | `hsl(200, 60%, 50%)` blue | `hsl(200, 40%, 14%)` |
| Conjuration | `hsl(40, 70%, 50%)` amber | `hsl(40, 50%, 12%)` |
| Divination | `hsl(180, 50%, 45%)` teal | `hsl(180, 35%, 12%)` |
| Enchantment | `hsl(320, 50%, 55%)` pink | `hsl(320, 35%, 14%)` |
| Transmutation | `hsl(80, 45%, 42%)` olive | `hsl(80, 30%, 12%)` |

Applied as a 3px left-edge accent bar on the card (`::before` pseudo-element).

---

## Structure

```tsx
<SpellCard
  spell={spell}           // Spell data object
  variant="collapsed" | "expanded"
  onToggle={() => void}   // Switch between states
/>
```

### Spell data shape
```typescript
interface Spell {
  name: string
  level: number | 'cantrip'
  school: SpellSchool
  castingTime: string       // "1 Action", "Bonus Action", "Reaction", etc.
  range: string             // "150 ft", "Self", "Touch", etc.
  duration: string          // "Instantaneous", "1 Minute", "Concentration, up to 1 hour"
  concentration: boolean
  components: {
    verbal: boolean
    somatic: boolean
    material: boolean
    materialDesc?: string
  }
  description: string       // Full text, supports **bold** markdown for key values
  higherLevels?: string     // "At Higher Levels" text, optional
  save?: string             // "DEX · Half", "CON · Negate", etc.
  classes: string[]         // ["Wizard", "Sorcerer"]
}
```

---

## Visual Details

- **Card background:** `--stone-bg` gradient (`hsl(240 10% 11%)` → `hsl(240 8% 8%)`)
- **Card border:** `--border` (`hsl(35, 35%, 20%)`)
- **Inset highlight:** `inset 0 1px 0 hsl(35 60% 50% / 0.08)`
- **Border radius:** `3px` (matches app `--radius`)
- **Stat grid background:** `hsl(240 10% 7%)` — slightly darker inset panel
- **Upcast box:** `hsl(260 30% 10%)` bg, `hsl(260 30% 22%)` border, `--purple` label
- **Key values in description:** `font-weight: 600`, `color: var(--amber-light)`
- **Level badge:** pill shape, `border-radius: 99px`, school colour bg/border/text

---

## Implementation Notes

- Collapsed → Expanded transition: animate card height with CSS `grid-rows` or `max-height` trick
- Tap/click anywhere on collapsed card expands it
- Expanded has explicit close affordance (chevron or ✕)
- Component badges V/S/M always rendered; inactive ones are dimmed (not hidden)
- Material description only shown when M is active
- `higherLevels` section only rendered when field is present
- Cantrips: level badge shows "Cantrip" not "0th"

---

## Reference

Prototype: `E:/Projects/QuiverDM/.superpowers/brainstorm/423867-1773817223/spell-cards-v1.html`
