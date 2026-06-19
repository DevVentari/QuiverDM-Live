import * as React from 'react';
import { cn } from '@/lib/utils';

export interface QdProgressProps {
  /** Progress value 0–100 */
  value: number;
  className?: string;
}

/**
 * QdProgress — token-only progress bar primitive.
 * Track: h-1 rounded-full bg-qd-border; fill: h-full bg-qd-accent at value%.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export function QdProgress({ value, className }: QdProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1 rounded-full bg-qd-border overflow-hidden', className)}
    >
      <div
        className="h-full bg-qd-accent transition-all duration-qd-base ease-qd-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
