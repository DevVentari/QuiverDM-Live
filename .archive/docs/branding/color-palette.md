# Color Palette

Complete color system for QuiverDM, including primary brand colors, semantic colors, and accessibility guidelines.

---

## Primary Brand Colors

### Brand Purple

The primary brand color representing creativity, magic, and premium quality.

| Format | Value |
|--------|-------|
| Hex | `#8B5CF6` |
| RGB | `139, 92, 246` |
| HSL | `255, 91%, 66%` |
| Tailwind | `violet-500` (closest) |

**Usage**: Primary CTAs, links, active states, brand accents

### Purple Family

| Name | Hex | Usage |
|------|-----|-------|
| Purple Light | `#A78BFA` | Hover states, highlights |
| Purple | `#8B5CF6` | Primary brand |
| Purple Dark | `#7C3AED` | Active states, pressed |
| Purple Darker | `#6D28D9` | Emphasis, contrast |

---

## Accent Colors

### Gold/Warm Accent

Represents medieval warmth, treasure, and achievement.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Accent Light | `#e8c46f` | `232, 196, 111` | Highlights, premium |
| Accent Warm | `#d4a84b` | `212, 168, 75` | Primary warm accent |
| Accent Dark | `#c4964a` | `196, 150, 74` | Darker contexts |

---

## Background Colors

Dark, warm backgrounds creating a medieval tavern atmosphere.

| Name | Hex | RGB | Tailwind Class | Usage |
|------|-----|-----|----------------|-------|
| Background | `#0f0d0b` | `15, 13, 11` | `bg-cream-bg` | Page background |
| Surface | `#1a1714` | `26, 23, 20` | `bg-cream-white` | Cards, elevated |
| Elevated | `#252220` | `37, 34, 32` | `bg-cream-light` | Modals, dropdowns |
| Border | `#3d3530` | `61, 53, 48` | `border-cream-border` | Dividers, borders |

---

## Text Colors

| Name | Hex | RGB | Tailwind Class | Usage |
|------|-----|-----|----------------|-------|
| Primary | `#e8dcc8` | `232, 220, 200` | `text-text-primary` | Body text, headings |
| Secondary | `#a89968` | `168, 153, 104` | `text-text-secondary` | Captions, metadata |
| Muted | `#6b5f4d` | `107, 95, 77` | - | Disabled, placeholder |
| Inverse | `#0f0d0b` | `15, 13, 11` | - | Text on light backgrounds |

---

## Semantic Colors

### Success

| Name | Hex | Usage |
|------|-----|-------|
| Success Light | `#86EFAC` | Success backgrounds |
| Success | `#22C55E` | Success states |
| Success Dark | `#16A34A` | Success emphasis |

### Warning

| Name | Hex | Usage |
|------|-----|-------|
| Warning Light | `#FDE047` | Warning backgrounds |
| Warning | `#EAB308` | Warning states |
| Warning Dark | `#CA8A04` | Warning emphasis |

### Error

| Name | Hex | Usage |
|------|-----|-------|
| Error Light | `#FCA5A5` | Error backgrounds |
| Error | `#EF4444` | Error states |
| Error Dark | `#DC2626` | Error emphasis |

### Info

| Name | Hex | Usage |
|------|-----|-------|
| Info Light | `#93C5FD` | Info backgrounds |
| Info | `#3B82F6` | Info states |
| Info Dark | `#2563EB` | Info emphasis |

---

## Dark Mode Specifications

QuiverDM uses dark mode by default. The color system is designed dark-first.

### Color Relationships

```
Background (#0f0d0b)
  └── Surface (#1a1714)
        └── Elevated (#252220)
              └── Border (#3d3530)
```

### Elevation Model

| Level | Color | Use Case |
|-------|-------|----------|
| 0 | `#0f0d0b` | Page background |
| 1 | `#1a1714` | Cards, sidebars |
| 2 | `#252220` | Modals, popovers |
| 3 | `#3d3530` | Tooltips, menus |

---

## Accessibility

### Contrast Ratios

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| Primary text on Background | 11.2:1 | AAA |
| Secondary text on Background | 5.8:1 | AA |
| Brand purple on Background | 4.9:1 | AA |
| Gold accent on Background | 7.1:1 | AAA |

### Guidelines

1. **Never** use brand purple for small text on dark backgrounds
2. **Always** ensure 4.5:1 minimum contrast for text
3. **Use** the gold accent for important UI elements requiring visibility
4. **Test** color combinations with accessibility tools

---

## Gradients

### Brand Gradient

```css
background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);
```

### Warm Gradient

```css
background: linear-gradient(135deg, #e8c46f 0%, #d4a84b 100%);
```

### Surface Gradient (subtle)

```css
background: linear-gradient(180deg, #1a1714 0%, #0f0d0b 100%);
```

---

## CSS Custom Properties

```css
:root {
  /* Brand */
  --color-brand: #8B5CF6;
  --color-brand-light: #A78BFA;
  --color-brand-dark: #7C3AED;

  /* Accent */
  --color-accent: #d4a84b;
  --color-accent-light: #e8c46f;
  --color-accent-dark: #c4964a;

  /* Background */
  --color-bg: #0f0d0b;
  --color-surface: #1a1714;
  --color-elevated: #252220;
  --color-border: #3d3530;

  /* Text */
  --color-text-primary: #e8dcc8;
  --color-text-secondary: #a89968;
}
```

---

## Tailwind Configuration

Current Tailwind color configuration (from `tailwind.config.ts`):

```typescript
colors: {
  'cream-bg': '#0f0d0b',
  'cream-white': '#1a1714',
  'cream-light': '#252220',
  'cream-border': '#3d3530',
  'text-primary': '#e8dcc8',
  'text-secondary': '#a89968',
  'accent-warm': '#d4a84b',
  'accent-dark': '#c4964a',
  'accent-light': '#e8c46f',
}
```

**Recommendation**: Add brand purple to Tailwind config:

```typescript
colors: {
  // ... existing colors
  'brand': '#8B5CF6',
  'brand-light': '#A78BFA',
  'brand-dark': '#7C3AED',
}
```
