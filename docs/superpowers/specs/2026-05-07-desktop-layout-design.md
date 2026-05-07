# QuiverDM Desktop Layout — Shell Redesign

**Date:** 2026-05-07
**Scope:** App shell + all authenticated pages
**Target:** 2560×1440 primary, scaling to 1280×800. Mobile breakpoints preserved via existing responsive patterns.
**Context:** Supersedes the page-level redesign already shipped in `88e6ef0`. This spec covers a full shell replacement: CommandRail, CommandBar, and Split Canvas — the structural scaffolding that those pages render inside.

---

## Problem

At 2560×1440 the current shell wastes ~760px of horizontal space (two 380px gutters from the `max-w-[1800px]` constraint). The 240px sidebar and 56px header consume vertical real estate without conveying campaign state. The atmospheric feel of the design system is present in components but the shell itself is neutral and forgettable.

---

## Architecture: Two Canvas Modes

Every authenticated page gets exactly one canvas layout. The shell always renders CommandRail + CommandBar — those two components adapt their content to context. The canvas beneath them is one of two types:

| Canvas | Used by |
|--------|---------|
| `SplitCanvas` | Sessions, NPCs, Encounters, Members, `/campaigns`, `/homebrew` |
| `BentoCanvas` | Campaign Overview (`/campaigns/[slug]`), Dashboard |

CommandBar adapts internally: campaign context shows the name + pressure gauges; global context shows a breadcrumb + page-level actions. No separate "global bar" component is needed.

---

## 1. CommandRail

**Replaces:** `src/components/sidebar.tsx`
**New file:** `src/components/layout/command-rail.tsx`

### Dimensions
- Default: 72px wide (collapsed, icon-only)
- Pinned: 260px wide (expanded, icon + label)
- State stored in `localStorage` key `quiver.rail.pinned`

### Structure (top → bottom)
1. **Logo zone** — QuiverDM gem icon centered (72px) or gem + wordmark (260px). Tapping gem in collapsed mode does nothing; tapping when expanded navigates to `/dashboard`.
2. **Nav icons** — icon buttons for each nav section. Each is 44px tall, full width, icon centered. Active state: amber left border (2px) + amber icon + `rgba(200,148,58, 0.08)` background.
3. **Spacer** — `flex: 1`
4. **Footer icons** — Party (shield), Settings (gear). Same 44×44 button style.
5. **Pin toggle** — bottom-most icon, toggles expanded/collapsed. `PanelLeft` / `PanelLeftClose`.

### Nav sections (campaign context)
- Overview (`Home`)
- Sessions (`CalendarDays`)
- NPCs (`Drama`)
- Encounters (`Swords`)
- World / Lore (`Library`)
- DM Brain (`Brain`)

### Nav sections (global context)
- Dashboard (`LayoutDashboard`)
- Campaigns (`Swords`)
- Homebrew (`BookOpen`)
- Recaps (`ScrollText`)

### Visual
- Background: `hsl(240 12% 4.5%)` — slightly darker than `--background`
- Right border: `hsl(35 35% 18%)` — same amber-tinted stone
- Ambient top gradient: `radial-gradient(ellipse 140% 25% at 50% 0%, hsl(35 80% 38% / 0.12), transparent)`
- Vertical amber accent on right edge: same `linear-gradient(180deg, transparent, hsl(35 80% 55% / 0.30) 30%, hsl(35 80% 55% / 0.30) 65%, transparent)` as current sidebar

### Transition
- Width animates `200ms ease` when toggling pinned state
- Labels fade in/out with opacity transition, `overflow: hidden`

---

## 2. CommandBar

**Replaces:** `src/app/(app)/app-shell.tsx` header element
**Height:** 48px
**New file:** `src/components/layout/command-bar.tsx`

### Layout (left → right)
1. **Campaign name block** — `campaign` context label (8px, amber/50%) above campaign name (14px bold, `hsl(35 60% 88%)`). Right of this block: chevron-down for campaign-switcher dropdown. Separated from the rest by a 1px vertical divider.
2. **Pressure gauges strip** — 4 horizontal gauge groups, each showing: name label (9px uppercase, muted) / track (36px × 3px, rounded) + value text. Only rendered when `isDM && inCampaign`. Gauges: Political, Supernatural, Economic, Cosmic. Color tiers: >75% red, >50% amber, ≤50% muted slate. The strip fills the available center space (`flex: 1`).
3. **Vertical divider**
4. **Quick actions** — context-sensitive pill buttons. In campaign: "New Session" (primary amber) + "Import" (ghost). In global: none.
5. **Vertical divider**
6. **User avatar** — 28px rounded circle. Dropdown on click: Profile / Settings / Sign out.

### Non-campaign pages (global shell)
- Campaign name block replaced by breadcrumb path (`Dashboard`, `Campaigns`, etc.)
- Pressure gauges strip omitted
- Quick actions: `New Campaign` on `/campaigns`; none elsewhere

### Visual
- Background: `linear-gradient(180deg, hsl(240 12% 7% / 0.98), hsl(240 12% 5.5% / 0.96))`
- Bottom border: `hsl(35 35% 14%)` + an amber-glow gradient overlay: `linear-gradient(90deg, transparent, hsl(35 80% 55% / 0.2) 30%, hsl(35 80% 55% / 0.25) 50%, transparent)`
- No backdrop-blur — the bar is opaque, not glassy

---

## 3. SplitCanvas (list pages)

**Used by:** Sessions, NPCs, Encounters, Members, Homebrew (campaign-context versions)
**New file:** `src/components/layout/split-canvas.tsx`

### Column widths
- Left pane: 26% of canvas width
- Right canvas: 74% (`flex: 1`)
- No `max-width` constraint on the canvas — full bleed

### Left Pane
- Background: `hsl(240 12% 4.2%)` — slightly darker than rail
- Right border: `hsl(35 35% 11%)`
- Header strip (32px): entity label + count badge (left) + filter pills (right). Background same as pane. Bottom border same.
- Filter pills: entity-specific (Sessions: All/Planning/Active/Complete; NPCs: All/Major/Minor; Encounters: All/Active/Draft; Members: All/DM/Player)
- Scrollable list body: row height ~52px. Each row: leading indicator (number circle, avatar, or icon) + name + meta line + status badges.
- Active row: `border-left: 2px solid hsl(35 80% 55% / 0.5)` + `hsl(35 80% 55% / 0.06)` background. Inactive hover: `hsl(255 10% 100% / 0.025)`.

### Canvas Pane

#### Canvas Header (flat strip, ~52px)
Replaces the tall `PageLayout` hero card. Saves ~120px of vertical real estate.

- Background: `linear-gradient(135deg, hsl(240 12% 9% / 0.98), hsl(240 12% 5.5% / 0.96))`
- Ambient glow: `radial-gradient(ellipse 60% 80% at 0% 0%, hsl(35 80% 55% / 0.09), transparent 55%)` + faint purple upper-right
- Bottom border: `hsl(35 35% 13%)`
- Left: overline label (Cinzel, 9px, amber/60%, uppercase) + page title (Cinzel or display, 18px bold)
- Right: stat tiles (2–3 small boxes: value large + label small) + primary action button

#### Canvas Body
Full-bleed below the header. No outer padding or max-width. Each list page defines its own internal grid:

- **Sessions:** session detail panel (`SessionInspectorPanel`, existing from prior spec) — full height, scrollable internally
- **NPCs:** NPC detail panel (existing master-detail) — unchanged
- **Encounters:** encounter detail / encounter planner — existing component
- **Members:** member detail panel (`MemberDetailPanel`, existing from prior spec) — unchanged

---

## 4. BentoCanvas (overview pages)

**Used by:** Campaign Overview, Dashboard
**New file:** `src/components/layout/bento-canvas.tsx`

### Structure
- No split pane — single full-width canvas area
- Canvas Header strip: same spec as SplitCanvas canvas header
- Canvas Body: `grid` with `gap-4`. Column count per page:

| Page | Grid |
|------|------|
| Campaign Overview | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| Dashboard | `grid-cols-1 lg:grid-cols-[260px_1fr]` |

- No max-width on grid — full bleed within the canvas pane

---

## 5. App Shell Changes

**File:** `src/app/(app)/app-shell.tsx`

### Before
```
<div className="flex h-screen overflow-hidden">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    <header className="glass-shell flex h-14 ...">
    <main ...>
      <div className="mx-auto w-full max-w-[1400px] 2xl:max-w-[1800px] p-4 sm:p-6">
```

### After
```
<div className="flex h-screen overflow-hidden">
  <CommandRail />
  <div className="flex flex-1 flex-col overflow-hidden">
    <CommandBar />
    <main className="flex-1 overflow-hidden">
      {/* children render directly — no wrapper div, no max-width */}
```

The `overflow-y-auto` scrolling is owned by the canvas pane inside each layout component, not by `main`. This allows the list pane to scroll independently from the canvas pane.

### Campaign context detection
The shell reads `pathname` to determine which CommandBar and canvas layout to render. Campaign slug detection: `pathname.match(/\/campaigns\/([^/]+)/)?.[1]` — same as current sidebar.

---

## 6. PageLayout Changes

**File:** `src/components/layout/page-layout.tsx`

The `PageLayout` component is **deprecated** for all pages that adopt the new shell. Pages migrating to the new shell use:
- `SplitCanvas` with a `CanvasHeader` internally rendered
- `BentoCanvas` with a `CanvasHeader` internally rendered

`PageLayout` is retained (without changes) for pages not in scope of this redesign: session detail, prep wizard, session live cockpit, settings. This avoids touching 10+ files in a single migration.

---

## 7. Page Migration Map

| Route | New layout | Left pane content | Canvas body |
|-------|-----------|-------------------|-------------|
| `/campaigns/[slug]/sessions` | SplitCanvas | Session list | SessionInspectorPanel |
| `/campaigns/[slug]/npcs` | SplitCanvas | NPC list | NPC detail (existing) |
| `/campaigns/[slug]/encounters` | SplitCanvas | Encounter list | Encounter detail |
| `/campaigns/[slug]/members` | SplitCanvas | Member list | MemberDetailPanel |
| `/campaigns/[slug]` | BentoCanvas | — | Bento grid cards |
| `/dashboard` | BentoCanvas | — | Two-column (active campaign + list) |
| `/campaigns` | SplitCanvas | Campaign list | Campaign card detail |
| `/homebrew` | SplitCanvas | Type filter sidebar | Card grid |

---

## 8. Mobile Behavior

CommandRail: hidden below `md`. Mobile uses the existing `MobileSidebar` (sheet triggered from header). No changes to mobile — this redesign is desktop-first.

CommandBar: hidden below `md`. Mobile header retains current implementation.

SplitCanvas / BentoCanvas: below `md`, the left pane collapses and the canvas fills full width. Left pane becomes a sheet (triggered by a filter button in the canvas header).

---

## 9. New Files

| File | Purpose |
|------|---------|
| `src/components/layout/command-rail.tsx` | Icon rail, replaces sidebar |
| `src/components/layout/command-bar.tsx` | 48px top bar with gauges |
| `src/components/layout/split-canvas.tsx` | Two-pane layout shell |
| `src/components/layout/bento-canvas.tsx` | Full-width canvas for overview pages |

---

## 10. Preserved Files (no changes)

- All tRPC routers and services
- All Prisma schema
- All existing detail panel components (`SessionInspectorPanel`, `MemberDetailPanel`, NPC detail)
- Session detail page, prep wizard, session live cockpit
- Mobile sidebar (`MobileSidebar` component)

---

## 11. Success Criteria

- On a 2560×1440 viewport, the app uses the full horizontal canvas — no gutters wider than 24px
- CommandRail collapses to 72px by default, pins to 260px via localStorage
- CommandBar shows 4 world pressure gauges in DM-campaign context, nothing in global context
- SplitCanvas left pane scrolls independently from the canvas pane
- Canvas header is ≤60px tall — no tall hero banners inside the canvas
- All migrated pages render on 1280×800 without horizontal overflow
- Mobile (≤768px) continues to use the existing MobileSidebar + header — no regression
