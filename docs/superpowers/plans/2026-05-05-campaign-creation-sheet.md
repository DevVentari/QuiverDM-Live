# Campaign Creation Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-step full-page campaign creation wizard with a 2-step Sheet component that opens from the campaigns list page.

**Architecture:** A new `CampaignCreateSheet` component handles all creation logic (name/description/banner in Step 1, DDB URL and adventure template in optional Step 2). The campaigns list page gains `?create=true` URL state to drive the sheet open/close. The old wizard pages are deleted.

**Tech Stack:** Next.js 15 App Router, tRPC v11, shadcn Sheet, Tailwind, Lucide icons, `useSearchParams` / `useRouter` for URL state.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/components/campaign/campaign-create-sheet.tsx` |
| Modify | `src/app/(app)/campaigns/page.tsx` |
| Replace | `src/app/(app)/campaigns/new/page.tsx` (redirect only) |
| Delete | `src/app/(app)/campaigns/new/import-obsidian/page.tsx` |

---

### Task 1: Create `CampaignCreateSheet` component

**Files:**
- Create: `src/components/campaign/campaign-create-sheet.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
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
    // Reset state after animation settles
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
    importFromCampaign.isPending ||
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign/campaign-create-sheet.tsx
git commit -m "feat(campaigns): add CampaignCreateSheet 2-step sheet component"
```

---

### Task 2: Wire sheet into campaigns list page

**Files:**
- Modify: `src/app/(app)/campaigns/page.tsx`

The page is currently a `'use client'` component that links to `/campaigns/new`. Replace that button with a state-driven sheet opener, and add `useSearchParams` to support `?create=true`.

- [ ] **Step 1: Rewrite `campaigns/page.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Plus, Shield, Users } from 'lucide-react';
import { CampaignCreateSheet } from '@/components/campaign/campaign-create-sheet';

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaigns = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 120_000 });

  const sheetOpen = searchParams.get('create') === 'true';

  function openSheet() {
    router.push('?create=true');
  }

  function closeSheet() {
    router.replace('/campaigns');
  }

  return (
    <div className="space-y-6 max-w-6xl 2xl:max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div>
        <p className="label-overline mb-1">Campaigns</p>
        <div className="section-rule" />
        <div className="flex items-center justify-between mt-3">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wide">Campaigns</h1>
          <Button onClick={openSheet}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      {campaigns.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : campaigns.data && campaigns.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.data.map((campaign: any) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.slug || campaign.id}`}
            >
              <div className="stone-card overflow-hidden hover:border-amber-700/40 transition-colors cursor-pointer h-full flex flex-col">
                <div className="relative h-24 w-full shrink-0">
                  {campaign.bannerUrl ? (
                    <Image
                      src={campaign.bannerUrl}
                      alt={campaign.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(240,15%,13%)] via-[hsl(250,20%,10%)] to-[hsl(35,30%,8%)]">
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(35,60%,40%), transparent 60%), radial-gradient(circle at 80% 20%, hsl(260,40%,30%), transparent 50%)' }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(240,10%,11%)] via-transparent to-transparent" />
                  {campaign.status && (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-xs capitalize">
                      {campaign.status}
                    </Badge>
                  )}
                </div>

                <div className="stone-card-header flex-1">
                  <span className="stone-card-title">{campaign.name}</span>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {campaign.description || 'No description'}
                  </p>
                </div>

                <div className="stone-card-body">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{campaign._count?.gameSessions ?? 0} sessions</span>
                    <span>{campaign._count?.npcs ?? 0} NPCs</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign._count?.members ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Create a campaign to start your adventure — invite players, track sessions, and manage your world.
            </p>
            <Button size="sm" onClick={openSheet}>
              New Campaign
            </Button>
          </div>
        </div>
      )}

      <CampaignCreateSheet open={sheetOpen} onOpenChange={(o) => { if (!o) closeSheet(); }} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/campaigns/page.tsx
git commit -m "feat(campaigns): wire CampaignCreateSheet into campaigns list via ?create=true"
```

---

### Task 3: Replace `/campaigns/new` with redirect

**Files:**
- Replace: `src/app/(app)/campaigns/new/page.tsx`

The wizard page gets deleted and replaced with a one-line redirect so old links and bookmarks don't 404.

- [ ] **Step 1: Overwrite the file with a redirect**

```tsx
import { redirect } from 'next/navigation';

export default function NewCampaignPage() {
  redirect('/campaigns?create=true');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/campaigns/new/page.tsx
git commit -m "feat(campaigns): redirect /campaigns/new to /campaigns?create=true"
```

---

### Task 4: Delete the import-obsidian sub-route

**Files:**
- Delete: `src/app/(app)/campaigns/new/import-obsidian/page.tsx`

This route is no longer accessible (the `/new` page now redirects before reaching it) but the file should be cleaned up.

- [ ] **Step 1: Delete the file and empty directory**

```bash
rm src/app/(app)/campaigns/new/import-obsidian/page.tsx
rmdir src/app/(app)/campaigns/new/import-obsidian
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A src/app/(app)/campaigns/new/
git commit -m "chore(campaigns): remove import-obsidian sub-route"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3847/campaigns`.

- [ ] **Step 2: Test the happy path**

1. Click "New Campaign" — sheet slides in from the right, Step 1 visible
2. Leave name blank, click "Continue →" — name error appears
3. Type a name, click "Continue →" — advances to Step 2, Step 1 indicator shows ✓
4. Click "← Back" — returns to Step 1 with name preserved
5. Click "Skip to Create" from Step 1 — campaign is created, sheet closes, navigates to campaign page
6. Open sheet again, fill Step 1, continue to Step 2, select an adventure template, click "Create Campaign" — campaign created with adventure seeded

- [ ] **Step 3: Test redirect**

Navigate to `http://localhost:3847/campaigns/new` — should immediately redirect to `/campaigns?create=true` with the sheet open.

- [ ] **Step 4: Test close behaviour**

Open sheet, click the X button — sheet closes, URL returns to `/campaigns`. Open sheet, click overlay — same result.

- [ ] **Step 5: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "fix(campaigns): post-smoke-test adjustments"
git push origin main
```
