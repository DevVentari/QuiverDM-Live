'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { CreateHomebrewDialog } from '@/components/homebrew/create-homebrew-dialog';
import { ImportFromDDBDialog } from '@/components/homebrew/import-from-ddb-dialog';
import { ImportFromMediaDialog } from '@/components/homebrew/import-from-media-dialog';
import { BookOpen, FileText, Globe, ImageUp, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_FILTERS = [
  { value: undefined as string | undefined, label: 'All' },
  { value: 'item',     label: 'Items' },
  { value: 'spell',    label: 'Spells' },
  { value: 'creature', label: 'Creatures' },
  { value: 'class',    label: 'Classes' },
  { value: 'feat',     label: 'Feats' },
] as const;

const CREATE_TYPES = ['item', 'creature', 'spell', 'location'] as const;
type CreateType = (typeof CREATE_TYPES)[number];
const isCreateType = (s: string | null | undefined): s is CreateType =>
  !!s && (CREATE_TYPES as readonly string[]).includes(s);

const VALID_TYPES = ['item', 'spell', 'creature', 'class', 'feat'] as const;

export default function HomebrewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const initialType = searchParams?.get('type');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(
    initialType && (VALID_TYPES as readonly string[]).includes(initialType) ? initialType : undefined,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<CreateType | undefined>(undefined);
  const [ddbImportOpen, setDdbImportOpen] = useState(false);
  const [mediaImportOpen, setMediaImportOpen] = useState(false);
  const [scope, setScope] = useState<'campaign' | 'library'>('campaign');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const { data: activeCampaign } = trpc.campaigns.getActive.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const activeCampaignId = activeCampaign?.id ?? null;
  const activeCampaignName = activeCampaign?.name ?? null;
  const isDM = activeCampaign?.role === 'OWNER' || activeCampaign?.role === 'CO_DM';

  const sourcebooksQuery = trpc.ddbSync.listSourcebooksForCampaign.useQuery(
    activeCampaignId ? { campaignId: activeCampaignId } : (undefined as any),
    { enabled: !!activeCampaignId, staleTime: 5 * 60_000 },
  );
  const sourcebooks = (sourcebooksQuery.data ?? []) as Array<{ id: string; slug: string; title: string; linked: boolean }>;
  const linkedSourcebooks = sourcebooks.filter((s) => s.linked);
  const unlinkedSourcebooks = sourcebooks.filter((s) => !s.linked);

  const utils = trpc.useUtils();
  const linkSourcebook = trpc.ddbSync.linkSourcebookToCampaign.useMutation({
    onSuccess: () => {
      void sourcebooksQuery.refetch();
      void utils.homebrew.getContent.invalidate();
      void utils.homebrew.getContentStats.invalidate();
    },
  });

  // Force library scope when there's no active campaign — nothing to scope to.
  useEffect(() => {
    if (!activeCampaignId && scope === 'campaign') setScope('library');
  }, [activeCampaignId, scope]);

  useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      const t = searchParams.get('type');
      setCreateInitialType(isCreateType(t) ? t : undefined);
      setCreateOpen(true);
      router.replace('/homebrew', { scroll: false });
      return;
    }
    const t = searchParams?.get('type');
    if (t && (VALID_TYPES as readonly string[]).includes(t)) {
      setTypeFilter(t);
    } else if (!t) {
      setTypeFilter(undefined);
    }
  }, [searchParams, router]);

  useEffect(() => {
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const inCampaignScope = scope === 'campaign' && !!activeCampaignId;
  const content = trpc.homebrew.getContent.useQuery(
    {
      search: debouncedSearch || undefined,
      type: typeFilter as any,
      campaignId: inCampaignScope ? activeCampaignId! : undefined,
    },
    { staleTime: 300_000 },
  );
  const stats = trpc.homebrew.getContentStats.useQuery(
    inCampaignScope ? { campaignId: activeCampaignId! } : {},
    { staleTime: 300_000 },
  );

  const totalItems = stats.data
    ? Object.values((stats.data as any).byType || {}).reduce((a: number, b) => a + (b as number), 0)
    : 0;

  const items = ((content.data as any)?.items ?? []) as any[];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
            Library
          </p>
          <h1 className="font-[var(--q-font-display)] text-3xl md:text-4xl text-[var(--q-text)] mt-1">
            Compendium
          </h1>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] tabular-nums">
              {items.length}
            </div>
            <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
              {inCampaignScope
                ? items.length === totalItems
                  ? 'in campaign'
                  : `of ${totalItems} in campaign`
                : items.length === totalItems
                  ? 'in library'
                  : `of ${totalItems}`}
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/homebrew/pdfs">
              <FileText className="mr-2 h-4 w-4" />
              PDFs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 w-full">
          {activeCampaignId && (
            <div
              role="tablist"
              aria-label="Compendium scope"
              className="grid grid-cols-2 gap-0 rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'campaign'}
                onClick={() => setScope('campaign')}
                title={activeCampaignName ? `Items in ${activeCampaignName}` : 'Items in this campaign'}
                className={cn(
                  'rounded-sm px-2 py-1.5 text-[11px] uppercase tracking-[1.5px] transition-colors truncate',
                  scope === 'campaign'
                    ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                    : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)]',
                )}
                data-testid="hb-scope-campaign"
              >
                In Campaign
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'library'}
                onClick={() => setScope('library')}
                className={cn(
                  'rounded-sm px-2 py-1.5 text-[11px] uppercase tracking-[1.5px] transition-colors',
                  scope === 'library'
                    ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                    : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)]',
                )}
                data-testid="hb-scope-library"
              >
                Full Library
              </button>
            </div>
          )}

          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--q-text-faint)]"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search compendium"
              className="h-9 pl-9 text-sm"
              data-testid="hb-filter-search"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">
              Filter by type
            </p>
            {TYPE_FILTERS.map((filter) => {
              const active = typeFilter === filter.value;
              return (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => setTypeFilter(filter.value)}
                  className={cn(
                    'flex w-full items-center rounded-sm px-3 py-2 text-sm transition-colors text-left',
                    active
                      ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                      : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
                  )}
                  data-testid={`hb-filter-${filter.value ?? 'all'}`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">
              Add content
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)] transition-colors"
            >
              <Plus size={14} className="shrink-0" />
              Create manually
            </button>
            <button
              onClick={() => setDdbImportOpen(true)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)] transition-colors"
            >
              <Globe size={14} className="shrink-0" />
              Import from D&amp;D Beyond
            </button>
            <button
              onClick={() => setMediaImportOpen(true)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)] transition-colors"
            >
              <ImageUp size={14} className="shrink-0" />
              Import from photo / notes
            </button>
          </div>

          <div className="pt-2 border-t border-[var(--q-border-subtle)]">
            <Button onClick={() => setCreateOpen(true)} size="sm" className="w-full justify-start">
              <Plus size={14} className="mr-2" />
              New Entry
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          {content.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : content.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[var(--q-text-dim)]">
              <p className="text-sm">Failed to load homebrew content.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[var(--q-text-dim)] max-w-md mx-auto">
              <BookOpen size={32} className="text-[var(--q-text-faint)]/40" />
              {inCampaignScope && linkedSourcebooks.length === 0 ? (
                <>
                  <p className="text-sm">
                    No sourcebook linked to <span className="text-[var(--q-text)]">{activeCampaignName}</span>.
                  </p>
                  <p className="text-xs text-[var(--q-text-faint)]">
                    Link a sourcebook you own to populate this campaign&apos;s compendium, or browse the full library.
                  </p>
                  {isDM && unlinkedSourcebooks.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3 w-full max-w-xs">
                      {unlinkedSourcebooks.map((s) => (
                        <Button
                          key={s.id}
                          size="sm"
                          variant="outline"
                          disabled={linkSourcebook.isPending}
                          onClick={() => linkSourcebook.mutate({ campaignId: activeCampaignId!, sourcebookId: s.id })}
                          data-testid={`hb-link-sb-${s.slug}`}
                        >
                          Link {s.title}
                        </Button>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setScope('library')} className="mt-2">
                    Browse Full Library
                  </Button>
                </>
              ) : totalItems === 0 ? (
                <>
                  <p className="text-sm">No homebrew yet</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/homebrew/pdfs">Upload PDF</Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm">No entries match those filters</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {items.map((item) => (
                <HomebrewContentCard key={item.id} item={item} href={`/homebrew/${item.id}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateHomebrewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => content.refetch()}
        initialType={createInitialType}
      />
      <ImportFromDDBDialog
        open={ddbImportOpen}
        onOpenChange={setDdbImportOpen}
        onImported={() => {
          content.refetch();
          stats.refetch();
        }}
      />
      <ImportFromMediaDialog
        open={mediaImportOpen}
        onOpenChange={setMediaImportOpen}
        onSuccess={() => {
          content.refetch();
          stats.refetch();
        }}
      />
    </div>
  );
}
