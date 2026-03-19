# Sidebar UI 2.0 Design Spec

**Date:** 2026-03-18
**Scope:** `src/components/sidebar.tsx` (icon changes also applied to `MobileSidebar`)

---

## Overview

Update the QuiverDM sidebar to align with the UI 2.0 design language established in the mobile mockups (Cinzel + Bricolage Grotesque typography, stone card treatment, ambient radial gradient). Simultaneously replace duplicated and generic Lucide icons with unique, semantically appropriate alternatives.

---

## 1. Typography

Replace the current system font stack with the UI 2.0 typefaces using existing Tailwind utility classes (`font-display` = Cinzel via `--font-cinzel`, `font-sans` = Bricolage Grotesque via `--font-bricolage`). Both are already loaded in `layout.tsx`.

| Element | Current | New class | Weight |
|---|---|---|---|
| Logo "QuiverDM" | system-ui bold | `font-display` | 700 |
| Campaign name (in-campaign) | system-ui medium | `font-display` | 700 *(only 400 and 700 are loaded for Cinzel)* |
| Nav item labels | system-ui medium | `font-sans` | 500 |
| Section labels | system-ui bold uppercase | `font-sans` | 700 |
| Campaign subtitle / meta | system-ui | `font-sans` | 400 |
| Mode toggle (DM/Player) | system-ui | `font-sans` | 600 |

**Font weight note:** Cinzel is loaded with `weight: ['400', '700']` in `layout.tsx` — do not use weight 600 for Cinzel elements. Bricolage Grotesque is a variable font loaded with `axes: ['opsz', 'wdth']`, so all weights (300–800) are available — 500, 600, and 700 are all safe to use.

---

## 2. Ambient Background Gradient

Add a subtle radial gradient overlay inside the sidebar `<aside>` shell, matching the UI 2.0 body background treatment. Follow the existing pattern of the amber border overlay div (lines 228–234 of current `sidebar.tsx`) — an absolutely positioned `<div>` with `pointer-events-none` and a high `z-index`.

```
/* amber top-centre + purple top-right bleed */
radial-gradient(ellipse 140% 30% at 50% 0%, hsl(35 80% 38% / 0.14) 0%, transparent 60%),
radial-gradient(ellipse 80% 20% at 85% 0%, hsl(260 50% 45% / 0.09) 0%, transparent 50%)
```

Apply as a `<div>` with Tailwind: `absolute inset-0 pointer-events-none z-0`. All other sidebar children that need to render above it should use `relative z-[1]` — the `<aside>` already has `relative` positioning.

---

## 3. Stone Card Treatment

Apply the UI 2.0 stone card style to the campaign switcher button and in-campaign context header block:

```css
background: linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%);
box-shadow: inset 0 1px 0 hsl(35 60% 50% / 0.08);
border: 1px solid hsl(35 35% 18%);
border-radius: 3px; /* rounded-[3px] */
```

Hover state on campaign switcher: `border-color: hsl(35 50% 26%)`.

Use inline `style` for the gradient and box-shadow (not expressible in Tailwind without custom config). Border and radius via Tailwind.

---

## 4. Icon Replacements

All icons from `lucide-react`. Apply `strokeWidth={1.8}` consistently on every `<Icon>` instance in `NavItem` and on icons used in buttons (collapse button, campaign switcher chevron). The `Icon` component prop passed through `NavItem` renders via `<Icon className="h-4 w-4 shrink-0" />` — add `strokeWidth={1.8}` to that render call so it applies globally across all nav items.

### Global nav

| Route | Label | Old | New |
|---|---|---|---|
| `/dashboard` | Dashboard | `LayoutDashboard` | `LayoutDashboard` *(keep)* |
| `/campaigns` | Campaigns | `Swords` | `Globe` *(not Globe2 — not in ^0.454.0)* |
| `/characters` | Characters | `Users` | `User` |
| `/homebrew` | Homebrew | `BookOpen` | `FlaskConical` |
| `/feedback` | Feedback | `MessageSquare` | `MessageSquare` *(keep)* |

### Campaign nav — Campaign section

| Route | Label | Old | New |
|---|---|---|---|
| `/campaigns/[slug]` | Overview | `LayoutDashboard` | `Home` |
| `/campaigns/[slug]/sessions` | Sessions | `CalendarDays` | `CalendarDays` *(keep)* |
| `/campaigns/[slug]/summaries` | Summaries | `ScrollText` | `ScrollText` *(keep)* |

### Campaign nav — World section

| Route | Label | Old | New |
|---|---|---|---|
| `/campaigns/[slug]/npcs` | NPCs | `Users` | `Drama` |
| `/campaigns/[slug]/brain` | DM Brain | `Brain` | `Brain` *(keep)* |
| `/campaigns/[slug]/encounters` | Encounters | `Swords` | `Swords` *(moved here exclusively)* |

### Campaign nav — Library section

| Route | Label | Old | New |
|---|---|---|---|
| `/campaigns/[slug]/homebrew` | Homebrew | `BookOpen` | `FlaskConical` |
| `/campaigns/[slug]/players` | Characters | `Shield` | `Shield` *(keep)* |
| `/campaigns/[slug]/members` | Members | `UsersRound` | `UsersRound` *(keep, now unique)* |

**`MobileSidebar`:** Apply the same icon changes. Typography changes are out of scope for this pass.

---

## 5. Section Label Refinements

**Note:** The current `SectionLabel` component at `sidebar.tsx:115` uses `font-display` (Cinzel). This must change to `font-sans` — Cinzel at 11px is illegible and section labels are utility text, not display text.

- Tracking: `tracking-[0.18em]` (up from `0.16em`)
- Color: `hsl(35 10% 55%)` — matches `--card-text-muted` in `globals.css`, warmer than current blue-grey
- Font: `font-sans` weight 700 uppercase *(change from current `font-display`)*

---

## 6. Campaign Context Header (In-Campaign)

When `inCampaign` is true, **replace `CampaignSwitcher` entirely** with a context header block. Remove the bottom `All Campaigns` `NavItem` — the back link moves into this header.

Structure:

```
[context header block — stone card bg]
  ← All Campaigns          (back link: font-sans 600 uppercase, 0.1em tracking)
  🛡 Eye of Ruin  [DM]     (campaign name: font-display 700, amber glow)
  14 sessions · 6 players  (font-sans 400, hsl(35 10% 40%))
```

- **Back link:** small caps, `hsl(240 5% 36%)`, chevron-left icon before text
- **Campaign name:** `font-display` (Cinzel) 700, `hsl(35 80% 68%)`, `text-shadow: 0 0 14px hsl(35 80% 48% / 0.3)` via inline style
- **DM/Player badge:** pill, `border: 1px solid hsl(35 60% 28%)`, `background: hsl(35 60% 10%)`, `color: hsl(35 70% 52%)`
- **Session count:** `font-sans` 400, `hsl(35 10% 40%)`
- Stone card bg applied to this block

When `inCampaign` is false, show the existing `CampaignSwitcher` dropdown (with stone card treatment added per Section 3).

---

## 7. Out of Scope

- Collapsed sidebar state — icon-only view unchanged structurally; icon component changes apply naturally
- `MobileSidebar` typography — icons update, font classes do not change in this pass
- New nav items or route changes
- Animations or transitions beyond existing `.1s` hover
