# Create Pages Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Campaign, NPC, and Character create pages to use a live-preview split layout matching the current amber/glass design system.

**Architecture:** Each page gets a left sticky preview panel (live-updating entity card) and a right glass-panel form panel divided by `label-overline` + `section-rule` sections. A shared `CreatePageShell` component handles the layout so all three pages are consistent.

**Tech Stack:** Next.js 15 App Router, React, tRPC, Tailwind CSS, shadcn/ui, Next.js `<Image>`

---

### Task 1: CreatePageShell component

**Files:**
- Create: `src/components/create/create-page-shell.tsx`

**Step 1: Create the file**

```tsx
import React from 'react';

interface CreatePageShellProps {
  overline: string;
  title: string;
  preview: React.ReactNode;
  children: React.ReactNode;
}

export function CreatePageShell({ overline, title, preview, children }: CreatePageShellProps) {
  return (
    <div className="max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <p className="label-overline mb-1">{overline}</p>
        <h1 className="font-display text-3xl font-bold tracking-wide">{title}</h1>
      </div>
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-[38%] shrink-0 lg:sticky lg:top-6">
          {preview}
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep create-page-shell
```
Expected: no output (no errors)

**Step 3: Commit**

```bash
git add src/components/create/create-page-shell.tsx
git commit -m "feat(ui): add CreatePageShell layout component"
```

---

### Task 2: Campaign Create page redesign

**Files:**
- Modify: `src/app/(app)/campaigns/new/page.tsx`

**Step 1: Replace the entire file with the redesigned version**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name must be 100 characters or less'),
});

function CampaignPreview({ name, description }: { name: string; description: string }) {
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      <div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold truncate">
            {name || <span className="text-muted-foreground/40">Your Campaign</span>}
          </h3>
          <Badge variant="outline" className="text-xs shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/10">
            Draft
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || <span className="opacity-40">No description</span>}
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = trpc.campaigns.create.useMutation({
    onSuccess: (campaign: any) => {
      router.push(`/campaigns/${campaign.slug || campaign.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = createCampaignSchema.safeParse({ name: name.trim() });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    create.mutate({ name: name.trim(), description: description || undefined });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Campaign"
      preview={<CampaignPreview name={name} description={description} />}
    >
      <form onSubmit={handleSubmit}>
        <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
          {/* Campaign Identity */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Campaign Identity</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Curse of Strahd"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors({}); }}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A Gothic horror adventure in the mists of Barovia..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          {create.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {create.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                'Create Campaign'
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </CreatePageShell>
  );
}
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "campaigns/new"
```
Expected: no output

**Step 3: Visual check**

Navigate to `http://localhost:3847/campaigns/new`. Verify:
- Left panel shows preview card with gradient banner, "Your Campaign" placeholder, Draft badge
- Typing in Name updates the preview card name live
- Typing in Description updates the preview card description live
- Submit works and redirects to the new campaign

**Step 4: Commit**

```bash
git add src/app/\(app\)/campaigns/new/page.tsx
git commit -m "feat(ui): redesign campaign create page with live preview split layout"
```

---

### Task 3: Character portrait upload route

**Files:**
- Create: `src/app/api/upload/character-portrait/route.ts`

The current character create page has no portrait upload. This new route mirrors `/api/upload/npc-image` but uses `userId` scope only (no campaignId required).

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { uploadToLocal, generateLocalFileKey } from '@/lib/storage/local-storage';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileKey = generateLocalFileKey(userId, 'global', file.name, 'character-portraits');

    const url = await uploadToLocal({
      key: fileKey,
      body: buffer,
      contentType: file.type,
      metadata: { originalFilename: file.name, uploadedAt: new Date().toISOString() },
    });

    return NextResponse.json({ url, key: fileKey, storage: 'local' });
  } catch (error) {
    console.error('Error uploading character portrait:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "character-portrait"
```
Expected: no output

**Step 3: Commit**

```bash
git add "src/app/api/upload/character-portrait/route.ts"
git commit -m "feat(api): add character portrait upload route"
```

---

### Task 4: Character Create page redesign

**Files:**
- Modify: `src/app/(app)/characters/new/page.tsx`

**Step 1: Replace the entire file**

```tsx
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';

interface CharacterPreviewProps {
  name: string;
  race: string;
  charClass: string;
  level: number;
  backstory: string;
  portraitUrl: string;
  uploading: boolean;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function CharacterPreview({
  name, race, charClass, level, backstory,
  portraitUrl, uploading, onUploadClick, onFileChange, fileInputRef,
}: CharacterPreviewProps) {
  const subtitle = [race, charClass, level ? `Level ${level}` : null].filter(Boolean).join(' · ');

  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      <label
        className="block relative h-24 w-full cursor-pointer group"
        onClick={onUploadClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        {portraitUrl ? (
          <Image src={portraitUrl} alt="Character portrait" fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            ) : (
              <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-5 w-5 mx-auto text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground/60 mt-1">Upload portrait</p>
              </div>
            )}
          </div>
        )}
        <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/30 transition-all rounded-t-xl pointer-events-none" />
      </label>
      <div className="p-4 space-y-1">
        <h3 className="font-display text-base font-bold truncate">
          {name || <span className="text-muted-foreground/40">Your Character</span>}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {backstory && (
          <p className="text-sm text-muted-foreground/70 line-clamp-2 pt-1">{backstory}</p>
        )}
      </div>
    </div>
  );
}

export default function NewCharacterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState('');
  const [backstory, setBackstory] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const create = trpc.characters.create.useMutation({
    onSuccess: async (data: any) => {
      await utils.characters.getMyCharacters.invalidate();
      router.push(`/characters/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/character-portrait', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setPortraitUrl(data.url);
      } else {
        setUploadError(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    create.mutate({
      name,
      race: race || undefined,
      class: charClass || undefined,
      level,
      background: background || undefined,
      backstory: backstory || undefined,
    });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Character"
      preview={
        <CharacterPreview
          name={name}
          race={race}
          charClass={charClass}
          level={level}
          backstory={backstory}
          portraitUrl={portraitUrl}
          uploading={uploading}
          onUploadClick={() => fileInputRef.current?.click()}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
        />
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
          {/* Identity */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Identity</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Tharivol Moonwhisper"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(null); }}
                aria-invalid={!!nameError}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="race">Race</Label>
                <Input id="race" placeholder="Half-Elf" value={race} onChange={(e) => setRace(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input id="class" placeholder="Wizard" value={charClass} onChange={(e) => setCharClass(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="w-24"
              />
            </div>
          </div>

          {/* Background */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Background</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="background">Background</Label>
              <Input id="background" placeholder="Sage" value={background} onChange={(e) => setBackground(e.target.value)} />
            </div>
          </div>

          {/* Backstory */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Backstory</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory</Label>
              <Textarea
                id="backstory"
                placeholder="Write your character's backstory..."
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {create.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {create.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                'Create Character'
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </CreatePageShell>
  );
}
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "characters/new"
```
Expected: no output

**Step 3: Visual check**

Navigate to `http://localhost:3847/characters/new`. Verify:
- Left: gradient banner with hover showing "Upload portrait" overlay
- Left: "Your Character" placeholder updates live as you type
- Left: Race · Class · Level badge row updates live
- Clicking the banner opens file picker
- Submit creates character and redirects

**Step 4: Commit**

```bash
git add src/app/\(app\)/characters/new/page.tsx
git commit -m "feat(ui): redesign character create page with live preview and portrait upload"
```

---

### Task 5: NPC Create page redesign

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/npcs/new/page.tsx`

**Step 1: Replace the entire file**

```tsx
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Lock } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';

interface NpcPreviewProps {
  name: string;
  faction: string;
  description: string;
  imageUrl: string;
  uploading: boolean;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function NpcPreview({
  name, faction, description, imageUrl,
  uploading, onUploadClick, onFileChange, fileInputRef,
}: NpcPreviewProps) {
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      <label
        className="block relative h-24 w-full cursor-pointer group"
        onClick={onUploadClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        {imageUrl ? (
          <Image src={imageUrl} alt="NPC portrait" fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            ) : (
              <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-5 w-5 mx-auto text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground/60 mt-1">Upload image</p>
              </div>
            )}
          </div>
        )}
        <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/30 transition-all rounded-t-xl pointer-events-none" />
      </label>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold truncate">
            {name || <span className="text-muted-foreground/40">NPC Name</span>}
          </h3>
          {faction && (
            <Badge variant="outline" className="text-xs shrink-0">{faction}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || <span className="opacity-40">No description</span>}
        </p>
      </div>
    </div>
  );
}

export default function NewNPCPage() {
  const router = useRouter();
  const { campaignId, slug } = useCampaign();
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

  const create = trpc.npcs.create.useMutation({
    onSuccess: (data: any) => {
      router.push(`/campaigns/${slug}/npcs/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    create.mutate({
      campaignId,
      name,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
    });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New NPC"
      preview={
        <NpcPreview
          name={name}
          faction={faction}
          description={description}
          imageUrl={imageUrl}
          uploading={uploading}
          onUploadClick={() => fileInputRef.current?.click()}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
        />
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
          {/* Identity */}
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
                  onChange={(e) => { setName(e.target.value); setNameError(null); }}
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

          {/* Details */}
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

          {/* DM Only */}
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

          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {create.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {create.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                'Create NPC'
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </CreatePageShell>
  );
}
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "npcs/new"
```
Expected: no output

**Step 3: Visual check**

Navigate to a campaign's NPC page and click "New NPC". Verify:
- Left: gradient banner with "Upload image" hover overlay
- Left: name + faction + description update live
- Clicking banner opens file picker, image preview appears in banner on upload
- "DM Only" section has lock icon in the overline
- Submit creates NPC and redirects

**Step 4: Commit**

```bash
git add "src/app/\(app\)/campaigns/\[slug\]/npcs/new/page.tsx"
git commit -m "feat(ui): redesign NPC create page with live preview and image upload zone"
```

---

### Task 6: Push and deploy

```bash
git push origin main
```

Check Vercel deploys successfully (visit `https://quiverdm.com/campaigns/new` and verify the new layout is live).
