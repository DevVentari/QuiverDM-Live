import * as React from 'react';
import { cn } from '@/lib/utils';

export type QdButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

export interface QdButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: QdButtonVariant;
}

const variantClasses: Record<QdButtonVariant, string> = {
  primary:
    'bg-qd-accent text-qd-on-accent font-qd-display font-bold rounded-qd-md ' +
    'hover:opacity-90 active:opacity-80',
  outline:
    'border border-qd-strong bg-white/5 text-qd-ink-2 rounded-qd-md ' +
    'hover:bg-white/10 active:bg-white/5',
  ghost:
    'bg-transparent text-qd-ink-muted rounded-qd-md ' +
    'hover:text-qd-ink active:text-qd-ink',
  danger:
    'border border-qd-danger text-qd-danger rounded-qd-md ' +
    'bg-transparent hover:bg-qd-danger/10 active:bg-qd-danger/5',
};

/**
 * QdButton — token-only button primitive.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export const QdButton = React.forwardRef<HTMLButtonElement, QdButtonProps>(
  ({ variant = 'primary', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base — all variants
          'inline-flex items-center justify-center gap-2',
          'min-h-[44px] px-4',
          'text-sm transition-colors',
          'disabled:opacity-50 disabled:pointer-events-none',
          'select-none cursor-pointer',
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
QdButton.displayName = 'QdButton';
