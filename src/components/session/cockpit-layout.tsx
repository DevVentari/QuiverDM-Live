'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CockpitLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
}

export function CockpitLayout({ left, center, right, className }: CockpitLayoutProps) {
  return (
    <div
      className={cn(
        'hidden lg:grid h-[calc(100vh-200px)] overflow-hidden',
        className
      )}
      style={{
        gridTemplateColumns: '220px 1fr 300px',
        borderTop: '1px solid hsl(35 35% 18%)',
        marginLeft: '-2rem',
        marginRight: '-2rem',
      }}
    >
      {/* Left panel */}
      <div
        className="flex flex-col overflow-y-auto"
        style={{ borderRight: '1px solid hsl(35 35% 18%)' }}
      >
        {left}
      </div>

      {/* Center panel */}
      <div className="flex flex-col overflow-y-auto min-w-0">
        {center}
      </div>

      {/* Right panel */}
      <div
        className="flex flex-col overflow-y-auto"
        style={{ borderLeft: '1px solid hsl(35 35% 18%)' }}
      >
        {right}
      </div>
    </div>
  );
}

export function CockpitPanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 shrink-0"
      style={{ borderBottom: '1px solid hsl(35 35% 18%)' }}
    >
      <p className="label-overline">{title}</p>
      {children}
    </div>
  );
}
