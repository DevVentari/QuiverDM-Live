'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, BookOpen, Scroll, Plus, Trash2, ChevronRight } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';
import { AdventurePicker } from '@/components/create/adventure-picker';
import { PartyImportStep } from '@/components/create/party-import-step';
import { cn } from '@/lib/utils';
import { type AdventureTemplate } from '@/lib/adventure-templates';

type Faction = { name: string; stance: 'ally' | 'neutral' | 'hostile' };

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors',
              s < current
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : s === current
                  ? 'bg-amber-500/30 border-amber-500 text-amber-200'
                  : 'bg-transparent border-border/40 text-muted-foreground/40'
            )}
          >
            {s}
          </div>
          {s < total && (
            <div className={cn('h-px w-6', s < current ? 'bg-amber-500/40' : 'bg-border/30')} />
          )}
        </div>
      ))}
    </div>
  );
}

function CampaignPreview({
  name,
  description,
  bannerUrl,
  adventure,
}: {
  name: string;
  description: string;
  bannerUrl: string | null;
  adventure: AdventureTemplate | null;
}) {
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      {bannerUrl ? (
        <img src={bannerUrl} alt="" className="h-24 w-full object-cover" />
      ) : adventure ? (
        <div className={cn('h-24 w-full bg-gradient-to-br', adventure.gradient)} />
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold truncate">
            {name || (adventure ? adventure.title : <span className="text-muted-foreground/40">Your Campaign</span>)}
          </h3>
          <Badge variant="outline" className="text-xs shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/10">
            Draft
          </Badge>
        </div>
        {adventure && !name && (
          <p className="text-[10px] text-amber-400/70">{adventure.levelRange} · {adventure.setting}</p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || adventure?.description || <span className="opacity-40">No description</span>}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/50 pt-1">
          <span>0 sessions</span>
          <span>·</span>
          <span>0 NPCs</span>
        </div>
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [path, setPath] = useState<'published' | 'original' | null>(null);
  const [selectedAdventure, setSelectedAdventure] = useState<AdventureTemplate | null>(null);
  const [ddbCampaignUrl, setDdbCampaignUrl] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [antagonistMotivation, setAntagonistMotivation] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [factions, setFactions] = useState<Faction[]>([]);
  const [storyText, setStoryText] = useState('');
  const [nameError, setNameError] = useState('');

  const settingsQuery = trpc.userSettings.getSettings.useQuery();
  const hasCobalt = settingsQuery.data?.hasDndBeyondCobaltCookie ?? false;

  const createCampaign = trpc.campaigns.create.useMutation({
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  const seedFromCreation = trpc.brain.seedFromCreation.useMutation();
  const importFromCampaign = trpc.charactersDndBeyond.importFromCampaign.useMutation();

  function handleSelectAdventure(adventure: AdventureTemplate) {
    setSelectedAdventure(adventure);
    setName(adventure.title);
    setDescription(adventure.description);
    setStartingLocation(adventure.startingLocation);
    setAntagonistName(adventure.antagonistName);
    setAntagonistMotivation(adventure.antagonistMotivation);
    setOpeningHook(adventure.openingHook);
    setFactions(adventure.factions.map((f) => ({ ...f })));
    setStoryText('');
  }

  function handleSelectPath(selected: 'published' | 'original') {
    setPath(selected);
    if (selected === 'original') {
      setSelectedAdventure(null);
      setName('');
      setDescription('');
      setStartingLocation('');
      setAntagonistName('');
      setAntagonistMotivation('');
      setOpeningHook('');
      setFactions([]);
      setStoryText('');
    }
  }

  async function handleBannerUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'JPEG, PNG, WebP, or GIF only', variant: 'destructive' });
      return;
    }
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/campaign-banner', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { url: string };
      setBannerUrl(data.url);
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploadingBanner(false);
    }
  }

  function canProceedStep1() {
    if (path === 'original') return true;
    if (path === 'published') return selectedAdventure !== null;
    return false;
  }

  async function handleCreate() {
    if (!name.trim()) {
      setNameError('Campaign name is required');
      return;
    }
    setNameError('');

    let campaign: { id: string; slug: string };
    try {
      campaign = await createCampaign.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        bannerUrl: bannerUrl ?? undefined,
      });
    } catch {
      return;
    }

    if (ddbCampaignUrl.trim()) {
      importFromCampaign.mutate({
        campaignUrl: ddbCampaignUrl.trim(),
        campaignId: campaign.id,
      });
    }

    const hasWorldData =
      startingLocation.trim() !== '' ||
      antagonistName.trim() !== '' ||
      openingHook.trim() !== '' ||
      storyText.trim() !== '' ||
      factions.some((f) => f.name.trim() !== '');

    if (hasWorldData) {
      seedFromCreation.mutate({
        campaignId: campaign.id,
        worldSetup: {
          startingLocation: startingLocation.trim() || undefined,
          antagonistName: antagonistName.trim() || undefined,
          antagonistMotivation: antagonistMotivation.trim() || undefined,
          openingHook: openingHook.trim() || undefined,
          factions: factions
            .filter((f) => f.name.trim() !== '')
            .map((f) => ({ name: f.name.trim(), stance: f.stance })),
        },
        storyText: storyText.trim() || undefined,
      });
    }

    router.push(`/campaigns/${campaign.slug || campaign.id}`);
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Campaign"
      preview={
        <CampaignPreview
          name={name}
          description={description}
          bannerUrl={bannerUrl}
          adventure={selectedAdventure}
        />
      }
    >
      <div className="glass-panel glass-grain rounded-xl p-6">
        <StepIndicator current={step} total={4} />

        {/* Step 1: Choose Path */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Step 1 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">Choose your path</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectPath('published')}
                className={cn(
                  'rounded-xl border p-5 text-left transition-all space-y-2',
                  path === 'published'
                    ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-border/50 hover:border-amber-500/30 hover:bg-stone-900/40'
                )}
              >
                <BookOpen className={cn('h-6 w-6', path === 'published' ? 'text-amber-400' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-semibold">Published Adventure</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose from 16 official 5e adventures</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPath('original')}
                className={cn(
                  'rounded-xl border p-5 text-left transition-all space-y-2',
                  path === 'original'
                    ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-border/50 hover:border-amber-500/30 hover:bg-stone-900/40'
                )}
              >
                <Scroll className={cn('h-6 w-6', path === 'original' ? 'text-amber-400' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-semibold">Original Campaign</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Build your own world from scratch</p>
                </div>
              </button>
            </div>

            {path === 'published' && (
              <AdventurePicker value={selectedAdventure} onChange={handleSelectAdventure} />
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" disabled={!canProceedStep1()} onClick={() => setStep(2)}>
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Party Import */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Step 2 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">Import your party</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Bring in your players from D&D Beyond. You can skip this and do it later.
              </p>
            </div>

            <PartyImportStep
              campaignUrl={ddbCampaignUrl}
              onChange={setDdbCampaignUrl}
              hasCobalt={hasCobalt}
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now →
                </button>
                <Button type="button" onClick={() => setStep(3)}>
                  Next
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: World Setup */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="label-overline mb-1">Step 3 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">World setup</h2>
              {selectedAdventure && (
                <p className="text-xs text-amber-400/70 mt-1">
                  Pre-filled from {selectedAdventure.title} — edit freely
                </p>
              )}
            </div>

            {/* Identity */}
            <div className="space-y-3">
              <p className="label-overline">Campaign Identity</p>
              <div className="section-rule" />
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="Curse of Strahd"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  aria-invalid={!!nameError}
                  maxLength={100}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="A Gothic horror adventure in the mists of Barovia..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Banner */}
            <div className="space-y-3">
              <p className="label-overline">Banner Image</p>
              <div className="section-rule" />
              <div
                className={cn(
                  'relative rounded-lg border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors cursor-pointer overflow-hidden',
                  uploadingBanner && 'pointer-events-none opacity-60'
                )}
                onClick={() => bannerInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) void handleBannerUpload(file);
                }}
              >
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleBannerUpload(file);
                  }}
                />
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Campaign banner" className="h-28 w-full object-cover rounded-lg" />
                ) : (
                  <div className="h-28 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex flex-col items-center justify-center gap-2">
                    {uploadingBanner ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground/50" />
                        <p className="text-xs text-muted-foreground/50">Drop an image or click to upload</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* World fields */}
            <div className="space-y-3">
              <p className="label-overline">World</p>
              <div className="section-rule" />
              <div className="rounded-lg border border-border/40 bg-stone-900/40 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startingLocation">Starting Location</Label>
                    <Input
                      id="startingLocation"
                      placeholder="Waterdeep"
                      value={startingLocation}
                      maxLength={200}
                      onChange={(e) => setStartingLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="antagonistName">Main Antagonist</Label>
                    <Input
                      id="antagonistName"
                      placeholder="Strahd von Zarovich"
                      value={antagonistName}
                      maxLength={200}
                      onChange={(e) => setAntagonistName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="antagonistMotivation">Antagonist Motivation</Label>
                  <Input
                    id="antagonistMotivation"
                    placeholder="Seeks to break an ancient curse..."
                    value={antagonistMotivation}
                    maxLength={200}
                    onChange={(e) => setAntagonistMotivation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openingHook">Opening Hook</Label>
                  <Input
                    id="openingHook"
                    placeholder="A merchant is found dead with a strange symbol..."
                    value={openingHook}
                    maxLength={200}
                    onChange={(e) => setOpeningHook(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Factions */}
            <div className="space-y-3">
              <p className="label-overline">Factions</p>
              <div className="section-rule" />
              <div className="space-y-2">
                {factions.map((faction, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                    <Input
                      placeholder="Faction name"
                      value={faction.name}
                      maxLength={100}
                      onChange={(e) =>
                        setFactions((prev) => prev.map((f, i) => (i === idx ? { ...f, name: e.target.value } : f)))
                      }
                    />
                    <Select
                      value={faction.stance}
                      onValueChange={(v) =>
                        setFactions((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, stance: v as 'ally' | 'neutral' | 'hostile' } : f))
                        )
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ally">Ally</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="hostile">Hostile</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => setFactions((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {factions.length < 3 && (
                <button
                  type="button"
                  onClick={() => setFactions((prev) => [...prev, { name: '', stance: 'neutral' }])}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add faction
                </button>
              )}
            </div>

            {/* Story So Far */}
            <div className="space-y-3">
              <p className="label-overline">Story So Far</p>
              <div className="section-rule" />
              <Textarea
                placeholder="Note where in the adventure you're starting, or paste campaign history..."
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                maxLength={20000}
                rows={4}
                className="resize-none"
              />
              {storyText.length > 0 && (
                <p className="text-xs text-muted-foreground">{storyText.length.toLocaleString()} / 20,000</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <Button type="button" onClick={() => setStep(4)}>
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm & Create */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Step 4 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">Confirm & create</h2>
            </div>

            <div className="rounded-lg border border-border/40 bg-stone-900/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Adventure</p>
                  <p className="text-sm font-medium">
                    {selectedAdventure ? selectedAdventure.title : 'Original Campaign'}
                  </p>
                </div>
                {selectedAdventure && (
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">
                    {selectedAdventure.levelRange}
                  </Badge>
                )}
              </div>
              <div className="h-px bg-border/30" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{name || <span className="text-muted-foreground/50">Not set</span>}</p>
              </div>
              {startingLocation && (
                <div>
                  <p className="text-xs text-muted-foreground">Starting Location</p>
                  <p className="text-sm">{startingLocation}</p>
                </div>
              )}
              {antagonistName && (
                <div>
                  <p className="text-xs text-muted-foreground">Antagonist</p>
                  <p className="text-sm">{antagonistName}</p>
                </div>
              )}
              <div className="h-px bg-border/30" />
              <div>
                <p className="text-xs text-muted-foreground">Party Import</p>
                <p className="text-sm">
                  {ddbCampaignUrl ? 'D&D Beyond campaign linked — importing on creation' : 'No party imported yet'}
                </p>
              </div>
            </div>

            {createCampaign.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {createCampaign.error.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <Button type="button" onClick={() => void handleCreate()} disabled={createCampaign.isPending}>
                {createCampaign.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Campaign'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CreatePageShell>
  );
}
