# Logo System Design — QuiverDM

**Date:** 2026-03-22
**Sub-project:** UI 2.0 — #1 of 5
**Status:** Approved

---

## Overview

QuiverDM's logo becomes a d20-driven variant system. Each browser session rolls a d20 on app load; the result determines which logo variant appears in the sidebar for that session. A fourth variant (Gilded) activates automatically when the DM enters a live session, then reverts on exit.

This turns the logo from a static brand mark into a small piece of the game — consistent with QuiverDM's "world breathes" design principle.

---

## Variants

| Variant | Roll Range | Icon Treatment | Wordmark |
|---------|------------|----------------|----------|
| Standard | 7–14 (most common) | Shield + dark quiver body, purple gem at base | QUIVERDM, amber DM, subtitle: Campaign Companion |
| Arcane | 1–6 | Shield + arcane quiver fill (purple interior), empty crystal socket outlined | Same wordmark + subtitle |
| Legendary | 15–20 | Shield + horizontal purple band across mid-shield, brighter arrow tips | Same wordmark + subtitle |
| Gilded | Session start | Larger shield (100×120 viewBox), full gold treatment, center gem, exposed crown ornament | Same wordmark, no subtitle |

**Subtitle:** "Campaign Companion" displayed on all variants in expanded sidebar. Variant name is NOT shown — the icon itself signals rarity. This keeps the product name consistent.

---

## Roll Mechanic

```
appLoad → Math.floor(Math.random() * 20) + 1
        → stored in sessionStorage('quiverdm-logo-variant')
        → read on every render (no re-roll mid-session)
        → fresh roll on new tab/session
```

Gilded overrides the session roll: when DM navigates to `/sessions/[id]/live`, the logo switches to Gilded regardless of the stored variant. On exit, the stored variant resumes.

---

## Sidebar Integration

**Expanded state** (default, sidebar open):
- Icon: 28×34px rendered SVG (viewBox 0 0 72 88)
- Wordmark: `QUIVER` + `DM` in amber, font-display (Cinzel), 13px, tracking 0.1em
- Subtitle: "Campaign Companion", 8px, tracking 0.14em, muted color

**Collapsed state** (sidebar icon-only):
- Icon only: 26×32px, centered
- No wordmark, no subtitle

---

## Implementation Scope

### New files
- `src/components/logo/quiver-logo.tsx` — `QuiverLogo` component accepting `variant` prop and `size` ("sm" | "md" | "lg")
- `src/hooks/use-logo-variant.ts` — d20 roll + sessionStorage read/write hook. Returns `LogoVariant` type.

### Modified files
- `src/components/sidebar.tsx` — Replace current text-only logo slot with `<QuiverLogo>` + wordmark div. Import `useLogoVariant`. Pass variant down; override with `'gilded'` on live session route. `MobileSidebar` is **out of scope** — it currently has no dedicated logo area and is not part of this sub-project.
- `src/components/auth/portal-scene.tsx` — Replace `<img src="/images/logo.svg">` with `<QuiverLogo variant="standard" size="lg">` (auth pages always show Standard — no roll needed pre-login). The subtitle on the auth page remains **"The DM's Second Brain"** — this is intentional marketing copy on the hero panel, distinct from the sidebar's functional "Campaign Companion" label. The `QuiverLogo` component renders the icon only; the surrounding wordmark + subtitle text is composed by the parent, so both pages can set their own subtitle independently.

### Kept as-is
- `public/images/logo.svg` — retained as favicon/OG fallback. Not used in app UI after this change.

---

## SVG Specs

All variants share the same base shield path (viewBox 0 0 72 88):
```
Shield outer: M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z
Shield inner: M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z (stroke only)
Quiver body: rect x=29 y=24 w=14 h=26 rx=7
Arrows: 3 lines + 3 polygon tips (33/36/39 x-positions, heights 15/12/16)
```

Variant differences:
- **Standard**: quiver fill `hsl(240,10%,8%)`, gem circle `cx=36 cy=46 r=4.5` fill `hsl(260,55%,32%)` stroke `hsl(260,60%,62%)`
- **Arcane**: quiver fill `hsl(260,45%,22%)` (purple interior), inner circle `cx=36 cy=40 r=3.5` stroke-only `hsl(260,50%,55%)` opacity 0.7
- **Legendary**: Standard quiver + horizontal band `rect x=12 y=33 w=48 h=13 fill=hsl(260,40%,25%) opacity=0.45` clipped to shield, brighter arrow tips `hsl(35,80%,62%)`
- **Gilded**: Separate viewBox 0 0 100 120, larger shield `M50,8 L76,20 L76,48 Q76,68 50,82 Q24,68 24,48 L24,20 Z`, gold family throughout:
  - Shield outer stroke: `hsl(40,80%,55%)` stroke-width 2.2
  - Inner bevel: `M50,13 L71,23 ... Q50,76 29,48 L29,23 Z` stroke `hsl(40,70%,40%)` stroke-width 1
  - Crown ornament: `circle cx=50 cy=13 r=2` fill `hsl(40,80%,55%)`
  - Quiver body: fill `hsl(40,50%,16%)` stroke `hsl(40,80%,58%)` stroke-width 1.5
  - Arrow shafts: stroke `hsl(40,90%,68%)` stroke-width 1.8
  - Arrow tips: fill `hsl(40,90%,62%)`

---

## Component API

```tsx
type LogoVariant = 'standard' | 'arcane' | 'legendary' | 'gilded';

interface QuiverLogoProps {
  variant: LogoVariant;
  size?: 'sm' | 'md' | 'lg'; // sm=20px, md=28px, lg=52px
  className?: string;
}
```

```tsx
// Hook
function useLogoVariant(): LogoVariant {
  // Reads sessionStorage on mount, rolls if absent, stores result
  // Returns 'standard' on server render (SSR safe)
}
```

---

## Sidebar Usage Pattern

```tsx
// In sidebar.tsx
const baseVariant = useLogoVariant();
const pathname = usePathname();
const isLiveSession = pathname.match(/\/sessions\/[^/]+\/live$/) !== null;
const variant = isLiveSession ? 'gilded' : baseVariant;

<QuiverLogo variant={variant} size="md" />
<div>
  <span className="font-display ...">QUIVER<span className="text-amber">DM</span></span>
  <span className="label-overline ...">Campaign Companion</span>
</div>
```

---

## Out of Scope

- User preference to lock a variant — the randomness is the feature
- Animation on variant change (sessionStorage is read once on load)
- Gilded animation/transition — plain swap is sufficient for v1
- Any changes to OG images, favicon, or marketing pages
