'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Pin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { usePinnedItems, type PinnedEntityType } from '@/store/pinned-items-store';
import { CompendiumItemSheet } from '@/components/compendium/CompendiumItemSheet';
import type { LucideIcon } from 'lucide-react';

interface CompendiumSectionProps {
  label: string;
  entityType: PinnedEntityType;
  icon: LucideIcon;
  campaignId: string;
  slug: string;
  listHref: string;
  createHref?: string;
  collapsed: boolean;
}

const HOMEBREW_TYPES: PinnedEntityType[] = ['item', 'location', 'spell', 'monster'];

export function CompendiumSection({
  label,
  entityType,
  icon: Icon,
  campaignId,
  slug: _slug,
  listHref,
  createHref,
  collapsed,
}: CompendiumSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');
  const [sheetItem, setSheetItem] = useState<{ id: string; name: string } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { isPinned } = usePinnedItems();

  const isActive = pathname.startsWith(listHref);

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: filter || undefined },
    { enabled: !!campaignId && expanded && entityType === 'npc', staleTime: 60_000 }
  );

  const encounters = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { enabled: !!campaignId && expanded && entityType === 'encounter', staleTime: 60_000 }
  );

  const homebrew = trpc.homebrew.getContent.useQuery(
    { campaignId, type: entityType as 'item' | 'location' | 'spell' | 'monster', limit: 50 },
    { enabled: !!campaignId && expanded && HOMEBREW_TYPES.includes(entityType), staleTime: 60_000 }
  );

  type Item = { id: string; name: string };

  function getItems(): Item[] {
    if (entityType === 'npc') {
      const all = (npcs.data ?? []) as Item[];
      return all;
    }
    if (entityType === 'encounter') {
      const all = (encounters.data ?? []) as Item[];
      return filter
        ? all.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
        : all;
    }
    const result = homebrew.data as { items?: Item[] } | Item[] | undefined;
    const items: Item[] = Array.isArray(result)
      ? result
      : (result?.items ?? []);
    return filter
      ? items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()))
      : items;
  }

  const allItems = getItems();
  const shown = allItems.slice(0, 8);
  const extra = allItems.length - shown.length;

  if (collapsed) {
    return (
      <Link
        href={listHref}
        title={label}
        className={cn(
          'flex justify-center py-[7px] transition-colors',
          isActive ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      </Link>
    );
  }

  return (
    <>
      {/* Section header */}
      <div className={cn('flex items-center', isActive && !expanded && 'bg-amber-500/[0.07]')}>
        <Link
          href={listHref}
          className={cn(
            'relative flex flex-1 items-center gap-2.5 px-5 py-[7px] text-sm font-sans font-medium transition-colors',
            isActive
              ? 'text-amber-400/90'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
          )}
        >
          {isActive && !expanded && (
            <span
              className="absolute left-0 top-0 bottom-0 w-0.5"
              style={{
                background: 'hsl(35 80% 55%)',
                boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)',
              }}
            />
          )}
          <Icon
            className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')}
            strokeWidth={1.8}
          />
          <span>{label}</span>
        </Link>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-[7px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-150',
              expanded && 'rotate-90'
            )}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Inline list */}
      {expanded && (
        <div className="bg-black/20 border-y border-white/[0.04]">
          {/* Filter input */}
          <div className="px-3 py-1.5">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20"
            />
          </div>

          {/* Items */}
          {shown.map((item) => {
            const active = pathname.includes(`/${item.id}`);
            const pinned = isPinned(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  'group flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-white/[0.04] transition-colors',
                  active && 'border-l-2 border-amber-500/70 bg-amber-500/[0.06] pl-[14px]'
                )}
                onClick={() => router.push(`${listHref}/${item.id}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <EntityBadge entityType={entityType} name={item.name} />
                  <span
                    className={cn(
                      'text-[11px] truncate',
                      active ? 'text-white' : 'text-muted-foreground'
                    )}
                  >
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pinned && <Pin className="h-3 w-3 text-amber-400/60" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetItem(item);
                    }}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Quick view"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <Link
              href={createHref ?? `${listHref}/new`}
              className="text-[10px] text-amber-500/70 hover:text-amber-400 transition-colors"
            >
              + New {label.slice(0, -1)}
            </Link>
            {extra > 0 && (
              <Link
                href={listHref}
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                +{extra} more →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick-view sheet */}
      {sheetItem && (
        <CompendiumItemSheet
          entityType={entityType}
          entityId={sheetItem.id}
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
        />
      )}
    </>
  );
}

function EntityBadge({ entityType, name }: { entityType: PinnedEntityType; name: string }) {
  if (entityType === 'npc') {
    return (
      <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[8px] font-bold text-amber-400 shrink-0">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  const icons: Record<PinnedEntityType, string> = {
    npc: '',
    item: '⚔',
    location: '\u{1F5FA}',
    spell: '✦',
    monster: '\u{1F480}',
    encounter: '⚡',
  };
  return (
    <span className="text-[10px] shrink-0 leading-none">{icons[entityType]}</span>
  );
}
