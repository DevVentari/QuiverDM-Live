# DM Brain — Prep Workspace Integration

**Date:** 2026-03-21
**Status:** Draft

## Problem

The prep workspace is disconnected from the DM Brain. A DM prepping session 8 has no way to see which hooks are unresolved, which entities changed last session, or what pressure warnings are building — without leaving prep and navigating to the brain. The existing `brain.coDM.prepSuggestions` endpoint exists but only returns a cached Co-DM suggestion object (with `npcMotivationUpdates`, `factionShifts`, `nextSessionFocus`) — not the per-section AI suggestions the prep workspace needs.

## Solution

Three additions to the prep workspace: a "Last Session" context card at the top, a slide-in Brain context drawer from the header, and a "Brain Suggest" button on each prep section with a new per-section AI endpoint.

---

## Change 1 — Last Session Context Card

**New component:** `src/components/session/prep/prep-brain-context-card.tsx`

Rendered at the top of `PrepWorkspace`, above the section navigation.

**Props:** `{ campaignId: string }`

**Data:** Calls `trpc.brain.state.get({ campaignId })` and `trpc.brain.timeline({ campaignId, limit: 20 })`. Client-side: finds the most recent completed session's entries in the timeline (by grouping `WorldStateChange` records by their most recent batch), then extracts:
- Entities that changed in the most recent ingestion batch (up to 3)
- Hooks that opened or escalated in the most recent batch (up to 2)
- Any pressure track currently above 0.7

**Visual:** Stone card with amber overline label "Brain · Last Session". Three inline columns:
- **Changed** — entity name chips with type badge
- **New hooks** — hook description truncated to 40 chars + urgency badge
- **Pressure** — track name + value e.g. "Political ↑ 0.78"

Collapsed to a one-line summary by default ("3 entities changed · 1 new hook"). Expands on click. Shows nothing (renders null) if `WorldState` doesn't exist for the campaign (brain not seeded).

---

## Change 2 — Brain Context Drawer

**New component:** `src/components/session/prep/prep-brain-drawer.tsx`

A shadcn `<Sheet side="right">` triggered by a `Brain` icon button in `PrepHeader`.

**Props:** `{ campaignId: string; open: boolean; onClose: () => void }`

**Data:** Uses `trpc.brain.state.get({ campaignId })` and `trpc.brain.entities.list({ campaignId })` — both already exist and are used on the Brain page.

**Three sections:**

**Open Hooks** — sorted by urgency (high → medium → low). Each hook: description, urgency badge, age (sessions count from `WorldStateChange` creation date), linked entity name chips. Clicking a hook opens a new browser tab to the Brain page (hook detail requires SP2).

**Recent Entity Changes** — last 20 `WorldStateChange` entries from `brain.timeline`, grouped by entity, showing the most recent change per entity. Up to 8 entities. Shows entity name (linked to brain entity detail), type badge, what changed.

**Pressure Warnings** — tracks above 0.7 only. One line per track: "Supernatural pressure is elevated (0.83)". Empty section hidden.

**PrepHeader addition** (`src/components/session/prep/prep-header.tsx`):

Add to the inline params block:
```ts
brainDrawerOpen: boolean;
onBrainDrawerToggle: () => void;
```

Add a `Brain` icon button (Lucide `Brain`) in the right side of the header, before the fullscreen toggle. `onClick` → calls `onBrainDrawerToggle`.

**PrepWorkspace addition** (`src/components/session/prep/prep-workspace.tsx`):

Add `brainDrawerOpen` to local state (default `false`). Pass `brainDrawerOpen` and `onBrainDrawerToggle` down to `PrepHeader`. Render `<PrepBrainDrawer>` alongside the workspace, outside the main layout grid.

---

## Change 3 — Per-Section Brain Suggest

**New tRPC procedure:** `brain.sectionSuggest`

Replaces the existing `brain.coDM.prepSuggestions` for per-section use. The existing endpoint is unchanged.

**Input:**
```ts
z.object({
  campaignId: z.string(),
  section: z.enum(['characters', 'strong-start', 'scenes', 'secrets', 'npcs', 'monsters', 'rewards', 'threads']),
  currentContent: z.string().optional(), // existing section content, for context
})
```

**Procedure:** Uses `protectedProcedure` with manual ownership check (consistent with all existing `brain.ts` procedures — `campaignDMProcedure` is not imported in this router). Fetches brain context (world state, recent entity changes, open hooks, active threats). Calls `buildBrainSectionPrompt(section, brainContext, currentContent)` in `src/lib/ai/prep-prompts.ts`. Returns `{ suggestion: string }`.

**`prep-prompts.ts` addition:** `buildBrainSectionPrompt(section, brainContext, currentContent)` — one function with a switch on `section`. Each case produces a targeted prompt, e.g.:
- `npcs`: "Given these active entities and their current states, suggest 2–3 NPCs for this session with motivations: [entity list]"
- `threads`: "Given these unresolved hooks, suggest 1–2 loose threads to surface this session: [hooks list]"
- `strong-start`: "Given current pressure levels and recent events, suggest a strong opening scene: [context]"

**UI — Brain Suggest button per section:**

Each prep section card in `PrepWorkspace` gets a small `Brain` icon button in its top-right header area. Behaviour:
1. Click → loading spinner replaces Brain icon
2. Calls `brain.sectionSuggest` with `{ campaignId, section, currentContent }`
3. On success: shows a dismissible suggestion box below the section header, amber-bordered:

```
Brain suggests:
[suggestion text]
[✓ Use this]  [✕ Dismiss]
```

4. "Use this" → appends suggestion to the section content via a new `onBrainSuggest(section, suggestion)` callback prop on each section card, handled in `PrepWorkspace`. The callback appends to the current field value using `setPrepData` — string sections (e.g. `strongStart`) get the suggestion appended with a newline; array sections (e.g. `npcs`, `scenes`, `monsters`) get a new item created from the suggestion text.
5. Dismiss → hides the box
6. Error → replaces Brain icon with a muted "No brain data" tooltip (fires when brain isn't seeded)

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/session/prep/prep-brain-context-card.tsx` | New |
| `src/components/session/prep/prep-brain-drawer.tsx` | New |
| `src/components/session/prep/prep-header.tsx` | Add `brainDrawerOpen` + `onBrainDrawerToggle` props; add Brain icon button |
| `src/components/session/prep/prep-workspace.tsx` | Mount context card + drawer; add brain drawer state; add Brain Suggest to section cards |
| `src/lib/ai/prep-prompts.ts` | Add `buildBrainSectionPrompt` function |
| `src/server/routers/brain.ts` | Add `brain.sectionSuggest` procedure |

---

## Out of Scope

- Brain Suggest pulling D&D Beyond character data into the `characters` section
- Auto-filling entire sections without DM review
- Brain-aware prep completion scoring
- Hook detail drawer in the prep context (links to Brain page instead — SP2 dependency)
