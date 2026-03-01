'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useDiceRoller } from '@/hooks/use-dice-roller';
import { ModeSwitcher } from './mode-switcher';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Dices, X } from 'lucide-react';
import { toast } from 'sonner';

const QUICK_ROLLS = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'];

interface CockpitToolbarProps {
  sessionId: string;
  slug: string;
  mode: 'rp' | 'combat';
  onToggleMode: () => void;
}

function DiceRollerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { roll } = useDiceRoller();
  const [notation, setNotation] = useState('1d20');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="h-4 w-4" />
            Dice Roller
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={notation}
              onChange={(e) => setNotation(e.target.value)}
              placeholder="e.g. 2d6+3"
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  roll(notation, 'Roll');
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 px-3"
              onClick={() => roll(notation, 'Roll')}
            >
              Roll
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_ROLLS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setNotation(d);
                  roll(d, d);
                }}
                className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EndSessionDialog({
  open,
  onClose,
  sessionId,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  slug: string;
}) {
  const utils = trpc.useUtils();

  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      toast.success('Session completed — summary pipeline started');
      window.location.href = `/campaigns/${slug}/sessions/${sessionId}`;
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>End Session?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will mark the session as complete and trigger the AI summary pipeline (session summary, player recap, derailment analysis).
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Keep Playing
          </Button>
          <Button
            onClick={() => completeSession.mutate({ id: sessionId })}
            disabled={completeSession.isPending}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            {completeSession.isPending ? 'Ending…' : 'End Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CockpitToolbar({ sessionId, slug, mode, onToggleMode }: CockpitToolbarProps) {
  const [diceOpen, setDiceOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 border-t border-border bg-background/80 px-4 py-2 shrink-0 backdrop-blur-sm">
        <ModeSwitcher mode={mode} onToggle={onToggleMode} />

        <div className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setDiceOpen(true)}
        >
          <Dices className="h-3.5 w-3.5" />
          Roll
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setEndOpen(true)}
        >
          <X className="h-3.5 w-3.5" />
          End Session
        </Button>
      </div>

      <DiceRollerDialog open={diceOpen} onClose={() => setDiceOpen(false)} />
      <EndSessionDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        sessionId={sessionId}
        slug={slug}
      />
    </>
  );
}
