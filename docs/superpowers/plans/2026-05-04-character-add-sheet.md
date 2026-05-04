# Character Add Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heavy 5-tab `/characters/new` page with a right-side Sheet on the characters list that presents DDB import as the hero path and a minimal manual creation form as a fallback.

**Architecture:** A self-contained `CharacterAddSheet` component owns all state and both mutation calls. The characters list page controls open state via `?create=true` searchParam. Success on either path closes the sheet and navigates to the new character's detail page.

**Tech Stack:** Next.js 15 App Router, tRPC v11, shadcn/ui Sheet, React, TypeScript

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/components/character/CharacterAddSheet.tsx` | Sheet with DDB import + manual create |
| Modify | `src/app/(app)/characters/page.tsx` | Replace two buttons with one, wire sheet, add Suspense |
| Replace | `src/app/(app)/characters/new/page.tsx` | Redirect to `/characters?create=true` |
| Delete | `src/data/srd-characters.ts` | Only used by old create page — safe to delete |
| Create | `tests/characters-add.spec.ts` | Playwright E2E for the new flow |

---

## Task 1: Create `CharacterAddSheet.tsx` — DDB import section

**Files:**
- Create: `src/components/character/CharacterAddSheet.tsx`

- [ ] **Step 1: Create the file with DDB import section only**

```tsx
'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Upload } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CharacterAddSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // DDB import state
  const [ddbUrl, setDdbUrl] = useState('');

  const importCharacter = trpc.charactersDndBeyond.importCharacter.useMutation({
    onSuccess: async (data) => {
      const char = data.character as { id: string };
      await utils.characters.getMyCharacters.invalidate();
      handleOpenChange(false);
      router.push(`/characters/${char.id}`);
    },
    onError: (err) => {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    },
  });

  // Manual create state
  const [name, setName] = useState('');
  const [charClass, setCharClass] = useState('');
  const [race, setRace] = useState('');
  const [level, setLevel] = useState(1);
  const [backstory, setBackstory] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createCharacter = trpc.characters.create.useMutation({
    onSuccess: async (data) => {
      await utils.characters.getMyCharacters.invalidate();
      handleOpenChange(false);
      router.push(`/characters/${data.id}`);
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  async function handlePortraitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/character-portrait', { method: 'POST', body: formData });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) setPortraitUrl(data.url);
      else toast({ title: 'Upload failed', description: data.error, variant: 'destructive' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    createCharacter.mutate({
      name: name.trim(),
      class: charClass || undefined,
      race: race || undefined,
      level,
      backstory: backstory || undefined,
      portraitUrl: portraitUrl || undefined,
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setDdbUrl('');
      setName('');
      setCharClass('');
      setRace('');
      setLevel(1);
      setBackstory('');
      setPortraitUrl('');
      setNameError(null);
    }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display">Add Character</SheetTitle>
        </SheetHeader>

        {/* ── DDB Import ─────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Import from D&D Beyond
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.dndbeyond.com/characters/12345678"
              value={ddbUrl}
              onChange={(e) => setDdbUrl(e.target.value)}
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              onClick={() => importCharacter.mutate({ url: ddbUrl.trim() })}
              disabled={!ddbUrl.trim() || importCharacter.isPending}
            >
              {importCharacter.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : 'Import'}
            </Button>
          </div>
          {importCharacter.error && (
            <p className="text-xs text-destructive">{importCharacter.error.message}</p>
          )}
        </div>

        {/* ── Divider ────────────────────────────────────────── */}
        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-3 text-xs text-muted-foreground">
            or create manually
          </span>
        </div>

        {/* ── Manual Create ──────────────────────────────────── */}
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePortraitChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-lg border border-border bg-white/[0.02] hover:border-white/20 overflow-hidden flex items-center justify-center group"
          >
            {portraitUrl ? (
              <Image src={portraitUrl} alt="Portrait" fill className="object-cover" unoptimized />
            ) : uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70" />
            )}
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="char-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="char-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
              placeholder="Tharivol Moonwhisper"
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="char-class">Class</Label>
              <Input
                id="char-class"
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                placeholder="Fighter"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-race">Race</Label>
              <Input
                id="char-race"
                value={race}
                onChange={(e) => setRace(e.target.value)}
                placeholder="Human"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-level">Level</Label>
            <Input
              id="char-level"
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value))))}
              className="w-24"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-backstory">Backstory</Label>
            <Textarea
              id="char-backstory"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Write your character's backstory…"
              rows={3}
              className="resize-none"
            />
          </div>

          <Button type="submit" className="w-full" disabled={createCharacter.isPending}>
            {createCharacter.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
              : 'Create Character'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check the new file**

```bash
npx tsc --noEmit 2>&1 | grep CharacterAddSheet
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/character/CharacterAddSheet.tsx
git commit -m "feat(characters): add CharacterAddSheet with DDB import + manual create"
```

---

## Task 2: Update `characters/page.tsx` — wire up the sheet

**Files:**
- Modify: `src/app/(app)/characters/page.tsx`

The page needs to:
- Read `?create=true` from searchParams to control the sheet
- Replace the two current buttons with a single "Add Character" button
- Remove all Dialog/import-related state and mutations
- Wrap contents in `<Suspense>` (required by Next.js when using `useSearchParams` in a client component)

- [ ] **Step 1: Rewrite `characters/page.tsx`**

Replace the entire file with:

```tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, RefreshCw, Loader2, Sword } from 'lucide-react';
import type { MouseEvent } from 'react';
import { CharacterAddSheet } from '@/components/character/CharacterAddSheet';

function CharactersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
  const isCreateOpen = searchParams.get('create') === 'true';

  const syncCharacter = trpc.charactersDndBeyond.syncCharacter.useMutation({
    onSuccess: async (data) => {
      const synced = data.character as { name: string };
      await utils.characters.getMyCharacters.invalidate();
      toast({ title: 'Character synced', description: `${synced.name} was synced from D&D Beyond.` });
    },
    onError: (error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6 max-w-6xl 2xl:max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">Characters</h1>
        <Button onClick={() => router.push('?create=true')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Character
        </Button>
      </div>

      {characters.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : characters.data && characters.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(characters.data as any[]).map((char) => (
            <div key={char.id} className="stone-card overflow-hidden relative group min-h-[130px]">
              <Link href={`/characters/${char.id}`} className="absolute inset-0 z-0" aria-label={char.name} />
              <div className="flex h-full min-h-[130px]">
                <div className="relative w-[28%] shrink-0 self-stretch">
                  {char.portraitUrl ? (
                    <Image
                      src={char.portraitUrl}
                      alt={char.name}
                      fill
                      className="object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[hsl(240,10%,8%)] via-[hsl(240,8%,6%)] to-[hsl(35,15%,5%)] flex items-center justify-center">
                      <Users className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[hsl(240,10%,11%)] to-transparent pointer-events-none" />
                </div>
                <div className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="stone-card-title leading-snug">{char.name}</span>
                    {char.dndBeyondId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="relative z-10 h-6 w-6 p-0 shrink-0 text-muted-foreground/50 hover:text-foreground"
                        disabled={syncCharacter.isPending}
                        onClick={(e: MouseEvent) => {
                          e.preventDefault();
                          syncCharacter.mutate({ characterId: char.id });
                        }}
                        title="Sync from D&D Beyond"
                      >
                        {syncCharacter.isPending && syncCharacter.variables?.characterId === char.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {[char.race, char.class, char.level && `Level ${char.level}`]
                      .filter(Boolean)
                      .join(' · ') || 'No details'}
                  </p>
                  {char.backstory ? (
                    <p className="text-xs text-muted-foreground/60 line-clamp-2 mt-auto leading-relaxed">
                      {char.backstory}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 mt-auto italic">No backstory yet</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
            <Sword className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No characters yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Import a character from D&D Beyond or create one manually.
            </p>
            <Button size="sm" onClick={() => router.push('?create=true')}>
              Add Character
            </Button>
          </div>
        </div>
      )}

      <CharacterAddSheet
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) router.replace('/characters');
        }}
      />
    </div>
  );
}

export default function CharactersPage() {
  return (
    <Suspense>
      <CharactersPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "characters/page|CharacterAdd"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/characters/page.tsx
git commit -m "feat(characters): replace two buttons + dialog with CharacterAddSheet"
```

---

## Task 3: Redirect `/characters/new` and delete `srd-characters.ts`

**Files:**
- Replace: `src/app/(app)/characters/new/page.tsx`
- Delete: `src/data/srd-characters.ts`

- [ ] **Step 1: Replace `new/page.tsx` with a redirect**

Overwrite `src/app/(app)/characters/new/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function NewCharacterRedirect() {
  redirect('/characters?create=true');
}
```

- [ ] **Step 2: Delete `srd-characters.ts`**

```bash
rm src/data/srd-characters.ts
```

- [ ] **Step 3: Verify no remaining imports**

```bash
grep -r "srd-characters" src/ --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 4: Full type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/characters/new/page.tsx
git rm src/data/srd-characters.ts
git commit -m "chore(characters): redirect /characters/new, delete unused srd-characters data"
```

---

## Task 4: Write E2E spec

**Files:**
- Create: `tests/characters-add.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Character Add Sheet', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
  });

  test('Add Character button opens the sheet', async ({ page }) => {
    await page.getByRole('button', { name: /add character/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/import from d&d beyond/i)).toBeVisible();
    await expect(page.getByText(/or create manually/i)).toBeVisible();
  });

  test('sheet opens via ?create=true URL param', async ({ page }) => {
    await page.goto('/characters?create=true');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('/characters/new redirects to /characters?create=true', async ({ page }) => {
    await page.goto('/characters/new');
    await page.waitForURL(/\/characters\?create=true/, { timeout: 5000 });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('manual create requires a name', async ({ page }) => {
    await page.goto('/characters?create=true');
    await page.getByRole('button', { name: /^create character$/i }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible({ timeout: 3000 });
  });

  test('closing the sheet clears the URL param', async ({ page }) => {
    await page.goto('/characters?create=true');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    // Close via the sheet's X button (SheetContent renders a close button with sr-only "Close")
    await page.getByRole('button', { name: /close/i }).click();
    await page.waitForURL('/characters', { timeout: 3000 });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test tests/characters-add.spec.ts --reporter=list
```

All 5 tests should pass. If the "close" selector fails due to shadcn rendering, use `page.keyboard.press('Escape')` instead:

```ts
await page.keyboard.press('Escape');
```

- [ ] **Step 3: Commit**

```bash
git add tests/characters-add.spec.ts
git commit -m "test(characters): E2E spec for CharacterAddSheet"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Push**

```bash
git push origin main
```
