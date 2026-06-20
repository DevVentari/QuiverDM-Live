'use client';

import Link from 'next/link';
import type { EntityGaps } from '@/lib/brain/gap-detector';

export function GapsList({ gaps, slug }: { gaps: EntityGaps[]; slug: string }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        The world is well-specified — no gaps found.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {gaps.map((g) => (
        <Link
          key={g.id}
          href={`/campaigns/${slug}/brain/entities`}
          className="block rounded border border-border/60 bg-card/40 p-3 hover:border-[var(--q-amber)]/60 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{g.name}</span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.type}</span>
              <span className="rounded-full bg-[var(--q-amber)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {g.score}
              </span>
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {g.findings.map((f) => (
              <li key={f.rule} className="text-xs text-muted-foreground">• {f.hint}</li>
            ))}
          </ul>
        </Link>
      ))}
    </div>
  );
}
