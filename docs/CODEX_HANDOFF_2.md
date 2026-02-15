# QuiverDM — Codex Handoff #2

> **Created**: 2026-02-15 by Claude Code
> **Previous handoff**: `docs/CODEX_HANDOFF.md` (completed successfully)
> **Status**: Frontend 90% complete, all backend complete, deployment ready

---

## What Was Completed Since Handoff #1

All 4 tasks from the previous handoff are done and committed:
- Pricing/Upgrade UI wired to Stripe checkout/portal/cancel
- D&D Beyond character import dialog with sync
- Feedback form with star rating and history
- Email service (Resend) with welcome, invite, reset templates
- Sidebar navigation updated with Feedback link
- `getPlans` endpoint added to billing router

**TypeScript status**: Clean (only 2 pre-existing non-blocking errors in test files)

---

## Remaining Tasks (3 code tasks + polish)

### Task 1: Root Page Redirect (Critical — ~20 lines)

There is NO page at `/` — it returns 404. This breaks the app for new visitors.

**What to do:**
- Create `src/app/page.tsx` — a simple server component that redirects:
  - Authenticated users → `/dashboard`
  - Unauthenticated users → `/auth/signin`

**Implementation:**
```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  } else {
    redirect('/auth/signin');
  }
}
```

That's it. One file, ~10 lines. But it's critical — without it, the app is broken for anyone hitting `/`.

**Important**: This file goes at `src/app/page.tsx` (NOT inside `(app)/` or `(auth)/`). It must be at the root of the app directory.

### Task 2: Public Pricing Page (Medium — ~200 lines)

Users can only see plan pricing after signing up. Need a public-facing pricing page.

**What to do:**
- Create `src/app/(marketing)/pricing/page.tsx` — a public pricing page (no auth required)
- Show 3 tiers in a comparison grid:

| | Free | Pro ($9/mo) | Team ($19/mo) |
|---|---|---|---|
| Campaigns | 1 | Unlimited | Unlimited |
| Transcription | 30 min/mo | 10 hrs/mo | 30 hrs/mo |
| PDF Uploads | 5/mo | 50/mo | 200/mo |
| AI Extraction | Basic | Advanced | Advanced |
| Priority Support | No | Yes | Yes |

- Each paid tier has a CTA button linking to `/auth/signup`
- Free tier shows "Get Started" linking to `/auth/signup`
- Use the existing marketing layout at `src/app/(marketing)/layout.tsx`
- Style consistently with the app: dark theme compatible, Card components, Badge for "Popular" on Pro

**Reference files:**
- `src/app/(marketing)/layout.tsx` — the layout wrapper (already exists)
- `src/server/services/usage.service.ts` — tier limits are defined in `TIER_LIMITS` constant (lines 12-28)
- `src/app/(app)/settings/page.tsx` — see how usage meters display tier info

**Design notes:**
- Use `Card` components for each tier column
- Highlight Pro tier as "Most Popular" with a Badge
- Check icon for included features, X or dash for excluded
- Responsive: stack vertically on mobile, 3 columns on desktop

### Task 3: NPC Edit Page (Medium — ~200 lines)

NPCs can be created and viewed but not edited. The backend `update` endpoint already exists.

**What to do:**
- Create `src/app/(app)/campaigns/[slug]/npcs/[npcId]/edit/page.tsx`
- Pre-populate a form with existing NPC data from `trpc.npcs.getById.useQuery({ id: npcId })`
- Fields match the create form: name, faction, description, dmSecrets, imageUrl
- Submit calls `trpc.npcs.update.useMutation()` with the NPC id and changed fields
- On success, redirect to the NPC detail page and show a toast
- Add an "Edit" button to the NPC detail page (`src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`) that links to the edit page — only visible to DMs

**Existing tRPC endpoints:**
```typescript
trpc.npcs.getById.useQuery({ id: npcId })
trpc.npcs.update.useMutation()  // input: { id, name?, faction?, description?, dmSecrets?, imageUrl? }
```

**Reference files:**
- `src/app/(app)/campaigns/[slug]/npcs/new/page.tsx` — the create form (copy and adapt)
- `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx` — detail page (add Edit button)
- `src/server/routers/npcs.ts` — see update endpoint input schema (around line 61)
- `src/components/campaign/campaign-context.tsx` — provides `useCampaign()` hook with `{ slug, isDM }`

### Task 4: Polish & Edge Cases (Small — scattered fixes)

**4a. Auth error page home link fix**
- Read `src/app/(auth)/auth/error/page.tsx`
- If it links to `/` as "home", change it to `/dashboard` (authenticated) or `/auth/signin`

**4b. Marketing landing page link**
- Check if `src/app/(marketing)/page.tsx` exists in the main branch
- If not, create a simple redirect from `/` covers this (Task 1)
- If it does exist, make sure the CTA buttons link to `/auth/signup` and pricing links to `/pricing`

**4c. Campaign layout campaign not found**
- Check `src/app/(app)/campaigns/[slug]/layout.tsx` — verify it handles invalid slugs gracefully (shows error, doesn't crash)

---

## Architecture Quick Reference

(Same as Handoff #1 — abbreviated here for space)

### Key Patterns

**tRPC usage in React:**
```typescript
'use client';
import { trpc } from '@/lib/trpc';

const { data, isLoading } = trpc.npcs.getById.useQuery({ id });
const mutation = trpc.npcs.update.useMutation({ onSuccess: () => { ... } });
```

**Campaign context (for campaign-scoped pages):**
```typescript
import { useCampaign } from '@/components/campaign/campaign-context';
const { slug, isDM, isOwner, membership } = useCampaign();
```

**Error classes (NO `new` on static methods):**
```typescript
throw new NotFoundError('npc', npcId);           // with new
throw ForbiddenError.forPermission('edit', 'NPC'); // NO new
throw ValidationError.forField('name', 'Required'); // NO new
```

**UI components from `@/components/ui/`:**
Button, Card, Input, Label, Textarea, Badge, Skeleton, Select, Dialog, Separator, Progress, Tabs, Tooltip, Switch

**Icons from `lucide-react`:**
Plus, Trash2, ArrowLeft, Save, Edit, Download, RefreshCw, Loader2, ExternalLink, Star, etc.

**Toast notifications:**
```typescript
import { useToast } from '@/hooks/use-toast';
const { toast } = useToast();
toast({ title: 'Success', description: 'NPC updated.' });
toast({ title: 'Error', description: error.message, variant: 'destructive' });
```

### Dev Commands
```bash
npm run dev          # http://localhost:3847
npx tsc --noEmit     # Type check (2 pre-existing errors OK)
npm run lint         # ESLint
npm run build        # Full production build
```

---

## Parallel Execution Strategy

All 4 tasks are independent:
- **Agent A**: Task 1 (Root page redirect) — tiny, do first
- **Agent B**: Task 2 (Public pricing page) — create in marketing route group
- **Agent C**: Task 3 (NPC edit page) — create in campaigns route group
- **Agent D**: Task 4 (Polish fixes) — read and fix edge cases

Tasks 1-3 create new files only (no conflicts). Task 4 modifies existing files.

---

## After This Handoff

Once these tasks are done, the app is **feature-complete for beta launch**. The remaining work is all configuration/ops:

1. **Resend setup** — add `RESEND_API_KEY` and `EMAIL_FROM` env vars (email service code already done)
2. **Stripe setup** — create products/prices in Stripe dashboard, add price IDs to env
3. **Railway deploy** — create project, add env vars, `railway up`
4. **Domain** — connect custom domain on Railway
5. **Generate beta invite codes** — `npm run generate-beta-invites`
6. **Invite first users** — send codes to early testers

No more code needed after this handoff completes.

---

## Build Verification

After all changes:
```bash
npx tsc --noEmit     # Only 2 pre-existing errors (docs/Test/ and worker.ts)
npm run lint         # Should pass
npm run build        # Full production build should succeed
```
