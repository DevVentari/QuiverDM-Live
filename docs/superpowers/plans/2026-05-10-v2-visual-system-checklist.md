# V2 Visual System Implementation Checklist

> Status: ready to execute  
> Purpose: convert the approved V2 visual brief into a repo-specific implementation checklist based on the code that already exists in `src/styles`, `src/components/primitives`, `src/components/shell`, and the current `(app)` routes.

## Goal

Ship a tiered V2 visual system that preserves the heavier QuiverDM styling, but applies it deliberately:

- `Tier 1` utility surfaces stay disciplined and operational
- `Tier 2` feature surfaces carry texture, depth, and emphasis
- `Tier 3` signature moments deliver the full grimoire treatment

This plan assumes the current rewrite slice is partially implemented already. It does **not** treat the repo as greenfield.

## Current State

These pieces already exist and should be evolved, not replaced blindly:

- `src/styles/tokens.css`
- `src/components/primitives/Surface.tsx`
- `src/components/primitives/Card.tsx`
- `src/components/primitives/Section.tsx`
- `src/components/primitives/Summon.tsx`
- `src/components/primitives/Pill.tsx`
- `src/components/primitives/Canvas.tsx`
- `src/components/primitives/index.ts`
- `src/components/shell/CommandRail.tsx`
- `src/components/shell/CommandBar.tsx`
- `src/components/shell/BrainSummon.tsx`
- `src/components/shell/MobileHeader.tsx`
- `src/app/(app)/app-shell.tsx`
- `src/app/(app)/page.tsx`

The gap is not missing primitives. The gap is that the current primitives encode only a shallow material system:

- `Surface` is still `flat | raised | sunken`, not `utility | feature | hero | signature`
- `Card` is still `list | feature | grimoire`, missing `detail` and `hero`
- `Section` only supports a single heading style
- `Canvas` only has one atmospheric treatment
- `Summon` uses a boolean `grimoire` flag instead of tiered overlay variants
- `Pill` lacks `neutral` and `phase`
- shell components still hardcode many visual decisions inline instead of consuming the primitive system

## Execution Order

1. Stabilize tokens and utility classes
2. Expand primitive variants to match the visual tier model
3. Refactor shell components onto those primitives
4. Apply the tier rules to Home
5. Apply the tier rules to World and Prep
6. Add guardrail tests and regression checks

## Task 1: Harden Tokens And Global Utilities

**Files**

- Modify: `src/styles/tokens.css`
- Modify: `src/app/globals.css`

- [ ] Add explicit semantic tokens for the tier model instead of only surface depth tokens
  - Add `--q-surface-utility`
  - Add `--q-surface-feature`
  - Add `--q-surface-hero`
  - Add `--q-surface-signature`
  - Add matching border/glow tokens where needed

- [ ] Add text tokens that remove ad hoc fallback usage
  - Add `--q-text-danger`
  - Add `--q-text-warning`
  - Add `--q-text-info`

- [ ] Add shell-level spacing tokens if repeated values are emerging
  - rail width collapsed/expanded
  - command bar height
  - panel padding presets

- [ ] Move atmospheric utility ownership out of page files and into named utilities
  - base body atmosphere
  - signature vignette
  - hero panel glow
  - grain overlay

- [ ] Keep `globals.css` as the host for shared utilities, not as a second token source

**Done when**

- page components no longer need to invent color values inline
- shell and primitives can express their variants using semantic tokens instead of raw OKLCH strings

## Task 2: Upgrade `Surface` Into The Base Tier Primitive

**File**

- Modify: `src/components/primitives/Surface.tsx`

- [ ] Replace `flat | raised | sunken` with `utility | feature | hero | signature`

- [ ] Add optional props for material modifiers instead of forcing pages to hand-roll them
  - `grain?: boolean`
  - `glow?: boolean`
  - `ornament?: boolean`
  - `inset?: boolean`

- [ ] Make `utility` the default variant

- [ ] Keep the classes additive and token-backed
  - utility: quiet, crisp, low-glow
  - feature: glass/stone hybrid
  - hero: deeper contrast and stronger focal treatment
  - signature: atmospheric ownership, not just a stronger border

- [ ] Remove assumptions that `shadow-md` or amber border always means “important”

**Done when**

- shell panels, sheets, and page surfaces can all consume `Surface` without extra custom material classes

## Task 3: Expand `Card` To Match Real Screen Roles

**File**

- Modify: `src/components/primitives/Card.tsx`

- [ ] Expand variants to:
  - `list`
  - `detail`
  - `feature`
  - `hero`
  - `grimoire`

- [ ] Make `Card` compose `Surface` rather than duplicating its material logic

- [ ] Keep `list` visually calm enough for dense operational pages

- [ ] Add `detail` for structured content blocks like:
  - entity summaries
  - session info
  - right-panel sheets

- [ ] Add `hero` for the dominant panel on Home and similar surfaces

- [ ] Restrict `grimoire` to signature contexts only

**Done when**

- Home can have one `hero` card and multiple quieter cards without hand-tuned styling
- Prep can open a focused card with stronger treatment without over-styling every support block

## Task 4: Give `Section` Enough Structure To Standardize Rhythm

**File**

- Modify: `src/components/primitives/Section.tsx`

- [ ] Expand props to support:
  - `label?: string`
  - `title?: string`
  - `description?: string`
  - `action?: React.ReactNode`
  - `tone?: 'utility' | 'feature' | 'ceremonial'`

- [ ] Keep `label` optional so utility views are not forced into display-font overlines

- [ ] Map tones to the tier model
  - utility: practical heading
  - feature: stronger title and spacing
  - ceremonial: display type + more visible amber rule

- [ ] Make `Section` responsible for vertical rhythm instead of page-specific margin patterns

**Done when**

- page files stop hand-assembling repeated “eyebrow + line + title + action” patterns

## Task 5: Split `Canvas` Into Real Atmospheric Variants

**File**

- Modify: `src/components/primitives/Canvas.tsx`

- [ ] Add variants:
  - `base`
  - `world`
  - `prep`
  - `recap`
  - `summon`

- [ ] Keep `base` restrained enough for normal app pages

- [ ] Push the heavier treatment into:
  - `world`
  - `prep`
  - `summon`

- [ ] Make grain, vignette, glow, and symbolic overlays configurable inside the primitive

- [ ] Do not let route files rebuild background atmospherics ad hoc

**Done when**

- World, Prep, and Brain overlay can each feel distinct while still belonging to one system

## Task 6: Turn `Summon` Into The Overlay Tier System

**File**

- Modify: `src/components/primitives/Summon.tsx`

- [ ] Replace the `grimoire` boolean with real variants:
  - `dialog`
  - `sheet`
  - `overlay`
  - `grimoire-overlay`

- [ ] Keep focus management centralized

- [ ] Ensure the heavy visual treatment only exists in `grimoire-overlay`

- [ ] Audit whether `DialogContent` and `SheetContent` class usage needs wrapper surfaces instead of raw classes

**Done when**

- Brain summon can use the signature overlay without shipping that styling to routine sheets and dialogs

## Task 7: Expand `Pill` For Status And Phase Navigation

**File**

- Modify: `src/components/primitives/Pill.tsx`

- [ ] Add variants:
  - `neutral`
  - `info`
  - `warning`
  - `danger`
  - `primary`
  - `phase`

- [ ] Keep pills visually compact and operational

- [ ] Make `phase` appropriate for the session hub without reading like a CTA button

- [ ] Use semantic tokens instead of raw inline OKLCH strings where possible

**Done when**

- the phase bar and status tags no longer require route-specific style hacks

## Task 8: Refactor Shell Components Onto The Primitive Layer

**Files**

- Modify: `src/components/shell/CommandRail.tsx`
- Modify: `src/components/shell/CommandBar.tsx`
- Modify: `src/components/shell/MobileHeader.tsx`
- Modify: `src/components/shell/BrainSummon.tsx`
- Modify: `src/app/(app)/app-shell.tsx`

- [ ] Move shell material styling into `Surface` usage wherever practical

- [ ] Keep `CommandRail` explicitly `Tier 1`
  - calm silhouette
  - minimal ornament
  - iconography over effects

- [ ] Keep `CommandBar` `Tier 1` with one focused accent event
  - pressure gauges can carry the visual pulse
  - do not turn the full bar into a hero object

- [ ] Keep `MobileHeader` aligned with the same shell vocabulary, not a separate look

- [ ] Move `BrainSummon` to `Summon` + `Canvas` + `Card/Surface` composition
  - this should be the clearest `Tier 3` shell moment

- [ ] Reduce inline class decision-making inside shell components

**Done when**

- shell files mostly express layout and state
- primitives own the visual treatment

## Task 9: Apply The Tier Rules To The Home Route

**Files**

- Modify: `src/app/(app)/page.tsx`
- Modify: any imported dashboard feature components used on this page

- [ ] Make Home primarily `Tier 2`

- [ ] Reserve exactly one dominant `Tier 3`-leaning `hero` panel
  - the next-session hero

- [ ] Demote secondary modules to `list`, `detail`, or `feature`

- [ ] Keep amber concentrated
  - one major amber focal event on the page
  - avoid multiple glowing CTAs

- [ ] Use `Section` instead of page-local heading treatments where possible

**Done when**

- Home reads as a clean daily-use shell with one ceremonial anchor instead of a field of equally loud panels

## Task 10: Apply The Tier Rules To World

**Files**

- Modify: `src/app/(app)/campaigns/[slug]/brain/page.tsx` or successor `world` route when migrated
- Modify: relevant `src/components/brain/*`
- Modify: relevant `src/components/world/*`

- [ ] Treat World as the signature surface baseline

- [ ] Use `Canvas variant="world"` as the owning atmosphere

- [ ] Keep the right-side entity detail panel at `Tier 2`

- [ ] Reduce graph clutter before reducing atmosphere
  - demote secondary nodes
  - simplify repeated halo treatments
  - preserve one clear focus path

- [ ] Reserve the heaviest ornaments for focal states, not the entire graph at once

**Done when**

- World feels like the brand-defining surface without collapsing usability into decorative density

## Task 11: Apply The Tier Rules To Prep

**Files**

- Modify: `src/app/(app)/session/[id]/page.tsx`
- Modify: `src/app/(app)/session/[id]/_components/*`
- Modify: any current prep-map or briefing components

- [ ] Treat the map itself as the signature surface

- [ ] Use `Canvas variant="prep"` for the page-level atmosphere

- [ ] Keep the right rail and bottom party strip at `Tier 2`

- [ ] Apply the strongest treatment only to:
  - active focused pin
  - open inline briefing card
  - major phase transition states

- [ ] Prevent the map edge UI from becoming as loud as the map

- [ ] Use `Pill variant="phase"` for the phase bar once implemented

**Done when**

- Prep reads as one decisive workspace with dramatic focus states rather than four competing ornate zones

## Task 12: Add Guardrails And Verification

**Files**

- Modify/create tests under `tests/workflows/*` as needed
- Modify lint/test expectations if class or variant APIs change

- [ ] Add at least one test that asserts the shell still renders after primitive refactors

- [ ] Add at least one test for Brain summon open/close behavior if `Summon` is refactored

- [ ] Add at least one test for the session phase bar once `Pill variant="phase"` exists

- [ ] Add a grep-style regression check for raw material styling in migrated files
  - repeated raw `bg-[var(--q-...)]`
  - repeated raw border/glow strings
  - old `.glass-*` class usage in routes being migrated

- [ ] Run:
  - type check
  - targeted Playwright flow tests
  - existing QA cycle if the touched routes are part of it

**Done when**

- variant APIs are stable enough that new pages will naturally consume the system instead of bypassing it

## Recommended First PR

Keep the first execution slice narrow:

1. `tokens.css`
2. `globals.css`
3. `Surface.tsx`
4. `Card.tsx`
5. `Section.tsx`
6. `Canvas.tsx`
7. `Summon.tsx`
8. `Pill.tsx`
9. `BrainSummon.tsx`
10. `CommandBar.tsx`

That gives the project the tiered visual foundation without forcing Home, World, and Prep to migrate in the same change.

## Definition Of Done

- primitives encode the tier model directly
- shell components consume primitives instead of hardcoding most material classes
- Home has one clear hero and calmer supporting panels
- World is the richest surface, but its supporting panels stay readable
- Prep concentrates drama in the map focus state rather than every supporting region
- migrated files rely on semantic primitives/tokens more than ad hoc classes
