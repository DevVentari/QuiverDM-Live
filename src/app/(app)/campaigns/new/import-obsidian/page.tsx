'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';

type ImportState =
  | { phase: 'form' }
  | { phase: 'uploading' }
  | { phase: 'processing'; jobId: string; campaignSlug: string }
  | { phase: 'done'; campaignSlug: string; errors: string[] }
  | { phase: 'error'; message: string };

interface Progress {
  total: number;
  done: number;
  currentFile: string;
  errors: string[];
}

function ProgressView({
  jobId,
  onDone,
}: {
  jobId: string;
  onDone: (errors: string[]) => void;
}) {
  const { data } = trpc.obsidian.getImportStatus.useQuery(
    { jobId },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'done' || status === 'error' ? false : 2000;
      },
    }
  );

  useEffect(() => {
    if (data?.status === 'done' || data?.status === 'error') {
      const progress = data.progress as Progress | null;
      onDone(progress?.errors ?? []);
    }
  }, [data?.status]);

  const progress = data?.progress as Progress | null;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{progress?.currentFile || 'Starting…'}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress && (
        <p className="text-xs text-muted-foreground">
          {progress.done} / {progress.total} items
        </p>
      )}
    </div>
  );
}

const IMPORT_OPTIONS = [
  { key: 'npcs' as const, label: 'NPCs' },
  { key: 'sessions' as const, label: 'Sessions' },
  { key: 'characters' as const, label: 'Characters' },
  { key: 'homebrew' as const, label: 'Homebrew' },
] as const;

export default function ImportObsidianPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({ phase: 'form' });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState({ npcs: true, sessions: true, characters: true, homebrew: true });

  function toggleOption(key: keyof typeof options) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast({ title: 'No file selected', description: 'Please choose a ZIP file of your vault.', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: 'Campaign name required', variant: 'destructive' });
      return;
    }

    setState({ phase: 'uploading' });

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      if (description.trim()) fd.append('description', description.trim());
      fd.append('npcs', String(options.npcs));
      fd.append('sessions', String(options.sessions));
      fd.append('characters', String(options.characters));
      fd.append('homebrew', String(options.homebrew));

      const res = await fetch('/api/uploads/obsidian-vault', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        setState({ phase: 'error', message: json.error || 'Upload failed' });
        return;
      }

      setState({ phase: 'processing', jobId: json.jobId, campaignSlug: json.campaignSlug });
    } catch (err: any) {
      setState({ phase: 'error', message: err.message || 'Upload failed' });
    }
  }

  if (state.phase === 'done') {
    return (
      <div className="max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <h1 className="font-display text-2xl font-bold">Import complete</h1>
        </div>
        {state.errors.length > 0 && (
          <div className="glass-panel glass-grain rounded-xl p-4 border border-amber-500/20">
            <p className="label-overline mb-1">Import warnings</p>
            <div className="section-rule mb-3" />
            <ul className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <Button onClick={() => router.push(`/campaigns/${state.campaignSlug}`)}>
          Open Campaign
        </Button>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <h1 className="font-display text-2xl font-bold">Import failed</h1>
        </div>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button variant="outline" onClick={() => setState({ phase: 'form' })}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.phase === 'processing') {
    return (
      <div className="max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <p className="label-overline mb-1">Import</p>
          <h1 className="font-display text-2xl font-bold tracking-wide">Importing vault…</h1>
        </div>
        <div className="glass-panel glass-grain rounded-xl p-6">
          <ProgressView
            jobId={state.jobId}
            onDone={(errors) => setState({ phase: 'done', campaignSlug: state.campaignSlug, errors })}
          />
        </div>
      </div>
    );
  }

  return (
    <CreatePageShell
      overline="Import"
      title="Import Obsidian Vault"
      preview={
        <div className="glass-panel glass-grain rounded-xl p-5 space-y-3 border border-border">
          <p className="label-overline">What gets imported</p>
          <div className="section-rule" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>NPCs extracted from markdown files</li>
            <li>Session notes converted to session records</li>
            <li>Character sheets and player notes</li>
            <li>Homebrew items, spells, and monsters</li>
          </ul>
          <p className="text-xs text-muted-foreground/60 pt-2">
            Zip your Obsidian vault folder and upload it. QuiverDM extracts content automatically.
          </p>
        </div>
      }
    >
      <div className="glass-panel glass-grain rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <p className="label-overline">Campaign Details</p>
            <div className="section-rule" />
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="Tales from The Bonfire Keep"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional campaign description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="label-overline">Vault ZIP</p>
            <div className="section-rule" />
            <div
              className="relative rounded-lg border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors cursor-pointer overflow-hidden"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="h-24 flex flex-col items-center justify-center gap-2">
                {file ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <p className="text-sm font-medium">{file.name}</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground/50">Drop a ZIP file or click to upload (max 50 MB)</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="label-overline">Import</p>
            <div className="section-rule" />
            <div className="grid grid-cols-2 gap-2">
              {IMPORT_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={options[key]}
                    onChange={() => toggleOption(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={state.phase === 'uploading'}>
              {state.phase === 'uploading' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                'Import Vault'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </CreatePageShell>
  );
}
