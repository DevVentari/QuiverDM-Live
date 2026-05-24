'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import {
  EMPTY_ABILITY_SCORES,
  EMPTY_STAT_BLOCK,
  NpcPreview,
  StatBlockSection,
  StatBlockFormState,
  buildNpcStats,
  hydrateStatBlock,
} from '@/components/npc/npc-sheet-fields';

interface NpcEditSheetProps {
  npcId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NpcEditSheet({ npcId, open, onOpenChange }: NpcEditSheetProps) {
  const { campaignId } = useCampaign();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const npc = trpc.npcs.getById.useQuery(
    { id: npcId as string },
    { enabled: open && !!npcId, staleTime: 120_000 }
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faction, setFaction] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [statBlockOpen, setStatBlockOpen] = useState(false);
  const [behaviorProfileOpen, setBehaviorProfileOpen] = useState(false);
  const [defaultBehavior, setDefaultBehavior] = useState('');
  const [triggeredBehaviors, setTriggeredBehaviors] = useState<Array<{ condition: string; behavior: string }>>([]);
  const [criticalDialogue, setCriticalDialogue] = useState<Array<{ line: string; trigger: string }>>([]);
  const [behaviorDirty, setBehaviorDirty] = useState(false);
  const [statState, setStatState] = useState<StatBlockFormState>({
    ...EMPTY_STAT_BLOCK,
    abilityScores: { ...EMPTY_ABILITY_SCORES },
  });

  useEffect(() => {
    if (!npc.data) return;
    const data = npc.data as any;

    setName(data.name || '');
    setDescription(data.description || '');
    setFaction(data.faction || '');
    setSecrets(data.secrets || '');
    setImageUrl(data.imageUrl || '');
    setUploadError(null);
    setNameError(null);

    const hydratedStats = hydrateStatBlock(data.stats as any);
    setStatState(hydratedStats);
    const hasStats = Object.values(hydratedStats).some((value) => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(Boolean);
      }
      return Boolean(value);
    });
    setStatBlockOpen(hasStats);
  }, [npc.data]);

  const behaviorProfile = trpc.npcBehaviorProfiles.get.useQuery(
    { campaignId, worldEntityId: npcId as string },
    { enabled: open && !!npcId && behaviorProfileOpen, staleTime: 60_000 }
  );

  const upsertBehaviorProfile = trpc.npcBehaviorProfiles.upsert.useMutation({
    onSuccess: () => {
      setBehaviorDirty(false);
      toast({ description: 'Behavior profile saved.' });
    },
    onError: () => {
      toast({ variant: 'destructive', description: 'Failed to save behavior profile.' });
    },
  });

  useEffect(() => {
    if (!behaviorProfile.data) return;
    const p = behaviorProfile.data;
    setDefaultBehavior(p.defaultBehavior ?? '');
    setTriggeredBehaviors(
      Array.isArray(p.triggeredBehaviors)
        ? (p.triggeredBehaviors as Array<{ condition: string; behavior: string }>)
        : []
    );
    setCriticalDialogue(
      Array.isArray(p.criticalDialogue)
        ? (p.criticalDialogue as Array<{ line: string; trigger: string }>)
        : []
    );
    setBehaviorDirty(false);
  }, [behaviorProfile.data]);

  const utils = trpc.useUtils();
  const update = trpc.npcs.update.useMutation({
    onSuccess: async () => {
      if (!npcId) return;
      await Promise.all([
        utils.npcs.getById.invalidate({ id: npcId }),
        utils.npcs.getAll.invalidate({ campaignId }),
      ]);
      onOpenChange(false);
      toast({ title: 'NPC updated', description: 'Changes saved successfully.' });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', campaignId);
      const res = await fetch('/api/upload/npc-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setImageUrl(data.url);
      } else {
        setUploadError(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  function setStatField<K extends Exclude<keyof StatBlockFormState, 'abilityScores'>>(key: K, value: StatBlockFormState[K]) {
    setStatState((prev) => ({ ...prev, [key]: value }));
  }

  function setAbilityScore(key: keyof StatBlockFormState['abilityScores'], value: string) {
    setStatState((prev) => ({
      ...prev,
      abilityScores: { ...prev.abilityScores, [key]: value },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!npcId) return;
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    if (name.trim().length > 100) {
      setNameError('Name must be 100 characters or fewer');
      return;
    }

    update.mutate({
      id: npcId,
      name: name || undefined,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
      stats: buildNpcStats(statState),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit NPC</SheetTitle>
        </SheetHeader>

        {!npcId || npc.isLoading ? (
          <div className="mt-6 space-y-4 px-5">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : npc.isError || !npc.data ? (
          <div className="mt-6 mx-5 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {npc.error?.message || 'Failed to load NPC'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 pb-4 px-5">
            <NpcPreview
              name={name}
              faction={faction}
              description={description}
              imageUrl={imageUrl}
              uploading={uploading}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              fileInputRef={fileInputRef}
            />

            <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="label-overline mb-1">Identity</p>
                  <div className="section-rule" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setNameError(null);
                      }}
                      aria-invalid={!!nameError}
                    />
                    {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-faction">Faction</Label>
                    <Input
                      id="edit-faction"
                      value={faction}
                      onChange={(e) => setFaction(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="label-overline mb-1">Details</p>
                  <div className="section-rule" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="label-overline mb-1 flex items-center gap-1.5">
                    <Lock className="h-2.5 w-2.5" />
                    DM Only
                  </p>
                  <div className="section-rule" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-secrets">Secrets</Label>
                  <Textarea
                    id="edit-secrets"
                    value={secrets}
                    onChange={(e) => setSecrets(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Behavior Profile */}
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/30 transition-colors"
                  onClick={() => setBehaviorProfileOpen((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    Behavior Profile
                    {behaviorDirty && <span className="text-[10px] text-primary">unsaved</span>}
                  </span>
                  {behaviorProfileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {behaviorProfileOpen && (
                  <div className="px-3 pb-3 pt-1.5 flex flex-col gap-3 border-t border-border">
                    {/* Default behavior */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Default behavior</Label>
                      <Textarea
                        rows={2}
                        value={defaultBehavior}
                        placeholder="How this NPC acts by default at the table..."
                        onChange={(e) => { setDefaultBehavior(e.target.value); setBehaviorDirty(true); }}
                      />
                    </div>

                    {/* Triggered behaviors */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Triggered behaviors</Label>
                        <button type="button" className="text-xs text-primary hover:underline flex items-center gap-0.5"
                          onClick={() => { setTriggeredBehaviors((prev) => [...prev, { condition: '', behavior: '' }]); setBehaviorDirty(true); }}>
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </div>
                      {triggeredBehaviors.map((tb, i) => (
                        <div key={i} className="flex gap-1.5 items-start">
                          <div className="flex flex-col gap-1 flex-1">
                            <Input placeholder="Condition (e.g. shown empathy)" value={tb.condition}
                              onChange={(e) => {
                                setTriggeredBehaviors(prev => prev.map((x, j) => j === i ? { ...x, condition: e.target.value } : x));
                                setBehaviorDirty(true);
                              }} />
                            <Input placeholder="Behavior" value={tb.behavior}
                              onChange={(e) => {
                                setTriggeredBehaviors(prev => prev.map((x, j) => j === i ? { ...x, behavior: e.target.value } : x));
                                setBehaviorDirty(true);
                              }} />
                          </div>
                          <button type="button" aria-label="Remove triggered behavior"
                            onClick={() => { setTriggeredBehaviors(prev => prev.filter((_, j) => j !== i)); setBehaviorDirty(true); }}
                            className="text-muted-foreground hover:text-destructive transition-colors mt-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Critical dialogue */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Critical dialogue</Label>
                        <button type="button" className="text-xs text-primary hover:underline flex items-center gap-0.5"
                          onClick={() => { setCriticalDialogue((prev) => [...prev, { line: '', trigger: '' }]); setBehaviorDirty(true); }}>
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </div>
                      {criticalDialogue.map((cd, i) => (
                        <div key={i} className="flex gap-1.5 items-start">
                          <div className="flex flex-col gap-1 flex-1">
                            <Input placeholder="Line (e.g. Stone ain't supposed to breathe.)" value={cd.line}
                              onChange={(e) => {
                                setCriticalDialogue(prev => prev.map((x, j) => j === i ? { ...x, line: e.target.value } : x));
                                setBehaviorDirty(true);
                              }} />
                            <Input placeholder="Trigger (e.g. players ask about excavation)" value={cd.trigger}
                              onChange={(e) => {
                                setCriticalDialogue(prev => prev.map((x, j) => j === i ? { ...x, trigger: e.target.value } : x));
                                setBehaviorDirty(true);
                              }} />
                          </div>
                          <button type="button" aria-label="Remove dialogue line"
                            onClick={() => { setCriticalDialogue(prev => prev.filter((_, j) => j !== i)); setBehaviorDirty(true); }}
                            className="text-muted-foreground hover:text-destructive transition-colors mt-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Save button */}
                    <Button variant="outline" size="sm"
                      disabled={!behaviorDirty || upsertBehaviorProfile.isPending || !npcId}
                      onClick={() => {
                        if (!npcId) return;
                        upsertBehaviorProfile.mutate({
                          campaignId,
                          worldEntityId: npcId,
                          defaultBehavior: defaultBehavior || undefined,
                          triggeredBehaviors,
                          criticalDialogue,
                        });
                      }}>
                      {upsertBehaviorProfile.isPending ? 'Saving...' : 'Save behavior profile'}
                    </Button>
                  </div>
                )}
              </div>

              <StatBlockSection
                state={statState}
                setField={setStatField}
                setAbilityScore={setAbilityScore}
                open={statBlockOpen}
                onOpenChange={setStatBlockOpen}
              />

              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              {update.error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {update.error.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
