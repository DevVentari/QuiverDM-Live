import { create } from 'zustand';
import type { RecapStyle } from '@prisma/client';

interface RecapStore {
  // Active editing
  editingRecapId: string | null;
  editingSectionKey: string | null;
  editDraft: string;
  setEditing: (recapId: string, sectionKey: string, content: string) => void;
  clearEditing: () => void;
  updateDraft: (content: string) => void;

  // Clarification state (client-side before submission)
  clarificationAnswers: Record<string, string>;
  setAnswer: (questionId: string, answer: string) => void;
  clearAnswers: () => void;

  // UI preferences
  preferredStyle: RecapStyle;
  preferredCharLimit: 2000 | 3000;
  preferredThreadMode: boolean;
  setPreferredStyle: (style: RecapStyle) => void;
  setPreferredCharLimit: (limit: 2000 | 3000) => void;
  setPreferredThreadMode: (mode: boolean) => void;
}

export const useRecapStore = create<RecapStore>((set) => ({
  editingRecapId: null,
  editingSectionKey: null,
  editDraft: '',
  setEditing: (recapId, sectionKey, content) =>
    set({ editingRecapId: recapId, editingSectionKey: sectionKey, editDraft: content }),
  clearEditing: () =>
    set({ editingRecapId: null, editingSectionKey: null, editDraft: '' }),
  updateDraft: (content) => set({ editDraft: content }),

  clarificationAnswers: {},
  setAnswer: (questionId, answer) =>
    set((s) => ({ clarificationAnswers: { ...s.clarificationAnswers, [questionId]: answer } })),
  clearAnswers: () => set({ clarificationAnswers: {} }),

  preferredStyle: 'NARRATIVE',
  preferredCharLimit: 2000,
  preferredThreadMode: false,
  setPreferredStyle: (style) => set({ preferredStyle: style }),
  setPreferredCharLimit: (limit) => set({ preferredCharLimit: limit }),
  setPreferredThreadMode: (mode) => set({ preferredThreadMode: mode }),
}));
