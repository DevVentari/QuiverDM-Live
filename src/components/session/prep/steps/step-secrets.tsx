'use client';

import { useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import type { PrepSecret } from '@/lib/prep-types';
import { AiSuggestionCard } from '../ai-suggestion-card';

export function StepSecrets({
  sessionId,
  secrets,
  onChange,
}: {
  sessionId: string;
  secrets: PrepSecret[];
  onChange: (secrets: PrepSecret[]) => void;
}) {
  const { toast } = useToast();
  const [aiSuggestions, setAiSuggestions] = useState<PrepSecret[] | null>(null);

  const suggest = trpc.sessions.aiSuggestSecrets.useMutation({
    onSuccess: (data) => setAiSuggestions(data.secretsAndClues as PrepSecret[]),
    onError: (error) =>
      toast({
        title: 'AI unavailable',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const add = () => onChange([...secrets, { id: crypto.randomUUID(), text: '' }]);
  const update = (id: string, field: keyof PrepSecret, value: string) =>
    onChange(secrets.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const remove = (id: string) => onChange(secrets.filter((s) => s.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Aim for 10 secrets. Scatter them across locations, NPCs, and objects.
      </p>

      {secrets.map((secret, i) => (
        <div key={secret.id} className="flex items-start gap-2">
          <span className="mt-2.5 w-6 shrink-0 text-right text-xs text-muted-foreground">
            {i + 1}.
          </span>
          <div className="flex-1 space-y-1">
            <Textarea
              value={secret.text}
              onChange={(e) => update(secret.id, 'text', e.target.value)}
              placeholder="A secret the players might discover..."
              className="min-h-[60px] resize-none text-sm"
            />
            <Input
              value={secret.linkedTo ?? ''}
              onChange={(e) => update(secret.id, 'linkedTo', e.target.value)}
              placeholder="Linked to NPC/location/item (optional)..."
              className="h-7 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(secret.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Secret
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          {secrets.length}/10
        </span>
        {!aiSuggestions && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => suggest.mutate({ sessionId })}
            disabled={suggest.isPending}
            className="ml-auto gap-1.5"
          >
            {suggest.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Suggest with AI
          </Button>
        )}
      </div>

      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="space-y-2">
          {aiSuggestions.map((secret, i) => (
            <AiSuggestionCard
              key={i}
              suggestion={secret.text}
              label={`Secret ${i + 1}`}
              onAccept={(value) => {
                onChange([
                  ...secrets,
                  {
                    id: crypto.randomUUID(),
                    text: value,
                    linkedTo: secret.linkedTo,
                  },
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

