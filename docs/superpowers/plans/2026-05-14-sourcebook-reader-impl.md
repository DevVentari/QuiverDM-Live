# Sourcebook Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/campaigns/[slug]/sourcebook` — a DM-only reader for a campaign's linked DDB sourcebook, with sidebar TOC, inline illustrations, inline entity cross-links with hover previews, and URL-tracked active chapter for deep-linking without full page reloads.

**Architecture:** Persist parsed chapter prose (currently discarded) on `DdbSourcebookChapter` as `bodySections` Json. New `sourcebookReader` tRPC router (DM-only) returns book overview, chapter content, and an entity index. Server tokenises entity names in markdown into `[[entity:<id>|<text>]]` markers. Client renders via `react-markdown` (already a dep) with a custom token transformer that swaps markers for `<EntityLink>` shadcn HoverCard popovers. Active chapter is tracked in `?chapter=<slug>` and switched via shallow `router.replace`.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma + PostgreSQL, react-markdown + remark-gfm (already installed), shadcn/ui, Tailwind, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-14-sourcebook-reader-design.md`

---

## Task 1: Schema — persist chapter prose

**Files:**
- Modify: `prisma/schema.prisma` (around `DdbSourcebookChapter`, lines 258–280)

- [ ] **Step 1: Add `bodySections` and `bodySyncedAt` to `DdbSourcebookChapter`**

Find the `DdbSourcebookChapter` model and add two fields just before `createdAt`:

```prisma
model DdbSourcebookChapter {
  id                String        @id @default(cuid())
  sourcebookId      String
  sourcebook        DdbSourcebook @relation(fields: [sourcebookId], references: [id], onDelete: Cascade)
  slug              String
  title             String
  chapterIndex      Int
  parentSlug        String?
  contentHash       String?
  syncStatus        String        @default("idle")
  hasPendingChanges Boolean       @default(false)
  pendingChanges    Json?
  lastSyncedAt      DateTime?
  // NEW: chapter prose preserved from parseChapterContent for the in-app reader.
  // Array of { heading: string|null, level: number, markdown: string }.
  bodySections      Json?
  bodySyncedAt      DateTime?
  entities          SourcebookEntity[]
  illustrations     SourcebookChapterImage[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@unique([sourcebookId, slug])
  @@index([sourcebookId])
  @@index([sourcebookId, parentSlug])
}
```

- [ ] **Step 2: Push schema to homelab dev DB**

Local `prisma db push` reads `.env`, not `.env.local`, so it hits the wrong DB (see MEMORY.md). Run:

```
npx prisma db push
```

If the running `npm run dev` holds a Prisma client lock and you see EPERM, stop the dev server, push, then restart.

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate client**

```
npx prisma generate
```

Expected: `Generated Prisma Client (vX.Y.Z) to ./node_modules/@prisma/client`

- [ ] **Step 4: Commit**

```
git add prisma/schema.prisma
git commit -m "feat(schema): persist chapter prose on DdbSourcebookChapter"
```

---

## Task 2: Sync pipeline writes `bodySections`

**Files:**
- Modify: `src/server/repositories/ddb-sync.repository.ts` (around `updateChapterHash`, line 465)
- Modify: `src/lib/queue/ddb-write-sink.ts` (call site that persists chapter results)

- [ ] **Step 1: Find the write-sink that finalises a chapter**

Run: `grep -n "updateChapterHash\|recordFetched\|contentHash" src/lib/queue/ddb-write-sink.ts | head -20`

Identify the method that runs at the end of a chapter sync (where `contentHash` is written). Note its name and signature.

- [ ] **Step 2: Update `updateChapterHash` to accept and write the section array**

In `src/server/repositories/ddb-sync.repository.ts`, change the signature and body:

```ts
async updateChapterHash(
  chapterId: string,
  contentHash: string,
  pendingChanges: object[],
  bodySections: Array<{ heading: string | null; level: number; markdown: string }>,
) {
  return prisma.ddbSourcebookChapter.update({
    where: { id: chapterId },
    data: {
      contentHash,
      syncStatus: 'idle',
      hasPendingChanges: pendingChanges.length > 0,
      pendingChanges: pendingChanges.length > 0 ? pendingChanges : Prisma.JsonNull,
      lastSyncedAt: new Date(),
      bodySections: bodySections as unknown as Prisma.InputJsonValue,
      bodySyncedAt: new Date(),
    },
  });
},
```

Ensure `import { Prisma } from '@prisma/client'` is present at the top of the file.

- [ ] **Step 3: Update the write-sink call site to pass `content.sections`**

In `src/lib/queue/ddb-write-sink.ts`, find the call to `ddbSyncRepository.updateChapterHash(...)`. The same scope already has the parsed `ChapterContent`. Pass its `sections`:

```ts
await ddbSyncRepository.updateChapterHash(
  chapterId,
  content.contentHash,
  pendingChanges,
  content.sections,
);
```

If the parsed-content variable isn't named `content`, adjust to match the surrounding scope. `ChapterContent.sections` is what `parseChapterContent` already returns.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: zero errors. If errors mention `updateChapterHash`, every caller must pass the new 4th arg. Find them with `grep -rn "updateChapterHash" src/` and add `content.sections` (or `[]` only as a last resort) at each site.

- [ ] **Step 5: Commit**

```
git add src/server/repositories/ddb-sync.repository.ts src/lib/queue/ddb-write-sink.ts
git commit -m "feat(ddb-sync): persist chapter prose on every chapter sync"
```

---

## Task 3: Entity-link tokeniser (pure function, testable)

**Files:**
- Create: `src/lib/sourcebook/entity-tokenizer.ts`
- Create: `tests/lib/sourcebook/entity-tokenizer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/sourcebook/entity-tokenizer.test.ts
import { describe, it, expect } from 'vitest';
import { tokenizeEntities, type EntityIndexItem } from '@/lib/sourcebook/entity-tokenizer';

const entities: EntityIndexItem[] = [
  { id: 'e1', name: 'Sildar Hallwinter', aliases: [], type: 'NPC' },
  { id: 'e2', name: 'Sildar', aliases: [], type: 'NPC' },
  { id: 'e3', name: 'Phandalin', aliases: ['Phandalin Town'], type: 'LOCATION' },
];

describe('tokenizeEntities', () => {
  it('replaces longest name first', () => {
    const out = tokenizeEntities('Sildar Hallwinter and his men.', entities);
    expect(out).toBe('[[entity:e1|Sildar Hallwinter]] and his men.');
  });

  it('matches shorter name when longer is absent', () => {
    const out = tokenizeEntities('Then Sildar spoke.', entities);
    expect(out).toBe('Then [[entity:e2|Sildar]] spoke.');
  });

  it('matches aliases', () => {
    const out = tokenizeEntities('Welcome to Phandalin Town.', entities);
    expect(out).toBe('Welcome to [[entity:e3|Phandalin Town]].');
  });

  it('is case-insensitive but preserves display text', () => {
    const out = tokenizeEntities('we reached phandalin at dusk.', entities);
    expect(out).toBe('we reached [[entity:e3|phandalin]] at dusk.');
  });

  it('skips matches inside existing markdown links', () => {
    const out = tokenizeEntities('See [Sildar](http://x) for details.', entities);
    expect(out).toBe('See [Sildar](http://x) for details.');
  });

  it('skips matches inside fenced code blocks', () => {
    const md = '```\nSildar\n```\nThen Sildar arrived.';
    const out = tokenizeEntities(md, entities);
    expect(out).toBe('```\nSildar\n```\nThen [[entity:e2|Sildar]] arrived.');
  });

  it('respects word boundaries', () => {
    const out = tokenizeEntities('The Sildarian empire.', entities);
    expect(out).toBe('The Sildarian empire.');
  });

  it('returns input unchanged when index is empty', () => {
    expect(tokenizeEntities('Hello world.', [])).toBe('Hello world.');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/lib/sourcebook/entity-tokenizer.test.ts`

Expected: all 8 tests fail with "Cannot find module '@/lib/sourcebook/entity-tokenizer'".

- [ ] **Step 3: Implement the tokeniser**

```ts
// src/lib/sourcebook/entity-tokenizer.ts
export interface EntityIndexItem {
  id: string;
  name: string;
  aliases: string[];
  type: string;
}

interface MatchTerm {
  id: string;
  term: string;
  lowerTerm: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatchTerms(entities: EntityIndexItem[]): MatchTerm[] {
  const terms: MatchTerm[] = [];
  for (const e of entities) {
    for (const t of [e.name, ...e.aliases]) {
      const trimmed = t.trim();
      if (trimmed.length < 3) continue;
      terms.push({ id: e.id, term: trimmed, lowerTerm: trimmed.toLowerCase() });
    }
  }
  terms.sort((a, b) => b.term.length - a.term.length);
  return terms;
}

function splitProtectedSegments(md: string): Array<{ text: string; protected: boolean }> {
  const segments: Array<{ text: string; protected: boolean }> = [];
  const re = /(```[\s\S]*?```|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: md.slice(lastIndex, m.index), protected: false });
    }
    segments.push({ text: m[0], protected: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < md.length) {
    segments.push({ text: md.slice(lastIndex), protected: false });
  }
  return segments;
}

function tokenizeSegment(text: string, terms: MatchTerm[]): string {
  if (terms.length === 0) return text;
  const pattern = terms.map((t) => escapeRegex(t.term)).join('|');
  const re = new RegExp(`\\b(${pattern})\\b`, 'gi');
  const byLower = new Map(terms.map((t) => [t.lowerTerm, t.id]));
  return text.replace(re, (match) => {
    const id = byLower.get(match.toLowerCase());
    return id ? `[[entity:${id}|${match}]]` : match;
  });
}

export function tokenizeEntities(markdown: string, entities: EntityIndexItem[]): string {
  const terms = buildMatchTerms(entities);
  if (terms.length === 0) return markdown;
  const segments = splitProtectedSegments(markdown);
  return segments
    .map((seg) => (seg.protected ? seg.text : tokenizeSegment(seg.text, terms)))
    .join('');
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/lib/sourcebook/entity-tokenizer.test.ts`

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/sourcebook/entity-tokenizer.ts tests/lib/sourcebook/entity-tokenizer.test.ts
git commit -m "feat(sourcebook): entity-name tokeniser for chapter prose"
```

---

## Task 4: `sourcebookReader` tRPC router

**Files:**
- Create: `src/server/routers/sourcebook-reader.ts`
- Modify: `src/server/routers/_app.ts` (register the router)

- [ ] **Step 1: Create the router file**

```ts
// src/server/routers/sourcebook-reader.ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { addDdbSyncJob } from '@/lib/queue/ddb-sync-queue';
import { tokenizeEntities, type EntityIndexItem } from '@/lib/sourcebook/entity-tokenizer';

async function resolveLinkedBook(campaignId: string, bookSlug: string) {
  const link = await prisma.campaignSourcebook.findFirst({
    where: { campaignId, sourcebook: { slug: bookSlug } },
    include: { sourcebook: true },
  });
  if (!link) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sourcebook not linked to this campaign' });
  }
  return link.sourcebook;
}

export const sourcebookReaderRouter = router({
  getOverview: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), bookSlug: z.string().min(1) }))
    .query(async ({ input }) => {
      const book = await resolveLinkedBook(input.campaignId, input.bookSlug);
      const chapters = await prisma.ddbSourcebookChapter.findMany({
        where: { sourcebookId: book.id },
        orderBy: { chapterIndex: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          chapterIndex: true,
          parentSlug: true,
          bodySyncedAt: true,
        },
      });
      return {
        book: {
          id: book.id,
          slug: book.slug,
          title: book.title,
          lastSyncedAt: book.lastSyncedAt,
          syncStatus: book.syncStatus,
        },
        chapters: chapters.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          chapterIndex: c.chapterIndex,
          parentSlug: c.parentSlug,
          hasBody: c.bodySyncedAt !== null,
        })),
      };
    }),

  getChapter: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      bookSlug: z.string().min(1),
      chapterSlug: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const book = await resolveLinkedBook(input.campaignId, input.bookSlug);

      const chapter = await prisma.ddbSourcebookChapter.findUnique({
        where: { sourcebookId_slug: { sourcebookId: book.id, slug: input.chapterSlug } },
        include: {
          illustrations: { orderBy: { position: 'asc' } },
        },
      });
      if (!chapter) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });

      const entityRows = await prisma.sourcebookEntity.findMany({
        where: { sourcebookId: book.id },
        select: {
          id: true, name: true, aliases: true, type: true,
          description: true, imageUrl: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const entityIndex = entityRows.map((e) => ({
        id: e.id,
        name: e.name,
        aliases: e.aliases ?? [],
        type: e.type,
        thumbUrl: e.imageUrl,
        oneLineDesc: e.description ? e.description.split(/\r?\n/)[0].slice(0, 160) : null,
      }));

      type RawSection = { heading: string | null; level: number; markdown: string };
      const rawSections = (chapter.bodySections ?? []) as RawSection[];
      const linkableIndex: EntityIndexItem[] = entityIndex.map((e) => ({
        id: e.id, name: e.name, aliases: e.aliases, type: e.type,
      }));
      const sections = rawSections.map((s) => ({
        heading: s.heading,
        level: s.level,
        markdown: tokenizeEntities(s.markdown, linkableIndex),
      }));

      return {
        chapter: {
          id: chapter.id,
          slug: chapter.slug,
          title: chapter.title,
          chapterIndex: chapter.chapterIndex,
          parentSlug: chapter.parentSlug,
          hasBody: chapter.bodySyncedAt !== null,
          bodySyncedAt: chapter.bodySyncedAt,
        },
        sections,
        illustrations: chapter.illustrations.map((i) => ({
          id: i.id, url: i.url, alt: i.alt,
          sectionHeading: i.sectionHeading, isHero: i.isHero,
          kind: i.kind, position: i.position,
        })),
        entityIndex,
      };
    }),

  resyncBook: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), bookSlug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const book = await resolveLinkedBook(input.campaignId, input.bookSlug);
      if (book.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the book owner can trigger re-sync' });
      }
      await addDdbSyncJob(book.id, book.userId);
      return { queued: true };
    }),
});
```

- [ ] **Step 2: Register router in `_app.ts`**

Add an import near the other ddb imports:

```ts
import { sourcebookReaderRouter } from './sourcebook-reader';
```

Add an entry inside `appRouter`:

```ts
  sourcebookReader: sourcebookReaderRouter,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 4: Commit**

```
git add src/server/routers/sourcebook-reader.ts src/server/routers/_app.ts
git commit -m "feat(sourcebook): sourcebookReader tRPC router (DM-only)"
```

---

## Task 5: Page route + server shell

**Files:**
- Create: `src/app/(app)/campaigns/[slug]/sourcebook/page.tsx`

- [ ] **Step 1: Create the page shell**

```tsx
'use client';
import { Suspense } from 'react';
import { SourcebookReader } from '@/components/sourcebook/SourcebookReader';

export default function SourcebookPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-220px)] animate-pulse rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)]" />
    }>
      <SourcebookReader />
    </Suspense>
  );
}
```

No commit yet — bundle with Task 6.

---

## Task 6: `SourcebookReader` client orchestrator

**Files:**
- Create: `src/components/sourcebook/SourcebookReader.tsx`

- [ ] **Step 1: Implement the orchestrator**

```tsx
'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { ChapterTree } from './ChapterTree';
import { ChapterView } from './ChapterView';
import { Skeleton } from '@/components/ui/skeleton';

export function SourcebookReader() {
  const { campaignId } = useCampaign();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const linked = trpc.ddbSync.listSourcebooksForCampaign.useQuery(
    { campaignId },
    { enabled: !!campaignId },
  );
  const firstLinked = linked.data?.find((b) => b.linked);
  const bookSlug = firstLinked?.slug;

  const overview = trpc.sourcebookReader.getOverview.useQuery(
    { campaignId, bookSlug: bookSlug ?? '' },
    { enabled: !!bookSlug },
  );

  const activeChapterSlug = useMemo(() => {
    const fromUrl = searchParams.get('chapter');
    if (fromUrl) return fromUrl;
    return overview.data?.chapters[0]?.slug ?? null;
  }, [searchParams, overview.data]);

  const chapter = trpc.sourcebookReader.getChapter.useQuery(
    { campaignId, bookSlug: bookSlug ?? '', chapterSlug: activeChapterSlug ?? '' },
    { enabled: !!bookSlug && !!activeChapterSlug },
  );

  function setActiveChapter(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('chapter', slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: true });
  }

  if (linked.isLoading) {
    return <Skeleton className="h-[calc(100vh-220px)] w-full" />;
  }
  if (!firstLinked) {
    return (
      <div className="p-8 text-[var(--q-text-secondary)]">
        No sourcebook is linked to this campaign. Link a DDB sourcebook in
        <span className="text-[var(--q-accent)]"> Settings &rarr; Sourcebooks</span> to start reading.
      </div>
    );
  }
  if (!overview.data) {
    return <Skeleton className="h-[calc(100vh-220px)] w-full" />;
  }

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 h-[calc(100vh-220px)]">
      <ChapterTree
        book={overview.data.book}
        chapters={overview.data.chapters}
        activeSlug={activeChapterSlug}
        onSelect={setActiveChapter}
        campaignId={campaignId}
      />
      <ChapterView
        loading={chapter.isLoading}
        data={chapter.data}
        bookSlug={bookSlug ?? ''}
        campaignId={campaignId}
      />
    </div>
  );
}
```

No commit yet — bundle with Task 9.

---

## Task 7: `ChapterTree` sidebar component

**Files:**
- Create: `src/components/sourcebook/ChapterTree.tsx`

- [ ] **Step 1: Implement the tree sidebar**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { RefreshCcw, ChevronRight } from 'lucide-react';

type ChapterNode = {
  id: string; slug: string; title: string;
  chapterIndex: number; parentSlug: string | null; hasBody: boolean;
  children: ChapterNode[];
};

interface Props {
  book: { id: string; title: string; slug: string; lastSyncedAt: Date | null };
  chapters: Array<{
    id: string; slug: string; title: string;
    chapterIndex: number; parentSlug: string | null; hasBody: boolean;
  }>;
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  campaignId: string;
}

function buildTree(chapters: Props['chapters']): ChapterNode[] {
  const bySlug = new Map<string, ChapterNode>();
  for (const c of chapters) bySlug.set(c.slug, { ...c, children: [] });
  const roots: ChapterNode[] = [];
  for (const node of bySlug.values()) {
    if (node.parentSlug && bySlug.has(node.parentSlug)) {
      bySlug.get(node.parentSlug)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortFn = (a: ChapterNode, b: ChapterNode) => a.chapterIndex - b.chapterIndex;
  roots.sort(sortFn);
  for (const r of roots) r.children.sort(sortFn);
  return roots;
}

export function ChapterTree({ book, chapters, activeSlug, onSelect, campaignId }: Props) {
  const [filter, setFilter] = useState('');
  const tree = useMemo(() => buildTree(chapters), [chapters]);
  const resync = trpc.sourcebookReader.resyncBook.useMutation();

  const filtered = useMemo(() => {
    if (!filter.trim()) return tree;
    const q = filter.toLowerCase();
    const match = (n: ChapterNode): ChapterNode | null => {
      const hit = n.title.toLowerCase().includes(q);
      const kids = n.children.map(match).filter((x): x is ChapterNode => x !== null);
      if (hit || kids.length > 0) return { ...n, children: kids };
      return null;
    };
    return tree.map(match).filter((x): x is ChapterNode => x !== null);
  }, [tree, filter]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-[var(--q-border-subtle)]">
        <div className="font-display text-base text-[var(--q-text-primary)] truncate">
          {book.title}
        </div>
        {book.lastSyncedAt && (
          <div className="text-xs text-[var(--q-text-tertiary)] mt-1">
            Synced {new Date(book.lastSyncedAt).toLocaleDateString()}
          </div>
        )}
      </div>
      <div className="p-3 border-b border-[var(--q-border-subtle)]">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter chapters..."
          className="w-full h-9 px-3 rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] text-sm text-[var(--q-text-primary)] placeholder:text-[var(--q-text-tertiary)] focus:outline-none focus:border-[var(--q-accent)]"
        />
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {filtered.map((node) => (
          <TreeNode key={node.id} node={node} depth={0} activeSlug={activeSlug} onSelect={onSelect} />
        ))}
      </nav>
      <div className="p-3 border-t border-[var(--q-border-subtle)]">
        <button
          type="button"
          disabled={resync.isPending}
          onClick={() => resync.mutate({ campaignId, bookSlug: book.slug })}
          className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-sm border border-[var(--q-border-subtle)] text-sm text-[var(--q-text-secondary)] hover:text-[var(--q-accent)] hover:border-[var(--q-accent)] transition-colors disabled:opacity-50"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {resync.isPending ? 'Queuing...' : 'Re-sync sourcebook'}
        </button>
      </div>
    </Card>
  );
}

function TreeNode({
  node, depth, activeSlug, onSelect,
}: {
  node: ChapterNode; depth: number; activeSlug: string | null; onSelect: (slug: string) => void;
}) {
  const active = node.slug === activeSlug;
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.slug)}
        className={cn(
          'w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-sm transition-colors',
          active
            ? 'bg-[var(--q-accent-muted)] text-[var(--q-accent)]'
            : 'text-[var(--q-text-secondary)] hover:bg-[var(--q-surface-utility)] hover:text-[var(--q-text-primary)]'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {node.children.length > 0 ? (
          <ChevronRight
            className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-90')}
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          />
        ) : (
          <span className="w-3" />
        )}
        <span className="truncate">{node.title}</span>
        {!node.hasBody && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--q-text-tertiary)]">
            empty
          </span>
        )}
      </button>
      {open && node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} activeSlug={activeSlug} onSelect={onSelect} />
      ))}
    </div>
  );
}
```

No commit yet — bundle with Task 9.

---

## Task 8: `EntityLink` with shadcn HoverCard

**Files:**
- Create: `src/components/sourcebook/EntityLink.tsx`
- Possibly add: `src/components/ui/hover-card.tsx` (via shadcn CLI)

- [ ] **Step 1: Ensure HoverCard primitive exists**

Run: `ls src/components/ui/hover-card.tsx`

If missing, run: `npx shadcn@latest add hover-card` and accept defaults.

- [ ] **Step 2: Implement EntityLink**

```tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useCampaign } from '@/components/campaign/campaign-context';

export interface EntityRef {
  id: string;
  name: string;
  type: string;
  thumbUrl: string | null;
  oneLineDesc: string | null;
}

interface Props {
  entity: EntityRef;
  displayText: string;
}

function entityHref(slug: string, entity: EntityRef): string {
  if (entity.type === 'NPC') return `/campaigns/${slug}/npcs/${entity.id}`;
  return `/campaigns/${slug}/world?entity=${entity.id}`;
}

export function EntityLink({ entity, displayText }: Props) {
  const { slug } = useCampaign();
  const href = entityHref(slug, entity);
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          href={href}
          className="text-[var(--q-accent)] underline decoration-[var(--q-accent)]/40 underline-offset-2 hover:decoration-[var(--q-accent)] transition-colors"
        >
          {displayText}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-72 p-3 bg-[var(--q-surface-elevated)] border border-[var(--q-border-subtle)] backdrop-blur"
      >
        <div className="flex gap-3">
          {entity.thumbUrl ? (
            <Image src={entity.thumbUrl} alt={entity.name} width={48} height={48}
              className="h-12 w-12 rounded-sm object-cover shrink-0" unoptimized />
          ) : (
            <div className="h-12 w-12 rounded-sm bg-[var(--q-surface-utility)] shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--q-accent)]">
              {entity.type}
            </div>
            <div className="font-display text-sm text-[var(--q-text-primary)] truncate">
              {entity.name}
            </div>
            {entity.oneLineDesc && (
              <div className="text-xs text-[var(--q-text-secondary)] mt-1 line-clamp-2">
                {entity.oneLineDesc}
              </div>
            )}
          </div>
        </div>
        <Link href={href} className="block mt-3 text-center text-xs text-[var(--q-accent)] hover:underline">
          Open &rarr;
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}
```

No commit yet — bundle with Task 9.

---

## Task 9: `ChapterView` main pane + markdown renderer

**Files:**
- Create: `src/components/sourcebook/markdown-with-entities.tsx`
- Create: `src/components/sourcebook/ChapterView.tsx`
- Modify: `src/styles/tokens.css` (append `.prose-q` utility)

- [ ] **Step 1: Implement the entity-aware markdown renderer**

```tsx
'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode } from 'react';
import { EntityLink, type EntityRef } from './EntityLink';

interface Props {
  markdown: string;
  entityById: Map<string, EntityRef>;
}

const ENTITY_RE = /\[\[entity:([^|\]]+)\|([^\]]+)\]\]/g;

function renderWithEntityTokens(
  text: string,
  entityById: Map<string, EntityRef>,
): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  ENTITY_RE.lastIndex = 0;
  let key = 0;
  while ((m = ENTITY_RE.exec(text)) !== null) {
    if (m.index > lastIndex) out.push(text.slice(lastIndex, m.index));
    const id = m[1];
    const display = m[2];
    const entity = entityById.get(id);
    if (entity) {
      out.push(<EntityLink key={key++} entity={entity} displayText={display} />);
    } else {
      out.push(display);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

function walk(children: ReactNode, entityById: Map<string, EntityRef>): ReactNode {
  if (typeof children === 'string') {
    return children.includes('[[entity:')
      ? renderWithEntityTokens(children, entityById)
      : children;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => {
      if (typeof c === 'string' && c.includes('[[entity:')) {
        return <span key={i}>{renderWithEntityTokens(c, entityById)}</span>;
      }
      return c;
    });
  }
  return children;
}

export function MarkdownWithEntities({ markdown, entityById }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{walk(children, entityById)}</p>,
        li: ({ children }) => <li>{walk(children, entityById)}</li>,
        td: ({ children }) => <td>{walk(children, entityById)}</td>,
        em: ({ children }) => <em>{walk(children, entityById)}</em>,
        strong: ({ children }) => <strong>{walk(children, entityById)}</strong>,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 2: Implement the main pane**

```tsx
'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/primitives';
import { MarkdownWithEntities } from './markdown-with-entities';
import type { EntityRef } from './EntityLink';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RefreshCcw } from 'lucide-react';

type Illustration = {
  id: string; url: string; alt: string | null;
  sectionHeading: string | null; isHero: boolean;
  kind: string; position: number;
};

type Section = { heading: string | null; level: number; markdown: string };

interface Props {
  loading: boolean;
  bookSlug: string;
  campaignId: string;
  data?: {
    chapter: { id: string; slug: string; title: string; chapterIndex: number; parentSlug: string | null; hasBody: boolean; bodySyncedAt: Date | null };
    sections: Section[];
    illustrations: Illustration[];
    entityIndex: Array<EntityRef & { aliases: string[] }>;
  };
}

function illustrationClass(kind: string) {
  if (kind === 'map') return 'w-full my-6 rounded-sm';
  if (kind === 'portrait') return 'float-right ml-6 mb-4 w-[280px] rounded-sm';
  return 'w-full my-6 rounded-sm';
}

export function ChapterView({ loading, data, bookSlug, campaignId }: Props) {
  const resync = trpc.sourcebookReader.resyncBook.useMutation();
  const [zoom, setZoom] = useState<Illustration | null>(null);

  const entityById = useMemo(() => {
    const m = new Map<string, EntityRef>();
    for (const e of data?.entityIndex ?? []) {
      m.set(e.id, { id: e.id, name: e.name, type: e.type, thumbUrl: e.thumbUrl, oneLineDesc: e.oneLineDesc });
    }
    return m;
  }, [data?.entityIndex]);

  const hero = data?.illustrations.find((i) => i.isHero) ?? null;

  const illustrationsBySection = useMemo(() => {
    const m = new Map<string, Illustration[]>();
    for (const i of data?.illustrations ?? []) {
      if (i.isHero) continue;
      const key = (i.sectionHeading ?? '').trim().toLowerCase();
      const arr = m.get(key) ?? [];
      arr.push(i);
      m.set(key, arr);
    }
    return m;
  }, [data?.illustrations]);

  if (loading || !data) {
    return (
      <Card className="p-8 overflow-y-auto">
        <Skeleton className="h-8 w-1/3 mb-6" />
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
    );
  }

  if (!data.chapter.hasBody) {
    return (
      <Card className="p-8 overflow-y-auto">
        <h1 className="font-display text-3xl text-[var(--q-text-primary)] mb-4">
          {data.chapter.title}
        </h1>
        <div className="max-w-md mx-auto mt-16 text-center">
          <p className="text-[var(--q-text-secondary)] mb-6">
            Chapter content hasn't been stored yet. Re-sync the sourcebook to load the prose.
          </p>
          <button
            type="button"
            disabled={resync.isPending}
            onClick={() => resync.mutate({ campaignId, bookSlug })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-[var(--q-accent)] text-[var(--q-accent)] hover:bg-[var(--q-accent-muted)] transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            {resync.isPending ? 'Queuing re-sync...' : 'Re-sync sourcebook'}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8 overflow-y-auto prose-q">
      <h1 className="font-display text-3xl text-[var(--q-text-primary)] mb-2">
        {data.chapter.title}
      </h1>
      {hero && (
        <button type="button" onClick={() => setZoom(hero)} className="block w-full">
          <Image src={hero.url} alt={hero.alt ?? data.chapter.title}
            width={1200} height={600} className="w-full rounded-sm my-6" unoptimized />
        </button>
      )}
      {data.sections.map((section, i) => {
        const key = (section.heading ?? '').trim().toLowerCase();
        const sectionImages = illustrationsBySection.get(key) ?? [];
        return (
          <section key={i} className="mt-6">
            {section.heading && (
              <h2 className="font-display text-xl text-[var(--q-text-primary)] mt-8 mb-3">
                {section.heading}
              </h2>
            )}
            <div className="text-[var(--q-text-primary)] leading-relaxed">
              <MarkdownWithEntities markdown={section.markdown} entityById={entityById} />
            </div>
            {sectionImages.map((img) => (
              <button key={img.id} type="button" onClick={() => setZoom(img)} className="block">
                <Image src={img.url} alt={img.alt ?? ''}
                  width={800} height={500} className={illustrationClass(img.kind)} unoptimized />
              </button>
            ))}
          </section>
        );
      })}

      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-5xl p-0 bg-transparent border-0">
          {zoom && (
            <Image src={zoom.url} alt={zoom.alt ?? ''}
              width={1600} height={1000} className="w-full h-auto rounded-sm" unoptimized />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Step 3: Append prose-styling utility**

In `src/styles/tokens.css`, append:

```css
.prose-q p { margin-block: 0.9rem; }
.prose-q ul, .prose-q ol { margin-block: 0.9rem; padding-left: 1.4rem; list-style: disc; }
.prose-q li { margin-block: 0.3rem; }
.prose-q blockquote {
  margin-block: 1rem;
  padding: 0.6rem 1rem;
  border-left: 2px solid var(--q-accent);
  background: var(--q-surface-utility);
  font-style: italic;
}
.prose-q table { width: 100%; border-collapse: collapse; margin-block: 1rem; }
.prose-q th, .prose-q td { border: 1px solid var(--q-border-subtle); padding: 0.4rem 0.6rem; text-align: left; }
.prose-q th { background: var(--q-surface-utility); font-family: var(--q-font-display); }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 5: Smoke-test in browser**

Run: `npm run dev` (if not already running).

Visit `http://localhost:3847/campaigns/lost-mines-of-phandelver/sourcebook`.

Expected:
- TOC sidebar renders with chapter titles
- "Re-sync sourcebook" button visible
- Selecting a chapter updates `?chapter=<slug>` in the URL without a full reload
- Chapters with `bodySections=null` show the empty-state re-sync CTA

- [ ] **Step 6: Commit Tasks 5–9 together**

```
git add src/app/\(app\)/campaigns/\[slug\]/sourcebook/page.tsx \
        src/components/sourcebook/SourcebookReader.tsx \
        src/components/sourcebook/ChapterTree.tsx \
        src/components/sourcebook/ChapterView.tsx \
        src/components/sourcebook/EntityLink.tsx \
        src/components/sourcebook/markdown-with-entities.tsx \
        src/components/ui/hover-card.tsx \
        src/styles/tokens.css
git commit -m "feat(sourcebook): reader UI"
```

---

## Task 10: Add Sourcebook entry to campaign navigation

**Files:**
- Modify: campaign sub-nav file (likely `src/components/layout/canvas-header.tsx` or `src/components/shell/CommandRail.tsx` — confirm before editing)

- [ ] **Step 1: Find the campaign nav**

Run: `grep -rn "/mechanics\|/world-map" src/components/layout/ src/components/shell/ | head -10`

Identify the file that lists campaign sub-routes (the Mechanics tab was added recently — it is the template for adding Sourcebook).

- [ ] **Step 2: Add a "Sourcebook" entry**

In the file from Step 1, find the array of nav items. Insert a new item following the same shape as the Mechanics entry — typically:

```tsx
{ label: 'Sourcebook', href: `/campaigns/${slug}/sourcebook`, icon: BookOpen, dmOnly: true }
```

Add `import { BookOpen } from 'lucide-react'` if not already imported.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 4: Commit**

```
git add -p
git commit -m "feat(nav): expose Sourcebook reader in campaign navigation"
```

---

## Task 11: Workflow spec

**Files:**
- Create: `tests/workflows/sourcebook.workflow.spec.ts`
- Modify (or create): `tests/helpers/auth.ts` — add `seedCampaignWithSourcebook`

- [ ] **Step 1: Find the existing test helpers**

Run: `grep -rn "loginAsSeededDm\|loginAs.*Dm\|seedCampaign" tests/helpers tests/workflows | head -10`

Identify the existing login + seeding pattern. Match its style for the new helper.

- [ ] **Step 2: Implement `seedCampaignWithSourcebook` using direct Prisma**

In `tests/helpers/auth.ts` (or the matching helpers file from Step 1):

```ts
import { prisma } from '@/lib/prisma';

export async function seedCampaignWithSourcebook(
  opts: { withEntity?: boolean; withEmptyChapter?: boolean } = {},
) {
  // Implementation pattern (write inline, no TODO left behind):
  // 1. Create a User (or reuse seeded DM)
  // 2. Create a Campaign linked to that user as OWNER
  // 3. Create a DdbEntitlement + DdbSourcebook (slug e.g. 'test-book-' + nanoid())
  // 4. Create CampaignSourcebook linking the two
  // 5. Create two DdbSourcebookChapter rows. First gets bodySections=[{ heading: 'Intro', level: 2, markdown: 'Welcome to the test chapter. Sildar awaits.' }] and bodySyncedAt=new Date().
  //    Second gets a similar non-empty body.
  //    If withEmptyChapter, add a 3rd chapter with bodySections=null.
  // 6. If withEntity, create a SourcebookEntity with name='Sildar', type='NPC', description='Sword of veteran tone.'
  // Return:
  //   { campaignSlug, bookSlug, firstChapterSlug, secondChapterSlug,
  //     emptyChapterSlug?, chapterWithEntity?, entityName? }
  ...
}
```

Implement the body inline (no placeholders). Use distinct slug suffixes per test run so reruns don't collide.

- [ ] **Step 3: Write the workflow spec**

```ts
// tests/workflows/sourcebook.workflow.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsSeededDm, seedCampaignWithSourcebook } from '../helpers/auth';

test.describe('Sourcebook reader', () => {
  test('DM can open the sourcebook page and switch chapters via URL', async ({ page }) => {
    const { campaignSlug, firstChapterSlug, secondChapterSlug } =
      await seedCampaignWithSourcebook();
    await loginAsSeededDm(page);

    await page.goto(`/campaigns/${campaignSlug}/sourcebook`);

    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('text=' + firstChapterSlug).first()).toBeVisible();

    await page.getByRole('button', { name: new RegExp(secondChapterSlug, 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`chapter=${secondChapterSlug}`));

    await page.goto(`/campaigns/${campaignSlug}/sourcebook?chapter=${firstChapterSlug}`);
    await expect(page.locator('h1')).toContainText(firstChapterSlug, { ignoreCase: true });
  });

  test('entity links render with hover popover', async ({ page }) => {
    const { campaignSlug, chapterWithEntity, entityName } =
      await seedCampaignWithSourcebook({ withEntity: true });
    await loginAsSeededDm(page);

    await page.goto(`/campaigns/${campaignSlug}/sourcebook?chapter=${chapterWithEntity}`);
    const link = page.getByRole('link', { name: entityName! }).first();
    await expect(link).toBeVisible();
    await link.hover();
    await expect(page.getByRole('link', { name: /open/i })).toBeVisible();
  });

  test('empty chapter shows resync CTA', async ({ page }) => {
    const { campaignSlug, emptyChapterSlug } =
      await seedCampaignWithSourcebook({ withEmptyChapter: true });
    await loginAsSeededDm(page);

    await page.goto(`/campaigns/${campaignSlug}/sourcebook?chapter=${emptyChapterSlug}`);
    await expect(page.getByRole('button', { name: /re-sync sourcebook/i })).toBeVisible();
  });
});
```

- [ ] **Step 4: Run the spec against local dev**

MEMORY.md note: `CI=true` is set globally — Playwright will silently target prod. Clear it for this run:

PowerShell:
```
$env:CI=$null; $env:BASE_URL='http://localhost:3847'; npx playwright test tests/workflows/sourcebook.workflow.spec.ts
```

Expected: all three tests pass.

- [ ] **Step 5: Commit**

```
git add tests/workflows/sourcebook.workflow.spec.ts tests/helpers/auth.ts
git commit -m "test(sourcebook): workflow spec for reader, entity links, resync CTA"
```

---

## Task 12: Re-sync existing LMoP to backfill prose, verify manually

This is an operational step against the dev environment (no code changes, no commit).

- [ ] **Step 1: Trigger a re-sync**

Open `https://dev.quiverdm.com/campaigns/lost-mines-of-phandelver/sourcebook` (or `http://localhost:3847/...`). Chapters will show "empty" pills. Click "Re-sync sourcebook" in the sidebar.

- [ ] **Step 2: Wait until `bodySections` is populated**

Either use the `read-only-postgres` skill against `quiverdm-local`, or run a Prisma query:

```
npx tsx -e "import('./src/lib/prisma').then(async ({prisma})=>{const ch = await prisma.ddbSourcebookChapter.findMany({where:{sourcebook:{slug:'lost-mines-of-phandelver'}}, select:{slug:true, bodySyncedAt:true}}); console.table(ch); process.exit(0)})"
```

Expected: every chapter has a non-null `bodySyncedAt` within a few minutes.

- [ ] **Step 3: Verify rendering in-app**

Reload the page. Chapters now render full prose with inline entity links (e.g. "Sildar Hallwinter", "Cragmaw Hideout"). Hovering shows the popover; clicking navigates to the entity page.

- [ ] **Step 4: Smoke-test deep link**

Open `/campaigns/lost-mines-of-phandelver/sourcebook?chapter=part-2-phandalin` in a fresh tab. Page loads directly on that chapter, sidebar highlights it, browser back returns to the previous chapter.

---

## Task 13: Update memory

**Files:**
- Modify: `C:\Users\mail\.claude\projects\E--Projects-QuiverDM\memory\MEMORY.md`
- Optional: re-ingest the plan into OpenViking

- [ ] **Step 1: Add a completed-features entry**

Append under "Completed Features":

```
- Sourcebook Reader (2026-05-14) — `/campaigns/[slug]/sourcebook`. TOC sidebar, chapter view with inline entity HoverCard links, hero + section illustrations, `?chapter=slug` URL state, DM-only. Schema: `DdbSourcebookChapter.bodySections` Json + `bodySyncedAt`. Sync pipeline now persists `parseChapterContent.sections`. Re-sync existing books to backfill. Plan: `docs/superpowers/plans/2026-05-14-sourcebook-reader-impl.md`.
```

- [ ] **Step 2: (Optional) Re-ingest the spec + plan into OpenViking**

Use the `mcp__openviking__add_resource` tool against the QuiverDM namespace with paths:
- `E:/Projects/QuiverDM/docs/superpowers/specs/2026-05-14-sourcebook-reader-design.md`
- `E:/Projects/QuiverDM/docs/superpowers/plans/2026-05-14-sourcebook-reader-impl.md`

- [ ] **Step 3: No git commit — MEMORY.md is outside the repo.**

---

## Summary of files

**New:**
- `src/lib/sourcebook/entity-tokenizer.ts`
- `tests/lib/sourcebook/entity-tokenizer.test.ts`
- `src/server/routers/sourcebook-reader.ts`
- `src/app/(app)/campaigns/[slug]/sourcebook/page.tsx`
- `src/components/sourcebook/SourcebookReader.tsx`
- `src/components/sourcebook/ChapterTree.tsx`
- `src/components/sourcebook/ChapterView.tsx`
- `src/components/sourcebook/EntityLink.tsx`
- `src/components/sourcebook/markdown-with-entities.tsx`
- `src/components/ui/hover-card.tsx` (shadcn add, if missing)
- `tests/workflows/sourcebook.workflow.spec.ts`

**Modified:**
- `prisma/schema.prisma` — 2 fields on `DdbSourcebookChapter`
- `src/server/repositories/ddb-sync.repository.ts` — `updateChapterHash` signature
- `src/lib/queue/ddb-write-sink.ts` — pass `content.sections` through
- `src/server/routers/_app.ts` — register `sourcebookReader`
- `src/components/layout/...` (campaign nav file) — add Sourcebook link
- `src/styles/tokens.css` — `.prose-q` utility
- `tests/helpers/auth.ts` — `seedCampaignWithSourcebook`
