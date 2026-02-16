'use client';

import { useState } from 'react';
import { Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type LongRestDialogProps = {
  data: any;
  onFinish: (patch: { hitPoints?: any; hitDice?: any; spellcasting?: any; features?: any }) => Promise<void>;
  disabled?: boolean;
};

function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input));
}

export function LongRestDialog({ data, onFinish, disabled }: LongRestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hp = (data.hitPoints as any) ?? { current: 1, max: 1, temp: 0 };
  const hitDice = ((data.hitDice as any[]) ?? []).map((hd) => ({
    die: hd.die,
    total: Number(hd.total || 0),
    used: Number(hd.used || 0),
  }));
  const spellcasting = clone((data.spellcasting as any) ?? null);
  const features = clone((data.features as any) ?? {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Sun className="h-4 w-4 mr-1" />
          Long Rest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take Long Rest?</DialogTitle>
          <DialogDescription>
            Restores HP and spell slots, and recovers half of spent hit dice (minimum 1).
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            onClick={async () => {
              setIsSaving(true);
              try {
                const nextHitDice = clone(hitDice);
                const totalDice = nextHitDice.reduce((sum, hd) => sum + hd.total, 0);
                let recover = Math.max(1, Math.floor(totalDice / 2));
                for (const hd of nextHitDice) {
                  if (recover <= 0) break;
                  const spent = Math.max(0, hd.used);
                  const recovered = Math.min(spent, recover);
                  hd.used -= recovered;
                  recover -= recovered;
                }

                if (spellcasting?.slots) {
                  for (const key of Object.keys(spellcasting.slots)) {
                    spellcasting.slots[key].used = 0;
                  }
                }

                features._quiver = features._quiver ?? {};
                features._quiver.deathSaves = { successes: 0, failures: 0 };

                await onFinish({
                  hitPoints: { ...hp, current: hp.max, temp: 0 },
                  hitDice: nextHitDice,
                  ...(spellcasting ? { spellcasting } : {}),
                  features,
                });
                setOpen(false);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Confirm Long Rest'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

