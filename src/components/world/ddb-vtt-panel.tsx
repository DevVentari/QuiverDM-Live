'use client';

import { useState } from 'react';
import { X, ExternalLink, Settings, Map, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface DdbVttPanelProps {
  campaignId: string;
  onClose: () => void;
}

export function DdbVttPanel({ campaignId, onClose }: DdbVttPanelProps) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [draft, setDraft] = useState('');

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.foundry.getSettings.useQuery({ campaignId });
  const setUrl = trpc.foundry.setDdbVttUrl.useMutation({
    onSuccess: () => {
      utils.foundry.getSettings.invalidate({ campaignId });
      setEditingUrl(false);
      toast.success('DnD Beyond game URL saved');
    },
    onError: (err) => toast.error(err.message),
  });

  const ddbUrl = data?.ddbVttUrl ?? null;

  const startEdit = () => {
    setDraft(ddbUrl ?? 'https://maps.dndbeyond.com/');
    setEditingUrl(true);
  };

  const saveUrl = () => {
    if (!draft.trim()) return;
    setUrl.mutate({ campaignId, ddbVttUrl: draft.trim() });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      {/* Header bar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-sm">
        <Map className="h-4 w-4 text-[hsl(210,100%,56%)]" />
        <span className="font-display text-sm text-muted-foreground">D&amp;D Beyond VTT</span>
        {ddbUrl && !editingUrl && (
          <>
            <span className="ml-1 truncate text-xs text-muted-foreground/60">{ddbUrl}</span>
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={startEdit}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a href={ddbUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </>
        )}
        {editingUrl && (
          <div className="ml-2 flex flex-1 items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://maps.dndbeyond.com/game/..."
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && saveUrl()}
            />
            <Button size="sm" className="h-7 text-xs" onClick={saveUrl} disabled={!draft.trim() || setUrl.isPending}>
              Save
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingUrl(false)}>
              Cancel
            </Button>
          </div>
        )}
        <Button variant="ghost" size="icon" className={`h-7 w-7 ${ddbUrl && !editingUrl ? '' : 'ml-auto'}`} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {!isLoading && !ddbUrl && !editingUrl && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <Map className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-display text-sm text-foreground">Connect D&amp;D Beyond VTT</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your D&amp;D Beyond game session URL to embed the VTT here.
                Start a game in <strong>maps.dndbeyond.com</strong>, then paste the URL.
              </p>
            </div>
            <Button size="sm" onClick={startEdit}>Set game URL</Button>
            <div className="flex max-w-xs items-start gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 p-3 text-left">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/70" />
              <p className="text-xs text-muted-foreground">
                D&amp;D Beyond may block iframe embedding. If the panel shows a blank screen,
                open your game in a new tab first using the{' '}
                <ExternalLink className="inline h-3 w-3" /> button above, then return here.
              </p>
            </div>
          </div>
        )}

        {!isLoading && ddbUrl && !editingUrl && (
          <iframe
            src={ddbUrl}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen; camera; microphone"
            title="D&D Beyond VTT"
          />
        )}
      </div>
    </div>
  );
}
