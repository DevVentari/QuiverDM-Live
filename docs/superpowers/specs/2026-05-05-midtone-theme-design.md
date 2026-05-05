# Ashwood Midtone Theme — Design Spec

**Date:** 2026-05-05
**Status:** Approved

## Overview

Replace the current near-black dark theme (`oklch(0.12 0.005 265)`) with the Ashwood Midtone palette — a neutral warm-grey base at ~28% lightness that preserves the atmospheric D&D feel while being visibly lighter and more readable, especially in daylight.

---

## Design Decisions

| Question | Decision |
|----------|----------|
| Direction | Ashwood — neutral grey with warm (amber-leaning) undertone. Neither blue-grey nor brown. |
| Lightness | True midtone — background at `oklch(0.28 0.008 60)` (~28% L) |
| Accent | Amber preserved — `oklch(0.70 0.16 55)`. No accent color change. |
| Scope | `globals.css` only — CSS custom properties + hardcoded utility values. No component files. |

---

## Colour Palette

All values are in oklch. HSL fallbacks provided for browsers without oklch support.

### Surface Scale (dark → light)

| Role | oklch | HSL fallback | Hex approx |
|------|-------|-------------|------------|
| Shell / Sidebar | `oklch(0.22 0.008 60)` | `hsl(32 8% 14%)` | `#282420` |
| Background | `oklch(0.28 0.008 60)` | `hsl(32 7% 18%)` | `#38342f` |
| Card surface | `oklch(0.33 0.007 60)` | `hsl(32 6% 22%)` | `#44403a` |
| Popover | `oklch(0.31 0.007 60 / 0.92)` | `hsl(32 7% 20% / 0.92)` | `#403c36/92%` |

### Text Scale

| Role | oklch | HSL fallback |
|------|-------|-------------|
| Foreground | `oklch(0.94 0.005 60)` | `hsl(35 8% 93%)` |
| Muted foreground | `oklch(0.68 0.006 60)` | `hsl(32 5% 60%)` |

### Borders & Inputs

| Role | oklch | HSL fallback |
|------|-------|-------------|
| Border | `oklch(0.85 0.008 60 / 0.12)` | `hsl(35 8% 80% / 0.12)` |
| Input border | `oklch(0.85 0.008 60 / 0.22)` | `hsl(35 8% 80% / 0.22)` |
| Ring (focus) | same as primary | — |

### Accent (unchanged)

| Role | oklch | HSL fallback |
|------|-------|-------------|
| Primary (amber) | `oklch(0.70 0.16 55)` | `hsl(35 80% 55%)` |
| Primary foreground | `oklch(0.15 0.01 60)` | `hsl(32 8% 8%)` |
| Secondary surface | `oklch(0.36 0.006 60 / 0.6)` | `hsl(32 6% 23% / 0.6)` |
| Accent bg | `oklch(0.33 0.018 55)` | `hsl(33 12% 21%)` |
| Accent fg | `oklch(0.80 0.13 55)` | `hsl(35 65% 78%)` |

### Status (unchanged)

| Role | oklch |
|------|-------|
| Destructive | `oklch(0.55 0.22 25)` |
| Destructive fg | `oklch(0.96 0.003 265)` |

---

## CSS Custom Properties Changes

These replace the existing `.dark` block in `globals.css`. The `:root` (light mode) block is untouched — light mode is not currently used.

### HSL fallback block (`.dark`)

```css
.dark {
  --background: hsl(32 7% 18%);
  --foreground: hsl(35 8% 93%);
  --card: hsl(32 6% 22% / 0.7);
  --card-foreground: hsl(35 8% 93%);
  --popover: hsl(32 7% 20% / 0.92);
  --popover-foreground: hsl(35 8% 93%);
  --primary: hsl(35 80% 55%);
  --primary-foreground: hsl(32 8% 8%);
  --secondary: hsl(32 6% 23% / 0.6);
  --secondary-foreground: hsl(35 8% 93%);
  --muted: hsl(32 6% 23% / 0.5);
  --muted-foreground: hsl(32 5% 60%);
  --accent: hsl(33 12% 21%);
  --accent-foreground: hsl(35 65% 78%);
  --destructive: hsl(0 62% 50%);
  --destructive-foreground: hsl(240 5% 96%);
  --border: hsl(35 8% 80% / 0.12);
  --input: hsl(35 8% 80% / 0.22);
  --ring: hsl(35 80% 55%);

  --card-stone-bg: linear-gradient(180deg, hsl(32 6% 22%) 0%, hsl(32 6% 20%) 100%);
  --card-stone-inset: inset 0 1px 0 hsl(35 60% 50% / 0.07);
  --card-amber: hsl(35, 80%, 55%);
  --card-amber-light: hsl(35, 80%, 68%);
  --card-stone-border: hsl(33, 12%, 28%);
  --card-stone-border-hi: hsl(33, 16%, 34%);
  --card-text-muted: hsl(32, 7%, 56%);
}
```

### oklch block (`.dark` inside `@supports`)

```css
.dark {
  --background: oklch(0.28 0.008 60);
  --foreground: oklch(0.94 0.005 60);
  --card: oklch(0.33 0.007 60 / 0.7);
  --card-foreground: oklch(0.94 0.005 60);
  --popover: oklch(0.31 0.007 60 / 0.92);
  --popover-foreground: oklch(0.94 0.005 60);
  --primary: oklch(0.70 0.16 55);
  --primary-foreground: oklch(0.15 0.01 60);
  --secondary: oklch(0.36 0.006 60 / 0.6);
  --secondary-foreground: oklch(0.94 0.005 60);
  --muted: oklch(0.36 0.006 60 / 0.5);
  --muted-foreground: oklch(0.68 0.006 60);
  --accent: oklch(0.33 0.018 55);
  --accent-foreground: oklch(0.80 0.13 55);
  --destructive: oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.96 0.003 265);
  --border: oklch(0.85 0.008 60 / 0.12);
  --input: oklch(0.85 0.008 60 / 0.22);
  --ring: oklch(0.70 0.16 55);
}
```

---

## Utility Class Changes

All utility classes in `globals.css` that contain hardcoded dark values must be updated. CSS custom properties alone are not enough because these classes bypass the token system.

### `body` background

```css
body {
  background-image:
    radial-gradient(ellipse 60% 50% at 25% -10%, hsl(33 40% 22% / 0.5), transparent),
    radial-gradient(ellipse 50% 45% at 75% -5%,  hsl(258 25% 22% / 0.35), transparent),
    radial-gradient(ellipse 70% 40% at 50% 110%, hsl(33 30% 18% / 0.3), transparent),
    linear-gradient(hsl(32 7% 18%), hsl(32 7% 18%));
}
```

Glows are less intense than the current version — the midtone base needs less lift from gradients.

### `.dashboard-bg`

```css
.dashboard-bg {
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, hsl(258 25% 22% / 0.4), transparent),
    radial-gradient(ellipse 60% 40% at 80% 100%, hsl(33 30% 18% / 0.3), transparent);
}
```

### `.glass-shell`

```css
.glass-shell {
  background-color: hsl(32 8% 14% / 0.5);
  backdrop-filter: blur(12px);
}
```

### `.glass-panel`

```css
.glass-panel {
  background-color: hsl(32 7% 18% / 0.55);
  backdrop-filter: blur(10px);
  border-color: hsl(35 8% 80% / 0.10);
}
```

### `.glass-row`

```css
.glass-row {
  background-color: hsl(32 7% 18% / 0.4);
  border-color: hsl(35 8% 80% / 0.07);
}
```

### `.stone-card`

```css
.stone-card {
  background: linear-gradient(180deg, hsl(32 6% 22%) 0%, hsl(32 6% 20%) 100%);
  box-shadow: inset 0 1px 0 hsl(35 60% 50% / 0.07);
  border: 1px solid hsl(33 12% 26%);
  border-radius: 3px;
}
```

### `.stone-card-header`

```css
.stone-card-header {
  border-bottom: 1px solid hsl(33 12% 26%);
}
```

### `.stone-card-title`

```css
.stone-card-title {
  color: hsl(33 20% 62%);
}
```

### `.stat-value`

```css
.stat-value {
  color: hsl(35 80% 65%);
}
```

### `.stat-label`

```css
.stat-label {
  color: hsl(33 8% 52%);
}
```

### `.label-overline`

```css
.label-overline {
  color: hsl(35 80% 55% / 0.45);
}
```

### `.section-rule::before`

No change needed — uses `hsl(35 80% 55% / 0.3)` which already works at any surface lightness.

### `.auth-scene-glow`

No change — only affects opacity animation.

### `.landing-bg`, `.hero-glow`

```css
.landing-bg {
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, hsl(258 25% 22% / 0.5), transparent),
    radial-gradient(ellipse 60% 40% at 80% 100%, hsl(33 30% 18% / 0.4), transparent),
    radial-gradient(ellipse 60% 40% at 20% 90%,  hsl(258 20% 18% / 0.2), transparent);
}

.hero-glow {
  background:
    radial-gradient(ellipse 70% 60% at 50% -5%,  hsl(35 80% 55% / 0.15), transparent),
    radial-gradient(ellipse 50% 40% at 80% 110%, hsl(258 30% 25% / 0.25), transparent),
    radial-gradient(ellipse 50% 40% at 20% 110%, hsl(33 40% 18% / 0.2), transparent);
}
```

---

## What Does NOT Change

- `:root` (light mode) — untouched
- `--radius` — untouched
- Typography (Cinzel / Bricolage Grotesque / JetBrains Mono) — untouched
- `--primary` amber — untouched
- `.text-gradient-amber`, `.animate-shimmer` — untouched (work at any bg lightness)
- `.glass-grain` grain texture — untouched
- `.pdf-grid-bg` — untouched
- `.animate-float`, `@keyframes float` — untouched
- `.hero-arch-left` clip-path — untouched
- Fluid type utilities — untouched
- `.scrollbar-hide` — untouched

---

## Out of Scope

- Component files (`.tsx`) — not touched. Components that have hardcoded Tailwind dark values (e.g. `bg-[hsl(240,10%,8%)]`) are a follow-up task if inconsistencies are visible after this ships.
- Light mode — not used, not changed.
- Font changes — not in scope.
- Accent color changes — amber stays.
