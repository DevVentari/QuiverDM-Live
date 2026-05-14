'use client';

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';
import {
  NpcPreview,
  StatBlockSection,
  buildNpcStats,
  EMPTY_ABILITY_SCORES,
  EMPTY_STAT_BLOCK,
  StatBlockFormState,
} from '@/components/npc/npc-sheet-fields';

interface NpcCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (npcId: string) => void;
}

export function NpcCreateSheet({ open, onOpenChange, onSuccess }: NpcCreateSheetProps) {
  const { campaignId } = useCampaign();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [faction, setFaction] = useState('');
  const [description, setDescription] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [statState, setStatState] = useState<StatBlockFormState>({
    ...EMPTY_STAT_BLOCK,
    abilityScores: { ...EMPTY_ABILITY_SCORES },
  });

  const utils = trpc.useUtils();

  function resetForm() {
    setName('');
    setFaction('');
    setDescription('');
    setSecrets('');
    setImageUrl('');
    setUploading(false);
    setUploadError(null);
    setNameError(null);
    setStatState({
      ...EMPTY_STAT_BLOCK,
      abilityScores: { ...EMPTY_ABILITY_SCORES },
    });
  }

  const create = trpc.npcs.create.useMutation({
    onSuccess: (data) => {
      void utils.npcs.getAll.invalidate({ campaignId });
      onSuccess?.(data.id);
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    if (name.trim().length > 100) {
      setNameError('Name must be 100 characters or fewer');
      return;
    }

    create.mutate({
      campaignId,
      name,
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
          <SheetTitle>New NPC</SheetTitle>
        </SheetHeader>

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
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Strahd von Zarovich"
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
                  <Label htmlFor="faction">Faction</Label>
                  <Input
                    id="faction"
                    placeholder="Castle Ravenloft"
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="A pale figure with piercing eyes..."
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
                <Label htmlFor="secrets">Secrets</Label>
                <Textarea
                  id="secrets"
                  placeholder="Hidden motivations, secret weaknesses..."
                  value={secrets}
                  onChange={(e) => setSecrets(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <StatBlockSection
              state={statState}
              setField={setStatField}
              setAbilityScore={setAbilityScore}
            />

            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            {create.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {create.error.message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create NPC'
                )}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
