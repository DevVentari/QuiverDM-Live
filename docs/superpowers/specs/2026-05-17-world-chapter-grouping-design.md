# World Page — Chapter Grouping + Map Chapter Filters

**Date:** 2026-05-17
**Status:** Approved

## Problem

The world page and world map show all locations, NPCs, items, and factions in flat type-grouped lists. For imported sourcebook campaigns (e.g. Curse of Strahd), this means sub-locations like "Crypt" appear at the same level as top-level locations like "Amber Temple", with no indication they belong to the same chapter. DMs lose spatial and narrative context.

## Goal

Add a "By Chapter" view to the world page that groups all entities by their sourcebook chapter. Add chapter filter pills to the world map that colour-code and toggle pins by chapter.

No schema changes. All required fields (`ddbChapterId`) already exist on `WorldEntry` (via `worldEntity`), `HomebrewContent`, and `WorldEntity`.

---

## Data Model (existing, no changes)

- `DdbSourcebookChapter` — `{ id, slug, title, chapterIndex, parentSlug }` — the canonical chapter list for a sourcebook
- `CampaignSourcebook` — links a `Campaign` to a `DdbSourcebook`
- `WorldEntity.ddbChapterId` (String?) — ID of the chapter this brain entity came from
- `WorldEntry.worldEntityId` → `WorldEntity.ddbChapterId` — WorldEntry reaches chapter via its linked entity
- `HomebrewContent.ddbChapterId` (String?) — direct chapter ID on homebrew items
- `MapPin.entityId` → `WorldEntity` — pins link to brain entities, which have `ddbChapterId`

---

## Backend Changes

### 1. New procedure: `world.getCampaignChapters`

```ts
// world router
getCampaignChapters: campaignMemberProcedure
  .input(z.object({ campaignId: z.string() }))
  .query(async ({ input }) => {
    // Campaign → CampaignSourcebook → DdbSourcebook → chapters
    const links = await prisma.campaignSourcebook.findMany({
      where: { campaignId: input.campaignId },
      include: {
        sourcebook: {
          include: {
            chapters: {
              orderBy: { chapterIndex: 'asc' },
              select: { id: true, slug: true, title: true, chapterIndex: true, parentSlug: true },
            },
          },
        },
      },
    });
    return links.flatMap(l => l.sourcebook.chapters);
  }),
```

### 2. Extend `worldRepository.findEntries`

Add `worldEntity: { select: { ddbChapterId: true } }` to the `WorldEntry` select, so the page can resolve chapter per entry without a second query.

### 3. Extend `campaigns.getWorldHomebrew`

Add `ddbChapterId: true` to the `HomebrewContent` select. This field already exists on the model.

### 4. Extend world map pin data

The world map component already loads `MapPin` records. Add `entity: { select: { ddbChapterId: true } }` to the map pin query so each pin carries its chapter ID. This powers colour-coding and toggle visibility on the map.

---

## World Page Changes (`/campaigns/[slug]/world/page.tsx`)

### View mode toggle

Add `viewMode: 'by-type' | 'by-chapter'` state. Default: `'by-type'` (no breaking change to existing behaviour). Rendered as two pills in the top toolbar beside the search input.

### "By Chapter" mode rendering

1. Fetch chapters via `world.getCampaignChapters`.
2. Group `WorldEntry` items by `entry.worldEntity?.ddbChapterId`.
3. Group `HomebrewContent` items by `hb.ddbChapterId`.
4. `CampaignDocument` items have no chapter — they always go in the "Custom Additions" bucket.
5. Render one collapsible `ChapterSection` per chapter, ordered by `chapterIndex`.
6. "Custom Additions" section rendered last.
7. Within each section, type filter chips (already in the toolbar) act as cross-section filters — they don't collapse sections, they hide/show individual cards within them.
8. Each chapter section gets a deterministic accent colour from a fixed 10-colour palette keyed by `chapterIndex % 10`. No new DB field.
9. Collapsed state stored in component state (not localStorage — not worth the complexity).

### `ChapterSection` component (new, lives in `src/components/world/`)

Props: `chapter`, `items`, `accentColor`, `defaultExpanded`.

Renders:
- Header row: accent left-border, chapter title (Cinzel font), entity count badge, "Filter map" button
- Collapsible card grid below (same card component as existing "By Type" view)

### "By Type" mode

Unchanged from current implementation.

---

## World Map Changes

### Chapter filter pills

Rendered above the map canvas in the existing toolbar area. One pill per chapter that has at least one pin. Pills use the same deterministic accent colours as the world page.

Toggle behaviour: clicking a pill toggles that chapter's pins on/off. All chapters on by default.

### Pin colour-coding

Each `MapPin` rendered with its chapter's accent colour when chapter filters are active. Pins with no `ddbChapterId` use the existing neutral colour.

### "Filter map" button on world page

The `ChapterSection` header has a "Filter map" button. Clicking it navigates to `/campaigns/[slug]/world-map?chapter=<chapterId>` (or sets a URL param if already on the map page). The map page reads this param on mount and activates only that chapter's pill.

---

## Colour Palette

10 colours assigned by `chapterIndex % 10`, cycling. CSS variables defined once in `globals.css`:

```css
--q-chapter-0: oklch(0.7 0.16 55);    /* amber — same as primary */
--q-chapter-1: oklch(0.6 0.15 290);   /* purple */
--q-chapter-2: oklch(0.65 0.15 140);  /* green */
--q-chapter-3: oklch(0.65 0.15 220);  /* blue */
--q-chapter-4: oklch(0.65 0.15 15);   /* red */
--q-chapter-5: oklch(0.7 0.14 75);    /* gold */
--q-chapter-6: oklch(0.6 0.15 320);   /* pink */
--q-chapter-7: oklch(0.65 0.14 175);  /* teal */
--q-chapter-8: oklch(0.6 0.15 260);   /* indigo */
--q-chapter-9: oklch(0.65 0.13 100);  /* lime */
```

---

## What Doesn't Change

- No schema migrations
- "By Type" view is unmodified
- CampaignDocument section layout unchanged
- Existing entity card design unchanged
- World map pin shapes and placement unchanged

---

## Edge Cases

- **No sourcebook linked** (custom campaign): `getCampaignChapters` returns empty. "By Chapter" mode shows only a "Custom Additions" section containing all items. The toggle still appears but "By Chapter" degrades gracefully.
- **Entity with stale/missing `ddbChapterId`**: treated as custom — falls into "Custom Additions" bucket.
- **Chapter with zero entities**: not shown (filter `chapters.filter(c => groupedItems[c.id]?.length > 0)`).

---

## Out of Scope

- Parent/child location nesting within a chapter (Option B from brainstorm — deferred)
- Zone grouping above chapters (Option C — deferred)
- Chapter grouping on the Brain entities page
- Persisting collapsed chapter state across sessions
