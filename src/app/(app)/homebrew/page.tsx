'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { CreateHomebrewDialog } from '@/components/homebrew/create-homebrew-dialog';
import { ImportFromDDBDialog } from '@/components/homebrew/import-from-ddb-dialog';
import { ImportFromMediaDialog } from '@/components/homebrew/import-from-media-dialog';
import { PageLayout } from '@/components/layout/page-layout';
import { BookOpen, Search, FileText, Plus, Globe, ImageUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_FILTERS = [
  { value: undefined as string | undefined, label: 'All'       },
  { value: 'item',     label: 'Items'     },
  { value: 'spell',    label: 'Spells'    },
  { value: 'creature', label: 'Creatures' },
  { value: 'class',    label: 'Classes'   },
  { value: 'feat',     label: 'Feats'     },
] as const;

export default function HomebrewPage() {
  const [search,          setSearch         ] = useState('');
  const [debouncedSearch, setDebouncedSearch ] = useState('');
  const [typeFilter,      setTypeFilter      ] = useState<string | undefined>(undefined);
  const [createOpen,      setCreateOpen      ] = useState(false);
  const [ddbImportOpen,   setDdbImportOpen   ] = useState(false);
  const [mediaImportOpen, setMediaImportOpen ] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const content = trpc.homebrew.getContent.useQuery(
    { search: debouncedSearch || undefined, type: typeFilter as any },
    { staleTime: 300_000 }
  );
  const stats = trpc.homebrew.getContentStats.useQuery({}, { staleTime: 300_000 });
  const totalItems = stats.data
    ? Object.values((stats.data as any).byType || {}).reduce((a: number, b) => a + (b as number), 0)
    : 0;

  const byType: Record<string, number> = (stats.data as any)?.byType ?? {};

  return (
    <PageLayout
      overline="Library"
      title="Homebrew"
      subtitle="Your spells, creatures, items, and imported fragments live here."
      stats={[
        { label: 'Total', value: totalItems },
      ]}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/homebrew/pdfs"><FileText className="mr-2 h-4 w-4" />PDFs</Link>
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* ── Left sidebar ── */}
        <aside className="hidden md:flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {/* Type filters */}
          <div className="rounded-[1rem] border border-border/60 bg-card/40 p-3 backdrop-blur">
            <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">Type</p>
            <div className="space-y-0.5">
              {TYPE_FILTERS.map((f) => {
                const count = f.value ? (byType[f.value] ?? 0) : totalItems;
                const active = typeFilter === f.value;
                return (
                  <button
                    key={f.label}
                    onClick={() => setTypeFilter(f.value)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-amber-500/[0.08] text-amber-100 ring-1 ring-amber-500/20'
                        : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                    )}
                  >
                    <span>{f.label}</span>
                    <span className={cn('text-xs tabular-nums', active ? 'text-amber-300/70' : 'text-muted-foreground/40')}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add actions */}
          <div className="rounded-[1rem] border border-border/60 bg-card/40 p-3 backdrop-blur">
            <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">Add Content</p>
            <div className="space-y-1">
              <button onClick={() => setCreateOpen(true)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5 shrink-0" />Create manually
              </button>
              <button onClick={() => setDdbImportOpen(true)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-colors">
                <Globe className="h-3.5 w-3.5 shrink-0" />Import from D&amp;D Beyond
              </button>
              <button onClick={() => setMediaImportOpen(true)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-colors">
                <ImageUp className="h-3.5 w-3.5 shrink-0" />Import from photo
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right: search + grid ── */}
        <div className="space-y-4">
          {/* Mobile: type filter pills */}
          <div className="flex md:hidden flex-wrap gap-2">
            {TYPE_FILTERS.map((f) => (
              <Button key={f.label} size="sm"
                variant={typeFilter === f.value ? 'default' : 'outline'}
                onClick={() => setTypeFilter(f.value)}>
                {f.label}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search homebrew..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Grid */}
          {content.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : content.isError ? (
            <div className="stone-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load homebrew content.</p>
            </div>
          ) : (content.data as any)?.items?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {((content.data as any).items || []).map((item: any) => (
                <HomebrewContentCard key={item.id} item={item} href={`/homebrew/${item.id}`} />
              ))}
            </div>
          ) : (
            <div className="stone-card">
              <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">No homebrew yet</h3>
                <p className="mb-6 max-w-sm text-sm text-muted-foreground">Upload a PDF to extract content, or create entries manually.</p>
                <Button asChild size="sm"><Link href="/homebrew/pdfs">Upload PDF</Link></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateHomebrewDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => content.refetch()} />
      <ImportFromDDBDialog  open={ddbImportOpen} onOpenChange={setDdbImportOpen} onImported={() => { content.refetch(); stats.refetch(); }} />
      <ImportFromMediaDialog open={mediaImportOpen} onOpenChange={setMediaImportOpen} onSuccess={() => { content.refetch(); stats.refetch(); }} />
    </PageLayout>
  );
}
