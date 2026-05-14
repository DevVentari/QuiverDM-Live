# Single-Flow Atlas Theme Design

**Date:** 2026-05-11  
**Status:** Draft

## Goal

Create one coherent visual language across QuiverDM. The app should feel like a daylight archive or campaign atlas: warm parchment, ink text, amber accent, stone-like cards, and subtle depth. Navigation should never feel like a theme change. Only density and contrast should vary by context.

## Design Intent

The product should read as a single system, not separate skins for home, NPCs, sessions, and settings.

- Base mood: readable, inviting, tabletop-friendly
- Brand cue: ancient archive, not enterprise SaaS
- Accent role: amber is precious and reserved for primary actions, active paths, and key highlights
- Surface role: soft parchment and stone layers with restrained shadow

## Core Principles

1. One flow throughout the app
   - Every major screen uses the same tokens, materials, and typography.
   - No screen should feel like it switched themes on navigation.

2. Light by default
   - Use the daylight atlas system as the primary app expression.
   - Reserve darker panels only for dense operational regions when they improve focus.

3. Amber is scarce
   - Use amber for one dominant action or emphasis per screen.
   - Secondary states should rely on neutral contrast, not extra color.

4. Depth through material, not decoration
   - Prefer layered surfaces, subtle borders, and restrained shadow.
   - Avoid glow-heavy accents, glass everywhere, or decorative gradients.

5. Mobile-safe by default
   - All controls should work comfortably at the table on a phone.
   - Minimum touch target: 44px.

## Theme Tokens

Define the system in `src/app/globals.css` as shared CSS variables.

### Palette

Use these as the first pass for the app-wide theme:

```css
:root {
  --paper: oklch(98.5% 0.008 85);
  --paper-2: oklch(96.8% 0.010 85);
  --paper-3: oklch(94.2% 0.014 85);
  --paper-4: oklch(90.8% 0.017 85);

  --ink: oklch(27% 0.016 60);
  --ink-2: oklch(40% 0.015 60);
  --ink-3: oklch(56% 0.014 60);
  --ink-4: oklch(71% 0.014 68);

  --rule: oklch(88% 0.016 85);
  --rule-2: oklch(83% 0.018 85);

  --accent: oklch(67% 0.14 58);
  --accent-soft: oklch(67% 0.14 58 / 0.10);
  --accent-line: oklch(67% 0.14 58 / 0.38);
  --accent-ink: oklch(36% 0.09 58);
}
```

### Typography

- Display: Spectral or equivalent serif with authority
- Body: IBM Plex Sans or a similar readable sans
- Mono: IBM Plex Mono for counts, clocks, labels, and stats

Rules:

- Use serif for headings, section labels, and key numbers
- Use sans for body copy and navigation
- Use mono only for metadata and machine-like values
- Do not use Inter as the primary identity font

### Surface Tokens

Add shared surface tokens for consistent layering:

- `--surface-base` - app background
- `--surface-panel` - primary cards and sheets
- `--surface-panel-soft` - lower emphasis panels
- `--surface-elevated` - overlays, modals, popovers
- `--surface-line` - borders and separators
- `--surface-shadow` - the only default card shadow

## Layout System

### App Shell

The app should keep a stable shell everywhere:

- Top header with campaign identity and quick actions
- Left icon rail or equivalent navigation on desktop
- Bottom navigation or condensed rail on mobile
- Main content area with one dominant reading path

The shell can adapt in density, but not in identity.

### Page Composition

Each major page should follow the same rhythm:

- Overline or section label first
- Strong headline second
- Short explanatory body copy
- Primary action visible within the first viewport
- Supporting cards or lists below

### Mobile Behavior

Mobile is not a collapsed desktop view.

- Collapse the rail into a bottom bar or compact segmented nav
- Stack panels vertically
- Keep the most important action above the fold
- Preserve 44px minimum touch targets

## Component Rules

### Cards

Cards should feel like parchment or stone panels, not SaaS tiles.

- Use soft border contrast and one light shadow
- Keep border radius modest
- Avoid nested card-in-card stacks unless it is structurally necessary

### Primary Actions

- One primary action per screen should use amber
- Secondary actions should stay neutral
- Destructive actions should be muted red, not bright warning red

### Sections

Use a consistent section pattern:

```tsx
<p className="label-overline">SECTION</p>
<div className="section-rule mb-4" />
```

Use this across:

- NPC lists and detail views
- Sessions and prep screens
- Homebrew and library surfaces
- Campaign admin and settings pages

### Lists

- Prefer clean rows with ample spacing over dense tables
- Use subtle dividers, not heavy boxes
- Keep scan order obvious

### Empty States

- Empty states should teach the next action
- Avoid dead-end "nothing here" copy
- Keep the voice in-world, not corporate

## Motion

Motion should be restrained and functional.

- Use entrance motion for major page sections
- Use subtle state transitions for hover, selection, and expansion
- Keep easing smooth and non-bouncy
- Avoid decorative motion that slows down table use

## Accessibility Rules

- Maintain strong contrast for text and key controls
- Never encode meaning in color alone
- Keep focus states visible and consistent
- Preserve readable type sizes for long stat blocks and list views

## Implementation Order

1. Promote the shared token set into `src/app/globals.css`
2. Normalize shell components to consume the new tokens
3. Update the home page first, then high-traffic campaign pages
4. Convert list/card patterns to the shared section and surface rules
5. Verify mobile behavior after each major surface change

## Acceptance Criteria

The theme is acceptable when:

- Home, NPCs, sessions, quests, and settings all feel like the same product
- The app is light by default and still reads as QuiverDM
- Amber feels special, not overused
- Mobile users can navigate without a separate mental model
- No screen feels like it switched to a different design system

## Non-Goals

- No separate dark-first app theme
- No neon or purple startup styling
- No glassmorphism as the dominant visual language
- No one-off page-specific aesthetic exceptions

## Notes

This theme is meant to replace the current split identity and become the visual baseline for the app. Darker treatment should be used only when the task demands compression or focus, not as a separate brand direction.
