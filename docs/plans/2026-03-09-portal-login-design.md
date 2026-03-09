# Portal Login Screen — Design Doc

**Date:** 2026-03-09
**Feature:** WoW-style parallax portal login scene for sign-in page

## Goal

Replace the current minimal centered auth layout with a full-screen cinematic portal scene — two stone sentinels flanking a glowing amber portal, login form floating inside, layered CSS parallax on mouse movement.

## Visual Reference

Original WoW vanilla login screen: two hooded stone statues flanking a stone archway, login panel inside the portal opening, fiery atmospheric sky behind. QuiverDM version uses D&D aesthetic with amber/gold portal glow matching existing design system.

## Layer Stack (back to front)

| # | Layer | Asset | Parallax Factor | Notes |
|---|-------|-------|-----------------|-------|
| 1 | Environment | `public/images/login-bg.jpg` | 0.02x | Barely drifts — sells depth |
| 2 | Atmospheric fog | CSS radial gradient | 0.04x | Animated opacity pulse |
| 3 | Vignette | CSS radial gradient | static | Darkens edges, draws eye center |
| 4 | Portal ring | Pure CSS | 0.06x | Oval, amber-gold, breathes |
| 5 | Login panel | glass-panel + SignInForm | 0.03x (inverse) | Opposite direction = depth pop |
| 6 | Particles | CSS keyframes | 0.01–0.08x each | 12–16 floating embers |

## Portal Ring Spec

- Shape: oval (`border-radius: 50%`), ~380px wide × 480px tall
- Two rings: outer soft glow (box-shadow, amber, low opacity) + inner crisp amber border
- Color: `--primary` (oklch 0.65 0.16 55) amber
- Animation: `portal-pulse` — opacity 0.6→1.0, scale 0.99→1.01, 3s ease-in-out infinite

## Login Panel Spec

- Class: `glass-panel` (existing design system)
- Width: 360px
- Animation: `float` — translateY -6px→+6px, 4s ease-in-out infinite
- Content: existing `SignInForm` component, unchanged internally

## Parallax System

- Single `mousemove` event listener on root container
- `lerp(current, target, 0.08)` on each RAF tick for smooth follow
- Each layer: `transform: translate(calc(mouseX * factor), calc(mouseY * factor))`
- `prefers-reduced-motion`: all animations and parallax disabled, static layout

## Particles

- 12–16 `<span>` elements, CSS-only
- Vary: size (2–6px), opacity (0.2–0.7), drift speed (4–12s), horizontal drift
- `@keyframes ember-rise` — float upward with slight horizontal wobble, fade out at top
- Colors: amber/orange/white mix

## Assets Required

- `public/images/login-bg.jpg` — user provides. Suggested prompt for Midjourney/fal.ai:
  > "two ancient stone guardian statues flanking a misty stone archway, dark fantasy dungeon entrance, candlelit atmosphere, dramatic cinematic lighting, wide angle establishing shot, no UI, no text, photorealistic"

## Files

| File | Change |
|------|--------|
| `src/app/(auth)/layout.tsx` | Strip centering/padding, full-screen pass-through |
| `src/app/(auth)/auth/signin/page.tsx` | Wrap SignInForm in PortalScene |
| `src/components/auth/portal-scene.tsx` | New — all layers, parallax logic, particles |
| `src/app/(auth)/auth/signup/page.tsx` | Same portal scene treatment |

## Non-Goals

- No changes to SignInForm internals
- No changes to marketing/landing page
- No video background (static image only)
- Signup page gets same wrapper but is a separate card — no new signup form changes
