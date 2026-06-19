'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SurfacedNudge } from '@/lib/heartflame';

interface HeartflameContextValue {
  /** The nudge currently surfaced on the perch (null = idle). */
  nudge: SurfacedNudge | null;
  setNudge: (nudge: SurfacedNudge | null) => void;
}

const HeartflameContext = createContext<HeartflameContextValue | null>(null);

/** Provides the current perch nudge. Any v3 screen can push a nudge via useHeartflame(). */
export function HeartflameProvider({
  children,
  initial = null,
}: {
  children: ReactNode;
  initial?: SurfacedNudge | null;
}) {
  const [nudge, setNudge] = useState<SurfacedNudge | null>(initial);
  return (
    <HeartflameContext.Provider value={{ nudge, setNudge }}>
      {children}
    </HeartflameContext.Provider>
  );
}

export function useHeartflame(): HeartflameContextValue {
  const ctx = useContext(HeartflameContext);
  if (!ctx) throw new Error('useHeartflame must be used within a HeartflameProvider');
  return ctx;
}
