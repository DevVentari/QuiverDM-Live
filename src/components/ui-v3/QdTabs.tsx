'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface QdTabItem {
  key: string;
  label: string;
}

export interface QdTabsProps {
  tabs: QdTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * QdTabs — token-only segmented tab primitive.
 * Active: bg-[rgba(217,138,61,.12)] border-qd-accent text-qd-accent-text
 * Inactive: border-qd-faint text-qd-ink-2
 * Uses only --qd-* CSS vars via Tailwind qd-* utilities.
 * No shadcn/ui imports. No v2 tokens.
 */
export function QdTabs({ tabs, value, onValueChange, children, className }: QdTabsProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab bar */}
      <div className="flex gap-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === value;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onValueChange(tab.key)}
              className={cn(
                'min-h-[44px] px-4 text-sm rounded-qd-md border transition-colors',
                'font-qd-mono uppercase tracking-[0.08em] text-[11px]',
                'focus:outline-none',
                isActive
                  ? 'bg-[rgba(217,138,61,.12)] border-qd-accent text-qd-accent-text'
                  : 'border-qd-faint text-qd-ink-2 hover:text-qd-ink hover:border-qd-strong',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Content */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
