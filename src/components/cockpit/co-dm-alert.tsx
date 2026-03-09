'use client';

import { X } from 'lucide-react';
import type { CoDMSuggestion } from '@/lib/co-dm/types';

interface CoDMAlertProps {
  suggestion: CoDMSuggestion;
  onDismiss: () => void;
}

const TYPE_LABELS: Record<CoDMSuggestion['type'], string> = {
  pacing: 'Pacing',
  npc_consistency: 'NPC',
  rule_reminder: 'Rule',
  engagement: 'Engagement',
  lore_continuity: 'Lore',
};

export function CoDMAlert({ suggestion, onDismiss }: CoDMAlertProps) {
  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 rounded-lg border border-destructive/40 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">
              Co-DM Alert · {TYPE_LABELS[suggestion.type]}
            </span>
          </div>
          <p className="text-xs font-medium text-foreground">{suggestion.message}</p>
          {suggestion.detail && (
            <p className="text-[11px] text-muted-foreground leading-snug">{suggestion.detail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
