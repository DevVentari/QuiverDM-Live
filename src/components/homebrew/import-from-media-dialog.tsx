'use client';

import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

const CONTENT_TYPES = ['item', 'spell', 'creature', 'location', 'faction', 'race', 'rule', 'adventure'];

interface ExtractedItem {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}

interface ReviewItem extends ExtractedItem {
  id: string;
  sourceFile: string;
  selected: boolean;
}

type Step = 'select' | 'extracting' | 'review' | 'saving' | 'done';

interface ImportFromMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
  onSuccess?: () => void;
}

export function ImportFromMediaDialog({
  open,
  onOpenChange,
  campaignId,
  onSuccess,
}: ImportFromMediaDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [extractErrors, setExtractErrors] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: campaigns } = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 60_000 });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignId ?? '');

  function addFiles(newFiles: FileList | File[]) {
    setFiles((prev) => [...prev, ...Array.from(newFiles)].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, []);

  async function handleExtract() {
    if (files.length === 0) return;
    setStep('extracting');

    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);

      const res = await fetch('/api/uploads/homebrew-import/extract', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        setExtractErrors([json.error || 'Extraction failed']);
        setReviewItems([]);
        setStep('review');
        return;
      }

      const errs: string[] = [];
      const items: ReviewItem[] = [];
      let idx = 0;

      for (const fr of json.fileResults as Array<{ fileName: string; items: ExtractedItem[]; error?: string }>) {
        if (fr.error) errs.push(`${fr.fileName}: ${fr.error}`);
        for (const item of fr.items) {
          items.push({ ...item, id: String(idx++), sourceFile: fr.fileName, selected: true });
        }
      }

      setExtractErrors(errs);
      setReviewItems(items);
      setStep('review');
    } catch (err: unknown) {
      setExtractErrors([err instanceof Error ? err.message : 'Extraction failed']);
      setReviewItems([]);
      setStep('review');
    }
  }

  async function handleSave() {
    const toSave = reviewItems.filter((i) => i.selected);
    if (toSave.length === 0) return;
    setStep('saving');

    try {
      const body = {
        items: toSave.map(({ name, type, description, properties }) => ({ name, type, description, properties })),
        campaignId: selectedCampaignId || undefined,
      };
      const res = await fetch('/api/uploads/homebrew-import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setSaveErrors([json.error || 'Save failed']);
        setSavedCount(0);
      } else {
        setSavedCount(json.saved as number);
        setSaveErrors(json.errors ?? []);
        if ((json.saved as number) > 0) onSuccess?.();
      }
    } catch (err: unknown) {
      setSaveErrors([err instanceof Error ? err.message : 'Save failed']);
      setSavedCount(0);
    }

    setStep('done');
  }

  function reset() {
    setStep('select');
    setFiles([]);
    setReviewItems([]);
    setExtractErrors([]);
    setSavedCount(0);
    setSaveErrors([]);
  }

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setReviewItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const selectedCount = reviewItems.filter((i) => i.selected).length;
  const isBusy = step === 'extracting' || step === 'saving';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isBusy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Any Format</DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Upload photos of hand-drawn content, handwritten notes, sketches, or any text file. AI will extract D&D homebrew content.'}
            {step === 'extracting' && 'Analyzing files with AI…'}
            {step === 'review' && (reviewItems.length > 0
              ? `Review extracted content. ${selectedCount} of ${reviewItems.length} items selected.`
              : 'Extraction complete.')}
            {step === 'saving' && 'Saving selected items…'}
            {step === 'done' && `Done — ${savedCount} item${savedCount !== 1 ? 's' : ''} saved to your library.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">

          {step === 'select' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Images (JPG, PNG, WebP), PDF, text — up to 5 files, 10MB each
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />

              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground text-xs">{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!campaignId && campaigns && campaigns.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Add to Campaign (optional)</Label>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No campaign — library only" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No campaign — library only</SelectItem>
                      {campaigns.map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleExtract} disabled={files.length === 0}>
                  Extract {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {step === 'extracting' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Analyzing {files.length} file{files.length > 1 ? 's' : ''} with AI…
              </p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              {extractErrors.length > 0 && (
                <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                  {extractErrors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive flex gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{e}
                    </p>
                  ))}
                </div>
              )}

              {reviewItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No D&D content found in the uploaded files.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 pb-1">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selectedCount === reviewItems.length && reviewItems.length > 0}
                      onChange={(e) =>
                        setReviewItems((prev) => prev.map((i) => ({ ...i, selected: e.target.checked })))
                      }
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <Label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer font-normal">
                      Select all ({reviewItems.length} items)
                    </Label>
                  </div>

                  {reviewItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex gap-3 p-3 rounded-lg border transition-colors ${item.selected ? 'bg-card' : 'bg-muted/30 opacity-60'}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => updateItem(item.id, { selected: e.target.checked })}
                        className="h-4 w-4 mt-1 rounded border-border accent-primary shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex gap-2">
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            className="h-7 text-sm font-medium flex-1"
                          />
                          <Select value={item.type} onValueChange={(v) => updateItem(item.id, { type: v })}>
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONTENT_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                        <p className="text-xs text-muted-foreground/40">from {item.sourceFile}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Saving {selectedCount} item{selectedCount !== 1 ? 's' : ''}…
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {savedCount > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                )}
                <span>{savedCount} item{savedCount !== 1 ? 's' : ''} saved to your library.</span>
              </div>
              {saveErrors.length > 0 && (
                <ul className="pl-7 text-xs text-destructive space-y-0.5">
                  {saveErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="flex gap-2 pt-4 border-t shrink-0">
            <Button onClick={handleSave} disabled={selectedCount === 0}>
              Save {selectedCount > 0 ? `${selectedCount} item${selectedCount !== 1 ? 's' : ''}` : ''}
            </Button>
            <Button variant="outline" onClick={reset}>Back</Button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex gap-2 pt-4 border-t shrink-0">
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            <Button variant="outline" onClick={reset}>Import More</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
