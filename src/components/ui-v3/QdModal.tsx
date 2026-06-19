'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface QdModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * QdModal — token-only modal primitive.
 * Fixed inset-0 backdrop + centered card with Framer Motion fade/scale.
 * Closes on Escape key or backdrop click.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export function QdModal({ open, onOpenChange, title, children, className }: QdModalProps) {
  const titleId = React.useId();

  // Escape key handler
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50"
          aria-modal="true"
          role="dialog"
          aria-labelledby={title ? titleId : undefined}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => onOpenChange(false)}
          />

          {/* Centered card */}
          <div className="relative flex items-center justify-center min-h-full p-4 pointer-events-none">
            <motion.div
              className={cn(
                'relative pointer-events-auto',
                'w-full max-w-lg',
                'bg-qd-surface border border-qd-accent rounded-qd-panel',
                'shadow-qd-panel',
                'p-6',
                className,
              )}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {/* Close button */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-qd-md text-qd-ink-muted hover:text-qd-ink transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
              {title && (
                <h2
                  id={titleId}
                  className="font-qd-display text-qd-title text-qd-ink-strong mb-4"
                >
                  {title}
                </h2>
              )}
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
