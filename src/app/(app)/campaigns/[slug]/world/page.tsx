'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Flag, MapPin, Clock, ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { PageLayout } from '@/components/layout/page-layout';
import { cn } from '@/lib/utils';

type DocType = 'lore' | 'faction' | 'location' | 'timeline' | string;

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  lore:     { label: 'Lore',      icon: ScrollText, color: 'text-amber-400/80' },
  faction:  { label: 'Factions',  icon: Flag,       color: 'text-blue-400/80'  },
  location: { label: 'Locations', icon: MapPin,      color: 'text-emerald-400/80' },
  timeline: { label: 'Timeline',  icon: Clock,       color: 'text-violet-400/80' },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: BookOpen, color: 'text-muted-foreground' };
}

function TypeBadge({ type }: { type: string }) {
  const meta = typeMeta(type);
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold', meta.color)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function DocRow({
  doc,
  expanded,
  onToggle,
}: {
  doc: { id: string; title: string; type: string; content: string; tags: string[] };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn(
      'rounded-md border transition-colors',
      expanded
        ? 'border-amber-500/30 bg-card/60'
        : 'border-border/40 bg-card/20 hover:border-border/60 hover:bg-card/30',
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground/90 leading-snug">{doc.title}</span>
          <span className="block mt-0.5">
            <TypeBadge type={doc.type} />
          </span>
        </span>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        }
      </button>

      {expanded && doc.content && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3">
          <div className="prose prose-sm max-w-none dark:prose-invert
            prose-headings:font-display prose-headings:text-amber-200/90
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-strong:text-foreground/80
            prose-li:text-muted-foreground
            prose-hr:border-border/30
            prose-blockquote:border-amber-500/40 prose-blockquote:text-muted-foreground
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
          </div>

          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/20">
              {doc.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-muted-foreground/50">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {expanded && !doc.content && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3">
          <p className="text-sm text-muted-foreground/40 italic">No content yet.</p>
        </div>
      )}
    </div>
  );
}

const FILTER_TYPES = ['all', 'lore', 'faction', 'location', 'timeline'] as const;
type FilterType = (typeof FILTER_TYPES)[number];

export default function WorldPage() {
  const { campaignId } = useCampaign();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = trpc.campaigns.getWorldDocuments.useQuery(
    { campaignId },
    { staleTime: 60_000 },
  );

  const filtered = filter === 'all' ? docs : docs.filter((d) => d.type === filter);

  const grouped = Object.entries(
    filtered.reduce<Record<string, typeof filtered>>((acc, doc) => {
      (acc[doc.type] ??= []).push(doc);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <PageLayout overline="Campaign" title="World Lore" maxWidth="md">
      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TYPES.map((t) => {
          const isActive = filter === t;
          const meta = t === 'all' ? { label: 'All', icon: BookOpen, color: '' } : typeMeta(t);
          const Icon = meta.icon;
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
              {t !== 'all' && (
                <span className="text-[10px] text-muted-foreground/50">
                  {docs.filter((d) => d.type === t).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-md bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-md border border-border/30 bg-card/20 px-6 py-12 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground/60">No world documents yet.</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Import a world sourcebook when creating or link documents from campaign settings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, typeDocs]) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <TypeBadge type={type} />
                <div className="h-px flex-1 bg-border/20" />
              </div>
              <div className="space-y-1.5">
                {typeDocs.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    expanded={expandedId === doc.id}
                    onToggle={() => toggle(doc.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
