'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { BookOpen, Search, FileText, AlertCircle } from 'lucide-react';

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
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const content = trpc.homebrew.getContent.useQuery({
    search: debouncedSearch || undefined,
    type: typeFilter as any,
  }, { staleTime: 30_000 });

  const stats = trpc.homebrew.getContentStats.useQuery({}, { staleTime: 30_000 });

  return (
    <div className="space-y-6 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Homebrew Library</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/homebrew/pdfs">
              <FileText className="mr-2 h-4 w-4" />
              PDFs
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats badges */}
      {stats.data && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries((stats.data as any).byType || {}).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="capitalize">
              {type}: {count as number}
            </Badge>
          ))}
        </div>
      )}

      {/* Type filter buttons */}
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
      </div>

      {/* Search with debounce */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search homebrew content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {content.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : content.isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load homebrew content. Please refresh.</p>
        </Card>
      ) : content.data && (content.data as any).items?.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {((content.data as any).items || []).map((item: any) => (
            <HomebrewContentCard
              key={item.id}
              item={item}
              href={`/homebrew/${item.id}`}
            />
          ))}
        </div>
      ) : content.data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No homebrew content yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Upload PDFs to extract spells, monsters, and items - or browse your campaign homebrew.
            </p>
            <Button asChild size="sm">
              <Link href="/homebrew/pdfs">Upload PDF</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
