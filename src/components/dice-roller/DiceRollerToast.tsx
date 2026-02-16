'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { DiceRoll } from '@/lib/dice';
import { DieIcon } from './DieIcon';
import { cn } from '@/lib/utils';

type DiceRollerToastProps = {
  roll: DiceRoll;
  onDismiss: () => void;
};

function formatModifier(mod: number): string {
  if (mod > 0) return `+${mod}`;
  if (mod < 0) return `${mod}`;
  return '';
}

export function DiceRollerToast({ roll, onDismiss }: DiceRollerToastProps) {
  const isCritical = roll.isCritical === true;
  const isFumble = roll.isFumble === true;

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'w-[356px] rounded-lg border bg-card p-3 shadow-lg',
        isCritical && 'border-amber-400/50 shadow-amber-400/20',
        isFumble && 'border-red-400/50 shadow-red-400/20',
        !isCritical && !isFumble && 'border-border'
      )}
    >
      {/* Header row: label + die type + dismiss */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <DieIcon
            sides={roll.dieType}
            size={20}
            className={cn(
              'text-muted-foreground',
              isCritical && 'text-amber-400',
              isFumble && 'text-red-400'
            )}
          />
          {roll.label ? (
            <span className="text-sm font-medium text-foreground truncate">
              {roll.label}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {roll.notation}
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Dice results row */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Individual die results */}
          {roll.rolls.map((value, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 20,
                delay: i * 0.05,
              }}
              className={cn(
                'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-1.5 text-xs font-bold tabular-nums',
                'bg-secondary border-border text-foreground',
                isCritical && value === 20 && 'bg-amber-400/15 border-amber-400/40 text-amber-400',
                isFumble && value === 1 && 'bg-red-400/15 border-red-400/40 text-red-400'
              )}
            >
              {value}
            </motion.span>
          ))}

          {/* Modifier */}
          {roll.modifier !== 0 && (
            <span className="text-xs text-muted-foreground tabular-nums font-medium">
              {formatModifier(roll.modifier)}
            </span>
          )}
        </div>

        {/* Total */}
        <motion.div
          initial={{ scale: 0.3 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 20,
            delay: 0.15,
          }}
          className="flex items-center gap-1.5 shrink-0"
        >
          {isCritical && (
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
              Critical!
            </span>
          )}
          {isFumble && (
            <span className="text-xs font-bold text-red-400 uppercase tracking-wide">
              Fumble!
            </span>
          )}
          <span
            className={cn(
              'text-xl font-bold tabular-nums',
              isCritical && 'text-amber-400',
              isFumble && 'text-red-400',
              !isCritical && !isFumble && 'text-foreground'
            )}
          >
            {roll.total}
          </span>
        </motion.div>
      </div>

      {/* Notation subtitle when label is present */}
      {roll.label && (
        <div className="mt-1">
          <span className="text-xs text-muted-foreground">{roll.notation}</span>
        </div>
      )}
    </motion.div>
  );
}
