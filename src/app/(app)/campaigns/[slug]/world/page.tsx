'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, Flag, MapPin, Clock, ScrollText, Sparkles,
  ChevronDown, ChevronRight, Sword, Package, Dna, Upload, LayoutList,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { ImportSheet } from '@/components/world/import-sheet';
import { ChapterSection } from '@/components/world/chapter-section';
import { WorldEntryCard } from '@/components/world/world-entry-card';
import { Canvas, Card, Section, Surface } from '@/components/primitives';
import { getChapterColor } from '@/lib/chapter-colors';
import { cn } from '@/lib/utils';

// ─── Type metadata ────────────────────────────────────────────────────────────

type TypeMeta = { label: string; icon: React.ElementType }

const DOC_TYPE_META: Record<string, TypeMeta> = {
  lore:     { label: 'Lore',      icon: ScrollText },
  faction:  { label: 'Factions',  icon: Flag },
  location: { label: 'Locations', icon: MapPin },
  timeline: { label: 'Timelines', icon: Clock },
};

const HB_TYPE_META: Record<string, TypeMeta> = {
  item:     { label: 'Items',     icon: Package },
  creature: { label: 'Monsters',  icon: Sword },
  race:     { label: 'Races',     icon: Dna },
};

const ENTRY_TYPE_META: Record<string, TypeMeta> = {
  LOCATION:  { label: 'Locations',         icon: MapPin },
  NPC:       { label: 'NPCs',              icon: BookOpen },
  PC:        { label: 'Player Characters', icon: BookOpen },
  MONSTER:   { label: 'Monsters',          icon: Sword },
  ITEM:      { label: 'Items',             icon: Package },
  FACTION:   { label: 'Factions',          icon: Flag },
  RACE:      { label: 'Races',             icon: Dna },
  LORE:      { label: 'Lore',              icon: ScrollText },
  TIMELINE:  { label: 'Timelines',         icon: Clock },
  SPELL:     { label: 'Spells',            icon: Sparkles },
};

function getTypeMeta(type: string): TypeMeta {
  return ENTRY_TYPE_META[type] ?? DOC_TYPE_META[type] ?? HB_TYPE_META[type] ?? { label: type, icon: BookOpen };
}

function TypeBadge({ type }: { type: string }) {
  const { icon: Icon, label } = getTypeMeta(type);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-[var(--q-text-faint)]">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const ALL_TYPES = ['all', 'lore', 'faction', 'location', 'timeline', 'item', 'creature', 'race'] as const;
type FilterType = (typeof ALL_TYPES)[number];

function filterChipClass(isActive: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors',
    isActive
      ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
      : 'border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)] text-[var(--q-text-dim)] hover:border-[var(--q-amber-border)] hover:text-[var(--q-text)]',
  );
}

// ─── Document row (markdown content) ─────────────────────────────────────────

type Doc = { id: string; title: string; type: string; content: string; tags: string[] };

function DocRow({ doc, expanded, onToggle }: { doc: Doc; expanded: boolean; onToggle: () => void }) {
  return (
    <Surface
      variant={expanded ? 'feature' : 'utility'}
      grain={expanded}
      className={cn(
        'transition-colors',
        expanded ? 'border-[var(--q-amber-border)]' : 'hover:border-[var(--q-amber-trace)]',
      )}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-[var(--q-text)] leading-snug">{doc.title}</span>
          <span className="block mt-0.5"><TypeBadge type={doc.type} /></span>
        </span>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-[var(--q-text-dim)]" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--q-text-faint)]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--q-border-subtle)] pt-3">
          {doc.content ? (
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:font-[var(--q-font-display)] prose-headings:text-[var(--q-text)]
              prose-p:text-[var(--q-text-dim)] prose-p:leading-relaxed
              prose-strong:text-[var(--q-text)] prose-li:text-[var(--q-text-dim)]
              prose-hr:border-[var(--q-border-subtle)]
              prose-blockquote:border-[var(--q-amber-dim)] prose-blockquote:text-[var(--q-text-dim)]"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-[var(--q-text-faint)] italic">No content yet.</p>
          )}
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-[var(--q-border-subtle)]">
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] text-[10px] text-[var(--q-text-faint)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}

// ─── Homebrew row (structured data) ──────────────────────────────────────────

type HbItem = { id: string; name: string; type: string; data: unknown; tags: string[]; ddbChapterId?: string | null };

function hbSummary(item: HbItem): string {
  const d = item.data as Record<string, unknown>;
  if (item.type === 'item') return String(d?.description ?? '').slice(0, 200);
  if (item.type === 'creature') return String(d?.type_alignment ?? '');
  if (item.type === 'race') {
    const traits = d?.traits as Array<{ name?: string }> | undefined;
    return traits?.map((t) => t.name).filter(Boolean).slice(0, 4).join(', ') ?? '';
  }
  return '';
}

function HbRow({ item, expanded, onToggle }: { item: HbItem; expanded: boolean; onToggle: () => void }) {
  const summary = hbSummary(item);
  return (
    <Surface
      variant={expanded ? 'feature' : 'utility'}
      grain={expanded}
      className={cn(
        'transition-colors',
        expanded ? 'border-[var(--q-amber-border)]' : 'hover:border-[var(--q-amber-trace)]',
      )}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-[var(--q-text)] leading-snug">{item.name}</span>
          {summary && <span className="block text-xs text-[var(--q-text-dim)] mt-0.5 truncate">{summary}</span>}
        </span>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-[var(--q-text-dim)]" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--q-text-faint)]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--q-border-subtle)] pt-3 space-y-2">
          {Boolean((item.data as Record<string, unknown>)?.description) && (
            <p className="text-sm text-[var(--q-text-dim)] leading-relaxed">
              {String((item.data as Record<string, unknown>).description)}
            </p>
          )}
          {item.type === 'creature' && (() => {
            const d = item.data as Record<string, unknown>;
            const traits = d?.traits as Array<{ name?: string; description?: string }> | undefined;
            return traits?.length ? (
              <div className="space-y-1">
                {traits.slice(0, 4).map((t, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-semibold text-[var(--q-text)]">{t.name}</span>
                    {t.description && <span className="text-[var(--q-text-dim)]"> — {String(t.description).slice(0, 120)}</span>}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
          {item.type === 'race' && (() => {
            const d = item.data as Record<string, unknown>;
            const traits = d?.traits as Array<{ name?: string; description?: string }> | undefined;
            return traits?.length ? (
              <div className="space-y-1">
                {traits.map((t, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-semibold text-[var(--q-text)]">{t.name}</span>
                    {t.description && <span className="text-[var(--q-text-dim)]"> — {String(t.description).slice(0, 120)}</span>}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--q-border-subtle)]">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] text-[10px] text-[var(--q-text-faint)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorldPage() {
  const { campaignId, slug } = useCampaign();
  const searchParams = useSearchParams();
  const initialFilter = (() => {
    const f = searchParams?.get('filter');
    return (f && (ALL_TYPES as readonly string[]).includes(f) ? f : 'all') as FilterType;
  })();
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [entryFilter, setEntryFilter] = useState<string>(() => searchParams?.get('type') ?? 'all');
  const [viewMode, setViewMode] = useState<'by-type' | 'by-chapter'>('by-type');
  useEffect(() => {
    const t = searchParams?.get('type');
    setEntryFilter(t && t.length > 0 ? t : 'all');
    const f = searchParams?.get('filter');
    if (f && (ALL_TYPES as readonly string[]).includes(f)) {
      setFilter(f as FilterType);
    }
  }, [searchParams]);
  const utils = trpc.useUtils();

  const { data: docs = [], isLoading: docsLoading } = trpc.campaigns.getWorldDocuments.useQuery(
    { campaignId }, { staleTime: 60_000 },
  );
  const { data: homebrew = [], isLoading: hbLoading } = trpc.campaigns.getWorldHomebrew.useQuery(
    { campaignId }, { staleTime: 60_000 },
  );
  const { data: entries = [], isLoading: entriesLoading } = trpc.world.getEntries.useQuery(
    { campaignId }, { staleTime: 60_000 },
  );
  const { data: sourcebookEntities = [], isLoading: sbLoading } = trpc.world.getSourcebookEntities.useQuery(
    { campaignId }, { staleTime: 300_000 },
  );
  const { data: chapters = [], isLoading: chaptersLoading } = trpc.world.getCampaignChapters.useQuery(
    { campaignId },
    { staleTime: 300_000, enabled: viewMode === 'by-chapter' },
  );

  const isLoading = docsLoading || hbLoading || entriesLoading || sbLoading;
  const isChapterLoading = isLoading || chaptersLoading;

  // Merge into unified list with source tag
  type EntryItem = {
    id: string;
    name: string;
    slug: string;
    type: string;
    summary?: string | null;
    worldEntity?: { ddbChapterId?: string | null } | null;
    sourcebookHref?: string; // present only for SourcebookEntity-sourced items
  };
  type AnyItem =
    | { id: string; title: string; type: string; _kind: 'doc'; _raw: Doc }
    | { id: string; title: string; type: string; _kind: 'hb'; _raw: HbItem }
    | { id: string; title: string; type: string; _kind: 'entry'; _raw: EntryItem };

  // Merge sourcebook entities into the entries list, de-duping by name+type
  // against existing WorldEntry records so hand-crafted entries win.
  const worldEntryKeys = new Set(entries.map((e) => `${e.type}:${e.name.toLowerCase()}`));
  const mergedEntries: EntryItem[] = [
    ...entries,
    ...sourcebookEntities
      .filter((se) => !worldEntryKeys.has(`${se.type}:${se.name.toLowerCase()}`))
      .map((se) => ({
        id: se.id,
        name: se.name,
        slug: '',
        type: se.type as string,
        summary: se.description ?? null,
        worldEntity: null,
        sourcebookHref: se.chapter?.slug
          ? `/campaigns/${slug}/sourcebook?chapter=${se.chapter.slug}`
          : `/campaigns/${slug}/sourcebook`,
      })),
  ];

  const allItems: AnyItem[] = [
    ...docs.map((d) => ({ id: d.id, title: d.title, type: d.type, _kind: 'doc' as const, _raw: d })),
    ...homebrew.map((h) => ({ id: h.id, title: h.name, type: h.type, _kind: 'hb' as const, _raw: h })),
  ];
  const allItemsForChapter: AnyItem[] = [
    ...mergedEntries.map((entry) => ({
      id: entry.id,
      title: entry.name,
      type: entry.type as string,
      _kind: 'entry' as const,
      _raw: entry as EntryItem,
    })),
    ...allItems,
  ];

  const filtered = filter === 'all' ? allItems : allItems.filter((i) => i.type === filter);

  const grouped = Object.entries(
    filtered.reduce<Record<string, AnyItem[]>>((acc, item) => {
      (acc[item.type] ??= []).push(item);
      return acc;
    }, {}),
  ).sort(([a], [b]) => {
    const order = ['lore', 'faction', 'location', 'timeline', 'item', 'creature', 'race'];
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const typesPresent = [...new Set(allItems.map((i) => i.type))];
  const chapterTypesPresent = [...new Set(allItemsForChapter.map((item) => item.type))];

  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));
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
        chapterId = item._raw.ddbChapterId ?? null;
      }
      const bucket = byChapter.get(chapterId) ?? [];
      bucket.push(item);
      byChapter.set(chapterId, bucket);
    }

    for (const chapter of chapters) {
      const items = byChapter.get(chapter.id);
      if (items?.length) {
        chapterBuckets.push({
          chapterId: chapter.id,
          title: chapter.title,
          chapterIndex: chapter.chapterIndex,
          items,
        });
      }
    }

    const custom = [...(byChapter.get(null) ?? [])];
    for (const [chapterId, items] of byChapter.entries()) {
      if (chapterId !== null && !chapterMap.has(chapterId)) custom.push(...items);
    }
    if (custom.length > 0) {
      chapterBuckets.push({
        chapterId: null,
        title: 'Custom Additions',
        chapterIndex: 9999,
        items: custom,
      });
    }
  }

  function renderChapterItem(item: AnyItem) {
    if (item._kind === 'entry') {
      const entry = item._raw;
      const href = entry.sourcebookHref ?? `/campaigns/${slug}/world/${entry.slug}`;
      return (
        <WorldEntryCard
          key={entry.id}
          entry={{ id: entry.id, name: entry.name, type: entry.type as string, summary: entry.summary }}
          href={href}
        />
      );
    }

    if (item._kind === 'doc') {
      return (
        <DocRow
          key={item.id}
          doc={item._raw}
          expanded={expandedId === item.id}
          onToggle={() => setExpandedId((previous) => (previous === item.id ? null : item.id))}
        />
      );
    }

    return (
      <HbRow
        key={item.id}
        item={item._raw}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId((previous) => (previous === item.id ? null : item.id))}
      />
    );
  }

  return (
    <Canvas variant="world">
    <PageLayout
      overline="Campaign"
      title="World Lore"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="gap-1.5 border-[var(--q-border-subtle)] text-[var(--q-text-dim)] hover:text-[var(--q-text)] hover:border-[var(--q-amber-border)]"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
      }
    >
      {/* ─── World Entities section ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setViewMode('by-type')} className={filterChipClass(viewMode === 'by-type')}>
          <LayoutList className="h-3 w-3" />
          By Type
        </button>
        <button onClick={() => setViewMode('by-chapter')} className={filterChipClass(viewMode === 'by-chapter')}>
          <BookOpen className="h-3 w-3" />
          By Chapter
        </button>
      </div>

      {viewMode === 'by-type' ? (
      <>
      {(entriesLoading || sbLoading || mergedEntries.length > 0) && (
        <Section
          label="World Entities"
          action={<span className="text-[10px] text-[var(--q-text-faint)]">{mergedEntries.length}</span>}
        >
          {/* Entry type filter */}
          {mergedEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...new Set(mergedEntries.map(e => e.type as string))]).map((t) => {
                const isActive = entryFilter === t;
                const meta = t === 'all' ? { label: 'All', icon: BookOpen } : ENTRY_TYPE_META[t];
                const Icon = meta?.icon ?? BookOpen;
                const count = t === 'all' ? mergedEntries.length : mergedEntries.filter(e => e.type === t).length;
                return (
                  <button key={t} onClick={() => setEntryFilter(t)} className={filterChipClass(isActive)}>
                    <Icon className="h-3 w-3" />
                    {meta?.label ?? t}
                    <span className="text-[10px] text-[var(--q-text-faint)]">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Entry cards */}
          {(entriesLoading || sbLoading) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mergedEntries
                .filter(e => entryFilter === 'all' || e.type === entryFilter)
                .map((entry) => {
                  const href = entry.sourcebookHref ?? `/campaigns/${slug}/world/${entry.slug}`;
                  return (
                    <WorldEntryCard
                      key={entry.id}
                      entry={{ id: entry.id, name: entry.name, type: entry.type as string, summary: entry.summary }}
                      href={href}
                    />
                  );
                })}
            </div>
          )}
        </Section>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...typesPresent] as FilterType[]).map((t) => {
          const isActive = filter === t;
          const meta = t === 'all' ? { label: 'All', icon: BookOpen } : getTypeMeta(t);
          const Icon = meta.icon;
          const count = t === 'all' ? allItems.length : allItems.filter((i) => i.type === t).length;
          return (
            <button
              key={t}
              onClick={() => { setFilter(t); setExpandedId(null); }}
              className={filterChipClass(isActive)}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              <span className="text-[10px] text-[var(--q-text-faint)]">{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] animate-pulse"
            />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <Card variant="detail" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <BookOpen className="h-8 w-8 text-[var(--q-text-faint)]" />
          <div className="space-y-1">
            <p className="text-sm text-[var(--q-text-dim)]">No world documents yet.</p>
            <p className="text-xs text-[var(--q-text-faint)]">
              Import a world sourcebook when creating a campaign or add content manually.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, items]) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <TypeBadge type={type} />
                <div className="h-px flex-1 bg-[var(--q-border-subtle)]" />
                <span className="text-[10px] text-[var(--q-text-faint)]">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((item) =>
                  item._kind === 'doc' ? (
                    <DocRow
                      key={item.id}
                      doc={item._raw as Doc}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId((p) => (p === item.id ? null : item.id))}
                    />
                  ) : item._kind === 'hb' ? (
                    <HbRow
                      key={item.id}
                      item={item._raw}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId((p) => (p === item.id ? null : item.id))}
                    />
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...chapterTypesPresent]).map((type) => {
              const isActive = entryFilter === type;
              const meta = type === 'all' ? { label: 'All', icon: BookOpen } : getTypeMeta(type);
              const Icon = meta.icon;
              const count = type === 'all'
                ? allItemsForChapter.length
                : allItemsForChapter.filter((item) => item.type === type).length;
              return (
                <button key={type} onClick={() => setEntryFilter(type)} className={filterChipClass(isActive)}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                  <span className="text-[10px] text-[var(--q-text-faint)]">{count}</span>
                </button>
              );
            })}
          </div>

          {isChapterLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)]"
                />
              ))}
            </div>
          ) : allItemsForChapter.length === 0 ? (
            <Card variant="detail" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <BookOpen className="h-8 w-8 text-[var(--q-text-faint)]" />
              <div className="space-y-1">
                <p className="text-sm text-[var(--q-text-dim)]">No world documents yet.</p>
                <p className="text-xs text-[var(--q-text-faint)]">
                  Import a world sourcebook when creating a campaign or add content manually.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {chapterBuckets.map((bucket, bucketIndex) => {
                const filteredItems = bucket.items.filter((item) => entryFilter === 'all' || item.type === entryFilter);
                if (filteredItems.length === 0) return null;
                const color = bucket.chapterId === null
                  ? 'var(--q-text-faint)'
                  : getChapterColor(bucket.chapterIndex).text;
                return (
                  <ChapterSection
                    key={bucket.chapterId ?? '__custom'}
                    chapterId={bucket.chapterId ?? '__custom'}
                    title={bucket.title}
                    count={filteredItems.length}
                    accentColor={color}
                    campaignSlug={slug}
                    defaultExpanded={bucketIndex === 0}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredItems.map(renderChapterItem)}
                    </div>
                  </ChapterSection>
                );
              })}
              {chapterBuckets.length === 0 && (
                <p className="px-2 text-sm italic text-[var(--q-text-faint)]">
                  No chapter data found. This campaign may not have a linked sourcebook.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <ImportSheet
        campaignId={campaignId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          setImportOpen(false);
          void utils.campaigns.getWorldDocuments.invalidate({ campaignId });
          void utils.campaigns.getWorldHomebrew.invalidate({ campaignId });
          void utils.world.getEntries.invalidate({ campaignId });
        }}
      />
    </PageLayout>
    </Canvas>
  );
}
