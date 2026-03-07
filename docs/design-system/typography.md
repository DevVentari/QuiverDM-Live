# Typography

## Font Families

| Class | Font | Variable | Use |
|-------|------|----------|-----|
| `font-sans` (default) | Bricolage Grotesque | `--font-bricolage` | Body text, UI elements, forms |
| `font-display` | Cinzel | `--font-cinzel` | Page titles, campaign names, headings with gravitas |
| `font-mono` | System monospace | `--font-mono` | Dice rolls, stat values, code |

Bricolage Grotesque is loaded from Google Fonts with optical sizing (`opsz`) and width (`wdth`) axes. Cinzel is loaded in weights 400 and 700.

Defined in `src/app/layout.tsx` via `next/font/google`.

## Font Weight Conventions

| Weight | Tailwind | Use |
|--------|----------|-----|
| 400 | `font-normal` | Body text, descriptions |
| 500 | `font-medium` | Labels, overlines, interactive text |
| 600 | `font-semibold` | Subheadings, table headers, strong emphasis |
| 700 | `font-bold` | Page titles (with `font-display`), stat scores |

## Size Scale

| Class | When to use |
|-------|-------------|
| `text-[10px]` / `text-[11px]` | Badges, stat footers, tertiary metadata |
| `text-xs` (12px) | Overline labels, timestamps, secondary metadata |
| `text-sm` (14px) | Card descriptions, form labels, table cells |
| `text-base` (16px) | Body paragraphs, form inputs |
| `text-lg` (18px) | Section headings within a page |
| `text-xl` to `text-3xl` | Page-level headings (usually with `font-display`) |

## Fluid Typography (custom utilities)

| Class | Range | Use |
|-------|-------|-----|
| `text-fluid-xl` | 1.125rem to 1.5rem | Responsive subheadings |
| `text-fluid-2xl` | 1.25rem to 1.875rem | Responsive section titles |
| `text-fluid-3xl` | 1.5rem to 2.25rem | Responsive page titles |
| `text-fluid-4xl` | 1.875rem to 3rem | Hero/landing headings |

## Text Utilities

- `text-gradient-amber` -- Amber gradient text fill (marketing/hero use)
- `animate-shimmer` -- Animated gradient text (landing page CTA)
- `tracking-wide` -- Pair with `font-display` for headings
- `label-overline` -- 0.625rem, 500 weight, 0.25em tracking, uppercase, amber/40% opacity
