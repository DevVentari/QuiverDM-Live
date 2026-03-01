'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAutoSave } from '@/hooks/use-auto-save';
import type { DmHint } from '@/hooks/useLiveTranscription';
import { Sparkles } from 'lucide-react';

interface LiveNotesPanelProps {
  sessionId: string;
  initialNotes: string;
  dmHints: DmHint[];
}

export function LiveNotesPanel({ sessionId, initialNotes, dmHints }: LiveNotesPanelProps) {
  const [notes, setNotes] = useState(initialNotes);

  const updateSession = trpc.sessions.update.useMutation();

  const onSave = useCallback(
    async (value: string) => {
      await updateSession.mutateAsync({ id: sessionId, quickNotes: value });
    },
    [sessionId, updateSession]
  );

  const { status } = useAutoSave(notes, onSave, 2000);

  return (
    <div className="flex flex-col h-full">
      {/* Notes area */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Live Notes
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Error saving' : ''}
        </span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type anything — notes auto-save as you type…"
        className="flex-1 resize-none bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed min-h-0"
      />

      {/* AI context feed */}
      {dmHints.length > 0 && (
        <div className="border-t border-border/50 shrink-0 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
              AI Context
            </span>
          </div>
          <div className="space-y-1.5">
            {dmHints.map((hint, i) => (
              <div
                key={i}
                className={`rounded px-2.5 py-1.5 text-xs leading-snug ${
                  hint.priority === 'important'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                {hint.effectName && (
                  <span className="font-semibold mr-1">[{hint.effectName}]</span>
                )}
                {hint.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
