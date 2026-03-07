# Colors

All colors use oklch color space with HSL fallbacks. Dark mode is the primary experience.

## Semantic Tokens (dark mode values shown)

| Token | CSS Variable | oklch Value | Role |
|-------|-------------|-------------|------|
| Background | `--background` | `oklch(0.12 0.005 265)` | Page background (deep indigo-black) |
| Foreground | `--foreground` | `oklch(0.96 0.003 265)` | Primary text |
| Card | `--card` | `oklch(0.16 0.005 265 / 0.56)` | Card surfaces (semi-transparent) |
| Card Foreground | `--card-foreground` | `oklch(0.96 0.003 265)` | Card text |
| Popover | `--popover` | `oklch(0.16 0.005 265 / 0.7)` | Dropdown/popover backgrounds |
| Primary | `--primary` | `oklch(0.7 0.16 55)` | Warm amber/gold -- CTAs, active states |
| Primary Foreground | `--primary-foreground` | `oklch(0.12 0.005 265)` | Text on primary |
| Secondary | `--secondary` | `oklch(0.22 0.005 265 / 0.62)` | Muted interactive surfaces |
| Muted | `--muted` | `oklch(0.22 0.005 265 / 0.52)` | Disabled/subtle backgrounds |
| Muted Foreground | `--muted-foreground` | `oklch(0.64 0.007 265)` | Secondary text, captions |
| Accent | `--accent` | `oklch(0.2 0.015 55)` | Warm-tinted highlight areas |
| Accent Foreground | `--accent-foreground` | `oklch(0.78 0.12 55)` | Text on accent surfaces |
| Destructive | `--destructive` | `oklch(0.55 0.22 25)` | Muted red for dangerous actions |
| Border | `--border` | `oklch(0.9 0.01 265 / 0.09)` | Very subtle borders |
| Input | `--input` | `oklch(0.9 0.01 265 / 0.2)` | Form input borders |
| Ring | `--ring` | `oklch(0.7 0.16 55)` | Focus ring (matches primary) |

## Border Radius

`--radius: 0.375rem` -- Tailwind maps: `rounded-lg` = var, `rounded-md` = var - 2px, `rounded-sm` = var - 4px.

## Glass Classes

| Class | Background | Backdrop | Border | Use |
|-------|-----------|---------|--------|-----|
| `glass-shell` | `hsl(240 10% 8% / 0.4)` | `blur(12px)` | -- | Sidebar shell |
| `glass-panel` | `hsl(240 10% 8% / 0.42)` | `blur(10px)` | `hsl(240 20% 85% / 0.09)` | Cards, panels |
| `glass-row` | `hsl(240 10% 8% / 0.3)` | -- | `hsl(240 20% 85% / 0.07)` | Table rows, list items |
| `glass-grain` | -- | -- | -- | Adds noise texture overlay (opacity 0.022) |

## Ambient Effects

- `app-grain` -- Fixed full-page noise texture (opacity 0.03)
- `app-vignette` -- Darkens edges with radial gradient
- `app-ambient-glow` -- Breathing amber/purple glow (12s animation cycle)
- `dashboard-bg` -- Purple top glow + amber bottom warmth
- `hero-glow` / `landing-bg` -- Marketing page atmospheric gradients

## Body Background

Multi-layer radial gradient: amber candlelight (upper-left), purple mystical (upper-right), faint amber (bottom-center), near-black base. Fixed attachment.
