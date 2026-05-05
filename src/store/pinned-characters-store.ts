import { create } from 'zustand';

export interface PinnedCharacter {
  characterId: string;
  campaignId: string;
  name: string;
  portraitUrl: string | null;
}

interface ActiveSheet extends PinnedCharacter {
  isExpanded: boolean;
}

interface PinnedCharactersStore {
  pinned: PinnedCharacter[];
  activeSheet: ActiveSheet | null;
  pin: (char: PinnedCharacter) => void;
  unpin: (characterId: string) => void;
  isPinned: (characterId: string) => boolean;
  openSheet: (char: PinnedCharacter) => void;
  closeSheet: () => void;
  expandSheet: () => void;
  collapseSheet: () => void;
}

export const usePinnedCharacters = create<PinnedCharactersStore>((set, get) => ({
  pinned: [],
  activeSheet: null,
  pin: (char) =>
    set((s) => ({
      pinned: s.pinned.some((p) => p.characterId === char.characterId)
        ? s.pinned
        : [...s.pinned, char],
    })),
  unpin: (characterId) =>
    set((s) => ({
      pinned: s.pinned.filter((p) => p.characterId !== characterId),
      activeSheet:
        s.activeSheet?.characterId === characterId ? null : s.activeSheet,
    })),
  isPinned: (characterId) => get().pinned.some((p) => p.characterId === characterId),
  openSheet: (char) => set({ activeSheet: { ...char, isExpanded: false } }),
  closeSheet: () => set({ activeSheet: null }),
  expandSheet: () =>
    set((s) => ({
      activeSheet: s.activeSheet ? { ...s.activeSheet, isExpanded: true } : null,
    })),
  collapseSheet: () =>
    set((s) => ({
      activeSheet: s.activeSheet ? { ...s.activeSheet, isExpanded: false } : null,
    })),
}));
