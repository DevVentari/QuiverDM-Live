'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, Flag, MapPin, Clock, ScrollText, Sparkles,
  ChevronDown, ChevronRight, Sword, Package, Dna, Upload,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { ImportSheet } from '@/components/world/import-sheet';
import { Canvas, Card, Section, Surface } from '@/components/primitives';
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
  return DOC_TYPE_META[type] ?? HB_TYPE_META[type] ?? { label: type, icon: BookOpen };
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

type HbItem = { id: string; name: string; type: string; data: unknown; tags: string[] };

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

  const isLoading = docsLoading || hbLoading || entriesLoading;

  // Merge into unified list with source tag
  type AnyItem = { id: string; title: string; type: string; _kind: 'doc' | 'hb'; _raw: Doc | HbItem };

  const allItems: AnyItem[] = [
    ...docs.map((d) => ({ id: d.id, title: d.title, type: d.type, _kind: 'doc' as const, _raw: d })),
    ...homebrew.map((h) => ({ id: h.id, title: h.name, type: h.type, _kind: 'hb' as const, _raw: h })),
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
      {(entriesLoading || entries.length > 0) && (
        <Section
          label="World Entities"
          action={<span className="text-[10px] text-[var(--q-text-faint)]">{entries.length}</span>}
        >
          {/* Entry type filter */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...new Set(entries.map(e => e.type as string))]).map((t) => {
                const isActive = entryFilter === t;
                const meta = t === 'all' ? { label: 'All', icon: BookOpen } : ENTRY_TYPE_META[t];
                const Icon = meta?.icon ?? BookOpen;
                const count = t === 'all' ? entries.length : entries.filter(e => e.type === t).length;
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
          {entriesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {entries
                .filter(e => entryFilter === 'all' || e.type === entryFilter)
                .map((entry) => {
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
                  ) : (
                    <HbRow
                      key={item.id}
                      item={item._raw as HbItem}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId((p) => (p === item.id ? null : item.id))}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
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
