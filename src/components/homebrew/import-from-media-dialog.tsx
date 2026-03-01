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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ResultItem {
  name: string;
  count: number;
  errors: string[];
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: campaigns } = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 60_000 });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignId ?? '');

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, []);

  async function handleSubmit() {
    if (files.length === 0) return;

    setUploading(true);
    setResults(null);

    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      if (selectedCampaignId) fd.append('campaignId', selectedCampaignId);

      const res = await fetch('/api/uploads/homebrew-import', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        setResults([{ name: 'Error', count: 0, errors: [json.error || 'Upload failed'] }]);
        return;
      }

      setResults(json.results as ResultItem[]);
      const totalSaved = (json.results as ResultItem[]).reduce((sum: number, r: ResultItem) => sum + r.count, 0);
      if (totalSaved > 0) onSuccess?.();
    } catch (err: unknown) {
      setResults([{ name: 'Error', count: 0, errors: [err instanceof Error ? err.message : 'Upload failed'] }]);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFiles([]);
    setResults(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Any Format</DialogTitle>
          <DialogDescription>
            Upload photos of hand-drawn content, handwritten notes, sketches, or any text file. AI will extract D&D homebrew content automatically.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  {r.count > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  <span className="font-medium truncate">{r.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {r.count} item{r.count !== 1 ? 's' : ''} imported
                  </span>
                </div>
                {r.errors.length > 0 && (
                  <ul className="pl-6 text-xs text-destructive space-y-0.5">
                    {r.errors.map((e, j) => <li key={j}>{e}</li>)}
                  </ul>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
              <Button variant="outline" onClick={reset}>Import More</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Images (JPG, PNG, WebP), PDF, text files — up to 5 files, 10MB each
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
                    <span className="text-muted-foreground text-xs">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
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
              <Button onClick={handleSubmit} disabled={files.length === 0 || uploading}>
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</>
                ) : (
                  `Import ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`
                )}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
