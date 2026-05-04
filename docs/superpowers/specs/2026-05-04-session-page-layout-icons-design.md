# Session Page — Layout & Icon Treatment

**Date:** 2026-05-04  
**Status:** Approved

## Problem

The session hub (`/campaigns/[slug]/sessions/[sessionId]`) uses `max-w-2xl` (672px), leaving most of the viewport wasted alongside the sidebar. The pipeline tracker uses abstract dots with no phase identity. Prep section chips are text-only at 9px — hard to scan. Phase complete rows use a generic check dot regardless of which phase is complete.

## Solution

Four targeted changes across four files. No structural redesign, no new components.

## Changes

### 1. Width — `page.tsx`

`max-w-2xl` → `max-w-3xl` on the root wrapper div. Also applies to the loading skeleton div.

### 2. Pipeline icons — `session-pipeline.tsx`

Replace the 6px abstract dot with a phase-specific Lucide icon. Add a `PHASE_ICONS` constant map at the top of the file:

```ts
const PHASE_ICONS: Record<SessionPhase, React.ElementType> = {
  prep:       BookOpen,
  ran:        Play,
  processing: Mic,
  summary:    MessageSquare,
  recap:      FileText,
  complete:   Star,
};
```

Icon sizing: `h-3.5 w-3.5`. States:
- **Done:** `text-emerald-400/70`
- **Active:** `text-amber-400` + `drop-shadow-[0_0_4px_hsl(35_80%_55%/0.5)]`
- **Locked:** `text-muted-foreground/30`

Remove the dot div entirely. Keep the existing `shadow-[0_0_6px_...]` on the active step's background, not the icon.

### 3. Phase complete rows — `phase-complete-row.tsx`

Replace the generic `Check` icon inside the green circle with the phase-specific icon from the same `PHASE_ICONS` map. Import the map from `session-lifecycle` or inline a local copy. Icon size inside the circle: `h-3 w-3`. Color: `text-emerald-400`. The circle itself (`h-5 w-5 bg-emerald-500/20`) stays unchanged.

### 4. Prep section chips — `prep-status-card.tsx`

Add a `SECTION_ICONS` map at the top of the file:

```ts
const SECTION_ICONS: Record<string, React.ElementType> = {
  characters:   Users,
  'strong-start': Zap,
  scenes:       MapPin,
  secrets:      KeyRound,
  npcs:         Users2,
  monsters:     Skull,
  rewards:      Award,
  threads:      List,
};
```

Each chip `div` becomes a flex row: `flex items-center justify-center gap-1`. Add `<Icon className="h-2 w-2 shrink-0" />` before the label text. Font size stays `text-[9px]`.

## Files Changed

| File | Change |
|------|--------|
| `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | `max-w-2xl` → `max-w-3xl` |
| `src/components/session/session-pipeline.tsx` | Phase icons replace abstract dots |
| `src/components/session/phase-complete-row.tsx` | Phase icon in green circle |
| `src/components/session/prep-status-card.tsx` | Icon + label in section chips |

## Out of Scope

- Session prep page width (separate decision)
- Session cockpit layout
- Any color, spacing, or card styling changes
- New components
