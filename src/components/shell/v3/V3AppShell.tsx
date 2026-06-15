'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/error-boundary';
import { ScrollkinPerch } from '@/components/scrollkin/ScrollkinPerch';

/**
 * V3AppShell — the parallel v3 shell, mirroring `(app)/app-shell.tsx`'s
 * two-level structure (global rail + content) but built on the v3 design
 * language. It is intentionally minimal until Track A1–A3 land the design
 * assets (tokens reconciled, 92-icon set) and Track C migrates real screens.
 *
 * The Scrollkin perch is mounted here as a global overlay — the single
 * surfacing channel the nudge engine (src/lib/scrollkin) broadcasts to.
 */
export function V3AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--q-bg)] text-[var(--q-text)]">
      {/* Global rail (placeholder — real CommandRail v3 lands in Track A4/C). */}
      <nav className="hidden w-16 shrink-0 flex-col items-center gap-4 border-r border-[var(--q-border-subtle)]/50 bg-[var(--q-shell-rail)] py-5 md:flex">
        <Link
          href="/v3"
          className="font-display text-lg font-bold tracking-tight text-[var(--q-accent-primary)]"
          aria-label="QuiverDM v3 home"
        >
          Q
        </Link>
      </nav>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (placeholder — real CommandBar v3 lands in Track A4/C). */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--q-border-subtle)]/50 bg-[var(--q-shell-bar)] px-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--q-text-dim)]">
            QuiverDM v3 · preview
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {/* Global overlay: the Scrollkin perch (idle until a nudge is delivered). */}
      <ScrollkinPerch />
    </div>
  );
}
