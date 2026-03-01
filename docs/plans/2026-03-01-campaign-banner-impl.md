# Campaign Banner Image Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the clashing purple placeholder on campaign cards, add banner image upload in settings, and render the banner as a subtle blurred vignette strip in the campaign header.

**Architecture:** `bannerUrl String?` already exists on Campaign and is returned by `getBySlug` / accepted by `campaigns.update`. A new upload route mirrors the existing npc-image pattern. The layout reads `data.bannerUrl` (already cast to `any`) and conditionally renders an absolutely-positioned blurred image behind the header. No schema migration needed.

**Tech Stack:** Next.js 15 App Router, tRPC, Tailwind CSS, local/R2 file storage (existing pattern)

---

### Task 1: Replace purple placeholder on campaign cards

**Files:**
- Modify: `src/app/(app)/campaigns/page.tsx:51`

**Context:** The campaign list card renders a `<div className="h-24 w-full bg-gradient-to-r from-purple-950 to-blue-950" />` when no `bannerUrl` is set. Replace it with a dark neutral gradient using the amber accent.

**Step 1: Open the file and locate the placeholder**

Line 51 in `src/app/(app)/campaigns/page.tsx`:
```tsx
<div className="h-24 w-full bg-gradient-to-r from-purple-950 to-blue-950" />
```

**Step 2: Replace with neutral amber-tinted gradient**

```tsx
<div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
```

**Step 3: Verify visually**

Run `npm run dev` (port 3847). Open `/campaigns`. Confirm the placeholder is dark/neutral — no purple.

**Step 4: Commit**

```bash
git add src/app/(app)/campaigns/page.tsx
git commit -m "fix(campaigns): replace purple placeholder with neutral amber gradient"
```

---

### Task 2: Create the campaign banner upload API route

**Files:**
- Create: `src/app/api/upload/campaign-banner/route.ts`
- Reference: `src/app/api/upload/npc-image/route.ts` (identical pattern)

**Context:** The npc-image route handles auth, validates file type/size, uploads via `uploadToLocal`, returns `{ url, key, storage }`. We need the same for campaign banners with key prefix `campaign-banners`. No `campaignId` is required in the key (the user's `userId` scopes it sufficiently and we don't have campaignId at upload time).

**Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { uploadToLocal, generateLocalFileKey } from '@/lib/storage/local-storage';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = generateLocalFileKey(
      session.user.id,
      'global',
      file.name,
      'campaign-banners'
    );

    const url = await uploadToLocal({
      key: fileKey,
      body: buffer,
      contentType: file.type,
      metadata: { originalFilename: file.name, uploadedAt: new Date().toISOString() },
    });

    return NextResponse.json({ url, key: fileKey, storage: 'local' });
  } catch (error) {
    console.error('Error uploading campaign banner:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
```

**Step 2: Test the route manually**

```bash
curl -X POST http://localhost:3847/api/upload/campaign-banner \
  -F "file=@/path/to/any-image.jpg" \
  -H "Cookie: <your-session-cookie>"
```
Expected: `{"url":"/api/storage/campaign-banners/...","key":"...","storage":"local"}`

**Step 3: Commit**

```bash
git add src/app/api/upload/campaign-banner/route.ts
git commit -m "feat(campaigns): add campaign banner upload API route"
```

---

### Task 3: Add banner upload UI in Campaign Settings

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/settings/page.tsx`

**Context:** The settings page has a form inside a `<Card>`. We need to add a banner image section at the top of the form (before the Name field). The section shows the current banner as a preview if set, plus a file input button. On file select, POST to `/api/upload/campaign-banner`, then immediately call `update.mutate({ id: campaignId, bannerUrl: url })`. This is DM-only (the form is already only rendered for DMs — the whole `<Card>` is visible to anyone but save is restricted; banner upload we'll guard with `isDM`).

**Step 1: Add state for banner URL and uploading flag**

In the component, add after the existing `useState` declarations (around line 38):
```tsx
const [bannerUrl, setBannerUrl] = useState<string | null>(null);
const [bannerUploading, setBannerUploading] = useState(false);
```

**Step 2: Populate bannerUrl from campaign data in the useEffect**

In the existing `useEffect` (around line 47), add:
```tsx
setBannerUrl(data.bannerUrl ?? null);
```

So the full effect becomes:
```tsx
useEffect(() => {
  if (campaign.data) {
    const data = campaign.data as any;
    setName(data.name || '');
    setDescription(data.description || '');
    setStatus(data.status || 'active');
    setBannerUrl(data.bannerUrl ?? null);
  }
}, [campaign.data]);
```

**Step 3: Add the upload handler function**

Add before `handleSave`:
```tsx
async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setBannerUploading(true);
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload/campaign-banner', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const { url } = await res.json() as { url: string };
    setBannerUrl(url);
    update.mutate({ id: campaignId, bannerUrl: url });
  } catch {
    toast({ title: 'Upload failed', description: 'Could not upload banner image.', variant: 'destructive' });
  } finally {
    setBannerUploading(false);
  }
}
```

**Step 4: Add banner preview + upload button to the form**

In the form JSX, add this block before the Name `<div>` (before line ~138 `<div className="space-y-2"><Label htmlFor="name">`):

```tsx
{isDM && (
  <div className="space-y-2">
    <Label>Campaign Banner</Label>
    {bannerUrl && (
      <div className="relative h-32 w-full rounded-md overflow-hidden border border-border">
        <Image src={bannerUrl} alt="Campaign banner" fill className="object-cover" />
      </div>
    )}
    <div className="flex items-center gap-2">
      <label
        htmlFor="banner-upload"
        className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        {bannerUploading ? 'Uploading...' : bannerUrl ? 'Change Image' : 'Upload Image'}
      </label>
      <input
        id="banner-upload"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleBannerUpload}
        disabled={bannerUploading}
      />
      {bannerUrl && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-destructive"
          onClick={() => {
            setBannerUrl(null);
            update.mutate({ id: campaignId, bannerUrl: '' });
          }}
        >
          Remove
        </button>
      )}
    </div>
    <p className="text-xs text-muted-foreground">Max 5MB — JPEG, PNG, WebP, or GIF</p>
  </div>
)}
```

**Step 5: Add `Image` import** at the top of the file (Next.js Image component):
```tsx
import Image from 'next/image';
```

**Step 6: Test the upload**

1. Navigate to `/campaigns/[slug]/settings`
2. Click "Upload Image", select a file
3. Confirm preview appears and no toast error
4. Reload page — confirm banner persists (loaded from DB)
5. Click "Remove" — confirm preview disappears

**Step 7: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/settings/page.tsx
git commit -m "feat(campaigns): add banner image upload in campaign settings"
```

---

### Task 4: Render vignette strip in campaign layout

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/layout.tsx`

**Context:** `data.bannerUrl` is available (the service returns it). The header div (lines 72–84) needs a `relative` wrapper. If `bannerUrl` is set, absolutely position a blurred, low-opacity image behind it with a bottom fade. Add `Image` import.

**Step 1: Add `Image` import**

```tsx
import Image from 'next/image';
```

**Step 2: Replace the header section**

Find this block (around lines 71–84):
```tsx
<div className="flex items-start justify-between gap-4 pb-4">
  <div className="min-w-0">
    <h1 className="font-display text-3xl font-bold tracking-wide leading-tight truncate">
      {data.name}
    </h1>
    {data.description && (
      <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{data.description}</p>
    )}
  </div>
  <span className={`shrink-0 mt-1 text-xs font-medium px-2.5 py-1 rounded-full border ${roleColor}`}>
    {roleLabel}
  </span>
</div>
```

Replace with:
```tsx
<div className="relative flex items-start justify-between gap-4 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-6 overflow-hidden rounded-t-lg">
  {data.bannerUrl && (
    <>
      <div className="absolute inset-0">
        <Image
          src={data.bannerUrl}
          alt=""
          fill
          className="object-cover scale-110 blur-[20px] opacity-[0.15]"
          aria-hidden
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
    </>
  )}
  <div className="relative z-10 min-w-0">
    <h1 className="font-display text-3xl font-bold tracking-wide leading-tight truncate">
      {data.name}
    </h1>
    {data.description && (
      <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{data.description}</p>
    )}
  </div>
  <span className={`relative z-10 shrink-0 mt-1 text-xs font-medium px-2.5 py-1 rounded-full border ${roleColor}`}>
    {roleLabel}
  </span>
</div>
```

**Why `scale-110`:** Prevents the blur from leaving transparent edges at the container boundary.

**Why `-mx` / `px` negative margins:** The layout wrapper has padding. Pulling the header to the edges makes the blur feel edge-to-edge rather than a floating rectangle.

**Step 3: Test the vignette**

1. Upload a banner via Settings (Task 3 must be done first)
2. Navigate to any campaign sub-page (`/campaigns/[slug]`, `/campaigns/[slug]/sessions`, etc.)
3. Confirm: blurred image in header area, name/description/badge readable on top, content below nav is clean
4. Test with no banner: confirm no visual change from current state

**Step 4: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/layout.tsx
git commit -m "feat(campaigns): render banner as subtle vignette strip in campaign header"
```

---

### Task 5: Fix bannerUrl empty string handling in router/service

**Context:** The "Remove" button sends `bannerUrl: ''`. The `campaigns.update` mutation uses `z.string().optional()` — empty string will pass but should be treated as clearing the field. Check the service handles this.

**Step 1: Check campaign service update**

Open `src/server/services/campaign.service.ts` and find the `update` method (around line 174).

If it does `bannerUrl: input.bannerUrl` directly in the Prisma call, add a null-coercion:
```ts
bannerUrl: input.bannerUrl || null,
```

This converts `''` to `null` in the DB, preventing a broken `<Image src="">`.

**Step 2: Commit if changed**

```bash
git add src/server/services/campaign.service.ts
git commit -m "fix(campaigns): coerce empty bannerUrl to null on update"
```

If the service already handles it or uses `undefined`, skip this task.

---

### Task 6: Final check

**Step 1: Run lint + type check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Smoke test the full flow**

1. `/campaigns` — placeholder is dark/amber (no purple)
2. `/campaigns/[slug]/settings` — banner upload works, preview shows, remove works, reload persists
3. `/campaigns/[slug]` (and any sub-page) — vignette shows with banner, clean without

**Step 3: Commit any fixes, then push**

```bash
git push origin main
```
