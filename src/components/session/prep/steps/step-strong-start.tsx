'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { VoiceScribe } from '../voice-scribe';

export function StepStrongStart({
  sessionId,
  value,
  onChange,
}: {
  sessionId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { toast } = useToast();
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const suggest = trpc.sessions.aiSuggestStrongStart.useMutation({
    onSuccess: (data) => setSuggestion(data.strongStart),
    onError: (error) =>
      toast({
        title: 'AI unavailable',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return (
    <div className="space-y-4">
      <VoiceScribe
        value={value}
        onChange={onChange}
        placeholder="How does tonight begin? Drop the players immediately into action or an interesting situation..."
        minHeight={160}
      />

      {!suggestion && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => suggest.mutate({ sessionId })}
          disabled={suggest.isPending}
          className="gap-1.5"
        >
          {suggest.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Suggest with AI
        </Button>
      )}

      {suggestion && (
        <AiSuggestionCard
          suggestion={suggestion}
          onAccept={(nextValue) => {
            onChange(nextValue);
            setSuggestion(null);
          }}
          onDiscard={() => setSuggestion(null)}
        />
      )}
    </div>
  );
}

