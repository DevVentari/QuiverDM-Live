'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Loader2,
  Upload,
  Check,
  ChevronLeft,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { ADVENTURE_TEMPLATES, type AdventureTemplate } from '@/lib/adventure-templates';
import { WORLD_SOURCEBOOKS, type WorldSourcebook } from '@/lib/world-sourcebooks';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = 1 | 2;

function ShellPanel({
  eyebrow,
  title,
  description,
  children,
  className = '',
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'q-panel-grain relative overflow-hidden rounded-[20px] border border-[var(--q-border-feature)]',
        'bg-[color-mix(in_oklab,var(--q-surface-utility)_82%,transparent)]',
        'shadow-[0_18px_50px_-34px_rgba(0,0,0,0.75)] backdrop-blur-sm',
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--q-amber-border)]/70 to-transparent" />
      <div className="relative z-10 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {eyebrow && <p className="label-overline">{eyebrow}</p>}
            <h3 className="font-[var(--q-font-display)] text-base text-[var(--q-text)] sm:text-lg">
              {title}
            </h3>
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--q-text-dim)]">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function AdventureCard({
  template,
  selected,
  onClick,
  compact = false,
  testId,
}: {
  template: AdventureTemplate;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'group relative overflow-hidden rounded-[18px] border text-left transition-all duration-200',
        'min-h-[88px] border-[var(--q-border-subtle)] bg-[color-mix(in_oklab,var(--q-surface-utility)_78%,transparent)]',
        'hover:-translate-y-0.5 hover:border-[var(--q-amber-border)] hover:shadow-[0_18px_45px_-30px_rgba(0,0,0,0.9)]',
        selected &&
          'border-[var(--q-amber-border)] bg-[color-mix(in_oklab,var(--q-amber-trace)_22%,var(--q-surface-utility))] shadow-[0_20px_46px_-30px_rgba(0,0,0,0.95)]',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 transition-opacity',
          template.gradient,
          selected ? 'opacity-95' : 'opacity-55 group-hover:opacity-80',
        )}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,10,18,0.82),rgba(7,10,18,0.55)_45%,rgba(7,10,18,0.18))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="relative z-10 flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text)]">
              {template.title}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[var(--q-text-faint)]">
              {template.setting}
            </div>
          </div>
          <div
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]',
              selected
                ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                : 'border-white/10 bg-white/[0.03] text-[var(--q-text-faint)]',
            )}
          >
            {template.levelRange}
          </div>
        </div>
        {!compact && (
          <p className="line-clamp-2 text-xs leading-snug text-[var(--q-text-dim)]">
            {template.description}
          </p>
        )}
      </div>
    </button>
  );
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="px-6 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                step >= 1
                  ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'border-white/10 bg-white/[0.02] text-[var(--q-text-faint)]',
              )}
            >
              {step > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">
                Step 1
              </p>
              <p className={cn('font-[var(--q-font-display)] text-sm', step === 1 && 'text-[var(--q-amber)]')}>
                Identity
              </p>
            </div>
          </div>
          <div className={cn('h-px flex-1 bg-gradient-to-r from-[var(--q-amber-border)]/70 to-transparent', step > 1 ? 'opacity-100' : 'opacity-40')} />
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                step === 2
                  ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'border-white/10 bg-white/[0.02] text-[var(--q-text-faint)]',
              )}
            >
              2
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">
                Step 2
              </p>
              <p className={cn('font-[var(--q-font-display)] text-sm', step === 2 && 'text-[var(--q-amber)]')}>
                Seed the world
              </p>
            </div>
          </div>
        </div>
        <span className="hidden rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)] sm:inline-flex">
          DM-first workflow
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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState('');
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [ddbUrl, setDdbUrl] = useState('');
  const [selectedAdventure, setSelectedAdventure] = useState<AdventureTemplate | null>(null);
  const [selectedWorldSourcebook, setSelectedWorldSourcebook] = useState<WorldSourcebook | null>(null);
  const [selectedDdbSourcebookId, setSelectedDdbSourcebookId] = useState<string | null>(null);

  const ddbEntitlementsQuery = trpc.ddbSync.getEntitlements.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const ddbSourcebooks = (ddbEntitlementsQuery.data ?? [])
    .filter((e: any) => e.sourcebook?.id)
    .map((e: any) => ({ id: e.sourcebook.id as string, title: e.title as string, slug: e.slug as string }));

  const linkDdbSourcebook = trpc.ddbSync.linkSourcebookToCampaign.useMutation({
    onError: () => {
      toast({
        title: 'Sourcebook link failed',
        description: 'Campaign created but the sourcebook could not be linked. Try again from the Compendium.',
        variant: 'destructive',
      });
    },
  });

  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [storyText, setStoryText] = useState('');

  const applyAdventureTemplate = (template: AdventureTemplate | null) => {
    setSelectedAdventure(template);
    setStartingLocation(template?.startingLocation ?? '');
    setAntagonistName(template?.antagonistName ?? '');
    setOpeningHook(template?.openingHook ?? '');
    setStoryText(template?.description ?? '');
  };

  const featuredAdventureIds = ['lmop', 'idrotf'] as const;
  const featuredAdventures = featuredAdventureIds
    .map((id) => ADVENTURE_TEMPLATES.find((template) => template.id === id))
    .filter((template): template is AdventureTemplate => !!template);

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

  const seedFromWorldSourcebook = trpc.campaigns.seedFromWorldSourcebook.useMutation({
    onError: () => {
      toast({
        title: 'World sourcebook import failed',
        description: 'Campaign created but world content could not be copied. Try again from campaign settings.',
        variant: 'destructive',
      });
    },
  });

  function resetState() {
    setTimeout(() => {
      setStep(1);
      setName('');
      setDescription('');
      setBannerUrl(null);
      setNameError('');
      setDdbUrl('');
      setSelectedAdventure(null);
      setSelectedWorldSourcebook(null);
      setSelectedDdbSourcebookId(null);
      setStartingLocation('');
      setAntagonistName('');
      setOpeningHook('');
      setStoryText('');
    }, 300);
  }

  function handleClose() {
    onOpenChange(false);
    resetState();
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

    if (ddbUrl.trim()) {
      setDdbCampaignUrl.mutate({ campaignId: campaign.id, url: ddbUrl.trim() });
      importFromCampaign.mutate({ campaignUrl: ddbUrl.trim(), campaignId: campaign.id });
    }

    if (selectedWorldSourcebook) {
      seedFromWorldSourcebook.mutate({ campaignId: campaign.id, sourceSlug: selectedWorldSourcebook.sourceSlug });
    }

    if (selectedDdbSourcebookId) {
      try {
        await linkDdbSourcebook.mutateAsync({ campaignId: campaign.id, sourcebookId: selectedDdbSourcebookId });
      } catch {
        // Mutation-level toast already communicates the failure.
      }
    }

    const shouldSeed =
      !!startingLocation.trim() ||
      !!antagonistName.trim() ||
      !!openingHook.trim() ||
      !!storyText.trim() ||
      selectedAdventure !== null;

    if (shouldSeed) {
      try {
        await seedFromCreation.mutateAsync({
          campaignId: campaign.id,
          worldSetup: {
            startingLocation: startingLocation.trim() || undefined,
            antagonistName: antagonistName.trim() || undefined,
            antagonistMotivation: selectedAdventure?.antagonistMotivation,
            openingHook: openingHook.trim() || undefined,
            factions: selectedAdventure?.factions.slice(0, 3),
          },
          storyText: storyText.trim() || undefined,
        });
      } catch {
        // Mutation-level toast already communicates the failure.
      }
    }

    await utils.campaigns.getAll.invalidate();
    onOpenChange(false);
    resetState();
    const dest = ddbUrl.trim()
      ? `/campaigns/${campaign.slug || campaign.id}/players?ddb-importing=true`
      : `/campaigns/${campaign.slug || campaign.id}`;
    router.push(dest);
  }

  // importFromCampaign is intentionally excluded - it's fire-and-forget after navigate.
  const isCreating =
    createCampaign.isPending ||
    seedFromCreation.isPending ||
    seedFromWorldSourcebook.isPending ||
    linkDdbSourcebook.isPending;

  const selectedSeedLabel = selectedAdventure?.title ?? 'Blank slate';
  const ddbConnectionLabel = ddbUrl.trim() ? 'D&D Beyond linked' : 'No party import';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          '!fixed !left-auto !right-0 !inset-y-0 !h-[100dvh] !w-[min(42rem,calc(100vw-1rem))] !max-w-none overflow-hidden p-0 text-[var(--q-text)]',
          'border-l border-[var(--q-border-feature)]',
          'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--q-surface-feature)_94%,black)_0%,var(--q-surface-feature)_100%)]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 q-hero-glow opacity-90" />
        <div className="pointer-events-none absolute inset-0 q-panel-grain opacity-70" />
        <div className="relative z-10 flex h-full flex-col">
          <div className="sticky top-0 z-20 border-b border-[var(--q-border-feature)]/70 bg-[color-mix(in_oklab,var(--q-surface-feature)_90%,black)]/95 px-6 py-6 backdrop-blur-md sm:px-8">
            <SheetHeader className="space-y-2 text-left">
              <p className="label-overline">Campaign Forge</p>
              <SheetTitle className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] sm:text-3xl">
                Forge a new campaign
              </SheetTitle>
              <p className="max-w-3xl text-sm leading-relaxed text-[var(--q-text-dim)] sm:text-base">
                Name the world, choose whether QuiverDM should seed it with a published adventure,
                and decide what imports should happen the moment the campaign is born.
              </p>
            </SheetHeader>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">Campaign</p>
                <p className="mt-1 truncate font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
                  {name.trim() || 'Unnamed campaign'}
                </p>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">Seed</p>
                <p className="mt-1 truncate font-[var(--q-font-display)] text-sm text-[var(--q-amber)]">
                  {selectedSeedLabel}
                </p>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">Import</p>
                <p className="mt-1 truncate font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
                  {ddbConnectionLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="sticky top-[calc(1px+8.75rem)] z-20 border-b border-[var(--q-border-feature)]/55 bg-[color-mix(in_oklab,var(--q-surface-feature)_88%,black)]/95 backdrop-blur-md">
            <StepIndicator step={step} />
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {step === 1 ? (
              <div className="space-y-5 px-6 pb-6 lg:px-8">
                <div className="space-y-5">
                  <ShellPanel
                    eyebrow="Identity"
                    title="Give the campaign a name"
                    description="The name appears in the rail, the dashboard, and every session surface that follows."
                  >
                    <div className="grid gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="campaign-name">
                          Campaign Name <span className="text-[var(--q-amber)]">*</span>
                        </Label>
                        <Input
                          id="campaign-name"
                          value={name}
                          onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                          placeholder="e.g. Curse of Strahd"
                          maxLength={100}
                          autoFocus
                          className="h-11 border-[var(--q-border-subtle)] bg-black/10"
                        />
                        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="campaign-description">Description</Label>
                        <Textarea
                          id="campaign-description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="A short description of your campaign..."
                          rows={4}
                          className="border-[var(--q-border-subtle)] bg-black/10"
                        />
                      </div>
                    </div>
                  </ShellPanel>

                  <ShellPanel
                    eyebrow="Banner"
                    title="Mark the campaign with an image"
                    description="A banner helps the campaign feel like a place, not a list item."
                    action={<Sparkles className="mt-1 h-4 w-4 text-[var(--q-amber)]" />}
                  >
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
                      <div className="relative overflow-hidden rounded-[18px] border border-white/10">
                        <div className="relative h-40">
                          <Image src={bannerUrl} alt="" fill className="object-cover" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                        <button
                          type="button"
                          onClick={() => setBannerUrl(null)}
                          className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/90 transition-colors hover:bg-black/75"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={uploading}
                        className={cn(
                          'flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed',
                          'border-white/12 bg-black/10 text-[var(--q-text-dim)] transition-colors',
                          'hover:border-[var(--q-amber-border)] hover:text-[var(--q-text)]',
                        )}
                      >
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[var(--q-amber)]" />
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-[var(--q-amber)]" />
                            <span className="text-sm font-medium">Upload a banner</span>
                            <span className="text-xs text-[var(--q-text-faint)]">
                              JPEG, PNG, or WebP
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </ShellPanel>
                </div>

                <div className="sticky bottom-0 z-20 flex flex-col-reverse gap-3 border-t border-[var(--q-border-feature)]/70 bg-[color-mix(in_oklab,var(--q-surface-feature)_90%,black)]/95 px-1 pt-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="h-11 px-4 text-[var(--q-text-dim)] hover:text-[var(--q-text)]"
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!name.trim() || isCreating}
                      onClick={() => { if (validateStep1()) handleCreate(); }}
                      className="h-11 px-4"
                    >
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Skip to Create'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!name.trim()}
                      onClick={() => { if (validateStep1()) setStep(2); }}
                      className="h-11 px-5"
                    >
                      Continue &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 px-6 pb-6 lg:px-8">
                <div className="space-y-5">
                  <ShellPanel
                    eyebrow="Connection"
                    title="Bring your table into the forge"
                    description="If you paste a D&D Beyond campaign URL, QuiverDM will try to import the party immediately."
                    action={<ScrollText className="mt-1 h-4 w-4 text-[var(--q-amber)]" />}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="ddb-url">D&amp;D Beyond Campaign URL</Label>
                      <Input
                        id="ddb-url"
                        value={ddbUrl}
                        onChange={(e) => setDdbUrl(e.target.value)}
                        placeholder="https://www.dndbeyond.com/campaigns/..."
                        className="h-11 border-[var(--q-border-subtle)] bg-black/10"
                      />
                      <p className="text-xs text-[var(--q-text-faint)]">
                        Links your party and imports characters automatically.
                      </p>
                    </div>

                    {ddbSourcebooks.length > 0 && (
                      <div className="mt-5 space-y-3">
                        <div className="flex items-center gap-3 text-xs text-[var(--q-text-faint)]">
                          <div className="h-px flex-1 bg-white/10" />
                          <span>or use a sourcebook you own</span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">
                            D&amp;D Beyond sourcebooks
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ddbSourcebooks.map((sb) => (
                              <button
                                key={sb.id}
                                type="button"
                                onClick={() => setSelectedDdbSourcebookId(selectedDdbSourcebookId === sb.id ? null : sb.id)}
                                className={cn(
                                  'rounded-[16px] border p-4 text-left text-xs transition-colors',
                                  selectedDdbSourcebookId === sb.id
                                    ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-text)]'
                                    : 'border-white/10 bg-white/[0.03] text-[var(--q-text-dim)] hover:border-[var(--q-amber-border)]/60 hover:text-[var(--q-text)]',
                                )}
                                data-testid={`create-ddb-sb-${sb.slug}`}
                              >
                                <div className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
                                  {sb.title}
                                </div>
                                <div className="mt-1 leading-snug">
                                  Links the new campaign to this sourcebook&apos;s imported items and creatures.
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {WORLD_SOURCEBOOKS.length > 0 && (
                      <div className="mt-5 space-y-3">
                        <div className="flex items-center gap-3 text-xs text-[var(--q-text-faint)]">
                          <div className="h-px flex-1 bg-white/10" />
                          <span>or load a homebrew world</span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--q-text-faint)]">
                            Homebrew sourcebooks
                          </p>
                          <div className="grid gap-2">
                            {WORLD_SOURCEBOOKS.map((wb) => (
                              <button
                                key={wb.id}
                                type="button"
                                onClick={() => setSelectedWorldSourcebook(selectedWorldSourcebook?.id === wb.id ? null : wb)}
                                className={cn(
                                  'rounded-[16px] border p-4 text-left text-xs transition-colors',
                                  selectedWorldSourcebook?.id === wb.id
                                    ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-text)]'
                                    : 'border-white/10 bg-white/[0.03] text-[var(--q-text-dim)] hover:border-[var(--q-amber-border)]/60 hover:text-[var(--q-text)]',
                                )}
                              >
                                <div className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
                                  {wb.title}
                                </div>
                                <div className="mt-1 leading-snug">{wb.subtitle}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {wb.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full border border-white/8 bg-black/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--q-text-faint)]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </ShellPanel>

                  <ShellPanel
                    eyebrow="Preseed"
                    title="Featured starting paths"
                    description="LMOP and Rime of the Frostmaiden are surfaced first because they were the v2 presets you called out."
                    action={<Sparkles className="mt-1 h-4 w-4 text-[var(--q-amber)]" />}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {featuredAdventures.map((template) => (
                        <AdventureCard
                          key={template.id}
                          template={template}
                          selected={selectedAdventure?.id === template.id}
                          onClick={() => applyAdventureTemplate(selectedAdventure?.id === template.id ? null : template)}
                          testId={`featured-seed-${template.id}`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[var(--q-text-faint)]">
                      Choosing one pre-fills the world anchors below so your campaign starts with a pulse.
                    </p>
                  </ShellPanel>

                  <ShellPanel
                    eyebrow="Catalog"
                    title="Browse the full published adventure library"
                    description="If you want a different official 5e start, the full catalog is still here."
                  >
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {ADVENTURE_TEMPLATES.map((template) => (
                        <AdventureCard
                          key={template.id}
                          template={template}
                          selected={selectedAdventure?.id === template.id}
                          onClick={() => applyAdventureTemplate(selectedAdventure?.id === template.id ? null : template)}
                          compact
                        />
                      ))}
                    </div>
                  </ShellPanel>

                  <ShellPanel
                    eyebrow="Story anchors"
                    title="Seed the campaign brain"
                    description="These fields are optional, but they make the first session and the DM Brain more useful."
                  >
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startingLocation">Starting Location</Label>
                        <Input
                          id="startingLocation"
                          value={startingLocation}
                          onChange={(e) => setStartingLocation(e.target.value)}
                          maxLength={200}
                          placeholder="e.g. Waterdeep, the City of Splendors"
                          className="h-11 border-[var(--q-border-subtle)] bg-black/10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="antagonistName">Main Antagonist</Label>
                        <Input
                          id="antagonistName"
                          value={antagonistName}
                          onChange={(e) => setAntagonistName(e.target.value)}
                          maxLength={200}
                          placeholder="e.g. Xanathar"
                          className="h-11 border-[var(--q-border-subtle)] bg-black/10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="openingHook">Opening Hook</Label>
                        <Textarea
                          id="openingHook"
                          value={openingHook}
                          onChange={(e) => setOpeningHook(e.target.value)}
                          maxLength={200}
                          rows={3}
                          placeholder="What pulls the party into the first problem?"
                          className="border-[var(--q-border-subtle)] bg-black/10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="storyText">Story So Far</Label>
                        <Textarea
                          id="storyText"
                          value={storyText}
                          onChange={(e) => setStoryText(e.target.value)}
                          maxLength={20000}
                          rows={5}
                          placeholder="Optional notes to queue for DM Brain ingestion."
                          className="border-[var(--q-border-subtle)] bg-black/10"
                        />
                        <p className="text-right text-xs text-[var(--q-text-faint)]">
                          {storyText.length}/20000
                        </p>
                      </div>
                    </div>
                  </ShellPanel>
                </div>

                <div className="sticky bottom-0 z-20 flex flex-col-reverse gap-3 border-t border-[var(--q-border-feature)]/70 bg-[color-mix(in_oklab,var(--q-surface-feature)_90%,black)]/95 pt-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="h-11 px-4 text-[var(--q-text-dim)] hover:text-[var(--q-text)]"
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isCreating}
                      onClick={handleCreate}
                      className="h-11 px-4 text-[var(--q-text-dim)] hover:text-[var(--q-text)]"
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      disabled={isCreating}
                      onClick={handleCreate}
                      className="h-11 px-5"
                    >
                      {isCreating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Create Campaign'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
