# World Chapter Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "By Chapter" view to the world page that groups all entities by sourcebook chapter, and add chapter filter pills to the world map.

**Architecture:** No schema changes — all required `ddbChapterId` fields already exist. A new `world.getCampaignChapters` tRPC procedure fetches chapters for the campaign's linked sourcebooks. The world page gets a "By Chapter / By Type" toggle. The world map gets chapter filter pills that colour-code and toggle pin visibility. A 10-colour palette keyed by `chapterIndex % 10` provides deterministic per-chapter colours.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma, React, Tailwind, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-05-17-world-chapter-grouping-design.md`

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/server/routers/world.ts` | Add `getCampaignChapters` procedure |
| Modify | `src/server/repositories/world.repository.ts` | Include `ddbChapterId` on `findEntries` select |
| Modify | `src/server/routers/campaigns.ts` | Include `ddbChapterId` on `getWorldHomebrew` select |
| Modify | `src/server/routers/world-map.ts` | Include `ddbChapterId` on pin entity select in `getMap` |
| Create | `src/lib/chapter-colors.ts` | Deterministic chapter colour palette util |
| Create | `src/components/world/chapter-section.tsx` | Collapsible chapter section component |
| Modify | `src/app/(app)/campaigns/[slug]/world/page.tsx` | "By Chapter" view mode + chapter grouping logic |
| Modify | `src/components/world/world-map-canvas.tsx` | Chapter filter pills + colour-coded pins |

---

## Task 1: Add `getCampaignChapters` to the world router

**Files:**
- Modify: `src/server/routers/world.ts`

- [ ] **Step 1: Add the procedure**

In `src/server/routers/world.ts`, add `getCampaignChapters` to the `worldRouter` object. Insert it after the existing `getEntries` procedure. The procedure follows the same `protectedProcedure` pattern used by the rest of the router — it accepts `campaignId`, looks up all sourcebooks linked to the campaign via `CampaignSourcebook`, and returns their chapters sorted by `chapterIndex`.

Add the import at the top of the file if `prisma` is not already imported (it is — check line 6).

```ts
getCampaignChapters: protectedProcedure
  .input(z.object({ campaignId: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
    // Verify the user has access to this campaign
    await authz.campaign(input.campaignId, ctx.session.user.id).verify();

    const links = await prisma.campaignSourcebook.findMany({
      where: { campaignId: input.campaignId },
      include: {
        sourcebook: {
          include: {
            chapters: {
              orderBy: { chapterIndex: 'asc' },
              select: {
                id: true,
                slug: true,
                title: true,
                chapterIndex: true,
                parentSlug: true,
              },
            },
          },
        },
      },
    });

    return links.flatMap((l) => l.sourcebook.chapters);
  }),
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/world.ts
git commit -m "feat(world): add getCampaignChapters tRPC procedure"
```

---

## Task 2: Include `ddbChapterId` in `worldRepository.findEntries`

**Files:**
- Modify: `src/server/repositories/world.repository.ts`

Currently `findEntries` selects from `WorldEntry` but does not include the linked `WorldEntity`. The chapter ID lives on `WorldEntity.ddbChapterId`. We need to join through the optional `worldEntity` relation.

- [ ] **Step 1: Extend the select in `findEntries`**

In `src/server/repositories/world.repository.ts`, find the `findEntries` function (it starts at line ~6). The current `select` object on `prisma.worldEntry.findMany` is:

```ts
select: {
  id: true,
  name: true,
  slug: true,
  type: true,
  summary: true,
  tags: true,
  createdAt: true,
},
```

Replace it with:

```ts
select: {
  id: true,
  name: true,
  slug: true,
  type: true,
  summary: true,
  tags: true,
  createdAt: true,
  worldEntity: {
    select: { ddbChapterId: true },
  },
},
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors. The return type of `findEntries` widens automatically via Prisma inference — callers that don't use `worldEntity` are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/server/repositories/world.repository.ts
git commit -m "feat(world): include ddbChapterId in findEntries via worldEntity join"
```

---

## Task 3: Include `ddbChapterId` in `getWorldHomebrew`

**Files:**
- Modify: `src/server/routers/campaigns.ts`

`HomebrewContent` has a `ddbChapterId` column (it already exists in the schema). The `getWorldHomebrew` procedure currently returns homebrew items without this field.

- [ ] **Step 1: Add `ddbChapterId` to the homebrew select**

In `src/server/routers/campaigns.ts`, find `getWorldHomebrew` (around line 378). The inner `homebrew` select is:

```ts
homebrew: {
  select: { id: true, name: true, type: true, data: true, tags: true, imageUrl: true },
},
```

Replace it with:

```ts
homebrew: {
  select: { id: true, name: true, type: true, data: true, tags: true, imageUrl: true, ddbChapterId: true },
},
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/campaigns.ts
git commit -m "feat(world): include ddbChapterId in getWorldHomebrew"
```

---

## Task 4: Include `ddbChapterId` in world map pin entity select

**Files:**
- Modify: `src/server/routers/world-map.ts`

The `getMap` procedure returns `MapPin[]` with a nested `entity` select. We need `entity.ddbChapterId` so the canvas can colour-code pins by chapter.

- [ ] **Step 1: Add `ddbChapterId` to the pin entity select**

In `src/server/routers/world-map.ts`, find the `getMap` procedure (line ~50). The pins include is:

```ts
pins: {
  include: {
    entity: {
      select: {
        id: true,
        name: true,
        type: true,
        imageUrl: true,
        properties: true,
        _count: { select: { stateChanges: true } },
      },
    },
  },
},
```

Replace it with:

```ts
pins: {
  include: {
    entity: {
      select: {
        id: true,
        name: true,
        type: true,
        imageUrl: true,
        properties: true,
        ddbChapterId: true,
        _count: { select: { stateChanges: true } },
      },
    },
  },
},
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/world-map.ts
git commit -m "feat(world-map): include ddbChapterId on pin entity select"
```

---

## Task 5: Create chapter colour utility

**Files:**
- Create: `src/lib/chapter-colors.ts`

This util assigns a deterministic accent colour to each chapter based on `chapterIndex % 10`. The colours use oklch() to stay consistent with the QuiverDM design system (all colours use oklch in `globals.css`).

- [ ] **Step 1: Create the file**

```ts
// src/lib/chapter-colors.ts

export const CHAPTER_COLORS = [
  { bg: 'oklch(0.7 0.16 55)',   border: 'oklch(0.7 0.16 55 / 0.4)',   text: 'oklch(0.7 0.16 55)'   }, // 0 amber
  { bg: 'oklch(0.6 0.15 290)',  border: 'oklch(0.6 0.15 290 / 0.4)',  text: 'oklch(0.6 0.15 290)'  }, // 1 purple
  { bg: 'oklch(0.65 0.15 140)', border: 'oklch(0.65 0.15 140 / 0.4)', text: 'oklch(0.65 0.15 140)' }, // 2 green
  { bg: 'oklch(0.65 0.15 220)', border: 'oklch(0.65 0.15 220 / 0.4)', text: 'oklch(0.65 0.15 220)' }, // 3 blue
  { bg: 'oklch(0.65 0.15 15)',  border: 'oklch(0.65 0.15 15 / 0.4)',  text: 'oklch(0.65 0.15 15)'  }, // 4 red
  { bg: 'oklch(0.7 0.14 75)',   border: 'oklch(0.7 0.14 75 / 0.4)',   text: 'oklch(0.7 0.14 75)'   }, // 5 gold
  { bg: 'oklch(0.6 0.15 320)',  border: 'oklch(0.6 0.15 320 / 0.4)',  text: 'oklch(0.6 0.15 320)'  }, // 6 pink
  { bg: 'oklch(0.65 0.14 175)', border: 'oklch(0.65 0.14 175 / 0.4)', text: 'oklch(0.65 0.14 175)' }, // 7 teal
  { bg: 'oklch(0.6 0.15 260)',  border: 'oklch(0.6 0.15 260 / 0.4)',  text: 'oklch(0.6 0.15 260)'  }, // 8 indigo
  { bg: 'oklch(0.65 0.13 100)', border: 'oklch(0.65 0.13 100 / 0.4)', text: 'oklch(0.65 0.13 100)' }, // 9 lime
] as const;

export function getChapterColor(chapterIndex: number) {
  return CHAPTER_COLORS[chapterIndex % CHAPTER_COLORS.length];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chapter-colors.ts
git commit -m "feat(world): chapter colour palette utility"
```

---

## Task 6: Create `ChapterSection` component

**Files:**
- Create: `src/components/world/chapter-section.tsx`

This is the collapsible section rendered in "By Chapter" mode on the world page. It receives chapter metadata, colour, and a list of entity cards to render. The "Filter map" button navigates to the world map with `?chapter=<chapterId>` pre-selected.

The card content inside the section is passed as `children` so the parent page controls rendering (the page already has card rendering logic for entries and homebrew items — we reuse it).

- [ ] **Step 1: Create the file**

```tsx
// src/components/world/chapter-section.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Map } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ChapterSectionProps {
  chapterId: string;
  title: string;
  count: number;
  accentColor: string;  // oklch string for border + text
  campaignSlug: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function ChapterSection({
  chapterId,
  title,
  count,
  accentColor,
  campaignSlug,
  defaultExpanded = true,
  children,
}: ChapterSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-sm transition-colors hover:bg-[var(--q-surface-utility)]"
        style={{ borderLeft: `3px solid ${accentColor}` }}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />}
        <span
          className="flex-1 text-left text-xs font-semibold uppercase tracking-widest font-[var(--q-font-display)]"
          style={{ color: accentColor }}
        >
          {title}
        </span>
        <span className="text-[10px] text-[var(--q-text-faint)] mr-2">{count}</span>
        <Link
          href={`/campaigns/${campaignSlug}/world-map?chapter=${chapterId}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] border transition-colors',
            'border-[var(--q-border-subtle)] text-[var(--q-text-faint)]',
            'hover:text-[var(--q-text)] hover:border-[var(--q-amber-border)]',
          )}
        >
          <Map className="h-3 w-3" />
          Map
        </Link>
      </button>

      {expanded && (
        <div className="pl-3">
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/world/chapter-section.tsx
git commit -m "feat(world): ChapterSection collapsible component"
```

---

## Task 7: Add "By Chapter" view mode to the world page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/world/page.tsx`

This is the main integration task. We add:
1. A `viewMode` state (`'by-type' | 'by-chapter'`).
2. A query for `world.getCampaignChapters`.
3. Chapter-grouping logic for "By Chapter" mode.
4. The view toggle UI in the toolbar.
5. The chapter-grouped render path using `ChapterSection`.

The existing "By Type" render path is **unchanged**.

- [ ] **Step 1: Add imports**

At the top of `src/app/(app)/campaigns/[slug]/world/page.tsx`, add:

```ts
import { ChapterSection } from '@/components/world/chapter-section';
import { getChapterColor } from '@/lib/chapter-colors';
import { LayoutList, BookOpen as BookOpenIcon } from 'lucide-react';
```

(`BookOpen` is already imported — you can use `LayoutList` for the "By Type" icon and the existing `BookOpen` for "By Chapter". Or just use text labels — keep it simple.)

- [ ] **Step 2: Add `viewMode` state and chapter query**

Inside `WorldPage()`, after the existing state declarations, add:

```ts
const [viewMode, setViewMode] = useState<'by-type' | 'by-chapter'>('by-type');

const { data: chapters = [] } = trpc.world.getCampaignChapters.useQuery(
  { campaignId },
  { staleTime: 300_000, enabled: viewMode === 'by-chapter' },
);
```

- [ ] **Step 3: Add chapter-grouping logic**

**Important:** The world page has TWO distinct sections — the "World Entities" card grid (`entries` from `trpc.world.getEntries`) and the Documents/Homebrew section (`allItems` from docs + homebrew). In "By Chapter" mode we merge ALL three sources into a single chapter-grouped view. In "By Type" mode the existing two-section layout is preserved unchanged.

Extend the `AnyItem` union to include a third kind for WorldEntry items, and update the type aliases:

```ts
// Replace the existing AnyItem type with:
type EntryItem = { id: string; name: string; slug: string; type: string; summary?: string | null; worldEntity?: { ddbChapterId?: string | null } | null };
type AnyItem =
  | { id: string; title: string; type: string; _kind: 'doc'; _raw: Doc }
  | { id: string; title: string; type: string; _kind: 'hb'; _raw: HbItem }
  | { id: string; title: string; type: string; _kind: 'entry'; _raw: EntryItem };
```

Build `allItemsForChapter` (used only in "By Chapter" mode) from all three sources:

```ts
const allItemsForChapter: AnyItem[] = [
  ...entries.map((e) => ({
    id: e.id,
    title: e.name,
    type: e.type as string,
    _kind: 'entry' as const,
    _raw: e as EntryItem,
  })),
  ...docs.map((d) => ({ id: d.id, title: d.title, type: d.type, _kind: 'doc' as const, _raw: d })),
  ...homebrew.map((h) => ({ id: h.id, title: h.name, type: h.type, _kind: 'hb' as const, _raw: h })),
];
```

After the existing `grouped` derivation, add:

```ts
const chapterMap = new Map(chapters.map((c) => [c.id, c]));

type ChapterBucket = {
  chapterId: string | null;
  title: string;
  chapterIndex: number;
  items: AnyItem[];
};

const chapterBuckets: ChapterBucket[] = [];

if (viewMode === 'by-chapter') {
  const byChapter = new Map<string | null, AnyItem[]>();

  for (const item of allItemsForChapter) {
    let chapterId: string | null = null;
    if (item._kind === 'entry') {
      chapterId = item._raw.worldEntity?.ddbChapterId ?? null;
    } else if (item._kind === 'hb') {
      chapterId = (item._raw as HbItem).ddbChapterId ?? null;
    }
    // 'doc' kind has no chapter — chapterId stays null
    const bucket = byChapter.get(chapterId) ?? [];
    bucket.push(item);
    byChapter.set(chapterId, bucket);
  }

  for (const chapter of chapters) {
    const items = byChapter.get(chapter.id);
    if (items && items.length > 0) {
      chapterBuckets.push({ chapterId: chapter.id, title: chapter.title, chapterIndex: chapter.chapterIndex, items });
    }
  }

  // Custom / no chapter + any stale chapterIds that don't resolve
  const custom = byChapter.get(null) ?? [];
  for (const [cid, items] of byChapter.entries()) {
    if (cid !== null && !chapterMap.has(cid)) custom.push(...items);
  }
  if (custom.length > 0) {
    chapterBuckets.push({ chapterId: null, title: 'Custom Additions', chapterIndex: 9999, items: custom });
  }
}
```

- [ ] **Step 4: Add the view mode toggle to the toolbar**

Find the existing `Section` opening tag for the "World Entities" section. Just above the entity type filter chips (around line 306), add the view toggle. The toggle goes inside the `Section`, before the filter chips:

```tsx
{/* View mode toggle */}
<div className="flex gap-1 mb-2">
  <button
    onClick={() => setViewMode('by-type')}
    className={filterChipClass(viewMode === 'by-type')}
  >
    <LayoutList className="h-3 w-3" />
    By Type
  </button>
  <button
    onClick={() => setViewMode('by-chapter')}
    className={filterChipClass(viewMode === 'by-chapter')}
  >
    <BookOpen className="h-3 w-3" />
    By Chapter
  </button>
</div>
```

- [ ] **Step 5: Add the "By Chapter" render path**

In "By Chapter" mode the entire page body (both the "World Entities" card grid and the docs/homebrew section) is replaced by chapter buckets. In "By Type" mode both sections remain exactly as they are today.

Wrap the JSX returned by the page in a conditional at the `Section` level. The structure to aim for:

```tsx
{viewMode === 'by-chapter' ? (
  /* ─── By Chapter view ─────────────────────────────────── */
  <div className="space-y-4">
    {chapterBuckets.map((bucket) => {
      const chapterIndex = bucket.chapterId !== null
        ? (chapters.find((c) => c.id === bucket.chapterId)?.chapterIndex ?? 0)
        : 9999;
      const color = bucket.chapterId !== null
        ? getChapterColor(chapterIndex).text
        : 'var(--q-text-faint)';
      const filteredItems = bucket.items.filter(
        (item) => entryFilter === 'all' || item.type === entryFilter,
      );
      if (filteredItems.length === 0) return null;
      return (
        <ChapterSection
          key={bucket.chapterId ?? '__custom'}
          chapterId={bucket.chapterId ?? '__custom'}
          title={bucket.title}
          count={filteredItems.length}
          accentColor={color}
          campaignSlug={slug}
          defaultExpanded={chapterBuckets.indexOf(bucket) === 0}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredItems.map((item) => {
              if (item._kind === 'entry') {
                const entry = item._raw as EntryItem;
                const meta = ENTRY_TYPE_META[entry.type as string];
                const Icon = meta?.icon ?? BookOpen;
                return (
                  <Link
                    key={entry.id}
                    href={`/campaigns/${slug}/world/${entry.slug}`}
                    className="block text-left rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)] hover:border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)] transition-colors p-3 space-y-1"
                  >
                    <div className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-[var(--q-text-faint)]">
                      <Icon className="h-2.5 w-2.5" />
                      {meta?.label ?? entry.type}
                    </div>
                    <p className="text-sm font-medium text-[var(--q-text)] leading-snug line-clamp-1">{entry.name}</p>
                    {entry.summary && (
                      <p className="text-xs text-[var(--q-text-dim)] line-clamp-2">{entry.summary}</p>
                    )}
                  </Link>
                );
              }
              if (item._kind === 'doc') {
                return (
                  <DocRow
                    key={item.id}
                    doc={item._raw as Doc}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId((p) => (p === item.id ? null : item.id))}
                  />
                );
              }
              return (
                <HbRow
                  key={item.id}
                  item={item._raw as HbItem}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId((p) => (p === item.id ? null : item.id))}
                />
              );
            })}
          </div>
        </ChapterSection>
      );
    })}
    {chapterBuckets.length === 0 && !isLoading && (
      <p className="text-sm text-[var(--q-text-faint)] italic px-2">No chapter data found. This campaign may not have a linked sourcebook.</p>
    )}
  </div>
) : (
  /* ─── By Type view (existing, unchanged) ──────────────── */
  <>
    {/* existing "World Entities" Section block goes here — do not modify it */}
    {/* existing docs/homebrew filter tabs and grouped list go here — do not modify them */}
  </>
)}
```

The `<>…</>` else branch is a placeholder for you to understand the structure — do NOT change the existing "By Type" render code. Just wrap it in the conditional so "By Chapter" shows the new view and "By Type" shows the existing page unchanged.

Also update the `HbItem` type to include `ddbChapterId`:

```ts
type HbItem = { id: string; name: string; type: string; data: unknown; tags: string[]; ddbChapterId?: string | null };
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors. Common ones: the `AnyItem` union may need widening for the new `worldEntity` field. The safest approach is to cast `item._raw` when extracting `ddbChapterId` in the grouping logic (already done with the cast in Step 3).

- [ ] **Step 7: Smoke test in dev**

Open `http://localhost:3847/campaigns/<any-slug>/world`. Confirm:
- "By Type" tab works as before
- "By Chapter" tab groups entities by chapter for CoS campaigns
- Type filter chips filter within chapter groups
- "Map" button on each chapter section navigates to world map page

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/world/page.tsx
git commit -m "feat(world): By Chapter view mode with collapsible chapter sections"
```

---

## Task 8: Chapter filter pills on world map

**Files:**
- Modify: `src/components/world/world-map-canvas.tsx`

The canvas already loads pins via `trpc.worldMap.getMap`. After Task 4, each pin's entity now carries `ddbChapterId`. We need to:
1. Read the `?chapter` search param on mount to pre-select a chapter.
2. Derive a chapter list from the loaded pins.
3. Render chapter filter pills above the canvas.
4. Filter which pins are rendered based on active chapters.
5. Pass the chapter colour to each pin for visual display.

- [ ] **Step 1: Add imports to `world-map-canvas.tsx`**

At the top of `src/components/world/world-map-canvas.tsx`, add:

```ts
import { useSearchParams } from 'next/navigation';
import { getChapterColor } from '@/lib/chapter-colors';
```

- [ ] **Step 2: Add chapter filter state**

Inside the `WorldMapCanvas` component, after existing state declarations, add:

```ts
const searchParams = useSearchParams();

// Derive unique chapters from loaded pins (after mapData loads)
const pinChapters = useMemo(() => {
  const seen = new Map<string, { id: string; index: number }>();
  for (const pin of mapData?.pins ?? []) {
    const cid = pin.entity.ddbChapterId;
    if (cid && !seen.has(cid)) {
      // We don't have chapterIndex here — use a stable sort key from order of appearance
      seen.set(cid, { id: cid, index: seen.size });
    }
  }
  return [...seen.values()];
}, [mapData]);

// Active chapters — initialise from ?chapter param, then all-on once pinChapters loads
const [activeChapters, setActiveChapters] = useState<Set<string> | null>(null);

useEffect(() => {
  if (pinChapters.length === 0) return;
  if (activeChapters !== null) return; // already initialised
  const param = searchParams?.get('chapter');
  if (param && pinChapters.some((c) => c.id === param)) {
    setActiveChapters(new Set([param]));
  } else {
    setActiveChapters(new Set(pinChapters.map((c) => c.id)));
  }
}, [pinChapters, searchParams, activeChapters]);

// A pin is visible if: it has no chapter (always show), or its chapter is active
function isPinVisible(pin: { entity: { ddbChapterId?: string | null } }) {
  if (!pin.entity.ddbChapterId) return true;
  if (activeChapters === null) return true;
  return activeChapters.has(pin.entity.ddbChapterId);
}

function toggleChapter(id: string) {
  setActiveChapters((prev) => {
    const next = new Set(prev ?? pinChapters.map((c) => c.id));
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}
```

You will need to add `useMemo` to the React import if it isn't there already.

- [ ] **Step 3: Add chapter filter pills UI**

Find the existing toolbar area in the canvas JSX (look for the `<div>` containing the pin count and other map controls — around line 350). Add the chapter pills just above the map canvas element:

```tsx
{pinChapters.length > 0 && (
  <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-[var(--q-border-subtle)]">
    {pinChapters.map((ch) => {
      const color = getChapterColor(ch.index);
      const isActive = activeChapters === null || activeChapters.has(ch.id);
      return (
        <button
          key={ch.id}
          onClick={() => toggleChapter(ch.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] border transition-colors"
          style={{
            borderColor: isActive ? color.border : 'var(--q-border-subtle)',
            color: isActive ? color.text : 'var(--q-text-faint)',
            background: isActive ? `${color.bg.replace(')', ' / 0.1)')}` : 'transparent',
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: isActive ? color.bg : 'var(--q-text-faint)' }}
          />
          Ch {ch.index + 1}
        </button>
      );
    })}
    {(activeChapters?.size ?? 0) < pinChapters.length && (
      <button
        onClick={() => setActiveChapters(new Set(pinChapters.map((c) => c.id)))}
        className="text-[10px] text-[var(--q-text-faint)] hover:text-[var(--q-text)] px-1"
      >
        Show all
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: Filter pins before rendering**

Find where `mapData.pins` is iterated to render pin nodes on the canvas (around line 235–250 in the canvas, where pins are mapped to `LocationNode` or similar). Wrap the filter:

```ts
const visiblePins = (mapData?.pins ?? []).filter(isPinVisible);
```

Then use `visiblePins` in place of `mapData.pins` when rendering pin nodes and when computing `pinnedEntityIds`. The existing `pinnedEntityIds` set should still be built from ALL pins (not just visible ones) so the "already pinned" check is unaffected:

```ts
const pinnedEntityIds = useMemo(
  () => new Set((mapData?.pins ?? []).map((p) => p.entity.id)),
  [mapData?.pins],
);
```

Only replace `mapData.pins` with `visiblePins` in the render/map call for the actual pin nodes displayed on screen.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors. The `pin.entity.ddbChapterId` field is now available because Task 4 added it to the select.

- [ ] **Step 6: Smoke test in dev**

1. Open `/campaigns/<cos-slug>/world-map`.
2. Confirm chapter pills appear for CoS (which has a linked sourcebook with chapters).
3. Toggle a chapter off — confirm its pins disappear from the map.
4. Navigate from the world page "Map" button on a chapter section — confirm the map opens with that chapter pre-selected (other chapters dimmed).
5. Confirm campaigns with no sourcebook show no pills (no regression).

- [ ] **Step 7: Commit**

```bash
git add src/components/world/world-map-canvas.tsx
git commit -m "feat(world-map): chapter filter pills with colour-coded pin visibility"
```

---

## Final Check

- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm run lint` — zero new warnings
- [ ] Test on CoS campaign: By Chapter shows chapters, map filters work
- [ ] Test on a custom campaign (no sourcebook): By Chapter shows "Custom Additions" only, map shows no pills
