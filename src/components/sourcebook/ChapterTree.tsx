'use client';

import { BookOpen, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/primitives/Card';
import { cn } from '@/lib/utils';

type ChapterItem = {
  id: string;
  slug: string;
  title: string;
  chapterIndex: number;
  parentSlug: string | null;
  hasBody: boolean;
};

type BookOverview = {
  id: string;
  slug: string;
  title: string;
  lastSyncedAt: Date | null;
  syncStatus: string;
};

interface Props {
  book: BookOverview;
  chapters: ChapterItem[];
  activeSlug: string;
  onSelect: (chapterSlug: string) => void;
  onResync: () => void;
  resyncPending: boolean;
}

export function ChapterTree({ book, chapters, activeSlug, onSelect, onResync, resyncPending }: Props) {
  return (
    <Card variant="grimoire" className="h-full p-0 overflow-hidden">
      <div className="border-b border-[var(--q-border-subtle)] px-4 py-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[var(--q-accent-primary)]">
          <BookOpen className="h-3.5 w-3.5" />
          Sourcebook
        </div>
        <h2 className="mt-2 font-display text-lg text-[var(--q-text)]">{book.title}</h2>
        <p className="mt-1 text-xs text-[var(--q-text-dim)]">
          {book.lastSyncedAt ? `Synced ${formatDistanceToNow(book.lastSyncedAt)} ago` : 'Not synced yet'}
        </p>
        <button
          type="button"
          onClick={onResync}
          disabled={resyncPending}
          className={cn(
            'mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-sm border px-3 py-2 text-xs transition-colors',
            'border-[var(--q-border-subtle)] text-[var(--q-text)] hover:border-[var(--q-accent-primary-border)] hover:bg-[var(--q-amber-trace)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <RotateCcw className={cn('h-4 w-4', resyncPending && 'animate-spin')} />
          {resyncPending ? 'Queuing re-sync...' : 'Re-sync sourcebook'}
        </button>
      </div>

      <nav aria-label="Sourcebook chapters" className="max-h-[calc(100vh-220px)] overflow-y-auto px-2 py-3">
        {chapters.map((chapter) => {
          const active = chapter.slug === activeSlug;
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onSelect(chapter.slug)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors min-h-[44px]',
                active
                  ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{chapter.title}</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] opacity-70">
                  {chapter.slug}
                </span>
              </span>
              {!chapter.hasBody && (
                <span className="shrink-0 rounded-sm border border-[var(--q-border-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--q-text-faint)]">
                  Empty
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </Card>
  );
}
