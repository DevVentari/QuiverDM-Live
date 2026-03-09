'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

type Hook = {
  id: string;
  text: string;
  urgency: 'low' | 'medium' | 'high';
  createdSessionId?: string;
  status?: string;
  ageInSessions?: number;
};

const urgencyOrder = { high: 0, medium: 1, low: 2 } as const;

const urgencyStyles = {
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  medium: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  low: 'bg-muted/40 text-muted-foreground border-border',
} as const;

export function HookList({
  hooks,
  onResolve,
}: {
  hooks: Hook[];
  onResolve?: (hookId: string) => void;
}) {
  const openHooks = hooks
    .filter((h) => h.status !== 'resolved')
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  if (openHooks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No open hooks.</p>
    );
  }

  return (
    <ul data-testid="hook-list" className="space-y-2">
      {openHooks.map((hook) => (
        <li
          key={hook.id}
          className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5"
        >
          <Badge
            variant="outline"
            className={cn('mt-0.5 shrink-0 text-[10px] uppercase tracking-wider', urgencyStyles[hook.urgency])}
          >
            {hook.urgency}
          </Badge>
          <span className="flex-1 text-sm leading-snug">{hook.text}</span>
          {onResolve && (
            <Button
              data-testid="resolve-hook-btn"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onResolve(hook.id)}
              title="Mark resolved"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
