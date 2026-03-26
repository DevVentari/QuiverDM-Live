'use client';

import { useState } from 'react';
import { BookOpen, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import { SceneSchema, type PrepScene, type PrepNpc, type PrepSecret, type PrepMonster } from '@/lib/prep-types';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { VoiceScribe } from '../voice-scribe';
import { SourcebookImportDrawer } from '../sourcebook-import-drawer';

function LinkedEntitiesSection({
  scene,
  prepNpcs,
  prepSecrets,
  prepMonsters,
  onUpdate,
}: {
  scene: PrepScene;
  prepNpcs: PrepNpc[];
  prepSecrets: PrepSecret[];
  prepMonsters: PrepMonster[];
  onUpdate: (patch: Partial<PrepScene>) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleNpc = (id: string) => {
    const ids = scene.linkedNpcIds ?? [];
    onUpdate({ linkedNpcIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  };

  const toggleSecret = (id: string) => {
    const ids = scene.linkedSecretIds ?? [];
    onUpdate({ linkedSecretIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  };

  const toggleMonster = (name: string) => {
    const names = scene.linkedMonsterNames ?? [];
    onUpdate({ linkedMonsterNames: names.includes(name) ? names.filter(x => x !== name) : [...names, name] });
  };

  const linkedCount = (scene.linkedNpcIds?.length ?? 0) + (scene.linkedSecretIds?.length ?? 0) + (scene.linkedMonsterNames?.length ?? 0);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-400 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Linked Entities
        {linkedCount > 0 && (
          <span className="ml-1 text-amber-400 font-mono text-[10px]">{linkedCount}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3 pl-4 border-l border-border">
          {prepNpcs.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">NPCs</p>
              {prepNpcs.map(npc => (
                <label key={npc.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={(scene.linkedNpcIds ?? []).includes(npc.id)}
                    onChange={() => toggleNpc(npc.id)}
                    className="accent-amber-400"
                  />
                  {npc.name}
                </label>
              ))}
            </div>
          )}
          {prepSecrets.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Secrets</p>
              {prepSecrets.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={(scene.linkedSecretIds ?? []).includes(s.id)}
                    onChange={() => toggleSecret(s.id)}
                    className="accent-amber-400"
                  />
                  <span className="truncate max-w-[200px]">{s.text}</span>
                </label>
              ))}
            </div>
          )}
          {prepMonsters.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Monsters</p>
              {prepMonsters.map(m => (
                <label key={m.name} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={(scene.linkedMonsterNames ?? []).includes(m.name)}
                    onChange={() => toggleMonster(m.name)}
                    className="accent-amber-400"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StepScenes({
  sessionId,
  scenes,
  strongStart,
  onChange,
  prepNpcs,
  prepSecrets,
  prepMonsters,
}: {
  sessionId: string;
  scenes: PrepScene[];
  strongStart: string;
  onChange: (scenes: PrepScene[]) => void;
  prepNpcs: PrepNpc[];
  prepSecrets: PrepSecret[];
  prepMonsters: PrepMonster[];
}) {
  const { toast } = useToast();
  const [aiSuggestions, setAiSuggestions] = useState<PrepScene[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const suggest = trpc.sessions.aiSuggestScenes.useMutation({
    onSuccess: (data) => setAiSuggestions(data.scenes as PrepScene[]),
    onError: (error) =>
      toast({
        title: 'AI unavailable',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const updateScene = (id: string, patch: Partial<PrepScene>) =>
    onChange(scenes.map(scene => scene.id === id ? { ...scene, ...patch } : scene));

  const addScene = () =>
    onChange([
      ...scenes,
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        location: '',
        readAloud: '',
        order: scenes.length,
        linkedNpcIds: [],
        linkedSecretIds: [],
        linkedMonsterNames: [],
      },
    ]);

  const remove = (id: string) => onChange(scenes.filter((scene) => scene.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs text-muted-foreground">Plan the scenes that might unfold this session.</p>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="text-xs gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          Import from Sourcebook
        </Button>
      </div>

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
                onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                placeholder="Scene title..."
                className="h-8 text-sm font-medium"
              />
              <VoiceScribe
                value={scene.description}
                onChange={(v) => updateScene(scene.id, { description: v })}
                placeholder="What happens? What's at stake?"
                minHeight={70}
              />
              <Input
                value={scene.location ?? ''}
                onChange={(e) => updateScene(scene.id, { location: e.target.value })}
                placeholder="Location (optional)..."
                className="h-8 text-xs"
              />

              {/* Read-aloud */}
              <div className="relative">
                <textarea
                  value={scene.readAloud ?? ''}
                  onChange={e => updateScene(scene.id, { readAloud: e.target.value })}
                  placeholder="Read this aloud to your players..."
                  rows={3}
                  className="w-full resize-none rounded-md border border-border border-l-2 border-l-amber-400/60 bg-amber-950/20 px-3 py-2 text-sm italic text-amber-100/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                  style={{ fontFamily: 'Georgia, serif' }}
                />
                {scene.sourceId && (
                  <Badge variant="outline" className="absolute top-1.5 right-2 text-[9px] text-amber-400/70 border-amber-400/30">From book</Badge>
                )}
              </div>

              {/* Linked entities */}
              <LinkedEntitiesSection
                scene={scene}
                prepNpcs={prepNpcs}
                prepSecrets={prepSecrets}
                prepMonsters={prepMonsters}
                onUpdate={patch => updateScene(scene.id, patch)}
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

      <SourcebookImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingSceneCount={scenes.length}
        prepNpcs={prepNpcs}
        prepSecrets={prepSecrets}
        prepMonsters={prepMonsters}
        onImport={importedScenes => onChange([...scenes, ...importedScenes])}
      />
    </div>
  );
}
