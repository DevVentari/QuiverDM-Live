# Codex Agent C — Error Handling & SEO Metadata

> **Branch**: `codex/error-handling-seo`
> **Worktree**: `.worktrees/codex-agent-c/`
> **Scope**: Add toast error handlers to all mutations, add SEO metadata to marketing pages
> **DO NOT touch**: `src/server/services/`, `src/server/routers/`, `prisma/schema.prisma`, `src/components/ui/`

---

## Task 1: Add onError Toast Handlers to All Mutations (Priority: CRITICAL)

Many pages call `useMutation()` without an `onError` callback. When mutations fail, the user sees nothing — no feedback at all. Fix ALL of them.

### Pattern to follow

Pages that already do this correctly (use as reference):
- `src/app/(app)/settings/page.tsx` — imports `useToast`, adds `onError` to each mutation
- `src/app/(app)/feedback/page.tsx` — same pattern
- `src/app/(app)/admin/invites/page.tsx` — same pattern

The pattern is:

```typescript
// 1. Import useToast (at top of file with other imports)
import { useToast } from '@/hooks/use-toast';

// 2. Inside the component, destructure toast
const { toast } = useToast();

// 3. Add onError to every useMutation call
const myMutation = trpc.something.doThing.useMutation({
  onSuccess: () => { /* existing success handler */ },
  onError: (error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  },
});
```

### Pages that NEED fixing (13 pages, 25 mutations)

Read each file. If it already has `useToast` imported, just add the `onError` callback. If not, add the import and `const { toast } = useToast();` inside the component first.

1. **`src/app/(app)/dashboard/page.tsx`** — 2 mutations:
   - `acceptInvite` — add onError
   - `declineInvite` — add onError

2. **`src/app/(app)/onboarding/page.tsx`** — 7 mutations (has multiple sub-components):
   - `completeWelcome` — add onError
   - `completeProfile` — add onError
   - `skipOnboarding` (two instances) — add onError to both
   - `completeFirstCampaign` — add onError
   - `createCampaign` — add onError
   - `acceptInvite` — add onError

   Note: This file has multiple component functions (one per step). Each component needs its own `useToast()` call if it has mutations.

3. **`src/app/(app)/join/page.tsx`** — 1 mutation:
   - `acceptInvite` — add onError

4. **`src/app/(app)/campaigns/new/page.tsx`** — 1 mutation:
   - `create` — add onError

5. **`src/app/(app)/characters/[characterId]/page.tsx`** — 2 mutations:
   - `update` — add onError
   - `deleteChar` — add onError

6. **`src/app/(app)/characters/new/page.tsx`** — 1 mutation:
   - `create` — add onError

7. **`src/app/(app)/campaigns/[slug]/players/page.tsx`** — 1 mutation:
   - `approve` — add onError

8. **`src/app/(app)/campaigns/[slug]/members/page.tsx`** — 2 mutations:
   - `updateRole` — add onError
   - `removeMember` — add onError

9. **`src/app/(app)/campaigns/[slug]/settings/page.tsx`** — 2 mutations:
   - `update` — add onError
   - `deleteCampaign` — add onError

10. **`src/app/(app)/campaigns/[slug]/sessions/page.tsx`** — 1 mutation:
    - `create` — add onError

11. **`src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`** — 3+ mutations:
    - `updateSession` (possibly two instances) — add onError
    - `deleteSession` — add onError
    - `completeSession` — add onError

12. **`src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`** — 1 mutation:
    - `deleteNpc` — add onError

13. **`src/app/(app)/campaigns/[slug]/npcs/new/page.tsx`** — 1 mutation:
    - `create` — add onError

### Pages that are ALREADY DONE (don't touch):
- `src/app/(app)/settings/page.tsx` — has onError on all mutations
- `src/app/(app)/feedback/page.tsx` — has onError
- `src/app/(app)/characters/page.tsx` — has onError
- `src/app/(app)/admin/invites/page.tsx` — has onError
- `src/app/(app)/campaigns/[slug]/npcs/[npcId]/edit/page.tsx` — has onError

---

## Task 2: Add SEO Metadata to Marketing Pages (Priority: HIGH)

The marketing pages have NO metadata exports. This means poor SEO, broken social sharing (Discord, Twitter, etc.), and no page titles.

### 2a. Marketing Layout Metadata

Edit `src/app/(marketing)/layout.tsx` to add base metadata:

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'QuiverDM — AI-Powered D&D Session Management',
    template: '%s | QuiverDM',
  },
  description: 'Stop taking notes. Start telling stories. QuiverDM is the AI-powered toolkit for Dungeon Masters — transcription, NPC management, homebrew extraction, and more.',
  keywords: ['D&D', 'Dungeons and Dragons', 'DM tools', 'session management', 'AI', 'transcription', 'NPC tracker'],
  openGraph: {
    type: 'website',
    siteName: 'QuiverDM',
    title: 'QuiverDM — AI-Powered D&D Session Management',
    description: 'Stop taking notes. Start telling stories. The AI-powered toolkit for Dungeon Masters.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuiverDM — AI-Powered D&D Session Management',
    description: 'Stop taking notes. Start telling stories. The AI-powered toolkit for Dungeon Masters.',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
```

### 2b. Landing Page Metadata

Add to `src/app/(marketing)/landing/page.tsx` (at the top, before the default export):

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QuiverDM — Stop Taking Notes, Start Telling Stories',
  description: 'AI-powered D&D session management. Automatic transcription, NPC tracking, homebrew content extraction, and campaign organization for Dungeon Masters.',
};
```

Note: The landing page uses `auth()` which is a server component — metadata export should work fine.

### 2c. Pricing Page Metadata

Add to `src/app/(marketing)/pricing/page.tsx`:

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Choose the right QuiverDM plan. Free for casual DMs, Pro for active campaigns, Team for D&D groups.',
};
```

### 2d. Auth Pages Metadata

Check if `src/app/(auth)/auth/signin/page.tsx` and `src/app/(auth)/auth/signup/page.tsx` have metadata. If not, add:

**signin:**
```typescript
export const metadata: Metadata = {
  title: 'Sign In — QuiverDM',
  description: 'Sign in to your QuiverDM account.',
};
```

**signup:**
```typescript
export const metadata: Metadata = {
  title: 'Create Account — QuiverDM',
  description: 'Create your QuiverDM account and start managing your D&D campaigns.',
};
```

### 2e. App Layout Metadata

Check `src/app/(app)/layout.tsx` — if it doesn't have a title template, add:

```typescript
export const metadata: Metadata = {
  title: {
    default: 'Dashboard',
    template: '%s | QuiverDM',
  },
};
```

---

## Task 3: Add Query Error States to Key Pages (Priority: MEDIUM)

Some pages show loading spinners but never show error states if queries fail. The user sees an infinite spinner.

For each page below, find the main `useQuery` call and add error handling after the loading check:

```typescript
// After loading check:
if (query.isLoading) {
  return <LoadingSkeleton />;
}

// ADD THIS:
if (query.isError) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-4">
        <p className="text-destructive font-medium">Failed to load data</p>
        <p className="text-sm text-muted-foreground">{query.error?.message || 'An unexpected error occurred'}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
```

**Pages to fix** (highest traffic first):

1. `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` — main session detail page
2. `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx` — NPC detail page
3. `src/app/(app)/campaigns/[slug]/settings/page.tsx` — campaign settings
4. `src/app/(app)/campaigns/[slug]/members/page.tsx` — member management
5. `src/app/(app)/characters/[characterId]/page.tsx` — character detail

Read each file first and check if they already have `isError` handling. Only add it if missing.

Import `Button` from `@/components/ui/button` if not already imported.

---

## Key Patterns

**Toast for user-facing errors:**
```typescript
import { useToast } from '@/hooks/use-toast';
const { toast } = useToast();
toast({ title: 'Error', description: error.message, variant: 'destructive' });
```

**UI components from `@/components/ui/`** — don't install new packages.

---

## Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint        # pass
```

Commit all changes on `codex/error-handling-seo` branch with descriptive messages.
