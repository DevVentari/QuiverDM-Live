'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Sparkles, Square, ImageUp } from 'lucide-react';

interface MapBackgroundControlProps {
  open: boolean;
  onClose: () => void;
  /** Persist an uploaded/selected URL as the background. */
  onApplyUrl: (url: string) => Promise<void>;
  /** Queue AI generation with an optional custom prompt. */
  onGenerate: (customPrompt?: string) => Promise<void>;
  /** Clear the background (blank field). */
  onBlank: () => Promise<void>;
}

export function MapBackgroundControl({ open, onClose, onApplyUrl, onGenerate, onBlank }: MapBackgroundControlProps) {
  const [tab, setTab] = useState<'blank' | 'generate' | 'upload'>('generate');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const handleUpload = () =>
    wrap(async () => {
      if (!uploadFile) return;
      const form = new FormData();
      form.append('file', uploadFile);
      const res = await fetch('/api/upload/map-background', { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Upload failed');
      await onApplyUrl((await res.json()).url);
      onClose();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border-[var(--qd-border-accent)] bg-[var(--qd-surface,#1a130e)]">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--qd-font-display)] text-[var(--qd-ink-strong)]">Map background</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="blank"><Square className="mr-1.5 h-3.5 w-3.5" />Blank</TabsTrigger>
            <TabsTrigger value="generate"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Generate</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="mr-1.5 h-3.5 w-3.5" />Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="blank" className="mt-4">
            <Button className="w-full" disabled={busy} onClick={() => wrap(async () => { await onBlank(); onClose(); })}>Start blank</Button>
          </TabsContent>
          <TabsContent value="generate" className="mt-4 flex flex-col gap-3">
            <Input placeholder="Optional style notes — e.g. ruined keep, snowy pass" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} />
            <Button className="w-full gap-2" disabled={busy} onClick={() => wrap(async () => { await onGenerate(customPrompt || undefined); toast.info('Generation queued — updates when ready'); onClose(); })}>
              <Sparkles className="h-4 w-4" />Generate map
            </Button>
          </TabsContent>
          <TabsContent value="upload" className="mt-4 flex flex-col gap-3">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--qd-border-accent)] py-8 text-sm text-[var(--qd-ink-2)]">
              <ImageUp className="h-5 w-5" />{uploadFile ? uploadFile.name : 'Choose a file…'}
            </button>
            <Button className="w-full" disabled={!uploadFile || busy} onClick={handleUpload}>Set background</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
