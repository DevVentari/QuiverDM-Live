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
import { BookOpen, FileText, Globe, ImageUp, Plus, Search } from 'lucide-react';

const TYPE_FILTERS = [
  { value: undefined as string | undefined, label: 'All' },
  { value: 'item',     label: 'Items' },
  { value: 'spell',    label: 'Spells' },
  { value: 'creature', label: 'Creatures' },
  { value: 'class',    label: 'Classes' },
  { value: 'feat',     label: 'Feats' },
] as const;

export default function HomebrewPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [ddbImportOpen, setDdbImportOpen] = useState(false);
  const [mediaImportOpen, setMediaImportOpen] = useState(false);
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
  const pdfCount = (stats.data as any)?.pdfCount ?? 0;

  const heroStats = [
    { label: 'items', value: totalItems },
    ...(pdfCount > 0 ? [{ label: 'PDFs', value: pdfCount }] : []),
  ];

  return (
    <PageLayout
      overline="Library"
      title="Homebrew"
      subtitle="Your spells, creatures, items, and imported fragments live here."
      stats={heroStats}
      actions={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/homebrew/pdfs">
              <FileText className="mr-2 h-4 w-4" />
              PDFs
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex gap-6 items-start">
        {/* Left sidebar — desktop only */}
        <div className="hidden lg:flex flex-col w-[220px] shrink-0 space-y-5 lg:self-start lg:sticky lg:top-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-3">Filter by type</p>
            <div className="flex flex-col gap-0.5">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.label}
                  onClick={() => setTypeFilter(filter.value)}
                  className={`text-left rounded-md px-3 py-2 text-sm transition-colors ${
                    typeFilter === filter.value
                      ? 'bg-amber-500/[0.08] text-amber-200 border border-amber-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-3">Add content</p>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setCreateOpen(true)}
                className="text-left rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors flex items-center gap-2"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Create manually
              </button>
              <button
                onClick={() => setDdbImportOpen(true)}
                className="text-left rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors flex items-center gap-2"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                Import from D&amp;D Beyond
              </button>
              <button
                onClick={() => setMediaImportOpen(true)}
                className="text-left rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors flex items-center gap-2"
              >
                <ImageUp className="h-3.5 w-3.5 shrink-0" />
                Import from photo / notes
              </button>
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile type filters */}
          <div className="flex gap-1.5 overflow-x-auto lg:hidden pb-1 scrollbar-none">
            {TYPE_FILTERS.map((filter) => (
              <Button
                key={filter.label}
                size="sm"
                variant={typeFilter === filter.value ? 'default' : 'outline'}
                onClick={() => setTypeFilter(filter.value)}
                className="shrink-0 rounded-full h-7 px-3 text-xs"
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search homebrew..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {content.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : content.isError ? (
            <div className="stone-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load homebrew content.</p>
            </div>
          ) : content.data && (content.data as any).items?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {((content.data as any).items || []).map((item: any) => (
                <HomebrewContentCard key={item.id} item={item} href={`/homebrew/${item.id}`} />
              ))}
            </div>
          ) : (
            <div className="stone-card">
              <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">No homebrew yet</h3>
                <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                  Upload a PDF to extract content, or create entries manually.
                </p>
                <Button asChild size="sm">
                  <Link href="/homebrew/pdfs">Upload PDF</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateHomebrewDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => content.refetch()} />
      <ImportFromDDBDialog
        open={ddbImportOpen}
        onOpenChange={setDdbImportOpen}
        onImported={() => { content.refetch(); stats.refetch(); }}
      />
      <ImportFromMediaDialog
        open={mediaImportOpen}
        onOpenChange={setMediaImportOpen}
        onSuccess={() => { content.refetch(); stats.refetch(); }}
      />
    </PageLayout>
  );
}
