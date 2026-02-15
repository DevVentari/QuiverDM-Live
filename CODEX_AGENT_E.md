# Codex Agent E — Performance Optimization

> **Branch**: `codex/performance-optimization`
> **Worktree**: `.worktrees/codex-agent-e/`
> **Scope**: Query caching, bundle optimization, loading performance
> **DO NOT touch**: `src/server/services/`, `src/server/routers/`, `prisma/schema.prisma`

---

## Task 1: Add staleTime to ALL useQuery Calls (Priority: CRITICAL)

**Problem**: Only 1 out of 35+ queries has `staleTime` set. This means every page navigation refetches ALL data from the server, even if it was fetched 1 second ago. This is the #1 cause of perceived slowness.

**Fix**: Add `staleTime` to every `useQuery` call based on how often the data changes:

### Stale time tiers:

- **Rarely changes** (5 min = `300_000`): user settings, billing plans, billing status, usage status
- **Changes occasionally** (2 min = `120_000`): campaign list, character list, NPC list, member list, campaign stats, factions
- **Changes moderately** (30 sec = `30_000`): sessions, transcripts, recordings, homebrew content, PDFs
- **Changes frequently** (10 sec = `10_000`): pending invites, feedback list

### Files and queries to update:

**Settings page** — `src/app/(app)/settings/page.tsx`:
```typescript
const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
const usage = trpc.usage.getStatus.useQuery(undefined, { staleTime: 300_000 });
const billingStatus = trpc.billing.getStatus.useQuery(undefined, { staleTime: 300_000 });
const billingPlans = trpc.billing.getPlans.useQuery(undefined, { staleTime: 300_000 });
```

**Dashboard** — `src/app/(app)/dashboard/page.tsx`:
```typescript
const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 120_000 });
const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
const invites = trpc.campaigns.getPendingInvites.useQuery(undefined, { staleTime: 10_000 });
```

**Campaigns list** — `src/app/(app)/campaigns/page.tsx`:
```typescript
const campaigns = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 120_000 });
```

**Campaign layout** — `src/app/(app)/campaigns/[slug]/layout.tsx`:
```typescript
const campaign = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 120_000 });
```

**Campaign overview** — `src/app/(app)/campaigns/[slug]/page.tsx`:
```typescript
const stats = trpc.campaigns.getStats.useQuery({ campaignId }, { staleTime: 120_000 });
```

**Characters list** — `src/app/(app)/characters/page.tsx`:
```typescript
const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
```

**Character detail** — `src/app/(app)/characters/[characterId]/page.tsx`:
```typescript
const character = trpc.characters.getById.useQuery({ id: characterId }, { staleTime: 120_000 });
```

**NPCs list** — `src/app/(app)/campaigns/[slug]/npcs/page.tsx`:
```typescript
const npcs = trpc.npcs.getAll.useQuery({ campaignId, search: search || undefined }, { staleTime: 120_000 });
const factions = trpc.npcs.getFactions.useQuery({ campaignId }, { staleTime: 120_000 });
```

**NPC detail** — `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`:
```typescript
const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });
```

**NPC edit** — `src/app/(app)/campaigns/[slug]/npcs/[npcId]/edit/page.tsx`:
```typescript
const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });
```

**Members** — `src/app/(app)/campaigns/[slug]/members/page.tsx`:
```typescript
const members = trpc.members.getAll.useQuery({ campaignId }, { staleTime: 120_000 });
```

**Players** — `src/app/(app)/campaigns/[slug]/players/page.tsx`:
```typescript
const characters = trpc.characters.getCampaignCharacters.useQuery({ campaignId }, { staleTime: 120_000 });
```

**Campaign settings** — `src/app/(app)/campaigns/[slug]/settings/page.tsx`:
```typescript
const campaign = trpc.campaigns.getById.useQuery({ id: campaignId }, { staleTime: 120_000 });
```

**Sessions list** — `src/app/(app)/campaigns/[slug]/sessions/page.tsx`:
```typescript
const sessions = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });
```

**Session detail** — `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`:
```typescript
const session = trpc.sessions.getById.useQuery({ id: sessionId }, { staleTime: 30_000 });
const recordings = trpc.sessionRecordings.getBySessionId.useQuery({ sessionId }, { staleTime: 30_000 });
// Transcript viewer has its own query — add staleTime: 30_000 there too
```

**Homebrew** — `src/app/(app)/homebrew/page.tsx`:
```typescript
const content = trpc.homebrew.getContent.useQuery({ ... }, { staleTime: 30_000 });
const stats = trpc.homebrew.getContentStats.useQuery({}, { staleTime: 30_000 });
```

**Campaign homebrew** — `src/app/(app)/campaigns/[slug]/homebrew/page.tsx`:
```typescript
const content = trpc.homebrew.getContent.useQuery({ ... }, { staleTime: 30_000 });
const pdfs = trpc.homebrewPdf.getPDFs.useQuery({ campaignId }, { staleTime: 30_000 });
```

**PDFs list** — `src/app/(app)/homebrew/pdfs/page.tsx`:
```typescript
// Check if query already has options object, merge staleTime into it
// staleTime: 30_000
```

**PDF detail** — `src/app/(app)/homebrew/pdfs/[pdfId]/page.tsx`:
```typescript
const pdf = trpc.homebrewPdf.getPDF.useQuery({ pdfId }, { staleTime: 30_000 });
```

**Feedback** — `src/app/(app)/feedback/page.tsx`:
```typescript
const feedbackList = trpc.feedback.getMyFeedback.useQuery({ limit: 50 }, { staleTime: 10_000 });
```

**Admin invites** — `src/app/(app)/admin/invites/page.tsx`:
```typescript
const { data: stats, refetch: refetchStats } = trpc.invites.getStats.useQuery(undefined, { staleTime: 10_000 });
const { data: unusedCodes, refetch: refetchUnused } = trpc.invites.getUnused.useQuery({ ... }, { staleTime: 10_000 });
```

**Onboarding** — `src/app/(app)/onboarding/page.tsx`:
```typescript
const { data: status, isLoading, error } = trpc.onboarding.getStatus.useQuery(undefined, { staleTime: 300_000 });
```

### Important notes:
- Read each file first to see the existing query syntax
- If a query already has an options object (second argument), ADD `staleTime` to it; don't replace the object
- If a query has no options object, add `undefined` as the input for queries with no input, or just add the options after the existing input
- The onboarding check in `src/components/onboarding-check.tsx` already has staleTime — don't touch it

---

## Task 2: Add Global Query Defaults via tRPC Client Config (Priority: HIGH)

As a safety net, set a global default staleTime in the tRPC/React Query client config.

Read `src/lib/trpc.ts` and find where the tRPC client is created. Add a default `staleTime` to the React Query config:

```typescript
// Look for createTRPCReact or similar, and the queryClient config
// Add to the queryClient's defaultOptions:
defaultOptions: {
  queries: {
    staleTime: 30_000, // 30 seconds default
    refetchOnWindowFocus: false, // Don't refetch when user tabs back
  },
},
```

This prevents any query without explicit staleTime from refetching on every mount.

**IMPORTANT**: Read the file first. The trpc client setup might be in `src/lib/trpc.ts` or `src/app/providers.tsx` or similar. Find it and add the config there.

---

## Task 3: Optimize Package Imports in next.config.js (Priority: MEDIUM)

Read `next.config.js` and expand the `optimizePackageImports` list. Currently only `lucide-react` is there. Add common heavy packages:

```javascript
experimental: {
  optimizePackageImports: [
    'lucide-react',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-select',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip',
    '@radix-ui/react-popover',
    '@radix-ui/react-separator',
    '@radix-ui/react-progress',
    '@radix-ui/react-slot',
    'date-fns',
    'react-markdown',
  ]
},
```

Only add packages that are actually installed. Read `package.json` first and check which `@radix-ui/*` packages are in dependencies before adding them to the list.

---

## Task 4: Prefetch Critical Data on Layout (Priority: MEDIUM)

The campaign layout (`src/app/(app)/campaigns/[slug]/layout.tsx`) fetches campaign data. Sub-pages then fetch their own data. We can prefetch common sub-page data in the layout to eliminate waterfalls.

Read the layout file and add prefetching:

```typescript
// In the campaign layout component, after the campaign query:
const campaign = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 120_000 });

// Prefetch common sub-page data so it's already cached when they navigate
trpc.useUtils().npcs.getAll.prefetch({ campaignId: campaign.data?.id! }, {
  // Only prefetch once campaign data is available
});
trpc.useUtils().sessions.getAll.prefetch({ campaignId: campaign.data?.id! });
trpc.useUtils().members.getAll.prefetch({ campaignId: campaign.data?.id! });
```

**IMPORTANT**: Only prefetch if `campaign.data?.id` is available. Use a `useEffect` to trigger prefetching:

```typescript
const utils = trpc.useUtils();

useEffect(() => {
  if (campaign.data?.id) {
    utils.npcs.getAll.prefetch({ campaignId: campaign.data.id });
    utils.sessions.getAll.prefetch({ campaignId: campaign.data.id });
    utils.members.getAll.prefetch({ campaignId: campaign.data.id });
  }
}, [campaign.data?.id]);
```

---

## Task 5: Add Loading Transition Indicator (Priority: LOW)

Add a thin progress bar at the top of the page during client-side navigation, so users know something is happening.

Read `src/app/(app)/app-shell.tsx` and check if it has any navigation progress indicator. If not, add one using Next.js router events or a simple approach:

Create `src/components/navigation-progress.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
      <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
    </div>
  );
}
```

Then add it to `src/app/(app)/app-shell.tsx` at the top of the return, before the sidebar:
```typescript
<NavigationProgress />
<div className="flex h-screen overflow-hidden">
  ...
</div>
```

---

## Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint        # pass
```

Commit all changes on `codex/performance-optimization` branch with descriptive message.
