import { create } from 'zustand';

type CompendiumTab = 'encounters' | 'monsters' | 'chapters' | 'items';
type CompendiumItemType = 'encounter' | 'monster' | 'chapter' | 'item';

interface CompendiumStore {
  isOpen: boolean;
  activeTab: CompendiumTab;
  selectedItemId: string | null;
  selectedItemType: CompendiumItemType | null;
  open: () => void;
  close: () => void;
  setTab: (tab: CompendiumTab) => void;
  selectItem: (id: string, type: CompendiumItemType) => void;
}

export const useCompendiumStore = create<CompendiumStore>((set) => ({
  isOpen: false,
  activeTab: 'encounters',
  selectedItemId: null,
  selectedItemType: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, selectedItemId: null, selectedItemType: null }),
  setTab: (tab) => set({ activeTab: tab, selectedItemId: null, selectedItemType: null }),
  selectItem: (id, type) => set({ selectedItemId: id, selectedItemType: type }),
}));
