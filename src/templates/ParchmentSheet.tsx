'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ParchmentSheetProps extends HTMLMotionProps<'div'> {
  title?: string;
  variant?: 'default' | 'torn' | 'royal';
  children?: React.ReactNode;
}

/**
 * ParchmentSheet
 * 
 * A light-themed, tactile paper component for notes, letters, and scrolls.
 * Provides a warm contrast to the heavy dark stone UI.
 */
export const ParchmentSheet = React.forwardRef<HTMLDivElement, ParchmentSheetProps>(
  ({ className, title, variant = 'default', children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'relative p-6 sm:p-8 overflow-hidden',
          // Base parchment color (warm cream/amber)
          'bg-[oklch(0.95_0.02_85)] text-[oklch(0.25_0.02_85)]',
          'shadow-[0_4px_24px_rgba(0,0,0,0.15),inset_0_0_40px_rgba(0,0,0,0.05)]',
          variant === 'torn' && 'rounded-sm',
          variant !== 'torn' && 'rounded-lg',
          variant === 'royal' && 'border-4 border-double border-amber-800/20',
          className
        )}
        {...props}
      >
        {/* Fiber Texture Overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] mix-blend-multiply" />
        
        {/* Subtle Gradient for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/5" />

        {/* Torn Edge Effect (Simulated via SVG mask or pseudo-elements) */}
        {variant === 'torn' && (
          <div
            className="absolute top-0 left-0 right-0 h-1 -translate-y-[2px]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='100%25' height='4' viewBox='0 0 100 4' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 4L5 0L10 4L15 2L20 4L25 1L30 4L35 0L40 4L45 2L50 4L55 1L60 4L65 0L70 4L75 2L80 4L85 1L90 4L95 0L100 4' fill='%23f9f5e8'/%3E%3C/svg%3E\")",
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 space-y-4">
          {title && (
            <h3 className="font-display text-xl sm:text-2xl font-bold border-b border-amber-900/10 pb-2 mb-4 text-amber-950">
              {title}
            </h3>
          )}
          <div className="prose prose-sm prose-amber max-w-none text-inherit leading-relaxed">
            {children}
          </div>
        </div>

        {/* Decorative Watermark */}
        <div className="absolute bottom-4 right-4 opacity-5 pointer-events-none">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
          </svg>
        </div>
      </motion.div>
    );
  }
);

ParchmentSheet.displayName = 'ParchmentSheet';
