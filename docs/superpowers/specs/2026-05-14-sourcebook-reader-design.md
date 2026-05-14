# Sourcebook Reader — Design

**Date:** 2026-05-14
**Route:** `/campaigns/[slug]/sourcebook`
**Status:** Approved, ready for implementation plan

## Problem

Users with DDB sourcebooks synced into a campaign (e.g. *Lost Mines of Phandelver*) can't actually read the sourcebook inside QuiverDM. The sync pipeline currently extracts structured data — `SourcebookEntity` rows, `SourcebookChapterImage` rows, TOC metadata in `DdbSourcebookChapter` — but discards the parsed chapter prose. There is no `/sourcebook` route under `[slug]`.

The DM needs to read the source material in-app, with cross-links into the entities (NPCs / locations / monsters) we already have, so the sourcebook becomes a live document rather than a list of extracted artefacts.

## Goals

- Render a full, readable sourcebook page per campaign at `/campaigns/[slug]/sourcebook`.
- TOC sidebar with chapter + sub-page tree.
- Active chapter tracked in URL (`?chapter=<slug>`) — deep-linkable, browser back/forward works, no full page reload between chapters.
- Inline entity cross-links (NPC / location / monster names link to their entity, with hover preview).
- Inline illustrations in their original section context.
- DM-only access.

## Non-goals (Phase 2)

- Full-text search across chapters
- DM annotations / per-section notes
- Player-share toggles per section
- Print / PDF export
- Multi-book composite view

## Data model

Add two fields to `DdbSourcebookChapter` (no new tables):

```prisma
model DdbSourcebookChapter {
  // ... existing fields ...
  bodySections   Json?     // [{ heading: string|null, level: number, markdown: string }]
  bodySyncedAt   DateTime?
}
```

`bodySections` is the array `parseChapterContent` already produces and currently discards. We stop discarding it.

`bodySyncedAt` lets the UI distinguish "chapter exists in TOC but body never stored" from "chapter has stored body". Chapters where `bodySections IS NULL` render an empty state with a "Re-sync sourcebook" button — no big-bang backfill script.

## Sync pipeline change

`src/lib/ddb-sourcebook.ts::parseChapterContent` already returns `{ sections, contentHash, ... }`. The DDB sync worker currently uses `sections` for entity extraction and then drops them. Change: at the same point where the worker updates a `DdbSourcebookChapter` row, also write `bodySections: sections` and `bodySyncedAt: now()`.

Going forward, every newly synced chapter has prose. Existing chapters get prose the next time the user clicks "Re-sync".

## tRPC router — new: `sourcebookReader`

All procedures use `campaignDMProcedure` and verify the requested `DdbSourcebook` is linked to the campaign via `CampaignSourcebook`.

### `getOverview({ campaignSlug, bookSlug })`

Returns:
```ts
{
  book: { id, slug, title, coverImageUrl, lastSyncedAt },
  chapters: Array<{
    id, slug, title, chapterIndex, parentSlug,
    hasBody: boolean,
  }>,
}
```

Chapter tree is built client-side from `parentSlug` so we don't ship a separate nested payload.

### `getChapter({ campaignSlug, bookSlug, chapterSlug })`

Returns:
```ts
{
  chapter: { id, slug, title, chapterIndex, parentSlug, hasBody, bodySyncedAt },
  sections: Array<{ heading: string|null, level: number, markdown: string }>,
  illustrations: Array<{ id, url, alt, sectionHeading, isHero, kind, position }>,
  entityIndex: Array<{
    id, type, name, aliases: string[],
    thumbUrl: string|null,
    oneLineDesc: string|null,
  }>,
}
```

The `entityIndex` is built from `SourcebookEntity` rows scoped to `sourcebookId`. The client uses it for inline linking + hover popovers — no extra round-trip per entity.

### `resyncChapter({ chapterId })`

Enqueues the existing DDB chapter-sync job for one chapter. Used by the inline "Re-sync" CTA on chapters without prose.

## Entity cross-linking

Server-side, inside `getChapter`:

1. Load `SourcebookEntity` rows for this `sourcebookId`. Build a match table sorted by name length descending (so "Sildar Hallwinter" wins over "Sildar"). Include aliases.
2. For each `sections[i].markdown`, run a single pass that:
   - skips text inside markdown link syntax `[…](…)` and fenced code blocks
   - replaces longest-name matches first with a custom token: `[[entity:<id>|<displayText>]]`
   - is case-insensitive but preserves the original display text
3. Send the transformed markdown to the client.

Client renderer (`markdown-with-entities.tsx`) is a thin wrapper around the project's existing markdown renderer. It recognises the `[[entity:<id>|<text>]]` token and emits `<EntityLink id=… text=…>`.

`<EntityLink>` is amber-underlined text wrapped in shadcn `HoverCard`:
- Card shows: thumbnail (or type icon), type pill, name, one-line description, "Open" button.
- "Open" routes to the entity's existing page (NPC inspector, world entry, etc. — already exist).

## Illustrations

`SourcebookChapterImage` already has `position`, `sectionHeading`, `isHero`, `kind`.

- **Hero:** first row with `isHero=true` renders as a full-width banner directly under the chapter title.
- **Inline:** remaining illustrations attach to the section whose `heading` matches `sectionHeading` (case-insensitive trim compare). Multiple per section stack vertically. Images with no matching section render at the end of the chapter.
- **Sizing by kind:** `map` → full content width; `portrait` → ~280px floated right; `scene` / `generic` → full width.
- All images are click-to-zoom via a lightweight Dialog (no new dep — reuse existing image viewer if present, else shadcn Dialog).

## Page structure

```
src/app/(app)/campaigns/[slug]/sourcebook/
  page.tsx                   ← server component: loads getOverview, renders <SourcebookReader>
```

```
src/components/sourcebook/
  SourcebookReader.tsx       ← client orchestrator. Reads `?chapter=` via useSearchParams,
                               loads chapter via trpc, manages state. Uses router.replace
                               for shallow nav so back/forward works without full reload.
  ChapterTree.tsx            ← sidebar TOC: cover, title, filter input, nested tree,
                               re-sync button. Highlights active chapter.
  ChapterView.tsx            ← main pane: breadcrumb, title, hero, prose + inline illustrations.
                               Empty state when bodySyncedAt is null.
  EntityLink.tsx             ← amber link + HoverCard popover.
  markdown-with-entities.tsx ← renderer that handles entity tokens and illustration anchors.
```

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ CampaignHeader                                                │
├──────────────┬───────────────────────────────────────────────┤
│ Cover        │  Chapter 1 — Goblin Arrows                    │
│ Title        │  ┌─────────────────────────────────────────┐  │
│              │  │           Hero illustration            │  │
│ ▸ Ch 1       │  └─────────────────────────────────────────┘  │
│ ▸ Ch 2       │  Prose with [Sildar] entity links and inline  │
│   ▾ Sub 2a   │  illustrations placed by section heading...   │
│   ▾ Sub 2b   │                                               │
│ ▸ Ch 3       │                                               │
│              │                                               │
│ [Re-sync]    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

## Access control

- Procedures: `campaignDMProcedure` (OWNER / CO_DM only) — players cannot read sourcebook prose.
- Server check: requested `bookSlug` must have a `CampaignSourcebook` row for the active campaign. 403 otherwise.

## Edge cases

- **Sourcebook synced but no chapters have prose yet:** Tree renders, every chapter shows the empty state. Re-sync CTA in sidebar is the primary action.
- **Some chapters have prose, others don't:** Tree shows a small "(empty)" pill next to chapters with `hasBody=false`.
- **Entity name collisions:** Longest-match-first plus aliases handles most cases. We do not attempt disambiguation across types — first match wins (the index is sorted by name length, then by `createdAt` ascending for determinism).
- **Deep link to a chapter that no longer exists:** Reader falls back to the first chapter in `chapterIndex` order and clears the bad search param.
- **Re-sync mid-read:** Showing stale prose is fine — `bodySyncedAt` updates and a small "Updated" toast appears when the chapter sync finishes if the user is still on that chapter.

## Phase 2 (out of scope, listed for context)

- Cross-chapter search.
- DM annotations: per-section private notes stored in a new `SourcebookAnnotation` table.
- "Reveal to players" toggle per section, surfacing the revealed text inside the live session view.
- PDF / print export of a chapter.
- Multi-book composite reading (e.g. open a CoS chapter and a homebrew expansion side-by-side).
