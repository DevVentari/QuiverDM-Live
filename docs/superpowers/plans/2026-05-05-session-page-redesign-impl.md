# Session Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `PageLayout` component to campaign subpages and embed the full two-column prep workspace directly in the session hub (phase === 'prep'), removing the link-out to the separate `/sessions/prep` route.

**Architecture:** Pure UI refactor — no new tRPC procedures, no DB changes. `PageLayout` is a thin presentational wrapper adopted by 3 pages. `PrepWorkspace` gets an `inline` boolean prop that suppresses its header, brain drawer, and brain context card. `PhasePrep` is rewritten to load campaign context, parse prep data, and render PrepWorkspace in inline mode.

**Tech Stack:** Next.js 15 App Router, React, Tailwind, tRPC, shadcn/ui, Zod.

**Spec:** `docs/superpowers/specs/2026-05-05-session-page-redesign-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/layout/page-layout.tsx` | Shared overline + amber rule + title header wrapper |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | Adopt PageLayout; dynamic maxWidth; drop prep editHref |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx` | Redirect to hub instead of `/sessions/prep` |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/page.tsx` | Adopt PageLayout |
| Modify | `src/app/(app)/campaigns/[slug]/npcs/page.tsx` | Adopt PageLayout |
| Modify | `src/components/session/prep/prep-workspace.tsx` | Add `inline` + `onComplete` props; suppress header/drawer/brain card when inline |
| Modify | `src/components/session/phase-prep.tsx` | Full rewrite: load getPrepContext, parse prepData, render PrepWorkspace inline, Ready to Run button |

---

## Task 1: Create PageLayout Component

**Files:**
- Create: `src/components/layout/page-layout.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { cn } from '@/lib/utils';

const MAX_WIDTH_CLASSES = {
  sm:   'max-w-xl',
  md:   'max-w-3xl',
  lg:   'max-w-5xl',
  xl:   'max-w-7xl',
  full: 'w-full',
} as const;

interface PageLayoutProps {
  overline: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES;
  children: React.ReactNode;
}

export function PageLayout({
  overline,
  title,
  subtitle,
  actions,
  maxWidth = 'md',
  children,
}: PageLayoutProps) {
  return (
    <div className={cn('space-y-5', MAX_WIDTH_CLASSES[maxWidth])}>
      <div>
        <p className="label-overline mb-1">{overline}</p>
        <div className="section-rule" />
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-display text-xl font-bold tracking-wide">{title}</h1>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/page-layout.tsx
git commit -m "feat(layout): add PageLayout component"
```

---

## Task 2: Session Hub — Adopt PageLayout + Fix Prep Redirect

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx`

This task installs the PageLayout header and fixes the stale redirect. The dynamic `maxWidth` for prep phase is added in Task 7 (after PhasePrep is ready).

- [ ] **Step 1: Update the session hub page**

Replace the import block at the top — add `PageLayout` import:

```tsx
import { PageLayout } from '@/components/layout/page-layout';
```

Replace the loading skeleton wrapper div:
```tsx
// OLD
<div className="space-y-4 max-w-3xl">

// NEW
<div className="space-y-4 max-w-3xl">
```
(unchanged — keep skeleton as-is for now, it's temporary)

Replace the main return wrapper and header block. The current code (lines 68–81) is:

```tsx
return (
  <div className="space-y-5 max-w-3xl">
    {/* Page header */}
    <div>
      <p className="label-overline mb-1">Session {sessionNumber}</p>
      <div className="section-rule" />
      <h1 className="font-display text-xl font-bold mt-3 tracking-wide">
        {sessionTitle ?? `Session ${sessionNumber}`}
      </h1>
      {sessionDate && (
        <p className="text-xs text-muted-foreground mt-1">
          {format(sessionDate, 'EEEE, MMMM d yyyy')}
        </p>
      )}
    </div>
    ...
  </div>
);
```

Replace with:

```tsx
return (
  <PageLayout
    overline={`Session ${sessionNumber}`}
    title={sessionTitle ?? `Session ${sessionNumber}`}
    subtitle={sessionDate ? format(sessionDate, 'EEEE, MMMM d yyyy') : undefined}
    maxWidth="md"
  >
    ...
  </PageLayout>
);
```

Also remove the `editHref` from the prep `PhaseCompleteRow` call. The current line is:

```tsx
{prepDone && (
  <PhaseCompleteRow
    phase="prep"
    detail={(session.prepStatus as string) === 'complete' ? 'Prep complete' : 'Skipped'}
    editHref={`/campaigns/${slug}/sessions/prep?sessionId=${session.id as string}`}
  />
)}
```

Replace with:

```tsx
{prepDone && (
  <PhaseCompleteRow
    phase="prep"
    detail={(session.prepStatus as string) === 'complete' ? 'Prep complete' : 'Skipped'}
  />
)}
```

- [ ] **Step 2: Update the `[sessionId]/prep` redirect**

Open `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx`.

Current content:
```tsx
import { redirect } from 'next/navigation';

export default function PrepRedirectPage({ params }: { params: { slug: string; sessionId: string } }) {
  redirect(`/campaigns/${params.slug}/sessions/prep?sessionId=${params.sessionId}`);
}
```

Replace with:
```tsx
import { redirect } from 'next/navigation';

export default function PrepRedirectPage({ params }: { params: { slug: string; sessionId: string } }) {
  redirect(`/campaigns/${params.slug}/sessions/${params.sessionId}`);
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Start dev server: `npm run dev`

Navigate to a session detail page. Expected:
- Page header uses `label-overline` + `section-rule` + display font title (visually the same as before since PageLayout emits the same HTML, just from a shared component)
- No `editHref` on the prep complete row (if session is past prep)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx" \
        "src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx"
git commit -m "feat(session): adopt PageLayout on session hub, fix prep redirect to hub"
```

---

## Task 3: Sessions List — Adopt PageLayout

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/page.tsx`

The sessions list currently has no in-page heading — it starts directly with filter pills. PageLayout adds the standard overline + title. The "New Session" button moves to PageLayout's `actions` slot.

- [ ] **Step 1: Add PageLayout import**

Add to the import block:
```tsx
import { PageLayout } from '@/components/layout/page-layout';
```

- [ ] **Step 2: Wrap the return in PageLayout**

The current return (line 72) starts with `<div className="space-y-5">` and has the toolbar as the first child. Replace:

```tsx
// OLD
return (
  <div className="space-y-5">
    {/* Toolbar: filter pills + action */}
    <div className="flex items-center gap-2 flex-wrap">
      {allSessions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap flex-1">
          {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="rounded-full h-7 px-3 text-xs"
            >
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
              <span className="ml-1.5 opacity-70">{counts[f]}</span>
            </Button>
          ))}
        </div>
      )}
      {isDM && (
        <Button size="sm" className="gap-1.5 ml-auto shrink-0" asChild>
          <Link href={`/campaigns/${slug}/sessions/prep`}>
            <Plus className="h-3.5 w-3.5" />
            New Session
          </Link>
        </Button>
      )}
    </div>

    {/* Session list */}
    ...
  </div>
);
```

Replace with:

```tsx
const newSessionAction = isDM ? (
  <Button size="sm" className="gap-1.5" asChild>
    <Link href={`/campaigns/${slug}/sessions/prep`}>
      <Plus className="h-3.5 w-3.5" />
      New Session
    </Link>
  </Button>
) : undefined;

return (
  <PageLayout overline="Sessions" title="Sessions" actions={newSessionAction}>
    {/* Filter pills */}
    {allSessions.length > 0 && (
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="rounded-full h-7 px-3 text-xs"
          >
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
            <span className="ml-1.5 opacity-70">{counts[f]}</span>
          </Button>
        ))}
      </div>
    )}

    {/* Session list */}
    ...
  </PageLayout>
);
```

Keep the session list JSX unchanged — only the wrapper and toolbar changed.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Navigate to a campaign's sessions list. Expected:
- "Sessions" overline + amber rule + "Sessions" h1 heading now visible at top of page
- "New Session" button appears in top-right of the header row (via `actions` slot)
- Filter pills appear below the header
- Session cards unchanged

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/sessions/page.tsx"
git commit -m "feat(sessions): adopt PageLayout on sessions list"
```

---

## Task 4: NPCs List — Adopt PageLayout

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/npcs/page.tsx`

The NPCs page has separate mobile and desktop layouts. PageLayout unifies the header across both. The "New NPC" buttons in the mobile/desktop sections get removed in favour of the `actions` slot.

- [ ] **Step 1: Add PageLayout import**

Add to the import block:
```tsx
import { PageLayout } from '@/components/layout/page-layout';
```

- [ ] **Step 2: Wrap NPCsPageInner return in PageLayout**

The current `return` in `NPCsPageInner` (line 87) starts with `<>`. Replace the entire return:

```tsx
// OLD — starts with:
return (
  <>
    <div className="md:hidden space-y-4 px-4 sm:px-6">
      <div>
        {isDM && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreateSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New NPC
            </Button>
          </div>
        )}
      </div>
      ...
    </div>
    <div className="hidden md:block">
      ...
    </div>
    ...
  </>
);
```

Replace with:

```tsx
const newNpcAction = isDM ? (
  <Button size="sm" onClick={() => setCreateSheetOpen(true)}>
    <Plus className="h-3.5 w-3.5 mr-1.5" />
    New NPC
  </Button>
) : undefined;

return (
  <PageLayout overline="NPCs" title="NPCs" actions={newNpcAction}>
    {/* Mobile layout */}
    <div className="md:hidden space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search NPCs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {/* rest of mobile NPC list — unchanged */}
      ...
    </div>

    {/* Desktop layout */}
    <div className="hidden md:block">
      {/* unchanged */}
      ...
    </div>

    <NpcCreateSheet
      campaignId={campaignId}
      open={createOpen}
      onOpenChange={setCreateSheetOpen}
    />
  </PageLayout>
);
```

Keep all existing NPC list content (loading states, NpcListRow, NpcInspectorPanel, etc.) unchanged inside the layout wrapper. Only the outer structure and button placement changes.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Navigate to a campaign's NPCs list. Expected:
- "NPCs" overline + amber rule + "NPCs" h1 heading at top
- "New NPC" button in top-right header actions
- Search input + NPC list below — unchanged
- NPC create sheet still opens

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/npcs/page.tsx"
git commit -m "feat(npcs): adopt PageLayout on NPCs list"
```

---

## Task 5: PrepWorkspace — Add `inline` and `onComplete` Props

**Files:**
- Modify: `src/components/session/prep/prep-workspace.tsx`

This adds the `inline` mode to PrepWorkspace. When `inline=true`: PrepHeader, PrepBrainDrawer, and PrepBrainContextCard are not rendered; the outer div drops `min-h-screen`; the aside drops sticky/h-screen; `completePrep` success calls `onComplete()` instead of `router.push`.

- [ ] **Step 1: Update the PrepWorkspaceProps interface**

Find the `interface PrepWorkspaceProps` block (around line 157) and add the two new props:

```ts
interface PrepWorkspaceProps {
  sessionId: string;
  initialData: SessionPrepData;
  campaignContext: CampaignContext;
  slug: string;
  initialTitle: string;
  prepStatus?: string;
  inline?: boolean;
  onComplete?: () => void;
}
```

- [ ] **Step 2: Destructure the new props in the function signature**

Find the `export function PrepWorkspace({` signature and add `inline = false` and `onComplete`:

```tsx
export function PrepWorkspace({
  sessionId,
  initialData,
  campaignContext,
  slug,
  initialTitle,
  prepStatus = 'draft',
  inline = false,
  onComplete,
}: PrepWorkspaceProps) {
```

- [ ] **Step 3: Update `completePrep` mutation onSuccess**

Find the `completePrep` mutation (around line 186). Replace its `onSuccess`:

```ts
const completePrep = trpc.sessions.completePrep.useMutation({
  onSuccess: () => {
    if (onComplete) {
      onComplete();
    } else {
      toast({ title: 'Prep marked complete' });
      router.push(`/campaigns/${slug}/sessions/${sessionId}`);
    }
  },
  onError: (error) =>
    toast({ title: 'Failed to complete prep', description: error.message, variant: 'destructive' }),
});
```

- [ ] **Step 4: Update the return JSX**

The return block starts at line 287. Make these four changes:

**4a. Outer div — drop `min-h-screen` when inline:**

```tsx
// OLD
<div className="flex flex-col min-h-screen">

// NEW
<div className={inline ? 'flex flex-col' : 'flex flex-col min-h-screen'}>
```

**4b. PrepHeader — only render when not inline:**

```tsx
// OLD
<PrepHeader
  title={title}
  ...
/>

// NEW
{!inline && (
  <PrepHeader
    title={title}
    onTitleChange={setTitle}
    saveStatus={saveStatus}
    slug={slug}
    onComplete={() => completePrep.mutate({ id: sessionId })}
    isCompleting={completePrep.isPending}
    prepStatus={prepStatus}
    isFullscreen={false}
    onToggleFullscreen={() => {}}
    sessionId={sessionId}
    brainDrawerOpen={brainDrawerOpen}
    onBrainDrawerToggle={() => setBrainDrawerOpen((v) => !v)}
  />
)}
```

**4c. PrepBrainDrawer — only render when not inline:**

```tsx
// OLD
<PrepBrainDrawer
  campaignId={campaignId}
  open={brainDrawerOpen}
  onClose={() => setBrainDrawerOpen(false)}
/>

// NEW
{!inline && (
  <PrepBrainDrawer
    campaignId={campaignId}
    open={brainDrawerOpen}
    onClose={() => setBrainDrawerOpen(false)}
  />
)}
```

**4d. Aside — drop sticky + h-screen when inline:**

```tsx
// OLD
<aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-border/50 bg-card/30 sticky top-0 self-start h-screen overflow-y-auto">

// NEW
<aside className={cn(
  'hidden md:flex md:flex-col w-48 shrink-0 border-r border-border/50 bg-card/30',
  inline ? 'overflow-y-auto' : 'sticky top-0 self-start h-screen overflow-y-auto'
)}>
```

**4e. PrepBrainContextCard — only render when not inline:**

Find the line that renders `<PrepBrainContextCard campaignId={campaignId} />` and wrap it:

```tsx
{!inline && <PrepBrainContextCard campaignId={campaignId} />}
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke-test existing prep route still works**

Navigate to `/campaigns/<slug>/sessions/prep` (without sessionId — the standalone prep creation flow). Confirm:
- Prep header still visible
- Brain drawer toggle still present
- Brain context card still shows
- Behavior unchanged

- [ ] **Step 7: Commit**

```bash
git add src/components/session/prep/prep-workspace.tsx
git commit -m "feat(prep): add inline + onComplete props to PrepWorkspace"
```

---

## Task 6: PhasePrep — Full Rewrite

**Files:**
- Modify: `src/components/session/phase-prep.tsx`

PhasePrep becomes the inline prep host: it loads campaign context, parses prep data from the session, renders PrepWorkspace in inline mode, and adds the "Ready to Run" CTA below.

- [ ] **Step 1: Replace the entire file**

```tsx
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Play } from 'lucide-react';
import { SessionPrepDataSchema, emptyPrepData } from '@/lib/prep-types';
import { PrepWorkspace } from '@/components/session/prep/prep-workspace';

interface PhasePrepProps {
  session: Record<string, unknown>;
  slug: string;
  campaignId: string;
  onStatusChange: () => void;
}

export function PhasePrep({ session, slug, campaignId, onStatusChange }: PhasePrepProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const sessionId = session.id as string;

  const contextQuery = trpc.sessions.getPrepContext.useQuery(
    { campaignId },
    { enabled: !!campaignId }
  );

  const startSession = trpc.sessions.update.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      onStatusChange();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const initialData = useMemo(() => {
    const parsed = SessionPrepDataSchema.safeParse((session as any).prepData);
    const base = parsed.success ? parsed.data : emptyPrepData();

    if (base.characterNotes.length > 0) return base;

    const characters = (contextQuery.data?.characters ?? []) as Array<{ id: string; name: string }>;
    return {
      ...base,
      characterNotes: characters.map((character) => ({
        characterId: character.id,
        name: character.name,
        goals: '',
        notes: '',
      })),
    };
  }, [session, contextQuery.data]);

  if (contextQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contextQuery.data) return null;

  return (
    <div className="space-y-4">
      <PrepWorkspace
        sessionId={sessionId}
        initialData={initialData}
        campaignContext={contextQuery.data as any}
        slug={slug}
        initialTitle={(session as any).title ?? 'Session'}
        prepStatus={(session as any).prepStatus ?? 'draft'}
        inline
        onComplete={onStatusChange}
      />
      <Button
        size="sm"
        onClick={() => startSession.mutate({ id: sessionId, status: 'in_progress' })}
        disabled={startSession.isPending}
        className="w-full"
      >
        <Play className="mr-1.5 h-3.5 w-3.5" />
        Ready to Run
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/session/phase-prep.tsx
git commit -m "feat(prep): rewrite PhasePrep to embed PrepWorkspace inline"
```

---

## Task 7: Session Hub — Dynamic maxWidth for Prep Phase

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

Now that PhasePrep renders a two-column layout, the hub needs to be wider when phase is `prep`.

- [ ] **Step 1: Update the PageLayout maxWidth prop**

Find the `<PageLayout` in the hub page (added in Task 2). Change the static `maxWidth="md"` to a dynamic value:

```tsx
// OLD
<PageLayout
  overline={`Session ${sessionNumber}`}
  title={sessionTitle ?? `Session ${sessionNumber}`}
  subtitle={sessionDate ? format(sessionDate, 'EEEE, MMMM d yyyy') : undefined}
  maxWidth="md"
>

// NEW
<PageLayout
  overline={`Session ${sessionNumber}`}
  title={sessionTitle ?? `Session ${sessionNumber}`}
  subtitle={sessionDate ? format(sessionDate, 'EEEE, MMMM d yyyy') : undefined}
  maxWidth={phase === 'prep' ? 'lg' : 'md'}
>
```

- [ ] **Step 2: Also update the loading skeleton to use a reasonable width**

Find the loading skeleton wrapper (around line 27):

```tsx
// OLD
<div className="space-y-4 max-w-3xl">

// NEW
<div className="space-y-4 max-w-5xl">
```

Using `max-w-5xl` for the skeleton prevents a layout shift when transitioning from loading to the prep workspace (which is also `max-w-5xl`). For non-prep phases loading, the slightly wider skeleton is acceptable.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser — full prep flow**

Navigate to a session in `prep` phase:

Expected:
- Page header shows session number/title as before
- Below the pipeline, the two-column prep workspace appears inline (left rail with section nav, right side with section editors)
- Left rail is ~192px wide, shows 8 section links with amber active state
- Section editors render on the right
- AI Suggest button (Brain icon) is visible per section
- No brain drawer toggle
- "Ready to Run" button appears below the workspace
- Page is wider (max-w-5xl ≈ 1024px) when in prep phase

Navigate to a session in `summary` or `complete` phase:

Expected:
- Page reverts to narrower layout (max-w-3xl)
- All non-prep phases render as before

- [ ] **Step 5: Verify "Ready to Run" flow**

In the prep phase view, click "Ready to Run":
- Session status changes to `in_progress`
- Hub re-renders with `phase === 'ran'`
- PhaseProcessing component appears (upload recording)
- Prep workspace disappears

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx"
git commit -m "feat(session): widen hub to max-w-5xl when prep phase is active"
```

---

## Task 8: Final Check + Push

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no new errors (pre-existing warnings are acceptable).

- [ ] **Step 3: Manual regression check**

Navigate through these pages and confirm each looks correct:

| Page | URL pattern | Expected |
|------|-------------|---------|
| Session hub — prep | `/campaigns/[slug]/sessions/[id]` (planning status) | Two-column prep workspace, wide layout |
| Session hub — other phases | `/campaigns/[slug]/sessions/[id]` (completed) | Single column, narrow, pipeline + phase rows |
| Sessions list | `/campaigns/[slug]/sessions` | "Sessions" overline + heading, New Session button in header |
| NPCs list | `/campaigns/[slug]/npcs` | "NPCs" overline + heading, New NPC button in header |
| Standalone prep page | `/campaigns/[slug]/sessions/prep` | Full-page PrepWorkspace with header + brain drawer (unchanged) |
| Old prep redirect | `/campaigns/[slug]/sessions/[id]/prep` | Redirects to session hub |

- [ ] **Step 4: Push**

```bash
git push origin main
```

- [ ] **Step 5: Check Vercel deployment**

Watch `quiver-dm-live` deployment in Vercel dashboard. Navigate to a session in prep phase on the live URL to confirm the inline workspace renders correctly in production.
