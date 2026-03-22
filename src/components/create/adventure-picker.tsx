'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ADVENTURE_TEMPLATES, ADVENTURE_TAGS, type AdventureTemplate, type AdventureTag } from '@/lib/adventure-templates';

const TAG_TO_TEMPLATE_TAGS: Record<string, string[]> = {
  'City': ['city'],
  'Horror': ['horror', 'gothic'],
  'Dungeon': ['dungeon-crawl'],
  'Wilderness': ['wilderness', 'jungle', 'survival', 'exploration'],
  'Heist': ['heist'],
  'Multiplanar': ['multiplanar', 'spelljammer', 'space'],
  'Space': ['space', 'spelljammer'],
};

interface AdventurePickerProps {
  value: AdventureTemplate | null;
  onChange: (adventure: AdventureTemplate) => void;
}

export function AdventurePicker({ value, onChange }: AdventurePickerProps) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<AdventureTag>('All');

  const filtered = ADVENTURE_TEMPLATES.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag =
      activeTag === 'All' || (TAG_TO_TEMPLATE_TAGS[activeTag] ?? []).some((t) => a.tags.includes(t));
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-3 mt-4">
      <Input
        placeholder="Search adventures..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-wrap gap-1.5">
        {ADVENTURE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setActiveTag(tag)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeTag === tag
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                : 'border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((adventure) => (
          <button
            key={adventure.id}
            type="button"
            onClick={() => onChange(adventure)}
            className={cn(
              'group rounded-lg overflow-hidden border transition-all text-left',
              value?.id === adventure.id
                ? 'border-amber-500/60 ring-2 ring-amber-500/40 shadow-[0_0_12px_hsl(35_80%_55%/0.15)]'
                : 'border-border/40 hover:border-amber-500/30'
            )}
          >
            <div className={cn('h-16 w-full bg-gradient-to-br', adventure.gradient)} />
            <div className="p-2 space-y-1 bg-stone-900/80">
              <p className="text-xs font-semibold leading-tight line-clamp-2">{adventure.title}</p>
              <p className="text-[10px] text-muted-foreground">{adventure.levelRange}</p>
              <div className="flex flex-wrap gap-1">
                {adventure.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[9px] rounded-full bg-stone-800 px-1.5 py-0.5 text-muted-foreground/70">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No adventures match your search.</p>
      )}
    </div>
  );
}
