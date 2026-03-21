'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Hook = {
  id: string;
  text: string;
  urgency: 'low' | 'medium' | 'high';
  createdSessionId?: string | null;
  status?: string;
  ageInSessions?: number;
  linkedEntityNames?: string[];
};

const urgencyOrder = { high: 0, medium: 1, low: 2 } as const;

const urgencyStyles = {
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  medium: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  low: 'bg-muted/40 text-muted-foreground border-border',
} as const;

export function HookList({
  hooks,
  onSelect,
}: {
  hooks: Hook[];
  onSelect?: (hook: Hook) => void;
}) {
  const [resolvedOpen, setResolvedOpen] = useState(false);

  const openHooks = hooks
    .filter((h) => h.status !== 'resolved')
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  const resolvedHooks = hooks.filter((h) => h.status === 'resolved');

  if (openHooks.length === 0 && resolvedHooks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No hooks.</p>
    );
  }

  return (
    <div className="space-y-2">
      {openHooks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No open hooks.</p>
      ) : (
        <ul data-testid="hook-list" className="space-y-2">
          {openHooks.map((hook) => (
            <li
              key={hook.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5',
                onSelect && 'cursor-pointer hover:bg-card/70 transition-colors'
              )}
              onClick={() => onSelect?.(hook)}
            >
              <Badge
                variant="outline"
                className={cn('mt-0.5 shrink-0 text-[10px] uppercase tracking-wider', urgencyStyles[hook.urgency])}
              >
                {hook.urgency}
              </Badge>
              <span className="flex-1 text-sm leading-snug">{hook.text}</span>
              {onSelect && (
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="resolve-hook-btn"
                  className="ml-auto shrink-0 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onSelect(hook); }}
                >
                  Resolve
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {resolvedHooks.length > 0 && (
        <div className="mt-3">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setResolvedOpen((v) => !v)}
          >
            {resolvedOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Resolved ({resolvedHooks.length})
          </button>
          {resolvedOpen && (
            <ul className="mt-2 space-y-1.5">
              {resolvedHooks.map((hook) => (
                <li
                  key={hook.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border/30 bg-muted/20 px-3 py-2',
                    onSelect && 'cursor-pointer hover:bg-muted/30 transition-colors'
                  )}
                  onClick={() => onSelect?.(hook)}
                >
                  <Badge
                    variant="outline"
                    className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {hook.urgency}
                  </Badge>
                  <span className="flex-1 text-sm leading-snug text-muted-foreground line-through">
                    {hook.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
