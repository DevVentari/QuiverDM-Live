# QuiverDM Logo System — Design Spec

**Goal:** A dynamic 4-variant logo system where the displayed variant is determined by a d20 roll, reinforcing the D&D identity at every interaction.

**Status:** Design approved. Ready for implementation.

---

## Symbol

**Heater shield** containing a **quiver of arrows** (3 arrows protruding from top).

- Shield: classic heraldic heater shape with inner border detail
- Quiver: rounded cylinder, centred in shield
- Arrows: 3 arrows at varied heights with arrowhead tips visible above quiver rim
- Fonts: `Cinzel` (wordmark, serif display) + `Bricolage Grotesque` (UI body)

---

## Colour Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--amber` | `hsl(35, 80%, 48%)` | Shield border, arrow tips, primary brand |
| `--amber-light` | `hsl(35, 80%, 62%)` | Arrow shafts, wordmark |
| `--amber-gold` | `hsl(40, 80%, 55%)` | Gilded variant borders |
| `--amber-gold-bright` | `hsl(40, 90%, 68%)` | Gilded variant arrows |
| `--purple` | `hsl(260, 50%, 55%)` | Arcane/Standard accent |
| `--purple-dim` | `hsl(260, 45%, 22%)` | Quiver fill (Arcane variant) |
| `--bg` | `hsl(240, 10%, 6%)` | App background |

---

## The 4 Variants

### Gilded — Session Start (always)
Shown **once per session** on load. Full gold, no purple. Signals the session beginning.

- Shield fill: `hsl(40, 60%, 14%)`
- Shield border: `hsl(40, 80%, 55%)` + outer glow ring
- Quiver body: `hsl(40, 50%, 16%)`, border `hsl(40, 80%, 58%)`
- Quiver detail: leather band mid-quiver + small gold gem at base
- Arrows: `hsl(40, 90%, 68%)` — brightest gold
- Corner ornament dots at shield vertices
- Wordmark: `hsl(40, 80%, 72%)` / DM suffix: `hsl(40, 90%, 58%)`
- Animation suggestion: fade in with subtle golden shimmer on session start

### Arcane — Roll 1–6
- Shield: dark fill, amber border
- Quiver body: `hsl(260, 45%, 22%)` (deep purple fill), border `hsl(260, 50%, 58%)`
- Quiver detail: small rune circle at centre
- Arrows: amber
- Wordmark: standard (amber DM suffix)

### Standard — Roll 7–14
- Shield: dark fill, amber border
- Quiver body: dark fill, amber border
- Quiver detail: purple gem at base (`hsl(260, 55%, 32%)`, border `hsl(260, 60%, 62%)`)
- Arrows: amber
- Wordmark: DM suffix in purple `hsl(260, 50%, 70%)`

### Legendary — Roll 15–20
- Shield: dark fill, amber border
- Shield detail: horizontal purple fess band (`hsl(260, 40%, 25%)`, 45% opacity, clipped to shield)
- Quiver body: dark fill, amber border
- Arrows: bright amber
- Wordmark: brighter amber `hsl(35, 80%, 80%)` / DM suffix `hsl(35, 90%, 65%)`

---

## Roll Logic

```typescript
// On each session start, roll once and store in session
function rollLogoVariant(): LogoVariant {
  const roll = Math.ceil(Math.random() * 20) // d20
  if (roll <= 6)  return 'arcane'
  if (roll <= 14) return 'standard'
  return 'legendary'
}

// Session start always shows gilded first, then transitions to rolled variant
// sessionStorage key: 'quiverdm_logo_variant'
// Show gilded on session start (no stored key), save rolled variant after
```

### Variant names (for CSS class / component prop)
- `gilded` — session start only
- `arcane` — 1–6
- `standard` — 7–14 (default/fallback)
- `legendary` — 15–20

---

## Wordmark

`QUIVER` in Cinzel 700, letter-spacing `0.1–0.15em`, followed by `DM` in the accent colour for each variant. All caps. No space between QUIVER and DM in the mark itself.

Full lockup: **[shield icon] + QUIVERDM** side-by-side for header use.
Icon-only: shield for app icon / favicon / avatar crops.

---

## Implementation Notes

- Build as a single `<QuiverLogo>` React component accepting `variant` prop
- SVG-based (not image) for crisp rendering at all sizes and easy colour theming via CSS vars
- Export icon-only and full lockup variants
- Sizes: 16px (favicon), 32px (mobile header), 48px (desktop header), 128px+ (splash/session start)
- Session start: show Gilded at full size with entrance animation, then shrink to header size showing rolled variant
- Gilded session-start display: suggested 2–3 second display before transitioning into the app

---

## SVG Reference

Working SVG prototypes in:
`E:/Projects/QuiverDM/.superpowers/brainstorm/423867-1773817223/`

- `logo-gilded.html` — all 4 variants side by side (final approved)
- `logo-system.html` — 3 variants with roll ranges
- `logo-colour-v2.html` — colour explorations
