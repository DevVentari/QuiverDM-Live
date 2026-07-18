'use client';

import { useRef, useState } from 'react';
import { QdModal } from '@/components/ui-v3/QdModal';
import { QdTabs } from '@/components/ui-v3/QdTabs';
import { QdButton } from '@/components/ui-v3/QdButton';
import { QdInput } from '@/components/ui-v3/QdInput';
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

const TABS = [
  { key: 'blank', label: 'Blank' },
  { key: 'generate', label: 'Generate' },
  { key: 'upload', label: 'Upload' },
];

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
    <QdModal open={open} onOpenChange={(o) => !o && onClose()} title="Map background">
      <QdTabs tabs={TABS} value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        {tab === 'blank' && (
          <QdButton className="w-full" disabled={busy} onClick={() => wrap(async () => { await onBlank(); onClose(); })}>
            <Square className="h-3.5 w-3.5" />Start blank
          </QdButton>
        )}
        {tab === 'generate' && (
          <div className="flex flex-col gap-3">
            <QdInput
              placeholder="Optional style notes — e.g. ruined keep, snowy pass"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <QdButton className="w-full" disabled={busy} onClick={() => wrap(async () => { await onGenerate(customPrompt || undefined); toast.info('Generation queued — updates when ready'); onClose(); })}>
              <Sparkles className="h-4 w-4" />Generate map
            </QdButton>
          </div>
        )}
        {tab === 'upload' && (
          <div className="flex flex-col gap-3">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--qd-border-accent)] py-8 text-sm text-[var(--qd-ink-2)]">
              <ImageUp className="h-5 w-5" />{uploadFile ? uploadFile.name : 'Choose a file…'}
            </button>
            <QdButton className="w-full" disabled={!uploadFile || busy} onClick={handleUpload}>Set background</QdButton>
          </div>
        )}
      </QdTabs>
    </QdModal>
  );
}
