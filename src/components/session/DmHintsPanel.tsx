'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DmHint } from '@/hooks/useLiveTranscription';

interface DmHintsPanelProps {
  hints: DmHint[];
  onDismiss: (index: number) => void;
}

export function DmHintsPanel({ hints, onDismiss }: DmHintsPanelProps) {
  // Auto-expire hints older than 60s via interval
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (hints.length === 0) return;
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 5_000);
    return () => clearInterval(interval);
  }, [hints.length]);

  const now = Date.now();
  const activeHints = hints.filter((h) => now - h.receivedAt < 60_000);

  if (activeHints.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-20 w-72 space-y-2">
      {activeHints.map((hint, idx) => (
        <div
          key={idx}
          className={`rounded-lg border p-3 shadow-md backdrop-blur-sm ${
            hint.priority === 'important'
              ? 'bg-amber-950/90 border-amber-700/50'
              : 'bg-card/90 border-border'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="shrink-0 mt-0.5">
              {hint.priority === 'important' ? (
                <AlertCircle className="h-4 w-4 text-amber-400" />
              ) : (
                <Sparkles className="h-4 w-4 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">{hint.text}</p>
              {hint.effectName && (
                <Badge variant="outline" className="mt-1.5 text-[10px] h-4">
                  {hint.effectName}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 -mt-0.5 -mr-1 opacity-60 hover:opacity-100"
              onClick={() => onDismiss(idx)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
