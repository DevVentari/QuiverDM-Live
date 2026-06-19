'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface QdPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * QdPanel — token-only right-sheet panel primitive.
 * Slides in from the right with Framer Motion AnimatePresence.
 * Width: min(42rem, 100vw-1rem). Full dvh height.
 * Closes on Escape key or backdrop click.
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export function QdPanel({ open, onOpenChange, title, children, className }: QdPanelProps) {
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
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={title ? 'qd-panel-title' : undefined}>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => onOpenChange(false)}
          />

          {/* Right sheet */}
          <motion.div
            className={cn(
              'absolute inset-y-0 right-0',
              'w-[min(42rem,calc(100vw-1rem))] h-[100dvh]',
              'bg-qd-surface border-l border-qd',
              'flex flex-col',
              'shadow-qd-panel',
              'overflow-y-auto',
              className,
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-qd shrink-0">
                <h2
                  id="qd-panel-title"
                  className="font-qd-display text-qd-title text-qd-ink-strong"
                >
                  {title}
                </h2>
                <button
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-qd-ink-muted hover:text-qd-ink transition-colors"
                  aria-label="Close panel"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
