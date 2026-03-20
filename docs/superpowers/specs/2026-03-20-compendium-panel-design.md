# Compendium Panel — Design Spec

## Overview

A global **Compendium Panel** accessible from every page in the app. A book icon pinned to the bottom of the sidebar opens a full-height slide-over from the left. DMs can browse, search, and act on all imported sourcebook content — encounters, monsters, chapters, items — without leaving their current context.

QuiverDM is a DM-only app. The compendium is DM-facing only.

---

## Entry Point

A tome/book icon is pinned to the bottom of the sidebar in both `sidebar.tsx` and `mobile-sidebar.tsx`, above the settings icon. Clicking it toggles the compendium panel open/closed. The icon has an amber glow when open.

---

## Panel Layout

Full-height slide-over using the existing `Sheet` component (`side="left"`). Approximately 700px wide on desktop, full-width on mobile. The current page is visible but dimmed behind it (overlay, not push).

Two-pane layout inside the panel:

**Left pane (~380px):**
- Header: "COMPENDIUM" label + sourcebook name (e.g. "Vecna: Eve of Ruin") + close button
- Tab bar: Encounters · Monsters · Chapters · Items
- Search input (per-tab, clears on tab switch)
- Scrollable list — encounters grouped by chapter with run/prepped badges

**Right pane (flex remaining):**
- Detail view for the selected item
- Scene description, creature list, or chapter prose depending on type
- Action buttons at the bottom of the detail pane

---

## Tabs

### Encounters Tab
- List of all `EncounterPlan` records for the campaign where `ddbChapterId` is set (sourcebook-linked)
- Grouped by chapter (derived from `ddbChapterId`)
- Each row shows: encounter name, creature count, difficulty, status badge
- Status badges:
  - **PREPPED** (green) — plan has `creatures.length > 0`
  - **RUN [date]** (amber) — plan has `lastRunAt` set, shows formatted date
  - No badge — unprepped, never run
- Clicking a row opens it in the detail pane

### Monsters Tab
- Queries `HomebrewContent` where `type = 'creature'` for the campaign's linked user
- Search by name, CR, type
- Row shows: name, CR, type tag
- Detail pane shows full stat block (reuses `MonsterStatBlock` component)
- Action: Add to current encounter (if on encounter builder page)

### Chapters Tab
- Queries `HomebrewContent` where `type = 'location'` and `sourceType = 'dndbeyond_import'`
- List shows chapter name and prose length
- Detail pane shows scene description / prose excerpt
- V1: read-only, no actions

### Items Tab
- V1 stub — tab visible, body shows "Coming soon"

---

## Detail Pane — Actions

Actions are context-aware based on `usePathname()`.

### Encounter actions:
1. **Load to Encounter Builder** (green)
   - If on `/campaigns/[slug]/encounters/[planId]`: adds the sourcebook encounter's creatures to the current plan via `addCreature` mutations
   - Otherwise: creates a new `EncounterPlan` pre-filled with the sourcebook encounter metadata and navigates to it
2. **Prep with DM Brain** (blue)
   - Navigates to `/campaigns/[slug]/brain?encounter=[planId]`
   - V1 stub — Brain integration is a separate feature
3. **Mark as Run** (amber)
   - Calls `encounterPlans.markAsRun({ planId, sessionId? })`
   - If currently on a live session page (`/sessions/[id]/live`), passes `sessionId` automatically
   - Badge updates optimistically in the list

### Monster actions:
1. **Add to Encounter** (green) — only shown when on encounter builder page; calls `addCreature`
2. **View Stat Block** — expands full stat block in detail pane (default state)

---

## Data Model Changes

```prisma
model EncounterPlan {
  // ... existing fields ...
  lastRunAt        DateTime?
  timesRun         Int       @default(0)
  lastRunSessionId String?
}
```

No other schema changes. Monsters, chapters, and items query existing `HomebrewContent`.

---

## New tRPC Endpoints

On `encounterPlans` router:

```ts
// Returns all sourcebook-linked plans for a campaign, grouped by chapter
getBySourcebook({ campaignId: string, sourceSlug: string })
// Returns: { chapterSlug: string, chapterName: string, plans: EncounterPlanSummary[] }[]

// Mark a plan as run
markAsRun({ planId: string, sessionId?: string })
// Sets lastRunAt = now(), increments timesRun, optionally sets lastRunSessionId
```

---

## Global State

Small Zustand slice (follows existing app pattern):

```ts
interface CompendiumStore {
  isOpen: boolean
  activeTab: 'encounters' | 'monsters' | 'chapters' | 'items'
  selectedItemId: string | null
  selectedItemType: 'encounter' | 'monster' | 'chapter' | 'item' | null
  open: () => void
  close: () => void
  setTab: (tab) => void
  selectItem: (id, type) => void
}
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/compendium/compendium-panel.tsx` | Sheet wrapper, Zustand wiring, two-pane layout |
| `src/components/compendium/encounters-tab.tsx` | Grouped encounter list with badges |
| `src/components/compendium/monsters-tab.tsx` | Monster search + stat block preview |
| `src/components/compendium/chapters-tab.tsx` | Chapter browse, read-only |
| `src/components/compendium/items-tab.tsx` | Stub tab |
| `src/components/compendium/detail-pane.tsx` | Detail + context-aware actions |
| `src/store/compendium-store.ts` | Zustand slice |

## Modified Files

| File | Change |
|------|--------|
| `src/components/sidebar.tsx` | Add compendium icon + toggle to bottom |
| `src/components/mobile-sidebar.tsx` | Same |
| `src/server/routers/encounter-plans.ts` | Add `getBySourcebook` + `markAsRun` |
| `prisma/schema.prisma` | Add `lastRunAt`, `timesRun`, `lastRunSessionId` to `EncounterPlan` |

---

## V1 Scope

**In:** Encounters tab (full), Monsters tab (full), Chapters tab (read-only), Items tab (stub), run tracking, Load to Builder, Mark as Run, Prep with Brain stub.

**Out:** Drag-and-drop (click to load only), full DM Brain prep integration, Items tab content, player-facing anything.
