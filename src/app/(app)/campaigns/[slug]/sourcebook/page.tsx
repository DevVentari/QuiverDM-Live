'use client';

import { Suspense } from 'react';
import { SourcebookReader } from '@/components/sourcebook/SourcebookReader';

export default function SourcebookPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-[var(--q-surface-utility)]" />
          <div className="h-[60vh] animate-pulse rounded-lg bg-[var(--q-surface-utility)]" />
        </div>
      }
    >
      <SourcebookReader />
    </Suspense>
  );
}
