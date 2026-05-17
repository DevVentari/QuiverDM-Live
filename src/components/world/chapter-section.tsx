'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChapterSectionProps {
  chapterId: string;
  title: string;
  count: number;
  accentColor: string;
  campaignSlug: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function ChapterSection({
  chapterId,
  title,
  count,
  accentColor,
  campaignSlug,
  defaultExpanded = true,
  children,
}: ChapterSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mb-2 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 transition-colors hover:bg-[var(--q-surface-utility)]"
        style={{ borderLeft: `3px solid ${accentColor}` }}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        )}
        <span
          className="flex-1 text-left font-[var(--q-font-display)] text-xs font-semibold uppercase tracking-widest"
          style={{ color: accentColor }}
        >
          {title}
        </span>
        <span className="mr-2 text-[10px] text-[var(--q-text-faint)]">{count}</span>
        <Link
          href={`/campaigns/${campaignSlug}/world-map?chapter=${chapterId}`}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex min-h-8 items-center gap-1 rounded-sm border px-2 text-[10px] transition-colors',
            'border-[var(--q-border-subtle)] text-[var(--q-text-faint)]',
            'hover:border-[var(--q-amber-border)] hover:text-[var(--q-text)]',
          )}
        >
          <Map className="h-3 w-3" />
          Map
        </Link>
      </button>

      {expanded && <div className="pl-3">{children}</div>}
    </div>
  );
}
