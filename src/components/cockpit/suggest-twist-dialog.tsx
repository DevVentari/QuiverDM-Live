'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

interface SuggestTwistDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}

export function SuggestTwistDialog({ open, onClose, sessionId }: SuggestTwistDialogProps) {
  const [hint, setHint] = useState('');
  const [twists, setTwists] = useState<string[]>([]);

  const suggest = trpc.sessions.suggestTwist.useMutation({
    onSuccess: (data) => setTwists(data.twists),
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    onClose();
    setTwists([]);
    setHint('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Suggest Twist
          </DialogTitle>
        </DialogHeader>

        {twists.length === 0 ? (
          <div className="space-y-3">
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Optional: betrayal, monster ambush…"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !suggest.isPending) {
                  suggest.mutate({ sessionId, hint: hint || undefined });
                }
              }}
            />
            <Button
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={() => suggest.mutate({ sessionId, hint: hint || undefined })}
              disabled={suggest.isPending}
            >
              {suggest.isPending ? 'Generating…' : 'Suggest Twists'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {twists.map((twist, i) => (
              <div key={i} className="rounded border border-border bg-card/50 p-2.5 text-sm">
                <span className="text-amber-400 font-mono text-xs mr-2">{i + 1}.</span>
                {twist}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { setTwists([]); suggest.reset(); }}>
              Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
