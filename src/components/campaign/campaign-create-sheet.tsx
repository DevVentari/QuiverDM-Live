'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Check, ChevronLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { ADVENTURE_TEMPLATES, type AdventureTemplate } from '@/lib/adventure-templates';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = 1 | 2;

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-border/40">
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors',
            step > 1
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-amber-500/30 border-amber-500 text-amber-200'
          )}
        >
          {step > 1 ? <Check className="h-3 w-3" /> : '1'}
        </div>
        <span className={cn('text-xs', step === 1 ? 'text-amber-300' : 'text-muted-foreground/50')}>
          Identity
        </span>
      </div>
      <div className={cn('h-px flex-1', step > 1 ? 'bg-amber-500/30' : 'bg-border/30')} />
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors',
            step === 2
              ? 'bg-amber-500/30 border-amber-500 text-amber-200'
              : 'bg-transparent border-border/40 text-muted-foreground/40'
          )}
        >
          2
        </div>
        <span className={cn('text-xs', step === 2 ? 'text-amber-300' : 'text-muted-foreground/40')}>
          Extras
          <span className="ml-1 text-[10px] text-muted-foreground/30">optional</span>
        </span>
      </div>
    </div>
  );
}

export function CampaignCreateSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState('');
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [ddbUrl, setDdbUrl] = useState('');
  const [selectedAdventure, setSelectedAdventure] = useState<AdventureTemplate | null>(null);

  const createCampaign = trpc.campaigns.create.useMutation({
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const setDdbCampaignUrl = trpc.campaigns.setDdbCampaignUrl.useMutation();

  const importFromCampaign = trpc.charactersDndBeyond.importFromCampaign.useMutation({
    onError: () => {
      toast({
        title: 'Party import failed',
        description: 'Campaign created but party import failed. Try again from campaign settings.',
        variant: 'destructive',
      });
    },
  });

  const seedFromCreation = trpc.brain.seedFromCreation.useMutation({
    onError: () => {
      toast({
        title: 'World data not saved',
        description: 'Campaign created but world setup failed. Re-add it from campaign settings.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setName('');
      setDescription('');
      setBannerUrl(null);
      setNameError('');
      setDdbUrl('');
      setSelectedAdventure(null);
    }, 300);
  }

  function validateStep1() {
    if (!name.trim()) {
      setNameError('Campaign name is required');
      return false;
    }
    setNameError('');
    return true;
  }

  async function handleBannerUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload/campaign-banner', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setBannerUrl(data.url);
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload banner image.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate() {
    if (!validateStep1()) return;

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

    // Fire-and-forget post-creation extras
    if (ddbUrl.trim()) {
      setDdbCampaignUrl.mutate({ campaignId: campaign.id, url: ddbUrl.trim() });
      importFromCampaign.mutate({ campaignUrl: ddbUrl.trim(), campaignId: campaign.id });
    }

    if (selectedAdventure) {
      seedFromCreation.mutate({
        campaignId: campaign.id,
        worldSetup: {
          startingLocation: selectedAdventure.startingLocation,
          antagonistName: selectedAdventure.antagonistName,
          antagonistMotivation: selectedAdventure.antagonistMotivation,
          openingHook: selectedAdventure.openingHook,
          factions: selectedAdventure.factions.slice(0, 3),
        },
      });
    }

    await utils.campaigns.getAll.invalidate();
    handleClose();
    router.push(`/campaigns/${campaign.slug || campaign.id}`);
  }

  const isCreating =
    createCampaign.isPending ||
    seedFromCreation.isPending;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetTitle className="font-display text-lg">New Campaign</SheetTitle>
        </SheetHeader>

        <StepIndicator step={step} />

        {step === 1 ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">
                  Campaign Name <span className="text-amber-400">*</span>
                </Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                  placeholder="e.g. Curse of Strahd"
                  maxLength={100}
                  autoFocus
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short description of your campaign..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Banner Image</Label>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBannerUpload(file);
                  }}
                />
                {bannerUrl ? (
                  <div className="relative h-24 rounded-md overflow-hidden">
                    <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setBannerUrl(null)}
                      className="absolute top-1.5 right-1.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-20 border border-dashed border-border/50 rounded-md flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-amber-500/40 hover:text-amber-300/70 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span className="text-xs">Upload banner</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!name.trim() || isCreating}
                  onClick={() => { if (validateStep1()) handleCreate(); }}
                >
                  {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Skip to Create'}
                </Button>
                <Button
                  size="sm"
                  disabled={!name.trim()}
                  onClick={() => { if (validateStep1()) setStep(2); }}
                >
                  Continue →
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="ddb-url">D&amp;D Beyond Campaign URL</Label>
                <Input
                  id="ddb-url"
                  value={ddbUrl}
                  onChange={(e) => setDdbUrl(e.target.value)}
                  placeholder="https://www.dndbeyond.com/campaigns/..."
                />
                <p className="text-xs text-muted-foreground">
                  Links your party — imports characters automatically
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
                  <div className="h-px flex-1 bg-border/30" />
                  <span>or start from a published adventure</span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                <Label>Published Adventure Template</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ADVENTURE_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedAdventure(selectedAdventure?.id === t.id ? null : t)}
                      className={cn(
                        'text-left p-2.5 rounded-md border text-xs transition-colors',
                        selectedAdventure?.id === t.id
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                          : 'border-border/40 bg-card/30 text-muted-foreground hover:border-amber-500/30'
                      )}
                    >
                      <div className="font-medium leading-tight text-foreground/80 line-clamp-1">{t.title}</div>
                      <div className="text-muted-foreground/60 mt-0.5">Levels {t.levelRange}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Seeds your campaign with NPCs, locations, and encounters
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isCreating}
                  onClick={handleCreate}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  disabled={isCreating}
                  onClick={handleCreate}
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Create Campaign'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
