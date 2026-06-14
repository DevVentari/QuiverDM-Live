'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Play, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

interface VoiceRowProps {
  campaignId: string;
  entityId: string;
}

export function VoiceRow({ campaignId, entityId }: VoiceRowProps) {
  const utils = trpc.useUtils();
  const clipsQuery = trpc.voice.getClipsForEntity.useQuery(
    { campaignId, entityId },
    {
      // Poll while a clip is still generating.
      refetchInterval: (q) => {
        const clips = q.state.data;
        const generating = clips?.some((c) => c.status === 'pending' || c.status === 'processing');
        return generating ? 2000 : false;
      },
    }
  );
  const regenerate = trpc.voice.regenerateSignature.useMutation({
    onSuccess: () => utils.voice.getClipsForEntity.invalidate({ campaignId, entityId }),
  });

  const signature = clipsQuery.data?.find((c) => c.kind === 'signature');
  const [audio] = useState(() => (typeof Audio !== 'undefined' ? new Audio() : null));

  function play(url: string) {
    if (!audio) return;
    audio.src = url;
    void audio.play();
  }

  return (
    <div data-testid="voice-row" className="flex items-center gap-2 rounded-sm border border-border/40 bg-card/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Voice</span>

      {!signature && <span className="text-xs text-muted-foreground">No voice yet</span>}

      {signature?.status === 'ready' && signature.audioUrl && (
        <Button size="sm" variant="ghost" data-testid="voice-play" onClick={() => play(signature.audioUrl!)}>
          <Play className="h-4 w-4" /> Play
        </Button>
      )}

      {(signature?.status === 'pending' || signature?.status === 'processing') && (
        <span data-testid="voice-pending" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Generating voice…
        </span>
      )}

      {signature?.status === 'failed' && (
        <span data-testid="voice-failed" className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> Voice unavailable
        </span>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="ml-auto"
        data-testid="voice-regenerate"
        disabled={regenerate.isPending}
        onClick={() => regenerate.mutate({ campaignId, entityId })}
      >
        <RefreshCw className="h-4 w-4" /> Regenerate
      </Button>
    </div>
  );
}
