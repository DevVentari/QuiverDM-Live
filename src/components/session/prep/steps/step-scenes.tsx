'use client';

import { useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import { SceneSchema, type PrepScene } from '@/lib/prep-types';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { VoiceScribe } from '../voice-scribe';

export function StepScenes({
  sessionId,
  scenes,
  strongStart,
  onChange,
}: {
  sessionId: string;
  scenes: PrepScene[];
  strongStart: string;
  onChange: (scenes: PrepScene[]) => void;
}) {
  const { toast } = useToast();
  const [aiSuggestions, setAiSuggestions] = useState<PrepScene[] | null>(null);

  const suggest = trpc.sessions.aiSuggestScenes.useMutation({
    onSuccess: (data) => setAiSuggestions(data.scenes as PrepScene[]),
    onError: (error) =>
      toast({
        title: 'AI unavailable',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const addScene = () =>
    onChange([
      ...scenes,
      SceneSchema.parse({ id: crypto.randomUUID(), title: '', description: '', location: '' }),
    ]);

  const update = (id: string, field: keyof PrepScene, value: string) => {
    onChange(scenes.map((scene) => (scene.id === id ? { ...scene, [field]: value } : scene)));
  };

  const remove = (id: string) => onChange(scenes.filter((scene) => scene.id !== id));

  return (
    <div className="space-y-4">
      {scenes.map((scene, i) => (
        <div
          key={scene.id}
          className="space-y-2 rounded-xl border border-border bg-card/50 p-4"
        >
          <div className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-xs text-muted-foreground">
              {i + 1}.
            </span>
            <div className="flex-1 space-y-2">
              <Input
                value={scene.title}
                onChange={(e) => update(scene.id, 'title', e.target.value)}
                placeholder="Scene title..."
                className="h-8 text-sm font-medium"
              />
              <VoiceScribe
                value={scene.description}
                onChange={(v) => update(scene.id, 'description', v)}
                placeholder="What happens? What's at stake?"
                minHeight={70}
              />
              <Input
                value={scene.location ?? ''}
                onChange={(e) => update(scene.id, 'location', e.target.value)}
                placeholder="Location (optional)..."
                className="h-8 text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(scene.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={addScene} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Scene
        </Button>
        {!aiSuggestions && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => suggest.mutate({ sessionId, strongStart })}
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
      </div>

      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="space-y-2">
          {aiSuggestions.map((scene, i) => (
            <AiSuggestionCard
              key={i}
              suggestion={`${scene.title}\n${scene.description}`}
              label={`Scene Suggestion ${i + 1}`}
              onAccept={() => {
                const normalized: PrepScene = SceneSchema.parse({
                  id: scene.id || crypto.randomUUID(),
                  title: scene.title || '',
                  description: scene.description || '',
                  location: scene.location,
                });
                onChange([...scenes, normalized]);
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

