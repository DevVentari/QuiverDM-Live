'use client';

import { useState } from 'react';
import { X, ExternalLink, Settings, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface FoundryPanelProps {
  campaignId: string;
  onClose: () => void;
  embedded?: boolean;
}

export function FoundryPanel({ campaignId, onClose, embedded = false }: FoundryPanelProps) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [draft, setDraft] = useState('');

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.foundry.getSettings.useQuery({ campaignId });
  const setUrl = trpc.foundry.setFoundryUrl.useMutation({
    onSuccess: () => {
      utils.foundry.getSettings.invalidate({ campaignId });
      setEditingUrl(false);
      toast.success('Foundry URL saved');
    },
    onError: (err) => toast.error(err.message),
  });

  const foundryUrl = data?.foundryUrl ?? null;
  const embedUrl = foundryUrl
    ? `${foundryUrl.replace(/\/game.*$/, '').replace(/\/$/, '')}/game?quiver=1`
    : null;

  const startEdit = () => {
    setDraft(foundryUrl ?? '');
    setEditingUrl(true);
  };

  const saveUrl = () => {
    if (!draft.trim()) return;
    setUrl.mutate({ campaignId, foundryUrl: draft.trim() });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      {/* Header bar */}
      {!embedded && (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-sm">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-sm text-muted-foreground">FoundryVTT</span>
          {foundryUrl && !editingUrl && (
            <>
              <span className="ml-1 truncate text-xs text-muted-foreground/60">{foundryUrl}</span>
              <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={startEdit}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <a href={foundryUrl} target="_blank" rel="noopener noreferrer">
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
                placeholder="http://192.168.1.x:30000"
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
          <Button variant="ghost" size="icon" className={`h-7 w-7 ${foundryUrl && !editingUrl ? '' : 'ml-auto'}`} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="relative flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {!isLoading && !foundryUrl && !editingUrl && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <Monitor className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-display text-sm text-foreground">Connect FoundryVTT</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your Foundry server URL to embed the canvas here.
                Install the <strong>quiver-embed</strong> module in Foundry first to enable embedding and hide the UI chrome.
              </p>
            </div>
            <Button size="sm" onClick={startEdit}>Set Foundry URL</Button>
          </div>
        )}

        {!isLoading && embedUrl && !editingUrl && (
          <iframe
            src={embedUrl}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen"
            title="FoundryVTT"
          />
        )}
      </div>
    </div>
  );
}
