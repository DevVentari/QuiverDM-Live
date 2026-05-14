'use client';

import { Suspense } from 'react';
import { SourcebookReader } from '@/components/sourcebook/SourcebookReader';

export default function SourcebookPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-220px)] animate-pulse rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)]" />
      }
    >
      <SourcebookReader />
    </Suspense>
  );
}
