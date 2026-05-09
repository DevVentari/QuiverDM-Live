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
  Flag, ScrollText, Sparkles, Dna, UsersRound, FileJson,
} from 'lucide-react';
import type { ExtractedEntity, ExtractedEntityType } from '@/server/services/markdown-extraction.service';
import type { FilePreview } from '@/server/services/json-import.service';

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

type Format = 'json' | 'md' | 'pdf';
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
  const mdFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  const [format, setFormat] = useState<Format>('json');
  const [view, setView] = useState<View>('upload');
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Markdown state
  const [mdFilename, setMdFilename] = useState('');
  const [mdContent, setMdContent] = useState('');
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [entityChecked, setEntityChecked] = useState<Set<number>>(new Set());

  // JSON state
  const [jsonFiles, setJsonFiles] = useState<Array<{ filename: string; content: string }>>([]);
  const [jsonPreviews, setJsonPreviews] = useState<FilePreview[]>([]);
  const [jsonChecked, setJsonChecked] = useState<Set<string>>(new Set());

  // PDF state
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfUploading, setPdfUploading] = useState(false);

  // ── tRPC mutations ──────────────────────────────────────────────────────────

  const extractMd = trpc.campaigns.importFromMarkdown.useMutation({
    onSuccess: (data) => {
      setEntities(data);
      setEntityChecked(new Set(data.map((_, i) => i)));
      setView('review');
    },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  const confirmMd = trpc.campaigns.confirmImport.useMutation({
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  const importJson = trpc.campaigns.importFromJson.useMutation({
    onSuccess: (data) => {
      setJsonPreviews(data.previews);
      setJsonChecked(new Set(data.previews.filter((p) => p.valid).map((p) => p.slug)));
      setView('review');
    },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  const confirmJson = trpc.campaigns.confirmJsonImport.useMutation({
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  function reset() {
    setView('upload');
    setHint('');
    setError(null);
    setMdFilename(''); setMdContent('');
    setEntities([]); setEntityChecked(new Set());
    setJsonFiles([]); setJsonPreviews([]); setJsonChecked(new Set());
    setPdfFilename('');
    if (jsonFileRef.current) jsonFileRef.current.value = '';
    if (mdFileRef.current) mdFileRef.current.value = '';
    if (pdfFileRef.current) pdfFileRef.current.value = '';
  }

  function handleClose() { reset(); onOpenChange(false); }

  // ── Markdown handlers ───────────────────────────────────────────────────────

  function handleMdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 60_000) { setError('File too large (max ~55 KB). Please split the file.'); return; }
    setMdFilename(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setMdContent((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  }

  function handleMdExtract() {
    if (!mdContent) { setError('No file loaded.'); return; }
    setView('loading');
    extractMd.mutate({ campaignId, content: mdContent, hint: hint || undefined });
  }

  // ── JSON handlers ───────────────────────────────────────────────────────────

  function handleJsonFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setError(null);

    const readers = selected.map(
      (file) =>
        new Promise<{ filename: string; content: string }>((resolve, reject) => {
          if (file.size > 250_000) {
            reject(new Error(`${file.name}: too large (max 200KB)`));
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => resolve({ filename: file.name, content: (ev.target?.result as string) ?? '' });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        }),
    );

    Promise.all(readers)
      .then((files) => {
        setJsonFiles(files);
        setView('loading');
        importJson.mutate({ campaignId, files });
      })
      .catch((err: Error) => setError(err.message));
  }

  // ── PDF handlers ────────────────────────────────────────────────────────────

  async function handlePdfFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPdfFilename(file.name);
    setPdfUploading(true);
    setView('loading');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads/world-import-pdf', { method: 'POST', body: form });
      const json = await res.json() as { markdown?: string; error?: string };
      if (!res.ok || !json.markdown) {
        throw new Error(json.error ?? 'PDF conversion failed');
      }
      setMdContent(json.markdown);
      setMdFilename(file.name);
      extractMd.mutate({ campaignId, content: json.markdown.slice(0, 55_000), hint: hint || undefined });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PDF conversion failed');
      setView('upload');
    } finally {
      setPdfUploading(false);
    }
  }

  // ── Confirm handlers ────────────────────────────────────────────────────────

  function handleMdConfirm() {
    const selected = entities.filter((_, i) => entityChecked.has(i));
    confirmMd.mutate({ campaignId, entities: selected });
  }

  function handleJsonConfirm() {
    confirmJson.mutate({
      campaignId,
      files: jsonFiles,
      selectedSlugs: Array.from(jsonChecked),
    });
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const grouped = Object.entries(
    entities.reduce<Record<string, { entity: ExtractedEntity; index: number }[]>>(
      (acc, entity, i) => { (acc[entity.type] ??= []).push({ entity, index: i }); return acc; },
      {},
    ),
  );

  const loadingLabel =
    format === 'json' ? 'Parsing JSON files…' :
    format === 'pdf' ? 'Converting PDF…' :
    `Extracting entities from ${mdFilename}…`;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b border-border/40">
          <SheetTitle className="font-display text-sm tracking-widest uppercase text-amber-300/80">
            Import World Content
          </SheetTitle>
        </SheetHeader>

        {/* Format tabs — only shown on upload view */}
        {view === 'upload' && (
          <div className="flex border-b border-border/30 px-6 pt-3 gap-1">
            {(['json', 'md', 'pdf'] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFormat(f); setError(null); }}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-t-sm font-medium uppercase tracking-widest transition-colors',
                  format === f
                    ? 'bg-amber-500/10 text-amber-300/80 border border-b-0 border-amber-500/30'
                    : 'text-muted-foreground/50 hover:text-muted-foreground/80',
                )}
              >
                {f === 'json' ? 'JSON' : f === 'md' ? 'Markdown' : 'PDF'}
              </button>
            ))}
          </div>
        )}

        {/* Upload views */}
        {view === 'upload' && (
          <div className="flex flex-col gap-4 p-6">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            {format === 'json' && (
              <>
                <div
                  onClick={() => jsonFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
                >
                  <FileJson className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">Click to choose JSON files (up to 50)</p>
                  <p className="text-xs text-muted-foreground/40">200KB per file · multi-select supported</p>
                </div>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json"
                  multiple
                  className="hidden"
                  onChange={handleJsonFilesChange}
                />
              </>
            )}

            {format === 'md' && (
              <>
                <div
                  onClick={() => mdFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">
                    {mdFilename || 'Click to choose a .md file'}
                  </p>
                  {mdFilename && <p className="text-xs text-muted-foreground/40">Click to change</p>}
                </div>
                <input ref={mdFileRef} type="file" accept=".md" className="hidden" onChange={handleMdFileChange} />

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">What&apos;s mainly in this file?</p>
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

                <Button onClick={handleMdExtract} disabled={!mdContent} className="mt-2">
                  Extract Content
                </Button>
              </>
            )}

            {format === 'pdf' && (
              <>
                <div
                  onClick={() => !pdfUploading && pdfFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">
                    {pdfFilename || 'Click to choose a PDF'}
                  </p>
                  <p className="text-xs text-muted-foreground/40">Converted via Docling · max 25MB</p>
                </div>
                <input ref={pdfFileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfFileChange} disabled={pdfUploading} />
              </>
            )}
          </div>
        )}

        {/* Loading */}
        {view === 'loading' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/60 p-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400/60" />
            <p className="text-sm text-center">{loadingLabel}</p>
            <p className="text-xs text-muted-foreground/40 text-center">
              {format === 'json' ? 'No AI needed — parsing directly' : 'This can take 15–30 seconds'}
            </p>
          </div>
        )}

        {/* Review — JSON */}
        {view === 'review' && format === 'json' && (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-3">
                  {jsonPreviews.length} files parsed — select to import
                </p>
                {jsonPreviews.map((preview) => (
                  <label
                    key={preview.slug || preview.filename}
                    className={cn(
                      'flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors',
                      preview.valid
                        ? 'border-border/30 bg-card/20 hover:bg-card/40'
                        : 'border-destructive/20 bg-destructive/5 opacity-60',
                    )}
                  >
                    <Checkbox
                      checked={jsonChecked.has(preview.slug)}
                      disabled={!preview.valid}
                      onCheckedChange={(checked) => {
                        setJsonChecked((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(preview.slug); else next.delete(preview.slug);
                          return next;
                        });
                      }}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground/90 leading-snug">{preview.title}</p>
                        {!preview.valid && (
                          <span className="text-[10px] text-destructive/70 uppercase tracking-wider">invalid</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">{preview.filename}</p>
                      {preview.valid && (
                        <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                          {[
                            preview.npcCount > 0 && `${preview.npcCount} NPCs`,
                            preview.homebrewCount > 0 && `${preview.homebrewCount} homebrew`,
                            preview.entityCount > 0 && `${preview.entityCount} entities`,
                          ].filter(Boolean).join(' · ') || preview.docType}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => setView('upload')}>Back</Button>
              <Button
                onClick={handleJsonConfirm}
                disabled={jsonChecked.size === 0 || confirmJson.isPending}
                className="gap-2"
              >
                {confirmJson.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Import {jsonChecked.size} {jsonChecked.size === 1 ? 'file' : 'files'}
              </Button>
            </div>
          </>
        )}

        {/* Review — Markdown / PDF (entity-level) */}
        {view === 'review' && (format === 'md' || format === 'pdf') && (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              {entities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/40">
                  <BookOpen className="h-8 w-8" />
                  <p className="text-sm">Nothing found — try a different file or hint</p>
                  <Button variant="ghost" size="sm" onClick={() => setView('upload')} className="mt-2">Try again</Button>
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
                              checked={entityChecked.has(index)}
                              onCheckedChange={() => {
                                setEntityChecked((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(index)) next.delete(index); else next.add(index);
                                  return next;
                                });
                              }}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground/90 leading-snug">{entity.name}</p>
                              {entity.description && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{entity.description}</p>
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
                <Button variant="ghost" size="sm" onClick={() => setView('upload')}>Back</Button>
                <Button
                  onClick={handleMdConfirm}
                  disabled={entityChecked.size === 0 || confirmMd.isPending}
                  className="gap-2"
                >
                  {confirmMd.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save {entityChecked.size} {entityChecked.size === 1 ? 'entity' : 'entities'}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
