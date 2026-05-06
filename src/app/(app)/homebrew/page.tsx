'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { CreateHomebrewDialog } from '@/components/homebrew/create-homebrew-dialog';
import { ImportFromDDBDialog } from '@/components/homebrew/import-from-ddb-dialog';
import { ImportFromMediaDialog } from '@/components/homebrew/import-from-media-dialog';
import { PageLayout } from '@/components/layout/page-layout';
import { BookOpen, Search, FileText, Plus, Globe, ImageUp, ChevronDown } from 'lucide-react';

const TYPE_FILTERS = [
  { value: undefined as string | undefined, label: 'All' },
  { value: 'item', label: 'Items' },
  { value: 'spell', label: 'Spells' },
  { value: 'creature', label: 'Creatures' },
  { value: 'class', label: 'Classes' },
  { value: 'feat', label: 'Feats' },
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

  return (
    <PageLayout
      overline="Library"
      title="Homebrew"
      subtitle="Your spells, creatures, items, and imported fragments live here. Search fast, filter by type, and add new lore without leaving the archive."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/homebrew/pdfs">
              <FileText className="mr-2 h-4 w-4" />
              PDFs
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add
                <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create manually
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDdbImportOpen(true)}>
                <Globe className="mr-2 h-4 w-4" />
                Import from D&amp;D Beyond
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMediaImportOpen(true)}>
                <ImageUp className="mr-2 h-4 w-4" />
                Import from photo / notes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <div className="stone-card glass-panel">
        <div className="stone-card-body space-y-4">
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((filter) => (
              <Button
                key={filter.label}
                size="sm"
                variant={typeFilter === filter.value ? 'default' : 'outline'}
                onClick={() => setTypeFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
            {stats.data && (
              <span className="ml-auto self-center text-xs text-muted-foreground">
                {totalItems} items
              </span>
            )}
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
        </div>
      </div>

      {content.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : content.isError ? (
        <div className="stone-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load homebrew content.</p>
        </div>
      ) : content.data && (content.data as any).items?.length > 0 ? (
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
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Upload a PDF to extract content, or create entries manually.
            </p>
            <Button asChild size="sm">
              <Link href="/homebrew/pdfs">Upload PDF</Link>
            </Button>
          </div>
        </div>
      )}

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
