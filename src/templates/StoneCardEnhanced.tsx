'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StoneCardEnhancedProps extends HTMLMotionProps<'div'> {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'inset' | 'elevated';
  children?: React.ReactNode;
}

/**
 * StoneCardEnhanced
 * 
 * An evolved version of the stone-card pattern with:
 * - Reactive grain texture
 * - Inner shadow for depth
 * - Chipped corner mask (simulated via CSS)
 * - Runic corner accents
 */
export const StoneCardEnhanced = React.forwardRef<HTMLDivElement, StoneCardEnhancedProps>(
  ({ className, title, subtitle, icon, footer, children, variant = 'default', ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          'stone-card glass-panel group relative flex flex-col overflow-hidden',
          variant === 'inset' && 'shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)]',
          variant === 'elevated' && 'shadow-[0_8px_30px_rgb(0,0,0,0.4)] border-amber-700/30',
          className
        )}
        {...props}
      >
        {/* Reactive Grain Overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.06] glass-grain" />

        {/* Amber Edge Glow (Bleed) */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),hsl(35_80%_55%_/_0.15),transparent_70%)]" />

        {/* Decorative Corner Runes (Top Right) */}
        <div className="absolute top-1 right-1 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2V8M22 2H16M22 2L14 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <circle cx="18" cy="6" r="1" fill="currentColor" />
          </svg>
        </div>

        {/* Header */}
        {(title || icon) && (
          <div className="stone-card-header flex items-center gap-3 bg-white/[0.02]">
            {icon && <div className="text-amber-500/80 group-hover:text-amber-400 transition-colors">{icon}</div>}
            <div className="flex flex-col min-w-0">
              {title && <span className="stone-card-title truncate">{title}</span>}
              {subtitle && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{subtitle}</span>}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="stone-card-body flex-1 relative z-10">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-border/40 bg-black/20 text-xs">
            {footer}
          </div>
        )}

        {/* "Chipped" corner detail */}
        <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
           <div className="absolute bottom-[-1px] right-[-1px] w-4 h-4 bg-background border-l border-t border-border/20 rotate-45 translate-x-1/2 translate-y-1/2" />
        </div>
      </motion.div>
    );
  }
);

StoneCardEnhanced.displayName = 'StoneCardEnhanced';
