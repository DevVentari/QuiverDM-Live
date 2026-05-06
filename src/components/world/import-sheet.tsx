'use client';

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Upload, Loader2, BookOpen, MapPin, Package, Skull,
  Flag, ScrollText, Sparkles, Dna, UsersRound,
} from 'lucide-react';
import type { ExtractedEntity, ExtractedEntityType } from '@/server/services/markdown-extraction.service';

const TYPE_META: Record<ExtractedEntityType, { label: string; icon: React.ElementType; color: string }> = {
  location: { label: 'Locations', icon: MapPin,      color: 'text-emerald-400/80' },
  npc:      { label: 'NPCs',      icon: UsersRound,  color: 'text-blue-400/80'    },
  item:     { label: 'Items',     icon: Package,     color: 'text-yellow-400/80'  },
  creature: { label: 'Creatures', icon: Skull,       color: 'text-red-400/80'     },
  faction:  { label: 'Factions',  icon: Flag,        color: 'text-purple-400/80'  },
  lore:     { label: 'Lore',      icon: ScrollText,  color: 'text-amber-400/80'   },
  timeline: { label: 'Timelines', icon: BookOpen,    color: 'text-violet-400/80'  },
  spell:    { label: 'Spells',    icon: Sparkles,    color: 'text-cyan-400/80'    },
  race:     { label: 'Races',     icon: Dna,         color: 'text-pink-400/80'    },
};

const HINTS = [
  { value: '', label: 'Let AI decide' },
  { value: 'Locations', label: 'Locations' },
  { value: 'NPCs', label: 'NPCs' },
  { value: 'Items & Creatures', label: 'Items & Creatures' },
  { value: 'Mixed', label: 'Mixed' },
];

type View = 'upload' | 'loading' | 'review';

export function ImportSheet({
  campaignId,
  open,
  onOpenChange,
  onSuccess,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('upload');
  const [hint, setHint] = useState('');
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const extract = trpc.campaigns.importFromMarkdown.useMutation({
    onSuccess: (data) => {
      setEntities(data);
      setChecked(new Set(data.map((_, i) => i)));
      setView('review');
    },
    onError: (e) => {
      setError(e.message);
      setView('upload');
    },
  });

  const confirm = trpc.campaigns.confirmImport.useMutation({
    onSuccess: () => {
      onSuccess();
      reset();
    },
    onError: (e) => {
      setError(e.message);
      setView('upload');
    },
  });

  function reset() {
    setView('upload');
    setHint('');
    setFilename('');
    setContent('');
    setEntities([]);
    setChecked(new Set());
    setError(null);
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 60_000) {
      setError('File too large (max ~55 KB). Please split the file.');
      return;
    }
    setFilename(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setContent((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  }

  function handleExtract() {
    if (!content) { setError('No file loaded.'); return; }
    setView('loading');
    extract.mutate({ campaignId, content, hint: hint || undefined });
  }

  function toggleCheck(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function handleConfirm() {
    const selected = entities.filter((_, i) => checked.has(i));
    confirm.mutate({ campaignId, entities: selected });
  }

  const grouped = Object.entries(
    entities.reduce<Record<string, { entity: ExtractedEntity; index: number }[]>>(
      (acc, entity, i) => {
        (acc[entity.type] ??= []).push({ entity, index: i });
        return acc;
      },
      {},
    ),
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b border-border/40">
          <SheetTitle className="font-display text-sm tracking-widest uppercase text-amber-300/80">
            Import from Markdown
          </SheetTitle>
        </SheetHeader>

        {view === 'upload' && (
          <div className="flex flex-col gap-4 p-6">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground/60">
                {filename || 'Click to choose a .md file'}
              </p>
              {filename && <p className="text-xs text-muted-foreground/40">Click to change</p>}
            </div>
            <input ref={fileRef} type="file" accept=".md" className="hidden" onChange={handleFileChange} />

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">
                What&apos;s mainly in this file?
              </p>
              <select
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className="w-full bg-card/40 border border-border/40 rounded px-3 py-2 text-sm text-foreground"
              >
                {HINTS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>

            <Button onClick={handleExtract} disabled={!content} className="mt-2">
              Extract Content
            </Button>
          </div>
        )}

        {view === 'loading' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/60 p-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400/60" />
            <p className="text-sm text-center">Extracting entities from {filename}&hellip;</p>
            <p className="text-xs text-muted-foreground/40 text-center">This can take 15–30 seconds</p>
          </div>
        )}

        {view === 'review' && (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              {entities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/40">
                  <BookOpen className="h-8 w-8" />
                  <p className="text-sm">Nothing found — try a different file or hint</p>
                  <Button variant="ghost" size="sm" onClick={() => setView('upload')} className="mt-2">
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {grouped.map(([type, items]) => {
                    const meta = TYPE_META[type as ExtractedEntityType];
                    const Icon = meta?.icon ?? BookOpen;
                    return (
                      <div key={type} className="space-y-1.5">
                        <div className={cn('flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-semibold', meta?.color)}>
                          <Icon className="h-3 w-3" />
                          {meta?.label ?? type}
                          <span className="text-muted-foreground/40 normal-case tracking-normal">({items.length})</span>
                        </div>
                        {items.map(({ entity, index }) => (
                          <label
                            key={index}
                            className="flex items-start gap-3 rounded-md border border-border/30 bg-card/20 px-3 py-2.5 cursor-pointer hover:bg-card/40 transition-colors"
                          >
                            <Checkbox
                              checked={checked.has(index)}
                              onCheckedChange={() => toggleCheck(index)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground/90 leading-snug">{entity.name}</p>
                              {entity.description && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">
                                  {entity.description}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {entities.length > 0 && (
              <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => setView('upload')}>
                  Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={checked.size === 0 || confirm.isPending}
                  className="gap-2"
                >
                  {confirm.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save {checked.size} {checked.size === 1 ? 'entity' : 'entities'}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
