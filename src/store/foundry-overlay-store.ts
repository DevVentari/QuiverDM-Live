import { create } from 'zustand'

interface FoundryOverlayStore {
  isOpen: boolean
  isMinimized: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  open: () => void
  close: () => void
  toggle: () => void
  minimize: () => void
  unminimize: () => void
  setPosition: (pos: { x: number; y: number }) => void
  setSize: (size: { width: number; height: number }) => void
}

export const useFoundryOverlayStore = create<FoundryOverlayStore>((set) => ({
  isOpen: false,
  isMinimized: false,
  position: { x: 80, y: 80 },
  size: { width: 900, height: 620 },
  open: () => set({ isOpen: true, isMinimized: false }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen, isMinimized: false })),
  minimize: () => set({ isMinimized: true }),
  unminimize: () => set({ isMinimized: false }),
  setPosition: (position) => set({ position }),
  setSize: (size) => set({ size }),
}))
