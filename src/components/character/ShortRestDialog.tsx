'use client';

import { useMemo, useState } from 'react';
import { Moon } from 'lucide-react';
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
import type { DiceRoll } from '@/lib/dice';

type ShortRestDialogProps = {
  data: any;
  onRoll: (notation: string, label?: string) => DiceRoll;
  onFinish: (patch: { hitPoints?: any; hitDice?: any; spellcasting?: any }) => Promise<void>;
  disabled?: boolean;
};

function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input));
}

export function ShortRestDialog({ data, onRoll, onFinish, disabled }: ShortRestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hitPoints = (data.hitPoints as any) ?? { current: 1, max: 1, temp: 0 };
  const hitDice = ((data.hitDice as any[]) ?? []).map((hd) => ({
    die: hd.die,
    total: Number(hd.total || 0),
    used: Number(hd.used || 0),
  }));
  const conMod = Math.floor((((data.abilityScores as any)?.con ?? 10) - 10) / 2);
  const isWarlock =
    ((data.class as string | undefined)?.toLowerCase().includes('warlock') ?? false) ||
    (((data.classes as any[]) ?? []).some((c) =>
      String(c?.name ?? '')
        .toLowerCase()
        .includes('warlock')
    ) ?? false);

  const [localHp, setLocalHp] = useState(hitPoints.current);
  const [localHitDice, setLocalHitDice] = useState(hitDice);

  const totalRemaining = useMemo(
    () =>
      localHitDice.reduce(
        (acc, hd) => acc + Math.max(0, Number(hd.total || 0) - Number(hd.used || 0)),
        0
      ),
    [localHitDice]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (next) {
          setLocalHp(hitPoints.current);
          setLocalHitDice(clone(hitDice));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Moon className="h-4 w-4 mr-1" />
          Short Rest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take Short Rest</DialogTitle>
          <DialogDescription>
            Spend hit dice to recover HP. Warlock pact slots recover when you finish.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm">
            HP: <span className="font-semibold">{localHp}</span> / {hitPoints.max}
          </div>
          <div className="space-y-2">
            {localHitDice.map((hd, idx) => {
              const dieSides = Number(String(hd.die ?? '').replace(/[^\d]/g, '')) || 0;
              const remaining = Math.max(0, hd.total - hd.used);
              return (
                <div key={`${hd.die}-${idx}`} className="flex items-center justify-between rounded border p-2">
                  <div className="text-sm">
                    {hd.die}: {remaining}/{hd.total}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={remaining <= 0 || dieSides <= 0}
                    onClick={() => {
                      const result = onRoll(
                        `1d${dieSides}${conMod === 0 ? '' : conMod > 0 ? `+${conMod}` : `${conMod}`}`,
                        `Hit Die (${hd.die})`
                      );
                      setLocalHp((prev: number) => Math.min(hitPoints.max, prev + result.total));
                      setLocalHitDice((prev) =>
                        prev.map((entry, i) => (i === idx ? { ...entry, used: entry.used + 1 } : entry))
                      );
                    }}
                  >
                    Roll
                  </Button>
                </div>
              );
            })}
            {localHitDice.length === 0 && (
              <div className="text-sm text-muted-foreground">No hit dice available.</div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Remaining hit dice: {totalRemaining}</div>
        </div>

        <DialogFooter>
          <Button
            onClick={async () => {
              setIsSaving(true);
              try {
                const spellcasting = clone((data.spellcasting as any) ?? null);
                if (isWarlock && spellcasting?.slots) {
                  for (const key of Object.keys(spellcasting.slots)) {
                    spellcasting.slots[key].used = 0;
                  }
                }
                await onFinish({
                  hitPoints: {
                    ...hitPoints,
                    current: localHp,
                  },
                  hitDice: localHitDice,
                  ...(spellcasting ? { spellcasting } : {}),
                });
                setOpen(false);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Finish Rest'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
