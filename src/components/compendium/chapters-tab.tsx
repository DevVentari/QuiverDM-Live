'use client';

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';

type ChapterItem = {
  id: string;
  name: string;
  sourceType: string;
  data: Record<string, unknown> | null;
};

export function ChaptersTab() {
  const [search, setSearch] = useState('');
  const { selectedItemId, selectItem } = useCompendiumStore();
  const pathname = usePathname();
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );
  const campaignId = campaignData?.id;

  const { data: result, isLoading } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId!, type: 'location' },
    { enabled: !!campaignId }
  );

  const chapters: ChapterItem[] = ((result?.items ?? []) as ChapterItem[]).filter(
    (item) => item.sourceType === 'dndbeyond_import'
  );

  const filtered = useMemo(
    () => search
      ? chapters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : chapters,
    [chapters, search]
  );

  if (!campaignSlug) {
    return <div className="p-4 text-sm text-muted-foreground">Open a campaign to browse chapters.</div>;
  }
  if (!campaignData) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(240_20%_85%/0.07)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters…"
          className="w-full bg-[hsl(240_10%_8%/0.6)] border border-[hsl(240_20%_85%/0.09)] rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--card-amber)]/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground p-2">No chapters found.</p>
        )}
        {filtered.map((chapter) => {
          const data = chapter.data as any;
          const wordEstimate = data?.proseLength
            ? `~${Math.round(data.proseLength / 5).toLocaleString()} words`
            : '';
          return (
            <button
              key={chapter.id}
              onClick={() => selectItem(chapter.id, 'chapter')}
              className={cn(
                'w-full text-left px-3 py-2 rounded border transition-colors',
                selectedItemId === chapter.id
                  ? 'bg-[hsl(240_10%_14%)] border-[var(--card-stone-border-hi)]'
                  : 'bg-[hsl(240_10%_10%/0.5)] border-[hsl(240_20%_85%/0.06)] hover:bg-[hsl(240_10%_12%)]'
              )}
            >
              <span className="text-xs text-foreground/80 block truncate">{chapter.name}</span>
              {wordEstimate && <span className="text-[10px] text-muted-foreground">{wordEstimate}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
