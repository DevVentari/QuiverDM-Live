lazy-dm-wizard-ui
REPO:E:\Projects\QuiverDM\.worktrees\feat\lazy-dm-wizard
CREATE:src/hooks/use-auto-save.ts,src/components/session/prep/prep-wizard.tsx,src/components/session/prep/prep-step-sidebar.tsx,src/components/session/prep/prep-header.tsx,src/components/session/prep/ai-suggestion-card.tsx,src/components/session/prep/steps/step-characters.tsx,src/components/session/prep/steps/step-strong-start.tsx,src/components/session/prep/steps/step-scenes.tsx,src/components/session/prep/steps/step-secrets.tsx,src/components/session/prep/steps/step-npcs.tsx,src/components/session/prep/steps/step-monsters.tsx,src/components/session/prep/steps/step-rewards.tsx,src/components/session/prep/steps/step-loose-threads.tsx,src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx,src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx
MOD:src/app/(app)/campaigns/[slug]/sessions/page.tsx,src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx
VERIFY:npx tsc --noEmit

[src/hooks/use-auto-save.ts]
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  delayMs = 2000
) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(data));
  const isDirtyRef = useRef(false);

  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    isDirtyRef.current = true;
    setStatus('unsaved');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await onSave(data);
        lastSavedRef.current = serialized;
        isDirtyRef.current = false;
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, onSave, delayMs]);

  // Block navigation when unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    try {
      await onSave(data);
      lastSavedRef.current = JSON.stringify(data);
      isDirtyRef.current = false;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [data, onSave]);

  return { status, saveNow };
}

[src/components/session/prep/prep-step-sidebar.tsx]
'use client';
import { Users, Zap, Map, Eye, UserCircle2, Swords, Gift, GitBranch, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 0, label: 'Characters', icon: Users, hint: 'Know your players' },
  { id: 1, label: 'Strong Start', icon: Zap, hint: 'Open with a bang' },
  { id: 2, label: 'Scenes', icon: Map, hint: 'Potential beats' },
  { id: 3, label: 'Secrets', icon: Eye, hint: 'Hidden truths' },
  { id: 4, label: 'NPCs', icon: UserCircle2, hint: 'Who they\'ll meet' },
  { id: 5, label: 'Monsters', icon: Swords, hint: 'Encounters' },
  { id: 6, label: 'Rewards', icon: Gift, hint: 'Treasure & XP' },
  { id: 7, label: 'Threads', icon: GitBranch, hint: 'Loose ends' },
] as const;

export function PrepStepSidebar({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {STEPS.map(({ id, label, icon: Icon }) => {
        const isActive = currentStep === id;
        const isDone = completedSteps.has(id);
        const isAccessible = isDone || id <= Math.max(...Array.from(completedSteps), -1) + 1;
        return (
          <button
            key={id}
            onClick={() => isAccessible && onStepClick(id)}
            disabled={!isAccessible}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all text-sm',
              isActive && 'bg-primary/15 text-primary font-medium',
              !isActive && isDone && 'text-foreground/80 hover:bg-foreground/5 cursor-pointer',
              !isActive && !isDone && isAccessible && 'text-muted-foreground hover:bg-foreground/5 cursor-pointer',
              !isAccessible && 'text-muted-foreground/40 cursor-not-allowed'
            )}
          >
            <span className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
              isActive && 'border-primary bg-primary text-primary-foreground',
              isDone && !isActive && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
              !isActive && !isDone && 'border-border text-muted-foreground'
            )}>
              {isDone && !isActive ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

[src/components/session/prep/prep-header.tsx]
'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import type { SaveStatus } from '@/hooks/use-auto-save';

export function PrepHeader({
  title,
  onTitleChange,
  saveStatus,
  slug,
  onComplete,
  isCompleting,
  prepStatus,
}: {
  title: string;
  onTitleChange: (t: string) => void;
  saveStatus: SaveStatus;
  slug: string;
  onComplete: () => void;
  isCompleting: boolean;
  prepStatus: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/50 backdrop-blur-sm">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
        <Link href={`/campaigns/${slug}/sessions`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="h-8 font-display font-semibold border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-1 max-w-xs"
        placeholder="Session title…"
      />
      <div className="flex-1" />
      {/* Save status */}
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        {saveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : saveStatus === 'error' ? 'Error' : 'Saved'}
      </span>
      {prepStatus !== 'complete' ? (
        <Button size="sm" onClick={onComplete} disabled={isCompleting} className="gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isCompleting ? 'Saving…' : 'Complete Prep'}
        </Button>
      ) : (
        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Prep Complete</Badge>
      )}
    </div>
  );
}

[src/components/session/prep/ai-suggestion-card.tsx]
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Check, X, Edit2 } from 'lucide-react';

export function AiSuggestionCard({
  suggestion,
  onAccept,
  onDiscard,
  label = 'AI Suggestion',
}: {
  suggestion: string;
  onAccept: (value: string) => void;
  onDiscard: () => void;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(suggestion);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-primary font-medium">
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </div>
      {editing ? (
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="text-sm min-h-[80px]"
          autoFocus
        />
      ) : (
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{editValue}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onAccept(editValue)} className="gap-1.5 h-7">
          <Check className="h-3 w-3" /> Accept
        </Button>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5 h-7">
            <Edit2 className="h-3 w-3" /> Edit
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7">
            Cancel
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDiscard} className="ml-auto gap-1.5 h-7 text-muted-foreground">
          <X className="h-3 w-3" /> Discard
        </Button>
      </div>
    </div>
  );
}

[src/components/session/prep/steps/step-characters.tsx]
'use client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import type { CharacterNote } from '@/lib/prep-types';

export function StepCharacters({
  characterNotes,
  onChange,
}: {
  characterNotes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void;
}) {
  const updateNote = (idx: number, field: keyof CharacterNote, value: string) => {
    const next = characterNotes.map((n, i) => i === idx ? { ...n, [field]: value } : n);
    onChange(next);
  };

  if (characterNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No characters in this campaign</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add player characters first from the Characters page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {characterNotes.map((char, i) => (
        <div key={char.characterId} className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">{char.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Goals & Motivations</Label>
              <Textarea
                value={char.goals}
                onChange={(e) => updateNote(i, 'goals', e.target.value)}
                placeholder="What does this character want right now?"
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Session Notes</Label>
              <Textarea
                value={char.notes}
                onChange={(e) => updateNote(i, 'notes', e.target.value)}
                placeholder="Anything to watch for this session?"
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

[src/components/session/prep/steps/step-strong-start.tsx]
'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { Sparkles, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

export function StepStrongStart({
  sessionId,
  value,
  onChange,
}: {
  sessionId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { toast } = useToast();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const suggest = trpc.sessions.aiSuggestStrongStart.useMutation({
    onSuccess: (data) => setSuggestion(data.strongStart),
    onError: (e) => toast({ title: 'AI unavailable', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="How does tonight begin? Drop the players immediately into action or an interesting situation…"
        className="min-h-[160px] text-sm resize-none"
      />
      {!suggestion && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => suggest.mutate({ sessionId })}
          disabled={suggest.isPending}
          className="gap-1.5"
        >
          {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Suggest with AI
        </Button>
      )}
      {suggestion && (
        <AiSuggestionCard
          suggestion={suggestion}
          onAccept={(v) => { onChange(v); setSuggestion(null); }}
          onDiscard={() => setSuggestion(null)}
        />
      )}
    </div>
  );
}

[src/components/session/prep/steps/step-scenes.tsx]
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import type { PrepScene } from '@/lib/prep-types';

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
    onError: (e) => toast({ title: 'AI unavailable', description: e.message, variant: 'destructive' }),
  });

  const addScene = () => {
    onChange([...scenes, { id: crypto.randomUUID(), title: '', description: '' }]);
  };

  const update = (id: string, field: keyof PrepScene, value: string) => {
    onChange(scenes.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const remove = (id: string) => onChange(scenes.filter((s) => s.id !== id));

  return (
    <div className="space-y-4">
      {scenes.map((scene, i) => (
        <div key={scene.id} className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground mt-2 w-5 text-right shrink-0">{i + 1}.</span>
            <div className="flex-1 space-y-2">
              <Input
                value={scene.title}
                onChange={(e) => update(scene.id, 'title', e.target.value)}
                placeholder="Scene title…"
                className="h-8 text-sm font-medium"
              />
              <Textarea
                value={scene.description}
                onChange={(e) => update(scene.id, 'description', e.target.value)}
                placeholder="What happens? What's at stake?"
                className="min-h-[70px] text-sm resize-none"
              />
              <Input
                value={scene.location ?? ''}
                onChange={(e) => update(scene.id, 'location', e.target.value)}
                placeholder="Location (optional)…"
                className="h-8 text-xs"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => remove(scene.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={addScene} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Scene
        </Button>
        {!aiSuggestions && (
          <Button variant="outline" size="sm" onClick={() => suggest.mutate({ sessionId, strongStart })} disabled={suggest.isPending} className="gap-1.5">
            {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Suggest with AI
          </Button>
        )}
      </div>
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="space-y-2">
          {aiSuggestions.map((s, i) => (
            <AiSuggestionCard
              key={i}
              suggestion={`${s.title}\n${s.description}`}
              label={`Scene Suggestion ${i + 1}`}
              onAccept={() => { onChange([...scenes, s]); setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null); }}
              onDiscard={() => setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

[src/components/session/prep/steps/step-secrets.tsx]
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import type { PrepSecret } from '@/lib/prep-types';

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
    onError: (e) => toast({ title: 'AI unavailable', description: e.message, variant: 'destructive' }),
  });

  const add = () => onChange([...secrets, { id: crypto.randomUUID(), text: '' }]);
  const update = (id: string, field: keyof PrepSecret, value: string) =>
    onChange(secrets.map((s) => s.id === id ? { ...s, [field]: value } : s));
  const remove = (id: string) => onChange(secrets.filter((s) => s.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Aim for 10 secrets. Scatter them across locations, NPCs, and objects.</p>
      {secrets.map((s, i) => (
        <div key={s.id} className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground mt-2.5 w-6 text-right shrink-0">{i + 1}.</span>
          <div className="flex-1 space-y-1">
            <Textarea
              value={s.text}
              onChange={(e) => update(s.id, 'text', e.target.value)}
              placeholder="A secret the players might discover…"
              className="min-h-[60px] text-sm resize-none"
            />
            <Input
              value={s.linkedTo ?? ''}
              onChange={(e) => update(s.id, 'linkedTo', e.target.value)}
              placeholder="Linked to NPC/location/item (optional)…"
              className="h-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-0.5" onClick={() => remove(s.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Secret
        </Button>
        <span className="text-xs text-muted-foreground self-center">{secrets.length}/10</span>
        {!aiSuggestions && (
          <Button variant="outline" size="sm" onClick={() => suggest.mutate({ sessionId })} disabled={suggest.isPending} className="gap-1.5 ml-auto">
            {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Suggest with AI
          </Button>
        )}
      </div>
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="space-y-2">
          {aiSuggestions.map((s, i) => (
            <AiSuggestionCard
              key={i}
              suggestion={s.text}
              label={`Secret ${i + 1}`}
              onAccept={(v) => { onChange([...secrets, { id: crypto.randomUUID(), text: v, linkedTo: s.linkedTo }]); setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null); }}
              onDiscard={() => setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

[src/components/session/prep/steps/step-npcs.tsx]
'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { PrepNpc } from '@/lib/prep-types';

export function StepNpcs({
  npcs,
  campaignNpcs,
  onChange,
}: {
  npcs: PrepNpc[];
  campaignNpcs: { id: string; name: string; role?: string | null; motivation?: string | null }[];
  onChange: (npcs: PrepNpc[]) => void;
}) {
  const add = () => onChange([...npcs, { name: '', isNew: true }]);
  const update = (i: number, field: keyof PrepNpc, value: string | boolean) =>
    onChange(npcs.map((n, j) => j === i ? { ...n, [field]: value } : n));
  const remove = (i: number) => onChange(npcs.filter((_, j) => j !== i));

  const addFromCampaign = (npc: typeof campaignNpcs[0]) => {
    if (npcs.some((n) => n.npcId === npc.id)) return;
    onChange([...npcs, { npcId: npc.id, name: npc.name, role: npc.role ?? undefined, motivation: npc.motivation ?? undefined }]);
  };

  return (
    <div className="space-y-4">
      {npcs.map((npc, i) => (
        <div key={i} className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 grid gap-2 sm:grid-cols-3">
              <Input value={npc.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="NPC name…" className="h-8 text-sm font-medium" />
              <Input value={npc.role ?? ''} onChange={(e) => update(i, 'role', e.target.value)} placeholder="Role (optional)…" className="h-8 text-sm" />
              <Input value={npc.motivation ?? ''} onChange={(e) => update(i, 'motivation', e.target.value)} placeholder="Motivation…" className="h-8 text-sm" />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add NPC
        </Button>
      </div>
      {campaignNpcs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Add from campaign NPCs:</p>
          <div className="flex flex-wrap gap-1.5">
            {campaignNpcs.slice(0, 20).map((n) => (
              <button
                key={n.id}
                onClick={() => addFromCampaign(n)}
                disabled={npcs.some((x) => x.npcId === n.id)}
                className="px-2.5 py-1 rounded-full border border-border text-xs hover:bg-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {n.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

[src/components/session/prep/steps/step-monsters.tsx]
'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Minus } from 'lucide-react';
import type { PrepMonster } from '@/lib/prep-types';

export function StepMonsters({
  monsters,
  onChange,
}: {
  monsters: PrepMonster[];
  onChange: (monsters: PrepMonster[]) => void;
}) {
  const add = () => onChange([...monsters, { name: '', source: 'custom', count: 1 }]);
  const update = (i: number, field: keyof PrepMonster, value: string | number) =>
    onChange(monsters.map((m, j) => j === i ? { ...m, [field]: value } : m));
  const remove = (i: number) => onChange(monsters.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {monsters.map((m, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
          <div className="flex-1 grid gap-2 sm:grid-cols-3">
            <Input value={m.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Monster name…" className="h-8 text-sm" />
            <Input value={m.cr ?? ''} onChange={(e) => update(i, 'cr', e.target.value)} placeholder="CR (e.g. 2, 1/2)…" className="h-8 text-sm" />
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => update(i, 'count', Math.max(1, m.count - 1))}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium w-6 text-center">{m.count}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => update(i, 'count', m.count + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add Monster
      </Button>
    </div>
  );
}

[src/components/session/prep/steps/step-rewards.tsx]
'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import type { PrepReward } from '@/lib/prep-types';

export function StepRewards({
  rewards,
  onChange,
}: {
  rewards: PrepReward[];
  onChange: (rewards: PrepReward[]) => void;
}) {
  const add = () => onChange([...rewards, { name: '', source: 'custom' }]);
  const update = (i: number, field: keyof PrepReward, value: string) =>
    onChange(rewards.map((r, j) => j === i ? { ...r, [field]: value } : r));
  const remove = (i: number) => onChange(rewards.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {rewards.map((r, i) => (
        <div key={i} className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 grid gap-2 sm:grid-cols-2">
              <Input value={r.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Reward name…" className="h-8 text-sm" />
              <Input value={r.rarity ?? ''} onChange={(e) => update(i, 'rarity', e.target.value)} placeholder="Rarity (optional)…" className="h-8 text-sm" />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Textarea
            value={r.notes ?? ''}
            onChange={(e) => update(i, 'notes', e.target.value)}
            placeholder="Notes, where to find it, conditions…"
            className="min-h-[50px] text-xs resize-none"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add Reward
      </Button>
    </div>
  );
}

[src/components/session/prep/steps/step-loose-threads.tsx]
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AiSuggestionCard } from '../ai-suggestion-card';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import type { PrepLooseThread } from '@/lib/prep-types';

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
    onError: (e) => toast({ title: 'AI unavailable', description: e.message, variant: 'destructive' }),
  });

  const add = () => onChange([...threads, { id: crypto.randomUUID(), text: '' }]);
  const update = (id: string, value: string) =>
    onChange(threads.map((t) => t.id === id ? { ...t, text: value } : t));
  const remove = (id: string) => onChange(threads.filter((t) => t.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Unresolved hooks, promises, or NPC situations from past sessions.</p>
      {threads.map((t) => (
        <div key={t.id} className="flex items-start gap-2">
          <div className="flex-1">
            <Textarea
              value={t.text}
              onChange={(e) => update(t.id, e.target.value)}
              placeholder="An unresolved thread…"
              className="min-h-[60px] text-sm resize-none"
            />
            {t.fromSessionTitle && (
              <p className="text-xs text-muted-foreground mt-1">From: {t.fromSessionTitle}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-0.5" onClick={() => remove(t.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Thread
        </Button>
        {!aiSuggestions && (
          <Button variant="outline" size="sm" onClick={() => detect.mutate({ sessionId })} disabled={detect.isPending} className="gap-1.5 ml-auto">
            {detect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Detect with AI
          </Button>
        )}
      </div>
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="space-y-2">
          {aiSuggestions.map((t, i) => (
            <AiSuggestionCard
              key={i}
              suggestion={t.text}
              label={t.fromSessionTitle ? `From: ${t.fromSessionTitle}` : `Thread ${i + 1}`}
              onAccept={(v) => { onChange([...threads, { ...t, text: v }]); setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null); }}
              onDiscard={() => setAiSuggestions((prev) => prev?.filter((_, j) => j !== i) ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

[src/components/session/prep/prep-wizard.tsx]
Build the main orchestrator component. It manages all step state and auto-save.

1. Signature:
```tsx
'use client';
export function PrepWizard({
  sessionId,
  initialData,
  campaignContext,
  slug,
  initialTitle,
}: {
  sessionId: string;
  initialData: SessionPrepData;
  campaignContext: { characters: any[]; npcs: any[]; recentSessions: any[]; homebrew: any[] };
  slug: string;
  initialTitle: string;
})
```

2. State: `prepData: SessionPrepData` (useState from initialData), `currentStep: number` (useState from initialData.currentStep), `title: string` (useState from initialTitle), `completedSteps: Set<number>` (useState - steps 0..currentStep-1)

3. Auto-save: use `useAutoSave` hook. onSave calls `trpc.sessions.updatePrep.mutateAsync({ id: sessionId, prepData: { ...prepData, currentStep } })` then also update title via `trpc.sessions.update.mutateAsync({ id: sessionId, title })`.

4. Complete prep: `trpc.sessions.completePrep.useMutation`, call onSuccess toast and router.push to session detail.

5. Step navigation: `handleNext` marks current step as completed, advances currentStep. `handlePrev` goes back. `handleJump` allows jumping to any completed/accessible step.

6. Layout (two-column):
```tsx
<div className="flex flex-col h-screen bg-background">
  <PrepHeader title={title} onTitleChange={setTitle} saveStatus={saveStatus} slug={slug} onComplete={...} isCompleting={...} prepStatus="draft" />
  <div className="flex flex-1 overflow-hidden">
    {/* Sidebar */}
    <aside className="w-56 shrink-0 border-r border-border/50 bg-card/30 overflow-y-auto hidden md:block">
      <PrepStepSidebar currentStep={currentStep} completedSteps={completedSteps} onStepClick={handleJump} />
    </aside>
    {/* Main content */}
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Step title + hint */}
        <div>
          <h2 className="font-display text-2xl font-bold">{STEP_TITLES[currentStep]}</h2>
          <p className="text-muted-foreground text-sm mt-1">{STEP_HINTS[currentStep]}</p>
        </div>
        {/* Step content */}
        {renderStep()}
        {/* Nav buttons */}
        <div className="flex justify-between pt-4 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentStep === 0}>Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleNext}>Skip</Button>
            {currentStep < 7 ? (
              <Button size="sm" onClick={handleNext}>Next</Button>
            ) : (
              <Button size="sm" onClick={handleComplete} disabled={isCompleting}>Complete Prep</Button>
            )}
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
```

7. `renderStep()` function — switch on currentStep:
- 0: `<StepCharacters characterNotes={...} onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))} />`
- 1: `<StepStrongStart sessionId={sessionId} value={prepData.strongStart} onChange={(v) => setPrepData((p) => ({ ...p, strongStart: v }))} />`
- 2: `<StepScenes sessionId={sessionId} scenes={prepData.scenes} strongStart={prepData.strongStart} onChange={(scenes) => setPrepData((p) => ({ ...p, scenes }))} />`
- 3: `<StepSecrets sessionId={sessionId} secrets={prepData.secretsAndClues} onChange={(s) => setPrepData((p) => ({ ...p, secretsAndClues: s }))} />`
- 4: `<StepNpcs npcs={prepData.npcs} campaignNpcs={campaignContext.npcs} onChange={(n) => setPrepData((p) => ({ ...p, npcs: n }))} />`
- 5: `<StepMonsters monsters={prepData.monsters} onChange={(m) => setPrepData((p) => ({ ...p, monsters: m }))} />`
- 6: `<StepRewards rewards={prepData.rewards} onChange={(r) => setPrepData((p) => ({ ...p, rewards: r }))} />`
- 7: `<StepLooseThreads sessionId={sessionId} threads={prepData.looseThreads} onChange={(t) => setPrepData((p) => ({ ...p, looseThreads: t }))} />`

8. STEP_TITLES array: ['Review Characters', 'Strong Start', 'Potential Scenes', 'Secrets & Clues', 'Featured NPCs', 'Monsters', 'Rewards', 'Loose Threads']
9. STEP_HINTS array with the plan's description for each step.
10. Import all step components. Import useAutoSave, PrepHeader, PrepStepSidebar from their paths. Import SessionPrepData, emptyPrepData from @/lib/prep-types.

[src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx]
'use client' page. Creates session on mount if no sessionId param, loads context, renders PrepWizard.

1. Use `useParams()` for slug, `useSearchParams()` for sessionId.
2. On mount (useEffect with empty deps), if no sessionId: call `trpc.sessions.createPrepSession.mutate({ campaignId })` then push `?sessionId=xxx` to URL (useRouter).
3. Fetch context: `trpc.sessions.getPrepContext.useQuery({ campaignId }, { enabled: !!campaignId })`.
4. Fetch session: `trpc.sessions.getById.useQuery({ id: sessionId }, { enabled: !!sessionId })`.
5. Derive `initialData`: parse `session?.prepData` through `SessionPrepDataSchema.safeParse`, fall back to `emptyPrepData()`. Also populate `characterNotes` from context.characters if characterNotes is empty — map each character to `{ characterId: c.id, name: c.name, goals: '', notes: '' }`.
6. Show loading skeleton while creating or loading. Show the PrepWizard once ready.
7. Import useCampaign to get campaignId and slug.

[src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx]
Thin redirect — on mount push to `/campaigns/${slug}/sessions/prep?sessionId=${sessionId}`.

```tsx
'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SessionPrepRedirect() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/campaigns/${slug}/sessions/prep?sessionId=${sessionId}`);
  }, [slug, sessionId, router]);
  return null;
}
```

[src/app/(app)/campaigns/[slug]/sessions/page.tsx]
1. Change the "New Session" button href from `/campaigns/${slug}/sessions/new` to `/campaigns/${slug}/sessions/prep`.
2. Inside the session card (within the map), add a "Continue Prep" badge/link: after the status badge, check `session.prepStatus === 'draft'` — if so render a small amber badge with text "Prep Draft" and link to `/campaigns/${slug}/sessions/prep?sessionId=${session.id}`.

[src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx]
1. In PrepTabContent: replace the refs to `data.prepStrongStart`, `data.prepSceneOutline`, etc. with parsing from `data.prepData`. Parse with `SessionPrepDataSchema.safeParse(data.prepData)` — call result `prepParsed`. Use `prepParsed.success ? prepParsed.data : null` as `prep`.
2. Update `hasPrepContent` to check `prep?.strongStart || prep?.scenes.length > 0 || prep?.secretsAndClues.length > 0 || prep?.npcs.length > 0 || prep?.monsters.length > 0 || prep?.rewards.length > 0 || prep?.looseThreads.length > 0`.
3. Replace all the existing `<PrepSection>` and `<PrepListSection>` calls:
   - Strong Start: `<PrepSection title="Strong Start" icon={Zap} content={prep?.strongStart ?? ''} />`
   - Scenes: `<PrepListSection title="Potential Scenes" icon={Map} items={(prep?.scenes ?? []).map(s => ({ label: s.title, sub: s.description }))} />`
   - Secrets: `<PrepListSection title="Secrets & Clues" icon={Eye} items={(prep?.secretsAndClues ?? []).map(s => ({ label: s.text, sub: s.linkedTo }))} />`
   - NPCs: `<PrepListSection title="Featured NPCs" icon={Users} items={(prep?.npcs ?? []).map(n => ({ label: n.name, sub: n.motivation }))} />`
   - Monsters: `<PrepListSection title="Monsters" icon={Swords} items={(prep?.monsters ?? []).map(m => ({ label: `${m.count}x ${m.name}`, sub: m.cr ? `CR ${m.cr}` : undefined }))} />`
   - Rewards: `<PrepListSection title="Rewards" icon={Gift} items={(prep?.rewards ?? []).map(r => ({ label: r.name, sub: r.rarity }))} />`
   - Loose Threads: `<PrepListSection title="Loose Threads" icon={GitBranch} items={(prep?.looseThreads ?? []).map(t => ({ label: t.text, sub: t.fromSessionTitle }))} />`
4. Update "Add Prep Notes" empty state link from `/campaigns/${slug}/sessions/new` to `/campaigns/${slug}/sessions/prep?sessionId=${data.id}`.
5. Update "Continue Prep" button in planning CTA to link to `/campaigns/${slug}/sessions/prep?sessionId=${data.id}`.
6. Add import: `import { SessionPrepDataSchema } from '@/lib/prep-types'` and `import { GitBranch } from 'lucide-react'`.
