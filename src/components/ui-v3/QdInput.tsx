import * as React from 'react';
import { cn } from '@/lib/utils';

export interface QdInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * QdInput — token-only input primitive.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export const QdInput = React.forwardRef<HTMLInputElement, QdInputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'w-full rounded-qd-md border border-qd-strong bg-black/20',
          'px-3 py-2 text-qd-ink',
          'placeholder:text-qd-ink-faint',
          'focus:outline-none focus:border-qd-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);
QdInput.displayName = 'QdInput';
