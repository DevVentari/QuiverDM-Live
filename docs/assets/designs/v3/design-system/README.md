# Handoff: QuiverDM Design System

## Overview
QuiverDM is a Dungeon Master's command center — campaign prep, live session running, combat tracking, world/location/scene navigation, and player-facing companions. This package is the **canonical design-token style guide**: the colors, typography, spacing, radii, elevation, motion, iconography, and signature component patterns that every QuiverDM screen is built from.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, system, and behavior. They are **not production code to copy directly**. The task is to **recreate this design system in the target codebase's environment** (React, Vue, SwiftUI, native, etc.) using its established patterns — or, if no environment exists yet, to choose the most appropriate framework and implement it there. The token files (`tokens.css`, `tokens.json`, `tailwind.config.js`) are ready to drop in as-is; the `.dc.html` style guide is a visual reference for how the tokens compose.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, motion curves, and the signature icon-overlay pattern are all specified exactly. Recreate the UI pixel-faithfully using the codebase's libraries.

## Typography — the system
Three roles, one decision already made:

| Role | Family | Weights | Used for |
|---|---|---|---|
| **Display / story** | **Kalam** | 300 / 400 / 700 | Titles, character names, narration, cinematic beats. The hand-inked voice — keep it everywhere story matters. |
| **Body / UI** | **Hanken Grotesk** | 400 / 500 / 600 / 700 | Descriptions, lists, statblock text, settings, tables, transcripts. Calm and legible at every size. |
| **Data / labels** | **mono** (`ui-monospace`) | — | Stat numbers, tracking-letter uppercase labels, codes, timers. |

Optional swap: replacing Hanken Grotesk with **Spectral** (serif) pushes the storybook mood further — same role, more romance. Load Kalam + Hanken Grotesk (+ Spectral) from Google Fonts.

### Type scale
| Token | Family | Size / line-height | Notes |
|---|---|---|---|
| `display-2xl` | Kalam 700 | 56 / 1.0 | Cinematic, cover |
| `display-xl` | Kalam 700 | 30 / 1.0 | Page title |
| `title` | Kalam 700 | 22 / 1.05 | Section header |
| `narration` | Kalam italic | 18 / 1.55 | Read-aloud text |
| `body-lg` | Hanken 400 | 16 / 1.55 | |
| `body` | Hanken 400 | 14 / 1.55 | Default |
| `body-sm` | Hanken 400 | 12 / 1.5 | |
| `label` | mono | 9, letter-spacing .16em, UPPERCASE | Eyebrow labels |

## Design Tokens
Full values live in `tokens.css` (CSS custom properties, prefix `--qd-*`), `tokens.json` (structured), and `tailwind.config.js` (theme extension). Summary:

**Surfaces** — bg `#0a0707` · panel `#16110e`→`#100b09` · rail `#0d0908` · card `#1b1512` · ink-on-accent `#1a0f06`
**Ink** — strong `#f6ead8` · body `#ece2d4` · secondary `#cdbfae` · muted `#9c8a76` · faint `#7f6f5e` · faintest `#5a4f45`
**Accent (amber)** — `#f0d6b2` `#e9b277` `#e0944a` `#d98a3d` `#c97a30` `#b8662a` · button gradient `linear-gradient(180deg,#e0944a,#c97a30)`
**Success (green / ally)** — `#bcd1a4` `#8fc466` `#7fae5a` `#5f8f45` `#3f5f2a`
**Danger (red / hostile)** — `#e6a99f` `#e0584a` `#c4453a` `#8a2f26`
**Warn (orange)** — `#ef9a5f` `#cf6f2a` `#a8401f`
**Arcane (purple / lore / AI)** — `#d6c8e4` `#cbb8e0` `#b08fd0` `#7a5fb0`
**Borders** — warm white `rgba(255,235,205,.06 / .10 / .16)` · accent `rgba(217,138,61,.40 / .50)`

**Spacing** (4px grid) — 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40
**Radii** — sm 8 · md 10 · lg 12 · xl 14 · 2xl 16 · panel 18 · pill 20 · phone 30 · full 9999
**Shadows** — card `0 30px 70px rgba(0,0,0,.4)` · panel `0 40px 90px rgba(0,0,0,.6)` · token `0 4px 14px rgba(0,0,0,.5)` · accent `0 8px 20px rgba(217,138,61,.3)` · glow-active `0 0 0 1px rgba(217,138,61,.9), 0 0 26px rgba(217,138,61,.4)`
**Motion** — durations fast 150 / base 250 / slow 400 / ambient 2400 · easings out `cubic-bezier(.2,.8,.2,1)` / spring `cubic-bezier(.34,1.56,.64,1)` / inout `cubic-bezier(.65,0,.35,1)`. Animate **transform & opacity only**; honor `prefers-reduced-motion`.

## Iconography
Uses the **dnd icon set** — single-path, solid-fill, 100×100 SVG glyphs across ~21 categories (ability, class, combat, condition, damage, dice, entity, location, monster, skill, spell, weapon, util, …). These replace every emoji used in the prototypes.

**Tinting:** never render via `<img>`. Use CSS mask so glyphs recolor to state:
```css
.qd-icon {
  -webkit-mask: url(icon.svg) center/contain no-repeat;
          mask: url(icon.svg) center/contain no-repeat;
  background: var(--qd-accent-text); /* any token color */
}
```
The full set is in the attached local `dnd/` folder; a representative subset is in `assets/icons/`.

## Signature Pattern — Icon Overlay
QuiverDM's distinguishing component treatment: on **badges, buttons, and cards**, the relevant glyph rides **behind the label as a low-opacity watermark**, tinted to the component's own semantic color and **bled off an edge**. A small inline glyph may lead the label; the large one gives depth.

- Container: `position: relative; overflow: hidden`
- Watermark: `position: absolute`, bled off a corner (e.g. `inset: auto -22px -26px auto`), `opacity: .10–.18`, sized 46–54px on badges/buttons and ~128px on cards, often a slight `rotate(±8deg)`, tinted with the component color via mask.
- Content: wrapped at `z-index: 1` so it stays crisp above the watermark.

```css
.qd-overlay {
  position: absolute; inset: auto -22px -26px auto;
  width: 128px; height: 128px; opacity: .13;
  background: var(--tint);
  -webkit-mask: url(icon.svg) center/contain no-repeat;
          mask: url(icon.svg) center/contain no-repeat;
  transform: rotate(-8deg);
}
```

## Core Components
- **Buttons** — Primary (amber gradient, Kalam 700, ink `#1a0f06`, accent shadow), Secondary (`rgba(255,255,255,.05)` + warm border), Danger (red tint + border), Ghost (mono, transparent). Press: `transform: scale(.94–.95)` over `--qd-dur-fast`.
- **Tags / status** — pill, mono uppercase label, semantic tint fill + border. Apply the icon-overlay where it adds depth.
- **Token + HP bar** — circular initiative token (2px semantic-colored ring, radial fill, Kalam monogram, token shadow); HP bar is a rounded track with a semantic gradient fill and a slower "lag" underlay for damage.
- **Field & toggle** — field: warm/accent border, `rgba(255,255,255,.03)` fill, Hanken body; toggle: 42×24 pill, green when on, `#f6ead8` knob.

## Assets
- `assets/icons/` — representative tinted-glyph subset used by the style guide.
- `dnd/` (attached local folder) — the full icon library (~309 SVGs).
- Image slots in prototypes are user-filled placeholders (map art, portraits, scene art); in production wire these to real uploads.

## Files
- `QuiverDM Style Guide.dc.html` — the canonical visual token reference (all sections above, rendered).
- `Typography.dc.html` — the type-system specimen (Kalam + companion comparison, in context).
- `tokens.css` · `tokens.json` · `tailwind.config.js` — machine-readable tokens (identical values).
- `assets/icons/` — icon subset referenced by the guides.

> The `.dc.html` files are Design Components — they open directly in a browser. Treat them as visual references; build the real thing in your stack.
