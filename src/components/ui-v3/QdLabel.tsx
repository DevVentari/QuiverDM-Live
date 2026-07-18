import * as React from 'react';
import { cn } from '@/lib/utils';

export interface QdLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/**
 * QdLabel — token-only label primitive.
 * Renders as a mono overline label in muted ink.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export const QdLabel = React.forwardRef<HTMLLabelElement, QdLabelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'font-qd-mono text-[11px] uppercase tracking-[0.12em] text-qd-ink-muted',
          className,
        )}
        {...props}
      >
        {children}
      </label>
    );
  },
);
QdLabel.displayName = 'QdLabel';
