# Feature 6: Player Portal / Limited Access Mode

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give players a scoped view of campaign content — session summaries, DM-shared handouts, and their own characters — while hiding DM-only data. DM controls visibility per session and per homebrew item.

**Architecture:** Add `playerVisibility` to `GameSession` and `sharedWithPlayers` to `HomebrewContent`. Existing `PLAYER` role + `useCampaign().isDM` used for conditional rendering. New player-scoped tRPC procedure variants strip DM-only fields. DM visibility toggles in session + homebrew pages.

**Tech Stack:** Prisma, tRPC, Next.js App Router, shadcn/ui, React, existing auth + campaign-context

---

## Task 1: Schema — visibility fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add to GameSession**

In `model GameSession`, add before `createdAt`:
```prisma
playerVisibility String @default("dm-only") // dm-only|summary-only|public
```

**Step 2: Add to HomebrewContent**

In `model HomebrewContent`, add before `createdAt`:
```prisma
sharedWithPlayers Boolean @default(false)
```

**Step 3:**
```bash
npm run db:push
git add prisma/schema.prisma
git commit -m "feat(schema): add playerVisibility to GameSession, sharedWithPlayers to HomebrewContent"
```

---

## Task 2: Session router — player-scoped getById + update visibility

**Files:**
- Modify: `src/server/routers/sessions.ts`
- Modify: `src/server/services/session.service.ts`

**Step 1: Add `updateVisibility` procedure to sessions router**

```typescript
updateVisibility: protectedProcedure
  .input(z.object({
    sessionId: z.string(),
    playerVisibility: z.enum(['dm-only', 'summary-only', 'public']),
  }))
  .mutation(async ({ input, ctx }) => {
    // Only DMs can change visibility
    await authz.session(input.sessionId, ctx.session.user.id).requirePermission('canManageSessions');
    return prisma.gameSession.update({
      where: { id: input.sessionId },
      data: { playerVisibility: input.playerVisibility },
    });
  }),
```

**Step 2: Add role-aware filtering to `getById` in session service**

In `session.service.ts`, update `getById` to accept user role and strip fields:

```typescript
async getById(sessionId: string, userId: string) {
  await authz.session(sessionId, userId).verify();

  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new NotFoundError('session', sessionId);

  // Check if user is DM
  const member = await prisma.campaignMember.findFirst({
    where: { campaignId: session.campaign.id, userId },
  });
  const isDM = member?.role === 'OWNER' || member?.role === 'CO_DM';

  if (isDM) return session;

  // Player: filter based on playerVisibility
  const visibility = (session as any).playerVisibility ?? 'dm-only';
  if (visibility === 'dm-only') {
    // Return minimal info — session exists but no content
    return {
      id: session.id,
      title: (session as any).title,
      sessionNumber: (session as any).sessionNumber,
      date: (session as any).date,
      status: (session as any).status,
      playerVisibility: visibility,
      // No transcript, no quickNotes, no aiHighlights
      recordings: [],
      transcripts: [],
      aiSummary: null,
      aiHighlights: null,
      quickNotes: null,
      recap: null,
    };
  }
  if (visibility === 'summary-only') {
    return {
      ...session,
      transcripts: [],         // Hide raw transcript
      recordings: [],           // Hide recordings
      quickNotes: null,         // Hide DM notes
    };
  }
  // public: return everything except DM quickNotes
  return { ...session, quickNotes: null };
}
```

**Step 3:**
```bash
git add src/server/routers/sessions.ts src/server/services/session.service.ts
git commit -m "feat(service): add player-scoped session filtering and visibility update"
```

---

## Task 3: Homebrew router — player-scoped list

**Files:**
- Modify: `src/server/routers/homebrew.ts`

**Step 1: Read `src/server/routers/homebrew.ts`** to understand existing `list` or `getByCampaign` procedure.

**Step 2: Add `updateSharing` procedure**

```typescript
updateSharing: protectedProcedure
  .input(z.object({
    homebrewId: z.string(),
    sharedWithPlayers: z.boolean(),
  }))
  .mutation(async ({ input, ctx }) => {
    const homebrew = await prisma.homebrewContent.findUnique({
      where: { id: input.homebrewId },
      select: { userId: true },
    });
    if (!homebrew) throw new NotFoundError('homebrew', input.homebrewId);
    if (homebrew.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('share', 'homebrew content');
    }
    return prisma.homebrewContent.update({
      where: { id: input.homebrewId },
      data: { sharedWithPlayers: input.sharedWithPlayers },
    });
  }),
```

**Step 3: Add player-aware filtering to campaign homebrew list**

In the homebrew procedure that lists content for a campaign, after fetching, check user role:

```typescript
// After fetching homebrewList:
const member = await prisma.campaignMember.findFirst({
  where: { campaignId, userId: ctx.session.user.id },
});
const isDM = member?.role === 'OWNER' || member?.role === 'CO_DM';

if (!isDM) {
  return homebrewList.filter((h: any) => h.sharedWithPlayers);
}
return homebrewList;
```

**Step 4:**
```bash
git add src/server/routers/homebrew.ts
git commit -m "feat(router): add homebrew sharing control and player-scoped filtering"
```

---

## Task 4: DM Visibility Controls Component

**Files:**
- Create: `src/components/session/dm-visibility-controls.tsx`

**Step 1: Create component**

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface DmVisibilityControlsProps {
  sessionId: string;
  currentVisibility: 'dm-only' | 'summary-only' | 'public';
}

const VISIBILITY_OPTIONS = [
  { value: 'dm-only', label: 'DM Only', description: 'Players see no session content', icon: EyeOff },
  { value: 'summary-only', label: 'Summary Only', description: 'Players see AI summary (if generated)', icon: BookOpen },
  { value: 'public', label: 'Full Access', description: 'Players see everything except DM notes', icon: Eye },
];

export function DmVisibilityControls({ sessionId, currentVisibility }: DmVisibilityControlsProps) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.sessions.updateVisibility.useMutation({
    onSuccess: () => {
      toast.success('Player visibility updated');
      utils.sessions.getById.invalidate({ id: sessionId });
    },
    onError: (e) => toast.error(e.message),
  });

  const current = VISIBILITY_OPTIONS.find((o) => o.value === currentVisibility) ?? VISIBILITY_OPTIONS[0];

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Player Visibility</Label>
      <Select
        value={currentVisibility}
        onValueChange={(v) =>
          updateMutation.mutate({ sessionId, playerVisibility: v as any })
        }
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <current.icon className="h-3 w-3" />
              {current.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div>
                <span className="font-medium">{opt.label}</span>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 2:**
```bash
git add src/components/session/dm-visibility-controls.tsx
git commit -m "feat(component): add DmVisibilityControls for per-session player access"
```

---

## Task 5: Wire visibility controls + player-aware rendering into session page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

**Step 1:** Import:
```typescript
import { DmVisibilityControls } from '@/components/session/dm-visibility-controls';
```

**Step 2:** In the DM section of the page, add:
```tsx
{isDM && session?.playerVisibility && (
  <DmVisibilityControls
    sessionId={sessionId}
    currentVisibility={session.playerVisibility as any}
  />
)}
```

**Step 3:** For player-only view, wrap DM-only sections:
```tsx
{isDM && (
  // ... DM-only panels: encounter tracker, recording upload, quick notes
)}
{/* Summary visible if visibility !== dm-only */}
{(!isDM && session?.playerVisibility === 'dm-only') && (
  <p className="text-muted-foreground text-sm text-center py-8">
    The DM hasn't shared this session yet.
  </p>
)}
```

**Step 4:**
```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): player-aware session rendering and DM visibility toggle"
```

---

## Task 6: Homebrew sharing toggle

**Files:**
- Modify: Homebrew content list or detail page

**Step 1:** Find where homebrew items are listed for a campaign. For each item card (DM only), add a share toggle:

```tsx
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Inside homebrew card (DM only):
{isDM && (
  <div className="flex items-center gap-2 mt-2">
    <Switch
      id={`share-${item.id}`}
      checked={item.sharedWithPlayers}
      onCheckedChange={(checked) =>
        updateSharingMutation.mutate({ homebrewId: item.id, sharedWithPlayers: checked })
      }
    />
    <Label htmlFor={`share-${item.id}`} className="text-xs">Share with players</Label>
  </div>
)}
```

Add the mutation hook at the component level:
```typescript
const updateSharingMutation = trpc.homebrew.updateSharing.useMutation({
  onSuccess: () => utils.homebrew.getAll.invalidate(),
  onError: (e) => toast.error(e.message),
});
```

**Step 2:**
```bash
git add src/app/\(app\)/campaigns/\[slug\]/homebrew/
git commit -m "feat(ui): add homebrew share-with-players toggle for DMs"
```

---

## Task 7: Type check

```bash
npx tsc --noEmit
git add -A && git commit -m "feat: Feature 6 — player portal scoped views complete"
```
