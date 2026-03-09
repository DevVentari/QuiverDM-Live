'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Sparkles, Save } from 'lucide-react';

interface GenerateNpcDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  campaignId: string;
}

export function GenerateNpcDialog({ open, onClose, sessionId, campaignId }: GenerateNpcDialogProps) {
  const [hint, setHint] = useState('');
  const [result, setResult] = useState<{ name: string; role: string; trait: string; secret: string; voiceQuirk: string } | null>(null);

  const generate = trpc.sessions.generateQuickNpc.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(e.message),
  });

  const saveNpc = trpc.npcs.create.useMutation({
    onSuccess: () => {
      toast.success('NPC saved to campaign');
      onClose();
      setResult(null);
      setHint('');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    onClose();
    setResult(null);
    setHint('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Quick NPC
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Optional: gruff innkeeper, nervous merchant…"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !generate.isPending) {
                  generate.mutate({ sessionId, hint: hint || undefined });
                }
              }}
            />
            <Button
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={() => generate.mutate({ sessionId, hint: hint || undefined })}
              disabled={generate.isPending}
            >
              {generate.isPending ? 'Generating…' : 'Generate NPC'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-base text-foreground">{result.name}</div>
            <div className="text-muted-foreground italic">{result.role}</div>
            <div className="space-y-1 pt-1">
              <div><span className="text-xs uppercase tracking-widest text-muted-foreground">Trait </span>{result.trait}</div>
              <div><span className="text-xs uppercase tracking-widest text-muted-foreground">Secret </span>{result.secret}</div>
              <div><span className="text-xs uppercase tracking-widest text-muted-foreground">Voice </span>{result.voiceQuirk}</div>
            </div>
          </div>
        )}

        {result && (
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setResult(null); generate.reset(); }}>
              Regenerate
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={() => saveNpc.mutate({
                campaignId,
                name: result.name,
                description: `${result.role}. ${result.trait}`,
                secrets: result.secret,
              })}
              disabled={saveNpc.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              Save to Campaign
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
