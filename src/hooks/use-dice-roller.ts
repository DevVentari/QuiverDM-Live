'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { rollDice } from '@/lib/dice';
import type { DiceRoll } from '@/lib/dice';
import { DiceRollerToast } from '@/components/dice-roller/DiceRollerToast';
import { createElement } from 'react';

/**
 * Hook that provides a `roll` function for rolling dice with animated toast feedback.
 *
 * Usage:
 * ```tsx
 * const { roll } = useDiceRoller();
 * const result = roll('1d20+5', 'Perception Check');
 * ```
 */
export function useDiceRoller() {
  const roll = useCallback((notation: string, label?: string): DiceRoll => {
    const result = rollDice(notation, label);

    toast.custom(
      (id) =>
        createElement(DiceRollerToast, {
          roll: result,
          onDismiss: () => toast.dismiss(id),
        }),
      { duration: 5000 }
    );

    return result;
  }, []);

  return { roll };
}
