'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { MapPin, Users, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityItem {
  id: string;
  name: string;
  type: string;
  isPinned: boolean;
  /** 'entity' = WorldEntity drag, 'npc' = NPC model drag */
  source: 'entity' | 'npc';
}

function DraggableRow({
  item,
  onDragStart,
  onClickPinned,
}: {
  item: EntityItem;
  onDragStart: (e: React.DragEvent, item: EntityItem) => void;
  onClickPinned?: (item: EntityItem) => void;
}) {
  return (
    <div
      draggable={!item.isPinned}
      onDragStart={(e) => !item.isPinned && onDragStart(e, item)}
      onClick={() => item.isPinned && onClickPinned?.(item)}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 select-none transition-colors',
        item.isPinned
          ? 'cursor-pointer opacity-60 hover:opacity-80'
          : 'cursor-grab hover:bg-white/[0.05] active:cursor-grabbing',
      )}
    >
      <MapPin
        className="h-3 w-3 shrink-0"
        style={{ color: item.isPinned ? 'var(--wm-accent)' : 'var(--wm-muted)' }}
      />
      <span className="truncate text-[11px]" style={{ color: 'var(--wm-text)' }}>
        {item.name}
      </span>
      {item.isPinned && (
        <span
          className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
          style={{
            background: 'var(--wm-accent-trace)',
            color: 'var(--wm-accent)',
          }}
        >
          on map
        </span>
      )}
    </div>
  );
}

interface MapEntityPanelProps {
  campaignId: string;
  mapId: string | undefined;
  pinnedEntityIds: Set<string>;
  onSelectEntity: (entityId: string, name: string) => void;
  onDropEntity: (entityId: string, name: string, type: string, source: 'entity' | 'npc', x: number, y: number) => void;
}

export function MapEntityPanel({
  campaignId,
  mapId,
  pinnedEntityIds,
  onSelectEntity,
  onDropEntity: _onDropEntity,
}: MapEntityPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [locSearch, setLocSearch] = useState('');
  const [npcSearch, setNpcSearch] = useState('');

  const entitiesQuery = trpc.worldMap.listMapEntities.useQuery(
    { campaignId, mapId },
    { enabled: !!campaignId },
  );
  const npcsQuery = trpc.npcs.getAll.useQuery({ campaignId });

  const locations = useMemo(() => {
    const all = (entitiesQuery.data ?? []).filter((e) => e.type === 'LOCATION');
    if (!locSearch.trim()) return all;
    const q = locSearch.toLowerCase();
    return all.filter((e) => e.name.toLowerCase().includes(q));
  }, [entitiesQuery.data, locSearch]);

  const npcs = useMemo(() => {
    const all = npcsQuery.data ?? [];
    const q = npcSearch.trim().toLowerCase();
    const filtered = q ? all.filter((n) => n.name.toLowerCase().includes(q)) : all;
    return filtered;
  }, [npcsQuery.data, npcSearch]);

  const onDragStart = (e: React.DragEvent, item: EntityItem) => {
    e.dataTransfer.setData(
      'application/quiver-entity',
      JSON.stringify({ entityId: item.id, name: item.name, type: item.type, source: item.source }),
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute left-2 top-16 z-20">
        <button
          onClick={() => setCollapsed(false)}
          title="Show entity panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-colors hover:border-[var(--wm-accent-border)]"
          style={{
            borderColor: 'var(--wm-border)',
            background: 'color-mix(in oklab, var(--wm-surface) 85%, black)',
          }}
        >
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--wm-muted)' }} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-16 left-2 top-16 z-20 flex w-52 flex-col overflow-hidden rounded-[1.1rem] border backdrop-blur-md"
      style={{
        borderColor: 'var(--wm-border)',
        background: 'color-mix(in oklab, var(--wm-surface) 88%, black)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.30)',
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: 'var(--wm-border)' }}
      >
        <span
          className="font-display text-[9px] uppercase tracking-[0.24em]"
          style={{ color: 'var(--wm-muted)' }}
        >
          Entities
        </span>
        <button onClick={() => setCollapsed(true)}>
          <ChevronLeft className="h-3.5 w-3.5" style={{ color: 'var(--wm-muted)' }} />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-2">
        {/* Locations */}
        <div className="rounded-lg border p-2" style={{ borderColor: 'var(--wm-border)', background: 'color-mix(in oklab, var(--wm-raised) 60%, transparent)' }}>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <MapPin className="h-3 w-3 shrink-0" style={{ color: 'var(--wm-accent)' }} />
            <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--wm-muted)' }}>
              Locations
            </span>
          </div>
          <div className="relative mb-1.5">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2"
              style={{ color: 'var(--wm-muted)' }}
            />
            <input
              type="text"
              value={locSearch}
              onChange={(e) => setLocSearch(e.target.value)}
              placeholder="Filter…"
              className="w-full rounded border py-1 pl-6 pr-2 text-[10px] focus:outline-none"
              style={{
                borderColor: 'var(--wm-border)',
                background: 'color-mix(in oklab, var(--wm-surface) 80%, black)',
                color: 'var(--wm-text)',
              }}
            />
          </div>
          <div className="flex flex-col">
            {locations.map((e) => (
              <DraggableRow
                key={e.id}
                item={{ id: e.id, name: e.name, type: e.type, isPinned: e.isPinned, source: 'entity' }}
                onDragStart={onDragStart}
                onClickPinned={(item) => onSelectEntity(item.id, item.name)}
              />
            ))}
            {locations.length === 0 && (
              <p className="px-2 py-1 text-[10px]" style={{ color: 'var(--wm-muted)' }}>
                No locations in entity graph yet
              </p>
            )}
          </div>
        </div>

        {/* NPCs */}
        <div className="rounded-lg border p-2" style={{ borderColor: 'var(--wm-border)', background: 'color-mix(in oklab, var(--wm-raised) 60%, transparent)' }}>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Users className="h-3 w-3 shrink-0" style={{ color: 'var(--wm-accent)' }} />
            <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--wm-muted)' }}>
              NPCs
            </span>
          </div>
          <div className="relative mb-1.5">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2"
              style={{ color: 'var(--wm-muted)' }}
            />
            <input
              type="text"
              value={npcSearch}
              onChange={(e) => setNpcSearch(e.target.value)}
              placeholder="Filter…"
              className="w-full rounded border py-1 pl-6 pr-2 text-[10px] focus:outline-none"
              style={{
                borderColor: 'var(--wm-border)',
                background: 'color-mix(in oklab, var(--wm-surface) 80%, black)',
                color: 'var(--wm-text)',
              }}
            />
          </div>
          <div className="flex flex-col">
            {npcs.map((npc) => {
              const isPinned = pinnedEntityIds.has(npc.id);
              return (
                <DraggableRow
                  key={npc.id}
                  item={{ id: npc.id, name: npc.name, type: 'NPC', isPinned, source: 'npc' }}
                  onDragStart={onDragStart}
                  onClickPinned={(item) => onSelectEntity(item.id, item.name)}
                />
              );
            })}
            {npcs.length === 0 && (
              <p className="px-2 py-1 text-[10px]" style={{ color: 'var(--wm-muted)' }}>
                No NPCs yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
