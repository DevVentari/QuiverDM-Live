# QuiverDM Magic Item Cards — Design Spec

**Goal:** A single-state magic item card that always shows the full effect, with rarity driving the visual treatment.

**Status:** Design approved. Ready for implementation.

---

## Design Philosophy

Magic items differ from spells and stat blocks — there is no collapsed/expanded toggle. The full effect is always visible. The card is reference material, not a mid-combat HUD. Rarity is the primary visual variable.

---

## Single Card Layout

Structure (top to bottom):
1. **Header row** — item name (Cinzel 700 14px) + rarity badge (pill, top-right)
2. **Meta row** — item type chip (icon + label) + attunement badge (if required)
3. **Effect text** — full description, key values bolded in rarity colour
4. **Charges row** — pip track + reset note (only if item has charges)
5. **Lore section** — dark inset panel, italic flavour text (always present)

---

## Rarity System

Each rarity drives `--rc` (colour) and `--rb` (badge/pip background). Legendary and Artifact also get a glow via `--rg`.

| Rarity | Colour | Background | Glow (`--rg`) |
|--------|--------|-----------|------|
| Common | `hsl(35,10%,55%)` muted amber | `hsl(35,8%,14%)` | none |
| Uncommon | `hsl(120,40%,46%)` green | `hsl(120,25%,12%)` | none |
| Rare | `hsl(210,65%,58%)` blue | `hsl(210,40%,14%)` | none |
| Very Rare | `hsl(270,55%,62%)` purple | `hsl(270,35%,16%)` | none |
| Legendary | `hsl(38,90%,58%)` gold | `hsl(38,60%,13%)` | `0 0 12px hsl(38 90% 50% / 0.2)` |
| Artifact | `hsl(42,100%,62%)` bright gold | `hsl(42,70%,12%)` | `0 0 20px hsl(42 100% 55% / 0.25), 0 0 40px hsl(42 100% 50% / 0.1)` |

The full card `box-shadow` is:
```css
box-shadow: var(--stone-inset), var(--rg, 0 4px 16px hsl(240 10% 4% / 0.4));
```
The `--rg` fallback `0 4px 16px hsl(240 10% 4% / 0.4)` is the standard card shadow used by all non-glowing rarities.

Applied as:
- 3px left-edge accent bar (`::before` pseudo-element, same pattern as spell cards)
- Rarity badge (pill, `--rb` background, `--rc` text, `1px solid var(--rc)` border at full opacity)
- Bold values in effect text (`color: var(--rc)`)
- Pip borders and filled state for charges

---

## DOM Structure

The rarity class (e.g. `r-rare`) goes on a **wrapper div** outside `.item-card`. The `::before` bar and `--rg` glow are on `.item-card` itself, which inherits the CSS variables from the rarity wrapper. This matters for Artifact's border override:

```html
<div class="r-artifact">          <!-- rarity wrapper: sets --rc, --rb, --rg -->
  <div class="item-card">         <!-- card: uses the variables, gets border-color override -->
    <div class="card-inner">...</div>
    <div class="card-lore">...</div>
  </div>
</div>
```

Artifact border override selector: `.r-artifact .item-card { border-color: hsl(42,60%,28%); }`

---

## Component Structure

```tsx
<MagicItemCard
  item={item}
/>
```

### Item data shape
```typescript
interface MagicItem {
  name: string
  rarity: 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact'
  type: string               // "Wondrous Item", "Weapon · Sword", "Wand", "Armour · Plate", etc.
  attunement?: boolean
  attunementNote?: string    // "Spellcaster", "Paladin", "by a creature of evil alignment", etc.
                             // The component renders: "Attunement · {attunementNote}" using " · " as separator
  description: string        // Full text, supports **bold** for key values
  charges?: {
    max: number
    current?: number         // Display state — defaults to max if omitted
    reset: string            // "at dawn", "weekly", "never (destroyed when depleted)"
  }
  lore: string               // Flavour text, always present — not optional
}
```

---

## Visual Details

- **Card background:** `--stone-bg` gradient (`hsl(240 10% 11%)` → `hsl(240 8% 8%)`)
- **Card border:** `--border` (`hsl(35,35%,20%)`)
- **Inset highlight:** `inset 0 1px 0 hsl(35 60% 50% / 0.08)`
- **Border radius:** `3px` (matches app `--radius`)
- **Card shadow:** `var(--stone-inset), var(--rg, 0 4px 16px hsl(240 10% 4% / 0.4))`
- **Artifact:** `border-color: hsl(42,60%,28%)` via `.r-artifact .item-card` selector

### Card Inner Padding
Card inner padding is asymmetric: `10px 12px 10px 16px` — the extra 4px on the left clears the 3px accent bar. Lore section uses the same asymmetry: `8px 12px 9px 16px`.

### Rarity Badge
- Pill shape (`border-radius: 99px`)
- 9px, uppercase, weight 700
- `--rb` background, `--rc` text, `1px solid var(--rc)` border (full opacity)

### Meta Chip
- Font size: 10px
- `var(--text-muted)` colour
- Icon (SVG, 11×11px) + label text, 3px gap

### Attunement Badge
- Square-ish pill (`border-radius: 2px`)
- 9px, uppercase, weight 600
- Fixed purple treatment: `hsl(260 30% 12%)` bg, `hsl(260,45%,62%)` text, `hsl(260,30%,22%)` border
- When `attunement` is true and no note: label is `"Attunement"`
- When `attunementNote` is present: label is `"Attunement · {attunementNote}"` (` · ` separator, middle dot U+00B7)

### Effect Text
- 12px, `var(--text)`, line-height 1.6
- Key values (dice, numbers, conditions) rendered as `<strong>` — scoped: `.item-card .card-effect strong { color: var(--rc); font-weight: 600; }`
- This must be scoped to `.item-card` to avoid conflicting with spell card `strong` styles (which use `--amber-light`)

### Charges Row
- Only rendered when `charges` is present
- Label: 9px uppercase muted ("Charges")
- Pips: 10×10px circles, `border: 1px solid var(--rc)`, filled = `background: var(--rc)`, empty = `background: var(--rb)`
- Reset note: 9px italic muted, right-aligned (`margin-left: auto`)

### Lore Section
- Separated from card inner by `1px solid var(--border)`
- Background: `hsl(240 10% 7%)` — slightly darker than card
- Padding: `8px 12px 9px 16px` (16px left to clear accent bar)
- Label: 9px uppercase muted ("Lore")
- Text: 11px, `hsl(35 12% 60%)`, italic, line-height 1.6

---

## Implementation Notes

- `description` markdown support: parse `**text**` → `<strong>text</strong>`. The `color: var(--rc)` rule must be scoped to `.item-card .card-effect strong` — not a global `strong` selector.
- Charges `current` is display state only — actual current value comes from encounter/inventory state, not item data.
- Artifact variant is spec-defined but not prototype-verified (no example in the mockup). The CSS values are derived from the rarity table; trust the table.
- Type chip uses the same icon + label pattern as spell/monster meta chips — reuse the same SVG set.

---

## Reference

Prototype: `E:/Projects/QuiverDM/.superpowers/brainstorm/423867-1773817223/magic-items-v1.html`

Note: prototype covers Common through Legendary with examples. Artifact rarity is CSS-defined but has no rendered example in the prototype.
