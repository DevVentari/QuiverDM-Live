import { create } from 'zustand';

export type HeaderStat = {
  label: string;
  value: string | number;
  alert?: boolean;
};

export type HeaderSlot = {
  label: string;
  title: string;
  campaignSlug?: string;
  campaignId?: string;
  isDM?: boolean;
  badge?: { text: string; color: 'amber' | 'sky' };
  stats?: HeaderStat[];
} | null;

interface HeaderStore {
  slot: HeaderSlot;
  setSlot: (slot: HeaderSlot) => void;
}

export const useHeaderStore = create<HeaderStore>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}));
