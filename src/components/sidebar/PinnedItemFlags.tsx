'use client';

import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePinnedItems, type PinnedItem, type PinnedEntityType } from '@/store/pinned-items-store';
import { CompendiumItemSheet } from '@/components/compendium/CompendiumItemSheet';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const TYPE_STYLES: Record<PinnedEntityType, { bg: string; border: string; activeBorder: string; text: string; icon?: string; round: boolean }> = {
  npc:      { bg: 'bg-[hsl(240,10%,8%)]', border: 'border-amber-800/35',  activeBorder: 'border-amber-500/55',  text: 'text-amber-400', round: true },
  item:     { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-indigo-800/30', activeBorder: 'border-indigo-500/50', text: 'text-indigo-400', icon: '⚔', round: false },
  location: { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-emerald-800/30',activeBorder: 'border-emerald-500/50',text: 'text-emerald-400',icon: '🗺',round: false },
  spell:    { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-violet-800/30', activeBorder: 'border-violet-500/50', text: 'text-violet-400', icon: '✦', round: false },
  monster:  { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-red-800/30',    activeBorder: 'border-red-500/50',    text: 'text-red-400',    icon: '💀',round: false },
  encounter:{ bg: 'bg-[hsl(240,10%,7%)]', border: 'border-orange-800/30', activeBorder: 'border-orange-500/50', text: 'text-orange-400', icon: '⚡',round: false },
};

export function PinnedItemFlags() {
  const { pinned, unpin, reorder } = usePinnedItems();
  const [sheetItem, setSheetItem] = useState<PinnedItem | null>(null);
  const pathname = usePathname();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pinned.findIndex((p) => p.id === active.id);
    const newIndex = pinned.findIndex((p) => p.id === over.id);
    const newOrder = [...pinned];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    reorder(newOrder.map((p) => p.id));
  }

  if (pinned.length === 0) return null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pinned.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div
            className="fixed right-0 z-40 flex flex-col gap-1.5 pointer-events-none"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            {pinned.map((item) => (
              <SortablePin
                key={item.id}
                item={item}
                pathname={pathname}
                onOpen={(i) => setSheetItem(i)}
                onUnpin={unpin}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sheetItem && (
        <CompendiumItemSheet
          entityType={sheetItem.entityType}
          entityId={sheetItem.id}
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
        />
      )}
    </>
  );
}

function SortablePin({
  item,
  pathname,
  onOpen,
  onUnpin,
}: {
  item: PinnedItem;
  pathname: string;
  onOpen: (item: PinnedItem) => void;
  onUnpin: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cfg = TYPE_STYLES[item.entityType];
  const isActivePage = pathname.includes(`/${item.id}`);

  function handleClick() {
    if (isActivePage) {
      onUnpin(item.id);
    } else {
      onOpen(item);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative pointer-events-auto flex items-center', isDragging && 'opacity-70 z-50')}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex flex-col gap-[3px] px-1 py-2 cursor-grab opacity-20 group-hover:opacity-60 transition-opacity"
      >
        <span className={cn('w-[3px] h-[3px] rounded-full', isActivePage ? 'bg-amber-400' : 'bg-muted-foreground')} />
        <span className={cn('w-[3px] h-[3px] rounded-full', isActivePage ? 'bg-amber-400' : 'bg-muted-foreground')} />
      </div>

      {/* Flag button */}
      <button
        onClick={handleClick}
        title={isActivePage ? `Unpin ${item.name}` : item.name}
        className={cn(
          'flex items-center justify-center w-11 h-[52px] rounded-l-xl border border-r-0 transition-all duration-150',
          'shadow-[-2px_0_8px_rgba(0,0,0,0.4)]',
          cfg.bg,
          isActivePage
            ? cn(cfg.activeBorder, 'shadow-[-2px_0_12px_rgba(0,0,0,0.5)]')
            : cn(cfg.border, 'hover:border-opacity-70')
        )}
      >
        {item.entityType === 'npc' ? (
          item.iconUrl ? (
            <div className="relative h-8 w-8 rounded-full overflow-hidden border border-amber-800/40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.iconUrl} alt={item.name} className="h-full w-full object-cover object-top" />
            </div>
          ) : (
            <div className={cn('h-8 w-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold font-display', cfg.bg, cfg.border, cfg.text)}>
              {item.name.charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <span className="text-lg leading-none">{TYPE_STYLES[item.entityType].icon}</span>
        )}
      </button>

      {/* Hover tooltip */}
      <div className="absolute right-11 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap z-50">
        <div className="rounded-l-md border border-r-0 border-amber-800/35 bg-[hsl(240,10%,8%)] px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-[-2px_0_8px_rgba(0,0,0,0.4)]">
          {isActivePage ? `Unpin ${item.name}` : item.name}
        </div>
      </div>

      {/* Unpin button (hover, non-active) */}
      {!isActivePage && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin(item.id); }}
          className="absolute -top-1 left-[10px] h-4 w-4 rounded-full bg-[hsl(240,10%,14%)] border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80 hover:border-destructive/60"
          title="Unpin"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
