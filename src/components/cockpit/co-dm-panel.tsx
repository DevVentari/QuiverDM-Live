'use client';

import { useState } from 'react';
import { Bot } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { CoDMSettings } from './co-dm-settings';
import { CoDMAlert } from './co-dm-alert';
import type { CoDMPermissionLevel, CoDMSuggestion, CoDMConfidence } from '@/lib/co-dm/types';
import { shouldSurface } from '@/lib/co-dm/decision-engine';

interface CoDMPanelProps {
  sessionId: string;
}

const CONFIDENCE_STYLES: Record<CoDMConfidence, string> = {
  silent: 'hidden',
  hint: 'border-border/40 text-muted-foreground',
  highlight: 'border-amber-400/40 text-amber-200 bg-amber-400/5',
  alert: 'border-destructive/40 text-destructive bg-destructive/5',
};

const TYPE_LABELS: Record<CoDMSuggestion['type'], string> = {
  pacing: 'Pacing',
  npc_consistency: 'NPC',
  rule_reminder: 'Rule',
  engagement: 'Engagement',
  lore_continuity: 'Lore',
};

export function CoDMPanel({ sessionId }: CoDMPanelProps) {
  const [permissionLevel, setPermissionLevel] = useState<CoDMPermissionLevel>('Assist');

  const suggestionsQuery = trpc.brain.coDM.suggestions.useQuery(
    { sessionId },
    { refetchInterval: 30_000 }
  );

  const dismissMutation = trpc.brain.coDM.dismiss.useMutation({
    onSuccess: () => suggestionsQuery.refetch(),
  });

  const rawSuggestions: CoDMSuggestion[] = (suggestionsQuery.data as CoDMSuggestion[]) ?? [];

  const visibleSuggestions = rawSuggestions.filter(
    (s) => !s.dismissed && shouldSurface(s, permissionLevel)
  );

  const alertSuggestion = visibleSuggestions.find((s) => s.confidence === 'alert');

  const handleDismiss = (id: string) => {
    dismissMutation.mutate({ sessionId, suggestionId: id });
  };

  return (
    <>
      {alertSuggestion && (
        <CoDMAlert
          suggestion={alertSuggestion}
          onDismiss={() => handleDismiss(alertSuggestion.id)}
        />
      )}

      <div className="space-y-4">
        <CoDMSettings value={permissionLevel} onChange={setPermissionLevel} />

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Suggestions
            </span>
            {visibleSuggestions.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-400/20 px-1.5 py-0 text-[9px] text-amber-300">
                {visibleSuggestions.length}
              </span>
            )}
          </div>

          {suggestionsQuery.isLoading ? (
            <p className="text-[10px] italic text-muted-foreground/60 pl-5">Listening...</p>
          ) : visibleSuggestions.length === 0 ? (
            <p className="text-[10px] italic text-muted-foreground/50 pl-5">
              No suggestions yet — listening...
            </p>
          ) : (
            <ul className="space-y-1.5 pl-5">
              {visibleSuggestions.map((s) => (
                <li
                  key={s.id}
                  className={[
                    'rounded border px-2 py-1.5',
                    CONFIDENCE_STYLES[s.confidence] ?? CONFIDENCE_STYLES.hint,
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">
                          {TYPE_LABELS[s.type]}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium leading-snug">{s.message}</p>
                      {s.detail && (
                        <p className="text-[10px] opacity-70 leading-snug">{s.detail}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismiss(s.id)}
                      className="shrink-0 text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
