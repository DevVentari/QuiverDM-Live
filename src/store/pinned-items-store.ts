import { create } from 'zustand';

export type PinnedEntityType = 'npc' | 'item' | 'location' | 'spell' | 'monster' | 'encounter';

export interface PinnedItem {
  id: string;
  entityType: PinnedEntityType;
  name: string;
  iconUrl?: string;
  order: number;
}

interface PinnedItemsStore {
  pinned: PinnedItem[];
  activeSheetItem: PinnedItem | null;
  pin: (item: PinnedItem) => void;
  unpin: (id: string) => void;
  isPinned: (id: string) => boolean;
  reorder: (orderedIds: string[]) => void;
  openSheet: (item: PinnedItem) => void;
  closeSheet: () => void;
}

export const usePinnedItems = create<PinnedItemsStore>((set, get) => ({
  pinned: [],
  activeSheetItem: null,
  pin: (item) =>
    set((s) => ({
      pinned: s.pinned.some((p) => p.id === item.id)
        ? s.pinned
        : [...s.pinned, { ...item, order: s.pinned.length }],
    })),
  unpin: (id) =>
    set((s) => ({
      pinned: s.pinned.filter((p) => p.id !== id),
      activeSheetItem: s.activeSheetItem?.id === id ? null : s.activeSheetItem,
    })),
  isPinned: (id) => get().pinned.some((p) => p.id === id),
  reorder: (orderedIds) =>
    set((s) => {
      const map = new Map(s.pinned.map((p) => [p.id, p]));
      return {
        pinned: orderedIds
          .map((id, idx) => (map.has(id) ? { ...map.get(id)!, order: idx } : null))
          .filter(Boolean) as PinnedItem[],
      };
    }),
  openSheet: (item) => set({ activeSheetItem: item }),
  closeSheet: () => set({ activeSheetItem: null }),
}));
