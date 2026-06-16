'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { V3AppShell } from './V3AppShell';

/**
 * Chooses the v3 chrome by route: the player portal (/v3/play/*) renders bare
 * (its own minimal player layout provides chrome); everything else gets the DM
 * V3AppShell (global rail + campaign sidebar + Heartflame).
 */
export function V3LayoutSwitch({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/v3/play')) return <>{children}</>;
  return <V3AppShell>{children}</V3AppShell>;
}
