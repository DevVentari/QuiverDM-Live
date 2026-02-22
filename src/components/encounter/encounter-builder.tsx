'use client';

import { useState, useEffect } from 'react';
import { Trash2, ChevronDown, ChevronRight, Play, Save, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { AiPromptPanel } from './ai-prompt-panel';
import { DifficultyMeter } from './difficulty-meter';
import { MonsterPicker } from './monster-picker';
import { StatBlockCard } from './stat-block-card';
import type { EncounterDifficulty } from './ai-prompt-panel';

interface EncounterBuilderProps {
  campaignId: string;
  planId?: string; // if editing existing plan
  campaignSlug: string;
  defaultPartySize?: number;
  defaultPartyLevel?: number;
}

interface CreatureRow {
  id: string;
  name: string;
  count: number;
  cr?: string;
  xp?: number;
  sourceType: string;
  statBlock?: Record<string, unknown>;
}

function CreatureRow({
  creature,
  onRemove,
  onCountChange,
}: {
  creature: CreatureRow;
  onRemove: () => void;
  onCountChange: (count: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded">
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground"
          disabled={!creature.statBlock}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{creature.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {creature.cr && <span>CR {creature.cr}</span>}
            {creature.xp && <span>• {creature.xp.toLocaleString()} XP ea.</span>}
            <Badge variant="outline" className="text-xs py-0 px-1">
              {creature.sourceType}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="w-6 h-6 rounded border border-border text-xs hover:bg-muted flex items-center justify-center"
            onClick={() => onCountChange(Math.max(1, creature.count - 1))}
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-medium">{creature.count}</span>
          <button
            className="w-6 h-6 rounded border border-border text-xs hover:bg-muted flex items-center justify-center"
            onClick={() => onCountChange(Math.min(20, creature.count + 1))}
          >
            +
          </button>
        </div>

        <div className="text-xs text-muted-foreground w-16 text-right">
          {creature.xp ? (creature.xp * creature.count).toLocaleString() + ' XP' : '—'}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {expanded && creature.statBlock && (
        <div className="border-t border-border p-2">
          <StatBlockCard monster={creature.statBlock as Parameters<typeof StatBlockCard>[0]['monster']} />
        </div>
      )}
    </div>
  );
}

export function EncounterBuilder({
  campaignId,
  planId,
  defaultPartySize = 4,
  defaultPartyLevel = 1,
}: EncounterBuilderProps) {
  const utils = trpc.useUtils();

  // Plan fields
  const [name, setName] = useState('New Encounter');
  const [sceneDescription, setSceneDescription] = useState('');
  const [tacticalNotes, setTacticalNotes] = useState('');
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>('medium');
  const [partySize, setPartySize] = useState(defaultPartySize);
  const [partyLevel, setPartyLevel] = useState(defaultPartyLevel);
  const [creatures, setCreatures] = useState<CreatureRow[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(planId ?? null);

  // Load existing plan if planId provided
  const planQuery = trpc.encounterPlans.getById.useQuery(
    { planId: planId! },
    { enabled: !!planId }
  );

  useEffect(() => {
    const plan = planQuery.data;
    if (!plan) return;
    setName(plan.name);
    setSceneDescription(plan.sceneDescription ?? '');
    setTacticalNotes(plan.tacticalNotes ?? '');
    setDifficulty((plan.difficulty as EncounterDifficulty) ?? 'medium');
    setPartySize(plan.partySize ?? defaultPartySize);
    setPartyLevel(plan.partyLevel ?? defaultPartyLevel);
    setCreatures(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (plan.creatures as any[]).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        count: c.count as number,
        cr: (c.cr as string | null) ?? undefined,
        xp: (c.xp as number | null) ?? undefined,
        sourceType: c.sourceType as string,
        statBlock: c.statBlock as Record<string, unknown> | undefined,
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planQuery.data]);

  const generateMutation = trpc.encounterPlans.generate.useMutation({
    onSuccess: (plan) => {
      if (!plan) return;
      setActivePlanId(plan.id);
      setName(plan.name);
      setSceneDescription(plan.sceneDescription ?? '');
      setTacticalNotes(plan.tacticalNotes ?? '');
      setDifficulty((plan.difficulty as EncounterDifficulty) ?? 'medium');
      setCreatures(
        (plan.creatures as CreatureRow[]).map((c) => ({
          id: c.id,
          name: c.name,
          count: c.count,
          cr: c.cr ?? undefined,
          xp: c.xp ?? undefined,
          sourceType: c.sourceType,
          statBlock: c.statBlock as Record<string, unknown> | undefined,
        }))
      );
      toast.success('Encounter generated!');
    },
    onError: (err) => toast.error(err.message),
  });

  const addCreatureMutation = trpc.encounterPlans.addCreature.useMutation({
    onSuccess: (creature) => {
      if (!creature) return;
      setCreatures((prev) => [
        ...prev,
        {
          id: creature.id,
          name: creature.name,
          count: creature.count,
          cr: creature.cr ?? undefined,
          xp: creature.xp ?? undefined,
          sourceType: creature.sourceType,
          statBlock: creature.statBlock as Record<string, unknown> | undefined,
        },
      ]);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeCreatureMutation = trpc.encounterPlans.removeCreature.useMutation({
    onSuccess: (_, { creatureId }) => {
      setCreatures((prev) => prev.filter((c) => c.id !== creatureId));
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCreatureMutation = trpc.encounterPlans.updateCreature.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const updatePlanMutation = trpc.encounterPlans.update.useMutation({
    onSuccess: () => toast.success('Saved'),
    onError: (err) => toast.error(err.message),
  });

  const createPlanMutation = trpc.encounterPlans.create.useMutation({
    onSuccess: (plan) => {
      setActivePlanId(plan.id);
      void utils.encounterPlans.getByCampaign.invalidate({ campaignId });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = async (params: {
    userPrompt: string;
    partySize: number;
    partyLevel: number;
    difficulty: EncounterDifficulty;
  }) => {
    setPartySize(params.partySize);
    setPartyLevel(params.partyLevel);
    setDifficulty(params.difficulty);

    await generateMutation.mutateAsync({
      campaignId,
      name,
      ...params,
    });
  };

  const handleAddCreature = async (payload: {
    name: string;
    count: number;
    cr?: string;
    xp?: number;
    sourceType: 'srd' | 'npc' | 'homebrew' | 'custom';
    sourceId?: string;
    statBlock?: Record<string, unknown>;
  }) => {
    let pId: string = activePlanId ?? '';
    if (!pId) {
      // Auto-create the plan first
      const plan = await createPlanMutation.mutateAsync({
        campaignId,
        name,
        partySize,
        partyLevel,
        difficulty,
      });
      pId = plan.id;
    }

    await addCreatureMutation.mutateAsync({ planId: pId, ...payload });
  };

  const handleRemoveCreature = (creatureId: string) => {
    removeCreatureMutation.mutate({ creatureId });
  };

  const handleCountChange = (creatureId: string, count: number) => {
    setCreatures((prev) =>
      prev.map((c) => (c.id === creatureId ? { ...c, count } : c))
    );
    updateCreatureMutation.mutate({ creatureId, count });
  };

  const handleSave = async () => {
    if (!activePlanId) {
      // Create new plan
      const plan = await createPlanMutation.mutateAsync({
        campaignId,
        name,
        partySize,
        partyLevel,
        difficulty,
      });
      setActivePlanId(plan.id);
      return;
    }

    updatePlanMutation.mutate({
      planId: activePlanId!,
      name,
      sceneDescription,
      tacticalNotes,
      difficulty,
      partySize,
      partyLevel,
    });
  };

  const creaturesForCalc = creatures.map((c) => ({
    xp: c.xp ?? 0,
    count: c.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* Left column */}
      <div className="space-y-4">
        {/* Plan name + party info */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Encounter Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Party Size</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value) || 4)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Level</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={partyLevel}
                  onChange={(e) => setPartyLevel(parseInt(e.target.value) || 1)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Difficulty Meter */}
            <DifficultyMeter
              creatures={creaturesForCalc}
              partySize={partySize}
              partyLevel={partyLevel}
            />
          </CardContent>
        </Card>

        {/* AI Prompt */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">AI Generate</CardTitle>
          </CardHeader>
          <CardContent>
            <AiPromptPanel
              onGenerate={handleGenerate}
              defaultPartySize={partySize}
              defaultPartyLevel={partyLevel}
              loading={generateMutation.isPending}
            />
          </CardContent>
        </Card>

        {/* Creature list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Creatures ({creatures.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {creatures.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No creatures yet. Use AI Generate or add from the picker.
              </p>
            )}
            {creatures.map((creature) => (
              <CreatureRow
                key={creature.id}
                creature={creature}
                onRemove={() => handleRemoveCreature(creature.id)}
                onCountChange={(count) => handleCountChange(creature.id, count)}
              />
            ))}
          </CardContent>
        </Card>

        {/* Scene description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scene Description</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              placeholder="Describe the scene to read aloud to players..."
              className="min-h-[80px] text-sm resize-none"
            />
          </CardContent>
        </Card>

        {/* Tactical notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tactical Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={tacticalNotes}
              onChange={(e) => setTacticalNotes(e.target.value)}
              placeholder="DM tactics, positioning, environmental hazards..."
              className="min-h-[80px] text-sm resize-none"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSave}
            disabled={updatePlanMutation.isPending || createPlanMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Plan
          </Button>
        </div>
      </div>

      {/* Right column — Monster Picker */}
      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add Creatures</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MonsterPicker
            campaignId={campaignId}
            onAdd={handleAddCreature}
            className="h-[600px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
