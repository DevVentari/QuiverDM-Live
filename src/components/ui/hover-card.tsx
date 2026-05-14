'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function HoverCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('group relative inline-flex', className)}>{children}</div>;
}

export function HoverCardTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('inline-flex', className)}>{children}</span>;
}

export function HoverCardContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'pointer-events-none absolute left-0 top-full z-50 mt-3 w-80 opacity-0 invisible translate-y-1',
        'transition duration-150 ease-out group-hover:pointer-events-auto group-hover:opacity-100 group-hover:visible group-hover:translate-y-0',
        'rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-raised)] shadow-2xl backdrop-blur-xl',
        'p-3 text-left',
        className,
      )}
    >
      {children}
    </div>
  );
}
