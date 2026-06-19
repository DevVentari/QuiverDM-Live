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
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabs.findIndex((t) => t.key === value);
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    onValueChange(tabs[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab bar */}
      <div className="flex gap-1" role="tablist" onKeyDown={handleKeyDown}>
        {tabs.map((tab, index) => {
          const isActive = tab.key === value;
          return (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
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
