'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';

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
  campaignSlug,
  onDone,
}: {
  jobId: string;
  campaignSlug: string;
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
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Import complete</h1>
        </div>
        {state.errors.length > 0 && (
          <Card className="border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-sm">Some items had errors</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
                {state.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Button onClick={() => router.push(`/campaigns/${state.campaignSlug}`)}>
          Open Campaign
        </Button>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Import failed</h1>
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
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Importing vault…</h1>
        <Card>
          <CardContent className="pt-6">
            <ProgressView
              jobId={state.jobId}
              campaignSlug={state.campaignSlug}
              onDone={(errors) => setState({ phase: 'done', campaignSlug: state.campaignSlug, errors })}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Import Obsidian Vault</h1>
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>
            Zip your Obsidian vault folder and upload it. QuiverDM will extract NPCs, sessions,
            characters, and homebrew content automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                placeholder="Tales from The Bonfire Keep"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
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
              />
            </div>
            <div className="space-y-2">
              <Label>Vault ZIP</Label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select a ZIP file (max 50 MB)</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Import</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(options) as Array<keyof typeof options>).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={options[key]}
                      onChange={() => toggleOption(key)}
                    />
                    <span className="text-sm capitalize">{key}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
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
        </CardContent>
      </Card>
    </div>
  );
}
