'use client';

import { useState, useEffect } from 'react';
import {
  Trash2, ChevronDown, ChevronRight, Save, Image,
  Leaf, Swords, Sparkles, Shield, BookOpen,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AiPromptPanel } from './ai-prompt-panel';
import { DifficultyMeter } from './difficulty-meter';
import { MonsterPicker } from './monster-picker';
import { StatBlockCard } from './stat-block-card';
import type { EncounterDifficulty } from './ai-prompt-panel';

interface EncounterBuilderProps {
  campaignId: string;
  planId?: string;
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
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 p-2.5 bg-card">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground shrink-0"
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            {creature.cr && <span>CR {creature.cr}</span>}
            {creature.xp && <span>· {creature.xp.toLocaleString()} XP ea.</span>}
            <Badge variant="outline" className="text-xs py-0 px-1 h-4">
              {creature.sourceType}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            className="w-6 h-6 rounded border border-border text-xs hover:bg-muted flex items-center justify-center font-bold"
            onClick={() => onCountChange(Math.max(1, creature.count - 1))}
          >−</button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums">{creature.count}</span>
          <button
            className="w-6 h-6 rounded border border-border text-xs hover:bg-muted flex items-center justify-center font-bold"
            onClick={() => onCountChange(Math.min(20, creature.count + 1))}
          >+</button>
        </div>

        <div className="text-xs text-amber-500/90 w-16 text-right shrink-0 tabular-nums font-medium">
          {creature.xp ? (creature.xp * creature.count).toLocaleString() + ' XP' : '—'}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {expanded && creature.statBlock && (
        <div className="border-t border-border p-3 bg-muted/20">
          <StatBlockCard monster={creature.statBlock as Parameters<typeof StatBlockCard>[0]['monster']} />
        </div>
      )}
    </div>
  );
}

export function EncounterBuilder({
  campaignId,
  planId,
  campaignSlug,
  defaultPartySize = 4,
  defaultPartyLevel = 1,
}: EncounterBuilderProps) {
  const utils = trpc.useUtils();

  const [name, setName] = useState('New Encounter');
  const [sceneDescription, setSceneDescription] = useState('');
  const [tacticalNotes, setTacticalNotes] = useState('');
  const [environmentalEffects, setEnvironmentalEffects] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>('medium');
  const [partySize, setPartySize] = useState(defaultPartySize);
  const [partyLevel, setPartyLevel] = useState(defaultPartyLevel);
  const [creatures, setCreatures] = useState<CreatureRow[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(planId ?? null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const planQuery = trpc.encounterPlans.getById.useQuery(
    { planId: planId! },
    { enabled: !!planId }
  );

  useEffect(() => {
    const plan = planQuery.data;
    if (!plan) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = plan as any;
    setName(p.name);
    setSceneDescription(p.sceneDescription ?? '');
    setTacticalNotes(p.tacticalNotes ?? '');
    setEnvironmentalEffects(p.environmentalEffects ?? '');
    setPortraitUrl(p.portraitUrl ?? '');
    setDifficulty((p.difficulty as EncounterDifficulty) ?? 'medium');
    setPartySize(p.partySize ?? defaultPartySize);
    setPartyLevel(p.partyLevel ?? defaultPartyLevel);
    setCreatures(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p.creatures as any[]).map((c: any) => ({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = plan as any;
      setActivePlanId(p.id);
      setName(p.name);
      setSceneDescription(p.sceneDescription ?? '');
      setTacticalNotes(p.tacticalNotes ?? '');
      setDifficulty((p.difficulty as EncounterDifficulty) ?? 'medium');
      setCreatures(
        (p.creatures as CreatureRow[]).map((c) => ({
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

  const deletePlanMutation = trpc.encounterPlans.delete.useMutation({
    onSuccess: () => {
      window.location.href = `/campaigns/${campaignSlug}/encounters`;
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
    await generateMutation.mutateAsync({ campaignId, name, ...params });
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
      const plan = await createPlanMutation.mutateAsync({
        campaignId, name, partySize, partyLevel, difficulty,
      });
      pId = plan.id;
    }
    await addCreatureMutation.mutateAsync({ planId: pId, ...payload });
  };

  const handleCountChange = (creatureId: string, count: number) => {
    setCreatures((prev) => prev.map((c) => (c.id === creatureId ? { ...c, count } : c)));
    updateCreatureMutation.mutate({ creatureId, count });
  };

  const handleSave = async () => {
    if (!activePlanId) {
      const plan = await createPlanMutation.mutateAsync({
        campaignId, name, partySize, partyLevel, difficulty,
      });
      setActivePlanId(plan.id);
      return;
    }
    updatePlanMutation.mutate({
      planId: activePlanId!,
      name,
      sceneDescription,
      tacticalNotes,
      environmentalEffects: environmentalEffects || undefined,
      portraitUrl: portraitUrl || undefined,
      difficulty,
      partySize,
      partyLevel,
    });
  };

  const handleConfirmDelete = () => {
    if (!activePlanId) return;
    deletePlanMutation.mutate({ planId: activePlanId });
    setConfirmDeleteOpen(false);
  };

  const creaturesForCalc = creatures.map((c) => ({ xp: c.xp ?? 0, count: c.count }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] gap-4 items-start">

      {/* ── Left column — tabbed form ─────────────────────────────────────── */}
      <div className="space-y-3">

        {/* Encounter name bar — always visible */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Encounter Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 font-medium text-base"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs text-muted-foreground">Party</Label>
                <Input
                  type="number" min={1} max={12}
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value) || 4)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs text-muted-foreground">Level</Label>
                <Input
                  type="number" min={1} max={20}
                  value={partyLevel}
                  onChange={(e) => setPartyLevel(parseInt(e.target.value) || 1)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Three-tab workspace */}
        <Tabs defaultValue="combat" className="w-full">
          <TabsList className="w-full justify-start gap-0 border-b border-border bg-transparent rounded-none px-0 mb-0">
            <TabsTrigger
              value="combat"
              className="flex items-center gap-1.5 px-4 data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              <Swords className="h-3.5 w-3.5" />
              Combat
            </TabsTrigger>
            <TabsTrigger
              value="story"
              className="flex items-center gap-1.5 px-4 data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Story
            </TabsTrigger>
            <TabsTrigger
              value="generate"
              className="flex items-center gap-1.5 px-4 data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Generate
            </TabsTrigger>
          </TabsList>

          {/* ── COMBAT tab ─────────────────────────────────────────────── */}
          <TabsContent value="combat" className="mt-3 space-y-3">
            {/* Difficulty meter */}
            <Card>
              <CardContent className="pt-3 pb-3">
                <DifficultyMeter
                  creatures={creaturesForCalc}
                  partySize={partySize}
                  partyLevel={partyLevel}
                />
              </CardContent>
            </Card>

            {/* Creature list */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-semibold">Creatures</span>
                    {creatures.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {creatures.length}
                      </Badge>
                    )}
                  </div>
                  {creatures.length > 0 && (
                    <span className="text-xs text-amber-500/80 font-medium tabular-nums">
                      {creaturesForCalc.reduce((s, c) => s + c.xp * c.count, 0).toLocaleString()} raw XP
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {creatures.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-md">
                      Add creatures from the picker →
                    </div>
                  ) : (
                    creatures.map((creature) => (
                      <CreatureRow
                        key={creature.id}
                        creature={creature}
                        onRemove={() => removeCreatureMutation.mutate({ creatureId: creature.id })}
                        onCountChange={(count) => handleCountChange(creature.id, count)}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── STORY tab ──────────────────────────────────────────────── */}
          <TabsContent value="story" className="mt-3 space-y-3">
            {/* Scene description */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-sky-400" />
                  Scene Description
                </Label>
                <Textarea
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  placeholder="Describe the scene to read aloud to players..."
                  className="min-h-[90px] text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Environmental effects */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                  Environmental Effects
                  <Badge variant="outline" className="text-xs py-0 px-1.5 h-4 font-normal">optional</Badge>
                </Label>
                <Textarea
                  value={environmentalEffects}
                  onChange={(e) => setEnvironmentalEffects(e.target.value)}
                  placeholder="Weather, terrain, lighting, hazards... e.g. Heavy rain (−2 ranged), slippery stone (DC 10 Athletics), dim torchlight..."
                  className="min-h-[80px] text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Tactical notes */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                  Tactical Notes
                </Label>
                <Textarea
                  value={tacticalNotes}
                  onChange={(e) => setTacticalNotes(e.target.value)}
                  placeholder="DM-only: monster tactics, positioning, lair actions, secret triggers..."
                  className="min-h-[80px] text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Portrait / Banner URL */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Image className="h-3.5 w-3.5 text-purple-400" />
                  Encounter Banner
                  <Badge variant="outline" className="text-xs py-0 px-1.5 h-4 font-normal">optional</Badge>
                </Label>
                <Input
                  value={portraitUrl}
                  onChange={(e) => setPortraitUrl(e.target.value)}
                  placeholder="https://... (image shown on encounter card)"
                  className="h-8 text-sm"
                />
                {portraitUrl && (
                  <div className="rounded overflow-hidden border border-border mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={portraitUrl}
                      alt="Banner preview"
                      className="w-full h-28 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI GENERATE tab ────────────────────────────────────────── */}
          <TabsContent value="generate" className="mt-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <AiPromptPanel
                  onGenerate={handleGenerate}
                  defaultPartySize={partySize}
                  defaultPartyLevel={partyLevel}
                  loading={generateMutation.isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save / Delete — always visible below tabs */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSave}
            disabled={updatePlanMutation.isPending || createPlanMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Plan
          </Button>
          {activePlanId && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={deletePlanMutation.isPending}
              onClick={() => {
                setConfirmDeleteOpen(true);
                return;
              }}
              title="Delete plan"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Right column — Monster Picker (sticky) ────────────────────────── */}
      <div className="lg:sticky lg:top-4">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Swords className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Add Creatures</span>
            </div>
            <MonsterPicker
              campaignId={campaignId}
              onAdd={handleAddCreature}
              className="h-[580px]"
            />
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete encounter plan?"
        description="This will permanently delete this plan and all its creatures. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
