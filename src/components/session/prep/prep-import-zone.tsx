'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import type { SessionPrepData } from '@/lib/prep-types';

type ImportState = 'idle' | 'uploading' | 'extracting' | 'done' | 'error';

interface PrepImportZoneProps {
  sessionId: string;
  campaignId: string;
  onExtracted: (data: Partial<SessionPrepData>, sectionCounts: Record<string, number>) => void;
  lastImportedAt?: string;
}

export function PrepImportZone({ sessionId, campaignId, onExtracted, lastImportedAt }: PrepImportZoneProps) {
  const [collapsed, setCollapsed] = useState(!!lastImportedAt);
  const [state, setState] = useState<ImportState>('idle');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = trpc.homebrewPdf.getUploadUrl.useMutation();
  const extractMutation = trpc.sessions.extractPrepFromNotes.useMutation();

  async function uploadFile(file: File): Promise<string> {
    const upload = await getUploadUrl.mutateAsync({
      filename: file.name,
      fileSize: file.size,
      campaignId,
    });
    if (upload.presignedUrl && upload.r2Key) {
      await fetch(upload.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      return upload.r2Url ?? '';
    }
    throw new Error('Upload failed');
  }

  async function runExtraction(url?: string, text?: string) {
    setState('extracting');
    const result = await extractMutation.mutateAsync({ sessionId, campaignId, url, text });

    const counts: Record<string, number> = {};
    if (result.strongStart) counts['strong-start'] = 1;
    if (result.scenes?.length) counts['scenes'] = result.scenes.length;
    if (result.secretsAndClues?.length) counts['secrets'] = result.secretsAndClues.length;
    if (result.npcs?.length) counts['npcs'] = result.npcs.length;
    if (result.monsters?.length) counts['monsters'] = result.monsters.length;
    if (result.rewards?.length) counts['rewards'] = result.rewards.length;
    if (result.looseThreads?.length) counts['threads'] = result.looseThreads.length;

    onExtracted(result, counts);
    setState('done');
  }

  async function handleFile(file: File) {
    try {
      setState('uploading');
      setError('');
      const url = await uploadFile(file);
      await runExtraction(url);
      setCollapsed(true);
    } catch (e: unknown) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  async function handlePaste() {
    if (!pastedText.trim()) return;
    try {
      setError('');
      await runExtraction(undefined, pastedText);
      setCollapsed(true);
    } catch (e: unknown) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Extraction failed');
    }
  }

  if (collapsed) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-sm"
        style={{ border: '1px solid hsl(35 35% 18%)', background: 'hsl(240 10% 10%)' }}>
        <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
          {lastImportedAt ? `Notes imported · ${new Date(lastImportedAt).toLocaleTimeString()}` : 'Notes imported'}
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCollapsed(false)}>
          Re-import
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-dashed border-amber-500/25 overflow-hidden"
      style={{ background: 'hsl(240 10% 9%)' }}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4" style={{ color: 'hsl(35 80% 55%)' }} />
          <p className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>Import Prep Notes</p>
          <span className="text-xs" style={{ color: 'hsl(35 10% 45%)' }}>— DM Brain will extract and fill sections</span>
        </div>

        {state === 'uploading' || state === 'extracting' ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-sm" style={{ color: 'hsl(35 10% 55%)' }}>
              {state === 'uploading' ? 'Uploading…' : 'Extracting prep content…'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-sm py-6 cursor-pointer transition-colors',
                dragging ? 'bg-amber-500/10 border-amber-500/40' : 'border border-dashed border-border/40 hover:border-border/60'
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6" style={{ color: 'hsl(35 40% 45%)' }} />
              <p className="text-xs" style={{ color: 'hsl(35 10% 45%)' }}>
                Drop a PDF, image, or{' '}
                <span style={{ color: 'hsl(35 80% 55%)' }}>browse</span>
              </p>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: 'hsl(35 10% 35%)' }}>or paste text</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>

            <Textarea
              placeholder="Paste your notes here — Obsidian, Google Docs, hand-typed session ideas…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              {lastImportedAt && (
                <Button variant="ghost" size="sm" onClick={() => setCollapsed(true)}>Cancel</Button>
              )}
              <Button size="sm" disabled={!pastedText.trim() && state !== 'idle'} onClick={handlePaste}>
                Extract with Brain
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
