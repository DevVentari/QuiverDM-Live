'use client';

import { type ElementType, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { SplitCanvas } from '@/components/layout/split-canvas';
import { NpcInspectorPanel } from '@/components/npc/npc-inspector-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Ghost,
  MapPin,
  Search,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';

type SectionId = 'npcs' | 'locations' | 'items' | 'monsters' | 'spells';

type SidebarRecord = {
  id: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  slug?: string;
  tags?: string[];
};

const SECTION_META: Record<
  SectionId,
  {
    label: string;
    singular: string;
    icon: ElementType;
    accent: string;
  }
> = {
  npcs: {
    label: 'NPCs',
    singular: 'NPC',
    icon: Users,
    accent: 'text-sky-300',
  },
  locations: {
    label: 'Locations',
    singular: 'Location',
    icon: MapPin,
    accent: 'text-emerald-300',
  },
  items: {
    label: 'Items',
    singular: 'Item',
    icon: BookOpen,
    accent: 'text-amber-300',
  },
  monsters: {
    label: 'Monsters',
    singular: 'Monster',
    icon: Swords,
    accent: 'text-rose-300',
  },
  spells: {
    label: 'Spells',
    singular: 'Spell',
    icon: Sparkles,
    accent: 'text-violet-300',
  },
};

function isSectionId(value: string | null): value is SectionId {
  return value !== null && value in SECTION_META;
}

export default function SidebarTestPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');

  const section: SectionId = isSectionId(searchParams.get('section'))
    ? searchParams.get('section')!
    : 'npcs';
  const selectedId = searchParams.get('item');

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: search || undefined },
    { enabled: section === 'npcs', staleTime: 60_000 }
  );
  const locations = trpc.world.getEntries.useQuery(
    { campaignId, type: 'LOCATION', search: search || undefined },
    { enabled: section === 'locations', staleTime: 60_000 }
  );
  const items = trpc.homebrew.getContent.useQuery(
    { campaignId, type: 'item', search: search || undefined, limit: 50 },
    { enabled: section === 'items', staleTime: 60_000 }
  );
  const monsters = trpc.homebrew.getContent.useQuery(
    { campaignId, type: 'creature', search: search || undefined, limit: 50 },
    { enabled: section === 'monsters', staleTime: 60_000 }
  );
  const spells = trpc.homebrew.getContent.useQuery(
    { campaignId, type: 'spell', search: search || undefined, limit: 50 },
    { enabled: section === 'spells', staleTime: 60_000 }
  );

  const records = useMemo<SidebarRecord[]>(() => {
    if (section === 'npcs') {
      return ((npcs.data ?? []) as any[]).map((npc) => ({
        id: npc.id,
        name: npc.name,
        subtitle: npc.faction,
        description: npc.description,
        href: `/campaigns/${slug}/npcs/${npc.id}`,
        tags: npc.tags,
      }));
    }

    if (section === 'locations') {
      return ((locations.data ?? []) as any[]).map((location) => ({
        id: location.id,
        name: location.name,
        subtitle: 'World entry',
        description: location.summary,
        href: `/campaigns/${slug}/world/${location.slug}`,
        slug: location.slug,
        tags: location.tags,
      }));
    }

    const homebrewResult =
      section === 'items'
        ? items.data
        : section === 'monsters'
          ? monsters.data
          : spells.data;

    return (((homebrewResult as any)?.items ?? []) as any[]).map((entry) => ({
      id: entry.id,
      name: entry.name,
      subtitle: entry.type,
      description: entry.description ?? entry.data?.description ?? null,
      href: `/homebrew/${entry.id}`,
      tags: entry.tags,
    }));
  }, [items.data, locations.data, monsters.data, npcs.data, section, slug, spells.data]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

  const selectedLocation = trpc.world.getEntryBySlug.useQuery(
    { campaignId, slug: selectedRecord?.slug ?? '' },
    { enabled: section === 'locations' && !!selectedRecord?.slug, staleTime: 60_000 }
  );
  const selectedHomebrew = trpc.homebrew.getContentById.useQuery(
    { id: selectedRecord?.id ?? '' },
    { enabled: ['items', 'monsters', 'spells'].includes(section) && !!selectedRecord?.id, staleTime: 60_000 }
  );

  const activeQuery =
    section === 'npcs'
      ? npcs
      : section === 'locations'
        ? locations
        : section === 'items'
          ? items
          : section === 'monsters'
            ? monsters
            : spells;

  useEffect(() => {
    setSearch('');
  }, [section]);

  useEffect(() => {
    if (!records.length) return;
    if (selectedId && records.some((record) => record.id === selectedId)) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('item', records[0]!.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, records, router, searchParams, selectedId]);

  function updateParams(next: { section?: SectionId; item?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.section) {
      params.set('section', next.section);
      params.delete('item');
    }

    if (next.item === null) {
      params.delete('item');
    } else if (next.item) {
      params.set('item', next.item);
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const meta = SECTION_META[section];
  const count = records.length;
  const actions = isDM && section === 'npcs' ? (
    <Button asChild size="sm" variant="outline">
      <Link href={`/campaigns/${slug}/npcs?create=true`}>New NPC</Link>
    </Button>
  ) : undefined;

  const leftPane = (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[hsl(35_35%_18%)] px-3 py-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
          Sidebar Prototype
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(SECTION_META) as Array<[SectionId, typeof meta]>).map(([key, value]) => {
            const Icon = value.icon;
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => updateParams({ section: key })}
                className={cn(
                  'flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-amber-500/40 bg-amber-500/10 text-foreground'
                    : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', value.accent)} />
                <span className="truncate text-xs font-medium">{value.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-[hsl(35_35%_18%)] px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()}...`}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-[hsl(35_35%_18%)] px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">{meta.label}</p>
          <p className="text-[11px] text-muted-foreground">{count} in this campaign</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Live data
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeQuery.isLoading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-16 rounded-md" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <Ghost className="mb-3 h-8 w-8 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">No {meta.label.toLowerCase()} found.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              This section is already scoped to the current campaign.
            </p>
          </div>
        ) : (
          records.map((record) => (
            <button
              key={record.id}
              onClick={() => updateParams({ item: record.id })}
              className={cn(
                'w-full border-l-2 px-3 py-3 text-left transition-colors',
                selectedId === record.id
                  ? 'border-primary bg-amber-500/10'
                  : 'border-transparent hover:bg-white/[0.04] hover:border-white/10'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{record.name}</p>
                  {record.subtitle ? (
                    <p className="truncate text-[11px] text-muted-foreground">{record.subtitle}</p>
                  ) : null}
                </div>
              </div>
              {record.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{record.description}</p>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full">
      <div className="hidden h-full md:flex">
        <SplitCanvas
          overline="Prototype"
          title="Campaign Sidebar Test"
          stats={[{ label: 'Section', value: meta.label }, { label: 'Records', value: String(count) }]}
          actions={actions}
          leftPane={leftPane}
        >
          {section === 'npcs' && selectedRecord ? (
            <NpcInspectorPanel npcId={selectedRecord.id} slug={slug} isDM={isDM} />
          ) : (
            <DetailPanel
              section={section}
              record={selectedRecord}
              locationData={selectedLocation.data as any}
              locationLoading={selectedLocation.isLoading}
              homebrewData={selectedHomebrew.data as any}
              homebrewLoading={selectedHomebrew.isLoading}
            />
          )}
        </SplitCanvas>
      </div>

      <div className="space-y-4 px-4 py-4 md:hidden">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
            Sidebar Prototype
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(SECTION_META) as Array<[SectionId, typeof meta]>).map(([key, value]) => {
              const Icon = value.icon;
              return (
                <button
                  key={key}
                  onClick={() => updateParams({ section: key })}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                    section === key
                      ? 'border-amber-500/40 bg-amber-500/10 text-foreground'
                      : 'border-white/10 bg-white/[0.03] text-muted-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', value.accent)} />
                  <span className="truncate text-xs font-medium">{value.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {leftPane}

        {section === 'npcs' && selectedRecord ? (
          <div className="rounded-lg border border-white/10 bg-black/20">
            <NpcInspectorPanel npcId={selectedRecord.id} slug={slug} isDM={isDM} />
          </div>
        ) : (
          <DetailPanel
            section={section}
            record={selectedRecord}
            locationData={selectedLocation.data as any}
            locationLoading={selectedLocation.isLoading}
            homebrewData={selectedHomebrew.data as any}
            homebrewLoading={selectedHomebrew.isLoading}
          />
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  section,
  record,
  locationData,
  locationLoading,
  homebrewData,
  homebrewLoading,
}: {
  section: SectionId;
  record: SidebarRecord | null;
  locationData: any;
  locationLoading: boolean;
  homebrewData: any;
  homebrewLoading: boolean;
}) {
  const meta = SECTION_META[section];

  if (!record) {
    const Icon = meta.icon;
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 rounded-full bg-white/[0.04] p-4">
          <Icon className={cn('h-6 w-6', meta.accent)} />
        </div>
        <p className="text-sm font-medium text-foreground">Select a {meta.singular.toLowerCase()}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This is the prototype for the sidebar opening a campaign-scoped list.
        </p>
      </div>
    );
  }

  const detailLoading = section === 'locations' ? locationLoading : ['items', 'monsters', 'spells'].includes(section) ? homebrewLoading : false;
  const detailData = section === 'locations' ? locationData : homebrewData;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-[hsl(35_35%_18%)] px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">{meta.label}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl text-foreground">{record.name}</h2>
            {record.subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{record.subtitle}</p>
            ) : null}
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={record.href}>Open full page</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {detailLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {record.description ? (
              <section className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Summary</p>
                <p className="text-sm leading-6 text-muted-foreground">{record.description}</p>
              </section>
            ) : null}

            {section === 'locations' && detailData?.content ? (
              <section className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">World Content</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {String(detailData.content).slice(0, 1200)}
                </p>
              </section>
            ) : null}

            {['items', 'monsters', 'spells'].includes(section) && detailData?.data ? (
              <section className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Structured Fields</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(detailData.data as Record<string, unknown>)
                    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <div key={key} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">{key}</p>
                        <p className="mt-1 text-sm text-foreground">{String(value)}</p>
                      </div>
                    ))}
                </div>
              </section>
            ) : null}

            {record.tags?.length ? (
              <section className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {record.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
