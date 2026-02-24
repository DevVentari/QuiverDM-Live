'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Zap,
  Map,
  Eye,
  Mountain,
  Users,
  Swords,
  Gift,
  ScrollText,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SceneItem   { id: string; text: string }
interface SecretItem  { id: string; text: string }
interface LocationItem{ id: string; name: string; description: string }
interface NpcItem     { id: string; name: string; motivation: string; npcId?: string }
interface EncounterItem { id: string; name: string; encounterPlanId?: string }
interface RewardItem  { id: string; text: string }

interface PrepDraft {
  title: string;
  prepStrongStart: string;
  prepSceneOutline: SceneItem[];
  prepSecrets: SecretItem[];
  prepLocations: LocationItem[];
  prepNpcs: NpcItem[];
  prepEncounters: EncounterItem[];
  prepRewards: RewardItem[];
  prepSessionArc: string;
}

// ---------------------------------------------------------------------------
// Step config
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 'strong-start',   label: 'Strong Start',       icon: Zap,        hint: 'How does the session begin? Drop players into action immediately.' },
  { id: 'scene-outline',  label: 'Scene Outline',      icon: Map,        hint: 'Up to 7 scenes or beats. Think of these as possibilities, not a railroad.' },
  { id: 'secrets',        label: 'Secrets & Clues',    icon: Eye,        hint: 'Up to 10 secrets the players might discover. Scatter them across locations and NPCs.' },
  { id: 'locations',      label: 'Locations',          icon: Mountain,   hint: 'Fantastic, evocative locations. Two sentences each.' },
  { id: 'npcs',           label: 'Featured NPCs',      icon: Users,      hint: 'Who will the players meet? Give each a one-sentence motivation.' },
  { id: 'encounters',     label: 'Encounters',         icon: Swords,     hint: 'Potential combat or challenge encounters. Keep them optional.' },
  { id: 'rewards',        label: 'Rewards',            icon: Gift,       hint: 'Treasure, story rewards, XP milestones.' },
  { id: 'session-arc',    label: 'Session Arc',        icon: ScrollText, hint: 'What larger story arc does this session serve? One or two sentences.' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newId() { return crypto.randomUUID(); }

const emptyDraft = (): PrepDraft => ({
  title: '',
  prepStrongStart: '',
  prepSceneOutline: [],
  prepSecrets: [],
  prepLocations: [],
  prepNpcs: [],
  prepEncounters: [],
  prepRewards: [],
  prepSessionArc: '',
});

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function WizardProgress({
  current,
  completed,
  onJump,
}: {
  current: number;
  completed: Set<number>;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = idx === current;
        const isDone = completed.has(idx) && !isActive;
        const canJump = completed.has(idx) || idx === current;

        return (
          <button
            key={step.id}
            disabled={!canJump}
            onClick={() => canJump && onJump(idx)}
            title={step.label}
            className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-all
              ${isActive
                ? 'bg-primary text-primary-foreground border-primary scale-110'
                : isDone
                  ? 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30 cursor-pointer'
                  : 'bg-card text-muted-foreground border-border opacity-50 cursor-not-allowed'
              }`}
          >
            {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dynamic list helpers
// ---------------------------------------------------------------------------

function ListField<T extends { id: string }>({
  items,
  onChange,
  maxItems,
  renderItem,
  addLabel,
  addItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  maxItems?: number;
  renderItem: (item: T, update: (patch: Partial<T>) => void, remove: () => void) => React.ReactNode;
  addLabel: string;
  addItem: () => T;
}) {
  const canAdd = !maxItems || items.length < maxItems;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          {renderItem(
            item,
            (patch) => onChange(items.map((i) => i.id === item.id ? { ...i, ...patch } : i)),
            () => onChange(items.filter((i) => i.id !== item.id))
          )}
        </div>
      ))}
      {canAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-dashed"
          onClick={() => onChange([...items, addItem()])}
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
          {maxItems && <span className="text-muted-foreground ml-1 text-xs">({items.length}/{maxItems})</span>}
        </Button>
      )}
      {maxItems && items.length >= maxItems && (
        <p className="text-xs text-muted-foreground italic">Maximum {maxItems} items reached.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual step components
// ---------------------------------------------------------------------------

function StepStrongStart({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <Textarea
      value={draft.prepStrongStart}
      onChange={(e) => onChange({ prepStrongStart: e.target.value })}
      placeholder="Read this scene aloud or summarize it for your players as they sit down..."
      rows={8}
      className="resize-none"
    />
  );
}

function StepSceneOutline({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <ListField
      items={draft.prepSceneOutline}
      onChange={(v) => onChange({ prepSceneOutline: v })}
      maxItems={7}
      addLabel="Add Scene"
      addItem={() => ({ id: newId(), text: '' })}
      renderItem={(item, update, remove) => (
        <div className="flex gap-2 items-start">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0 mt-2">
            {draft.prepSceneOutline.indexOf(item) + 1}
          </div>
          <Input
            value={item.text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder="Scene description or beat..."
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="sm" onClick={remove} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    />
  );
}

function StepSecrets({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <ListField
      items={draft.prepSecrets}
      onChange={(v) => onChange({ prepSecrets: v })}
      maxItems={10}
      addLabel="Add Secret or Clue"
      addItem={() => ({ id: newId(), text: '' })}
      renderItem={(item, update, remove) => (
        <div className="flex gap-2 items-start">
          <Eye className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-2.5" />
          <Input
            value={item.text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder="A secret or clue the players might discover..."
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="sm" onClick={remove} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    />
  );
}

function StepLocations({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <ListField
      items={draft.prepLocations}
      onChange={(v) => onChange({ prepLocations: v })}
      addLabel="Add Location"
      addItem={() => ({ id: newId(), name: '', description: '' })}
      renderItem={(item, update, remove) => (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <Mountain className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <Input
              value={item.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Location name..."
              className="flex-1 h-8 text-sm font-medium"
            />
            <Button type="button" variant="ghost" size="sm" onClick={remove} className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8 p-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Textarea
            value={item.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Two evocative sentences that bring this place to life..."
            rows={2}
            className="resize-none text-sm"
          />
        </div>
      )}
    />
  );
}

function StepNpcs({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <ListField
      items={draft.prepNpcs}
      onChange={(v) => onChange({ prepNpcs: v })}
      addLabel="Add NPC"
      addItem={() => ({ id: newId(), name: '', motivation: '' })}
      renderItem={(item, update, remove) => (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <Users className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <Input
              value={item.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="NPC name..."
              className="flex-1 h-8 text-sm font-medium"
            />
            <Button type="button" variant="ghost" size="sm" onClick={remove} className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8 p-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            value={item.motivation}
            onChange={(e) => update({ motivation: e.target.value })}
            placeholder="What does this NPC want? One sentence..."
            className="text-sm"
          />
        </div>
      )}
    />
  );
}

function StepEncounters({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <ListField
      items={draft.prepEncounters}
      onChange={(v) => onChange({ prepEncounters: v })}
      addLabel="Add Encounter"
      addItem={() => ({ id: newId(), name: '' })}
      renderItem={(item, update, remove) => (
        <div className="flex gap-2 items-start">
          <Swords className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-2.5" />
          <Input
            value={item.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Encounter name or description..."
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="sm" onClick={remove} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    />
  );
}

function StepRewards({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <ListField
      items={draft.prepRewards}
      onChange={(v) => onChange({ prepRewards: v })}
      addLabel="Add Reward"
      addItem={() => ({ id: newId(), text: '' })}
      renderItem={(item, update, remove) => (
        <div className="flex gap-2 items-start">
          <Gift className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-2.5" />
          <Input
            value={item.text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder="Reward, treasure, XP milestone, or story beat..."
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="sm" onClick={remove} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    />
  );
}

function StepSessionArc({ draft, onChange }: { draft: PrepDraft; onChange: (p: Partial<PrepDraft>) => void }) {
  return (
    <Textarea
      value={draft.prepSessionArc}
      onChange={(e) => onChange({ prepSessionArc: e.target.value })}
      placeholder="This session advances the arc of... One or two sentences connecting this session to the larger campaign story."
      rows={5}
      className="resize-none"
    />
  );
}

const STEP_COMPONENTS = [
  StepStrongStart,
  StepSceneOutline,
  StepSecrets,
  StepLocations,
  StepNpcs,
  StepEncounters,
  StepRewards,
  StepSessionArc,
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NewSessionPage() {
  const router = useRouter();
  const { campaignId, slug } = useCampaign();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<PrepDraft>(emptyDraft);

  const create = trpc.sessions.create.useMutation({
    onSuccess: (session) => {
      router.push(`/campaigns/${slug}/sessions/${session.id}`);
    },
    onError: (err) => {
      toast({ title: 'Error creating session', description: err.message, variant: 'destructive' });
    },
  });

  function patchDraft(patch: Partial<PrepDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function markCompleted(idx: number) {
    setCompleted((prev) => new Set([...prev, idx]));
  }

  function goNext() {
    markCompleted(step);
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  function goJump(idx: number) {
    markCompleted(step);
    setStep(idx);
  }

  function handleCreate(createAsPlanning: boolean) {
    markCompleted(step);
    create.mutate({
      campaignId,
      title: draft.title || undefined,
      status: createAsPlanning ? 'planning' : 'in_progress',
      prepStrongStart: draft.prepStrongStart || undefined,
      prepSceneOutline: draft.prepSceneOutline.length > 0 ? draft.prepSceneOutline : undefined,
      prepSecrets: draft.prepSecrets.length > 0 ? draft.prepSecrets : undefined,
      prepLocations: draft.prepLocations.length > 0 ? draft.prepLocations : undefined,
      prepNpcs: draft.prepNpcs.length > 0 ? draft.prepNpcs : undefined,
      prepEncounters: draft.prepEncounters.length > 0 ? draft.prepEncounters : undefined,
      prepRewards: draft.prepRewards.length > 0 ? draft.prepRewards : undefined,
      prepSessionArc: draft.prepSessionArc || undefined,
    });
  }

  const StepContent = STEP_COMPONENTS[step];
  const stepConfig = STEPS[step];
  const StepIcon = stepConfig.icon;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/campaigns/${slug}/sessions`} className="hover:text-foreground transition-colors">
          Sessions
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">New Session</span>
      </div>

      {/* Title input — always visible */}
      <div className="space-y-1.5">
        <Label htmlFor="session-title" className="text-base font-semibold">Session Title</Label>
        <Input
          id="session-title"
          value={draft.title}
          onChange={(e) => patchDraft({ title: e.target.value })}
          placeholder={`Session ${Date.now() % 100}: The [Something] of [Somewhere]`}
          className="text-lg h-11"
        />
      </div>

      {/* Wizard card */}
      <div className="rounded-xl border-2 border-border bg-card overflow-hidden">

        {/* Progress stepper */}
        <div className="px-5 pt-4 pb-3 border-b border-border bg-muted/20">
          <WizardProgress current={step} completed={completed} onJump={goJump} />
        </div>

        {/* Step header */}
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <StepIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="font-display text-lg font-bold leading-tight">{stepConfig.label}</h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-10">{stepConfig.hint}</p>
        </div>

        {/* Step content */}
        <div className="px-5 py-4 min-h-[200px]">
          <StepContent draft={draft} onChange={patchDraft} />
        </div>

        {/* Nav */}
        <div className="px-5 pb-5 pt-2 border-t border-border bg-muted/10 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={step === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <Button type="button" variant="ghost" size="sm" onClick={goNext} className="text-muted-foreground">
                Skip
              </Button>
            )}

            {isLastStep ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreate(true)}
                  disabled={create.isPending}
                  className="gap-1.5"
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  Save as Planning
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCreate(false)}
                  disabled={create.isPending}
                  className="gap-1.5"
                >
                  {create.isPending ? 'Creating…' : 'Start Session'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" onClick={goNext} className="gap-1.5">
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick-create link */}
      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t want to prep?{' '}
        <button
          className="text-primary hover:underline"
          onClick={() => {
            create.mutate({ campaignId, title: draft.title || undefined, status: 'in_progress' });
          }}
          disabled={create.isPending}
        >
          Create a blank session
        </button>
      </p>
    </div>
  );
}
