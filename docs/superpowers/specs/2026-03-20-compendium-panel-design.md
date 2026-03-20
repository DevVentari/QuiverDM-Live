# Compendium Panel — Design Spec

## Overview

A global **Compendium Panel** accessible from every page in the app. A book icon pinned to the bottom of the sidebar opens a full-height slide-over from the left. DMs can browse, search, and act on all imported sourcebook content — encounters, monsters, chapters, items — without leaving their current context.

QuiverDM is a DM-only app. The compendium is DM-facing only.

---

## Entry Point

A tome/book icon is pinned to the bottom of `src/components/sidebar.tsx`. `MobileSidebar` is exported from the same file (not a separate file) — add the icon there too. The icon sits above the settings icon. Clicking it toggles the compendium panel open/closed. The icon uses the amber glow treatment when open.

`<CompendiumPanel />` must be rendered in `src/app/(app)/layout.tsx` alongside the sidebar so it is globally accessible across all authenticated routes.

---

## Panel Layout

Full-height slide-over using the existing `Sheet` component (`side="left"`). Approximately 700px wide on desktop, full-width on mobile. The current page is visible but dimmed behind it (overlay, not push). The Sheet z-index layers above the sidebar — check existing sidebar z-index in `sidebar.tsx` and ensure Sheet is one level higher. Sidebar icons will not be accessible while the panel is open; this is intentional.

Two-pane layout inside the panel:

**Left pane (~380px):**
- Header: "COMPENDIUM" label + sourcebook name + close button (see Multi-Sourcebook below)
- Tab bar: Encounters · Monsters · Chapters · Items
- Search input (per-tab, clears on tab switch)
- Scrollable list with run/prepped badges

**Right pane (flex remaining):**
- Detail view for the selected item
- Action buttons at the bottom of the detail pane

---

## Tabs

### Encounters Tab

- Queries `EncounterPlan` records for the campaign where `ddbChapterId IS NOT NULL` via `getBySourcebook`
- Include `_count: { select: { creatures: true } }` in the Prisma query so badge logic has creature count
- Grouped by chapter using `ddbChapterId` value (e.g. `veor-chapter-4`)
- Chapter display names resolved by joining `HomebrewContent` where `type = 'location'` and `dndBeyondId = ddbChapterId`. The `name` field contains the human-readable chapter name (e.g. `"Vecna: Eve of Ruin: Chapter 4"`). Fall back to humanising the slug if no match.
- Each row shows: encounter name, difficulty, status badge
- Badge precedence (first match wins):
  1. **RUN [date]** (amber) — `lastRunAt` is set; show formatted date (e.g. "Mar 14")
  2. **PREPPED** (green) — `_count.creatures > 0`
  3. No badge — unprepped, never run
- Clicking a row opens it in the detail pane

**Detail pane for an encounter:**
- Shows name, difficulty, `sceneDescription`
- Shows "Monsters in this chapter" — a reference list sourced from the parent chapter's `HomebrewContent.data.monsterLinks` array (not from `EncounterPlanCreature` — the plans are empty containers by design). Label clearly: "Monsters available in this chapter".
- Sourcebook encounter plans have no pre-attached creatures — the DM adds them manually from the Monsters tab after loading.

### Monsters Tab

- Queries `HomebrewContent` scoped to the current campaign via `CampaignHomebrewContent` join table (`campaignId` → `homebrewId`), filtered to `type = 'creature'`
- Do NOT query by `userId` alone — that returns monsters across all campaigns
- Client-side filter on returned list for V1 (no MeiliSearch needed for compendium)
- Row shows: name, CR, type tag
- Detail pane shows full stat block. `HomebrewContent.data` for type `'creature'` is a JSON object matching `MonsterStatBlockData` from `src/components/homebrew/MonsterStatBlock.tsx`. Guard for null data before rendering: `if (!content.data) return null`. Cast as `content.data as unknown as MonsterStatBlockData`.
- Action: "Add to Encounter" — only shown when `currentPlanId` is set (see Context Detection)

### Chapters Tab

- Queries `HomebrewContent` where `type = 'location'` and `sourceType = 'dndbeyond_import'`, scoped via `CampaignHomebrewContent`
- `HomebrewContent.data` for type `'location'` has the shape:
  ```ts
  {
    prose: string
    proseLength: number      // character count
    encounterAreas: string[]
    subLocations: string[]
    monsterLinks: { ddbId: string; name: string; url: string }[]
    itemLinks: { ddbId: string; name: string; url: string }[]
    spellLinks: { ddbId: string; name: string; url: string }[]
    npcLinks: { ddbId: string; name: string; url: string }[]
    imageUrls: string[]
    contentHash: string | null
  }
  ```
- List row shows: chapter name, word estimate (`~${Math.round(data.proseLength / 5).toLocaleString()} words`)
- Detail pane: prose excerpt truncated at last space before 800 chars + "…", then list of `encounterAreas`
- V1: read-only, no actions

### Items Tab

- V1 stub — tab visible, body shows "Coming soon"

---

## Context Detection

`detail-pane.tsx` uses `usePathname()` to detect current route:

```ts
const pathname = usePathname()

// Encounter builder: /campaigns/[slug]/encounters/[planId]
const encounterMatch = pathname.match(/\/campaigns\/[^/]+\/encounters\/([^/]+)/)
const currentPlanId = encounterMatch?.[1] ?? null

// Live session: /campaigns/[slug]/sessions/[sessionId]/live
// Regex matches /sessions/[id]/live within the full pathname — correct behaviour
const sessionMatch = pathname.match(/\/sessions\/([^/]+)\/live/)
const currentSessionId = sessionMatch?.[1] ?? null
```

The store does NOT track `currentPlanId` — always derived from `usePathname()` at render time.

---

## Detail Pane — Actions

### Encounter actions:

1. **Load to Encounter Builder** (green)
   - Copies encounter metadata (name, difficulty, sceneDescription, ddbChapterId) to a plan — does NOT add creatures (plans are empty containers by design; DM adds creatures from the Monsters tab).
   - If `currentPlanId` is set: calls `encounterPlans.update({ planId: currentPlanId, name, difficulty, sceneDescription, ddbChapterId })` to overwrite the current plan's metadata
   - If `currentPlanId` is null: calls `encounterPlans.create({ campaignId, name, difficulty, ddbChapterId })` then navigates to the new plan

2. **Prep with DM Brain** (blue)
   - Navigates to `/campaigns/[slug]/brain?encounter=[planId]`
   - V1 stub — DM Brain integration is a separate feature

3. **Mark as Run** (amber)
   - Calls `encounterPlans.markAsRun({ planId, sessionId: currentSessionId ?? undefined })`
   - Badge updates optimistically in the list

### Monster actions:
1. **Add to Encounter** (green) — only shown when `currentPlanId` is set
   - Calls `encounterPlans.addCreature` with:
     ```ts
     { planId: currentPlanId, name, count: 1, cr, xp, sourceType: 'homebrew', sourceId: content.id, statBlock: content.data }
     ```
2. **View Stat Block** — default state, always shown

---

## Multi-Sourcebook Campaigns

V1 assumes a single sourcebook per campaign. If multiple sourcebooks are synced, all plans are returned and grouped together. The panel header shows the sourcebook name from the first chapter group's `HomebrewContent.name`. A sourcebook selector is out of scope for V1.

---

## Data Model Changes

Add three fields to `EncounterPlan` in `prisma/schema.prisma`:

```prisma
model EncounterPlan {
  // ... existing fields ...
  lastRunAt        DateTime?
  timesRun         Int       @default(0)
  lastRunSessionId String?
}
```

Run `npx prisma migrate dev --name add-encounter-run-tracking` (not `db:push`) for production-safe migration.

Extend the `create` mutation input to accept `ddbChapterId?: z.string().optional()`. The existing handler destructures `campaignId` and spreads `...data` into the service call — `ddbChapterId` will be included automatically as long as it is in the Zod schema and the Prisma model field exists (it does).

---

## New tRPC Endpoints

Add to `src/server/routers/encounter-plans.ts`. Import `campaignDMProcedure` from `'../trpc'` (it already exists there alongside `protectedProcedure`).

```ts
// DM-only. Returns all sourcebook-linked plans for a campaign grouped by chapter.
// campaignDMProcedure already declares { campaignId: z.string() } — do NOT re-declare it
// in a second .input() call. Use input.campaignId directly from procedure context.
// Include _count: { select: { creatures: true } } in Prisma query.
// chapterName resolved from HomebrewContent type='location' by dndBeyondId match.
getBySourcebook: campaignDMProcedure
  // No additional .input() needed — campaignId comes from campaignDMProcedure
  // Returns: { ddbChapterId: string; chapterName: string; plans: EncounterPlanSummary[] }[]

// User ownership verified via service layer (existing pattern). No campaignDMProcedure needed.
markAsRun: protectedProcedure
  .input(z.object({ planId: z.string(), sessionId: z.string().optional() }))
  // Sets lastRunAt = now(), increments timesRun, optionally sets lastRunSessionId
```

`EncounterPlanSummary` shape (define as a TypeScript interface in the router file):
```ts
interface EncounterPlanSummary {
  id: string
  name: string
  difficulty: string
  sceneDescription: string | null
  ddbChapterId: string
  lastRunAt: Date | null
  timesRun: number
  _count: { creatures: number }
}
```

---

## Global State

Small Zustand slice in `src/store/compendium-store.ts`. The `src/store/` directory does not yet exist — create it. Use the standard Zustand v5 `create` API (`zustand` is already in `package.json`). No existing store files to follow — the interface below is the full specification:

```ts
interface CompendiumStore {
  isOpen: boolean
  activeTab: 'encounters' | 'monsters' | 'chapters' | 'items'
  selectedItemId: string | null
  selectedItemType: 'encounter' | 'monster' | 'chapter' | 'item' | null
  open: () => void
  close: () => void
  setTab: (tab: CompendiumTab) => void
  selectItem: (id: string, type: CompendiumItemType) => void
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
| `src/app/(app)/layout.tsx` | Mount `<CompendiumPanel />` globally |
| `src/components/sidebar.tsx` | Add compendium icon + toggle (sidebar + MobileSidebar, same file) |
| `src/server/routers/encounter-plans.ts` | Add `getBySourcebook` + `markAsRun`; extend `create` with `ddbChapterId?`; import `campaignDMProcedure` |
| `prisma/schema.prisma` | Add `lastRunAt`, `timesRun`, `lastRunSessionId` to `EncounterPlan` |

---

## V1 Scope

**In:** Encounters tab (full), Monsters tab (full), Chapters tab (read-only), Items tab (stub), run tracking, Load to Builder (metadata only), Mark as Run, Add to Encounter (monsters), Prep with Brain stub.

**Out:** Drag-and-drop (click to load only), full DM Brain prep integration, Items tab content, multi-sourcebook selector, player-facing anything, pre-populating encounter creatures from sourcebook.
