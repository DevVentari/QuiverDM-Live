import { create } from 'zustand';

export type HeaderSlot = {
  label: string;
  title: string;
  badge?: { text: string; color: 'amber' | 'sky' };
} | null;

interface HeaderStore {
  slot: HeaderSlot;
  setSlot: (slot: HeaderSlot) => void;
}

export const useHeaderStore = create<HeaderStore>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}));
