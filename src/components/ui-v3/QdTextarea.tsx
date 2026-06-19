import * as React from 'react';
import { cn } from '@/lib/utils';

export interface QdTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * QdTextarea — token-only textarea primitive.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export const QdTextarea = React.forwardRef<HTMLTextAreaElement, QdTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-qd-md border border-qd-strong bg-black/20',
          'px-3 py-2 text-qd-ink',
          'placeholder:text-qd-ink-faint',
          'focus:outline-none focus:border-qd-accent',
          'resize-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);
QdTextarea.displayName = 'QdTextarea';
