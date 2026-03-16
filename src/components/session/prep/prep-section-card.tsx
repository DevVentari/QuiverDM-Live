'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PrepSectionCardProps {
  id: string;
  title: string;
  description: string;
  suggestedCount?: number;
  defaultOpen?: boolean;
  onExpand?: () => void;
  children: React.ReactNode;
}

export function PrepSectionCard({
  id,
  title,
  description,
  suggestedCount,
  defaultOpen = false,
  onExpand,
  children,
}: PrepSectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && onExpand) onExpand();
  };

  return (
    <div
      id={`section-${id}`}
      className="rounded-sm border border-border/40 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
        boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
      }}
    >
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>{title}</p>
          {!open && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'hsl(35 10% 45%)' }}>{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {suggestedCount != null && suggestedCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10"
            >
              <Sparkles className="h-2.5 w-2.5" />
              {suggestedCount} suggested
            </Badge>
          )}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
            style={{ color: 'hsl(35 10% 40%)' }}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/30">
          {children}
        </div>
      )}
    </div>
  );
}
