'use client';

import { useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import type { PrepLooseThread } from '@/lib/prep-types';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { VoiceScribe } from '../voice-scribe';

export function StepLooseThreads({
  sessionId,
  threads,
  onChange,
}: {
  sessionId: string;
  threads: PrepLooseThread[];
  onChange: (threads: PrepLooseThread[]) => void;
}) {
  const { toast } = useToast();
  const [aiSuggestions, setAiSuggestions] = useState<PrepLooseThread[] | null>(null);

  const detect = trpc.sessions.aiDetectLooseThreads.useMutation({
    onSuccess: (data) => setAiSuggestions(data.looseThreads as PrepLooseThread[]),
    onError: (error) =>
      toast({
        title: 'AI unavailable',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const add = () => onChange([...threads, { id: crypto.randomUUID(), text: '' }]);
  const update = (id: string, value: string) =>
    onChange(threads.map((thread) => (thread.id === id ? { ...thread, text: value } : thread)));
  const remove = (id: string) => onChange(threads.filter((thread) => thread.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Unresolved hooks, promises, or NPC situations from past sessions.
      </p>

      {threads.map((thread) => (
        <div key={thread.id} className="flex items-start gap-2">
          <div className="flex-1">
            <VoiceScribe
              value={thread.text}
              onChange={(v) => update(thread.id, v)}
              placeholder="An unresolved thread..."
              minHeight={60}
            />
            {thread.fromSessionTitle && (
              <p className="mt-1 text-xs text-muted-foreground">
                From: {thread.fromSessionTitle}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(thread.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Thread
        </Button>
        {!aiSuggestions && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => detect.mutate({ sessionId })}
            disabled={detect.isPending}
            className="ml-auto gap-1.5"
          >
            {detect.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Detect with AI
          </Button>
        )}
      </div>

      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="space-y-2">
          {aiSuggestions.map((thread, i) => (
            <AiSuggestionCard
              key={i}
              suggestion={thread.text}
              label={thread.fromSessionTitle ? `From: ${thread.fromSessionTitle}` : `Thread ${i + 1}`}
              onAccept={(value) => {
                onChange([
                  ...threads,
                  { ...thread, id: thread.id || crypto.randomUUID(), text: value },
                ]);
                setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null);
              }}
              onDiscard={() =>
                setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

