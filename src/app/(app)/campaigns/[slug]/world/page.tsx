'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, Flag, MapPin, Clock, ScrollText,
  ChevronDown, ChevronRight, Sword, Package, Dna, Upload,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { ImportSheet } from '@/components/world/import-sheet';
import { cn } from '@/lib/utils';

// ─── Type metadata ────────────────────────────────────────────────────────────

const DOC_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  lore:     { label: 'Lore',      icon: ScrollText, color: 'text-amber-400/80'   },
  faction:  { label: 'Factions',  icon: Flag,       color: 'text-blue-400/80'    },
  location: { label: 'Locations', icon: MapPin,      color: 'text-emerald-400/80' },
  timeline: { label: 'Timelines', icon: Clock,       color: 'text-violet-400/80'  },
};

const HB_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  item:     { label: 'Items',     icon: Package, color: 'text-yellow-400/80'  },
  creature: { label: 'Monsters',  icon: Sword,   color: 'text-red-400/80'     },
  race:     { label: 'Races',     icon: Dna,     color: 'text-pink-400/80'    },
};

const ENTRY_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  LOCATION:  { label: 'Locations',         icon: MapPin,     color: 'text-emerald-400/80' },
  NPC:       { label: 'NPCs',              icon: BookOpen,   color: 'text-blue-400/80'    },
  PC:        { label: 'Player Characters', icon: BookOpen,   color: 'text-violet-400/80'  },
  MONSTER:   { label: 'Monsters',          icon: Sword,      color: 'text-red-400/80'     },
  ITEM:      { label: 'Items',             icon: Package,    color: 'text-yellow-400/80'  },
  FACTION:   { label: 'Factions',          icon: Flag,       color: 'text-purple-400/80'  },
  RACE:      { label: 'Races',             icon: Dna,        color: 'text-pink-400/80'    },
  LORE:      { label: 'Lore',              icon: ScrollText, color: 'text-amber-400/80'   },
  TIMELINE:  { label: 'Timelines',         icon: Clock,      color: 'text-violet-400/80'  },
  SPELL:     { label: 'Spells',            icon: Sword,      color: 'text-cyan-400/80'    },
};

function getTypeMeta(type: string) {
  return DOC_TYPE_META[type] ?? HB_TYPE_META[type] ?? { label: type, icon: BookOpen, color: 'text-muted-foreground' };
}

function TypeBadge({ type }: { type: string }) {
  const { icon: Icon, label, color } = getTypeMeta(type);
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold', color)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const ALL_TYPES = ['all', 'lore', 'faction', 'location', 'timeline', 'item', 'creature', 'race'] as const;
type FilterType = (typeof ALL_TYPES)[number];

// ─── Document row (markdown content) ─────────────────────────────────────────

type Doc = { id: string; title: string; type: string; content: string; tags: string[] };

function DocRow({ doc, expanded, onToggle }: { doc: Doc; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      'rounded-md border transition-colors',
      expanded ? 'border-amber-500/30 bg-card/60' : 'border-border/40 bg-card/20 hover:border-border/60 hover:bg-card/30',
    )}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground/90 leading-snug">{doc.title}</span>
          <span className="block mt-0.5"><TypeBadge type={doc.type} /></span>
        </span>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3">
          {doc.content ? (
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:font-display prose-headings:text-amber-200/90
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-strong:text-foreground/80 prose-li:text-muted-foreground
              prose-hr:border-border/30
              prose-blockquote:border-amber-500/40 prose-blockquote:text-muted-foreground"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/40 italic">No content yet.</p>
          )}
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/20">
              {doc.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-muted-foreground/50">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
    <div className={cn(
      'rounded-md border transition-colors',
      expanded ? 'border-amber-500/30 bg-card/60' : 'border-border/40 bg-card/20 hover:border-border/60 hover:bg-card/30',
    )}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground/90 leading-snug">{item.name}</span>
          {summary && <span className="block text-xs text-muted-foreground/60 mt-0.5 truncate">{summary}</span>}
        </span>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-2">
          {Boolean((item.data as Record<string, unknown>)?.description) && (
            <p className="text-sm text-muted-foreground leading-relaxed">
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
                    <span className="font-semibold text-foreground/70">{t.name}</span>
                    {t.description && <span className="text-muted-foreground/60"> — {String(t.description).slice(0, 120)}</span>}
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
                    <span className="font-semibold text-foreground/70">{t.name}</span>
                    {t.description && <span className="text-muted-foreground/60"> — {String(t.description).slice(0, 120)}</span>}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/20">
              {item.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-muted-foreground/50">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorldPage() {
  const { campaignId, slug } = useCampaign();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [entryFilter, setEntryFilter] = useState<string>('all');
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
    return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
  });

  const typesPresent = [...new Set(allItems.map((i) => i.type))];

  return (
    <PageLayout
      overline="Campaign"
      title="World Lore"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="gap-1.5 border-border/40 text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
      }
    >
      {/* ─── World Entities section ─────────────────────────────────────── */}
      {(entriesLoading || entries.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-amber-400/70">World Entities</p>
            <div className="h-px flex-1 bg-border/20" />
            <span className="text-[10px] text-muted-foreground/40">{entries.length}</span>
          </div>

          {/* Entry type filter */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...new Set(entries.map(e => e.type as string))]).map((t) => {
                const isActive = entryFilter === t;
                const meta = t === 'all' ? { label: 'All', icon: BookOpen, color: '' } : ENTRY_TYPE_META[t];
                const Icon = meta?.icon ?? BookOpen;
                const count = t === 'all' ? entries.length : entries.filter(e => e.type === t).length;
                return (
                  <button
                    key={t}
                    onClick={() => setEntryFilter(t)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      isActive
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                        : 'border-border/40 bg-card/20 text-muted-foreground hover:border-border/60',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {meta?.label ?? t}
                    <span className="text-[10px] text-muted-foreground/50">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Entry cards */}
          {entriesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-20 rounded-md bg-white/5 animate-pulse" />
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
                    <button
                      key={entry.id}
                      onClick={() => router.push(`/campaigns/${slug}/world/${entry.slug}`)}
                      className="text-left rounded-md border border-border/40 bg-card/20 hover:border-amber-500/30 hover:bg-card/40 transition-colors p-3 space-y-1"
                    >
                      <div className={cn('inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold', meta?.color)}>
                        <Icon className="h-2.5 w-2.5" />
                        {meta?.label ?? entry.type}
                      </div>
                      <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-1">{entry.name}</p>
                      {entry.summary && (
                        <p className="text-xs text-muted-foreground/60 line-clamp-2">{entry.summary}</p>
                      )}
                    </button>
                  );
                })}
            </div>
          )}

          <div className="border-t border-border/20" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...typesPresent] as FilterType[]).map((t) => {
          const isActive = filter === t;
          const meta = t === 'all' ? { label: 'All', icon: BookOpen, color: '' } : getTypeMeta(t);
          const Icon = meta.icon;
          const count = t === 'all' ? allItems.length : allItems.filter((i) => i.type === t).length;
          return (
            <button
              key={t}
              onClick={() => { setFilter(t); setExpandedId(null); }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                isActive
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : 'border-border/40 bg-card/20 text-muted-foreground hover:border-border/60',
              )}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              <span className="text-[10px] text-muted-foreground/50">{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-md bg-white/5 animate-pulse" />)}
        </div>
      ) : allItems.length === 0 ? (
        <div className="rounded-md border border-border/30 bg-card/20 px-6 py-12 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground/60">No world documents yet.</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Import a world sourcebook when creating a campaign or add content manually.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, items]) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <TypeBadge type={type} />
                <div className="h-px flex-1 bg-border/20" />
                <span className="text-[10px] text-muted-foreground/40">{items.length}</span>
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
        }}
      />
    </PageLayout>
  );
}
