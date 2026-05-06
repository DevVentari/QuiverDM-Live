# DDB Campaign Link + Status-Grouped Characters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let DMs link a D&D Beyond campaign URL to a QuiverDM campaign and sync characters with one click; also show RETIRED and DECEASED characters on the players page grouped by status.

**Architecture:** Two independent changes — (1) a repo default + frontend grouping change for character status visibility, (2) a new `dndBeyondCampaignUrl` field on Campaign with two new tRPC endpoints and updated players page UI. The existing `charactersDndBeyond.importFromCampaign` mutation does the actual DDB scrape unchanged.

**Tech Stack:** Prisma + PostgreSQL, tRPC v11, Next.js 15 App Router, shadcn/ui (Dialog, Button, Input), React, TypeScript

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Modify | `src/server/routers/campaigns.ts` |
| Modify | `src/server/repositories/character.repository.ts` |
| Modify | `src/app/(app)/campaigns/[slug]/players/page.tsx` |

---

## Task 1: Fix character repository to include RETIRED and DECEASED

**Files:**
- Modify: `src/server/repositories/character.repository.ts:207`

- [ ] **1.1 — Update default statuses in `findByCampaignId`**

Open `src/server/repositories/character.repository.ts`. Find the `findByCampaignId` function at line ~205. Change the default parameter:

```ts
// BEFORE
export async function findByCampaignId(
  campaignId: string,
  statuses: CharacterStatus[] = [CharacterStatus.ACTIVE, CharacterStatus.PENDING]
)

// AFTER
export async function findByCampaignId(
  campaignId: string,
  statuses: CharacterStatus[] = [
    CharacterStatus.ACTIVE,
    CharacterStatus.PENDING,
    CharacterStatus.RETIRED,
    CharacterStatus.DECEASED,
  ]
)
```

Leave the rest of the function body unchanged. `CharacterStatus.REMOVED` stays excluded.

- [ ] **1.2 — Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "character.repository"
```

Expected: no output (no errors in that file).

- [ ] **1.3 — Commit**

```bash
git add src/server/repositories/character.repository.ts
git commit -m "fix(characters): include RETIRED and DECEASED in campaign character query"
```

---

## Task 2: Regroup characters by status in the players page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/players/page.tsx`

- [ ] **2.1 — Replace two-bucket split with four buckets**

In `PlayersPageInner`, find:
```ts
const pending = chars.filter((cc) => cc.status === 'PENDING');
const active = chars.filter((cc) => cc.status !== 'PENDING');
```

Replace with:
```ts
const pending  = chars.filter((cc) => cc.status === 'PENDING');
const active   = chars.filter((cc) => cc.status === 'ACTIVE');
const retired  = chars.filter((cc) => cc.status === 'RETIRED');
const deceased = chars.filter((cc) => cc.status === 'DECEASED');
```

- [ ] **2.2 — Update the `useCampaignPageSlot` call**

The slot stat already uses `active.length` but was previously counting all non-pending. Now `active` is correctly scoped to ACTIVE only. No change needed to the call itself — verify it still reads:
```ts
useCampaignPageSlot('Characters', [
  { label: active.length === 1 ? 'character' : 'characters', value: active.length },
  ...(pending.length > 0 ? [{ label: 'pending', value: pending.length, alert: true }] : []),
]);
```

- [ ] **2.3 — Replace the Party section JSX**

Find the `<div className="space-y-3">` block that renders the "Party" section (currently renders `active.map(...)`). Replace the entire `<>...</>` fragment returned when `chars.length > 0` with:

```tsx
<>
  {pending.length > 0 && (
    <div className="space-y-3">
      <h2 className="text-lg sm:text-xl font-semibold">Pending Approval</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pending.map((cc) => (
          <CharacterCard
            key={cc.id}
            cc={cc}
            isDM={isDM}
            campaignId={campaignId}
            onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
            onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
            onStatusChange={(status) =>
              updateStatus.mutate({ campaignId, campaignCharacterId: cc.id, status: status as any })
            }
            onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
          />
        ))}
      </div>
    </div>
  )}

  <div className="space-y-3">
    <h2 className="text-lg sm:text-xl font-semibold">Party</h2>
    {active.length === 0 ? (
      <p className="text-sm text-muted-foreground">No active characters yet.</p>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((cc) => (
          <CharacterCard
            key={cc.id}
            cc={cc}
            isDM={isDM}
            campaignId={campaignId}
            onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
            onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
            onStatusChange={(status) =>
              updateStatus.mutate({ campaignId, campaignCharacterId: cc.id, status: status as any })
            }
            onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
          />
        ))}
      </div>
    )}
  </div>

  {retired.length > 0 && (
    <div className="space-y-3">
      <h2 className="text-lg sm:text-xl font-semibold text-muted-foreground">Retired</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-65">
        {retired.map((cc) => (
          <CharacterCard
            key={cc.id}
            cc={cc}
            isDM={isDM}
            campaignId={campaignId}
            onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
            onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
            onStatusChange={(status) =>
              updateStatus.mutate({ campaignId, campaignCharacterId: cc.id, status: status as any })
            }
            onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
          />
        ))}
      </div>
    </div>
  )}

  {deceased.length > 0 && (
    <div className="space-y-3">
      <h2 className="text-lg sm:text-xl font-semibold text-muted-foreground">Deceased</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-65">
        {deceased.map((cc) => (
          <CharacterCard
            key={cc.id}
            cc={cc}
            isDM={isDM}
            campaignId={campaignId}
            onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
            onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
            onStatusChange={(status) =>
              updateStatus.mutate({ campaignId, campaignCharacterId: cc.id, status: status as any })
            }
            onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
          />
        ))}
      </div>
    </div>
  )}
</>
```

- [ ] **2.4 — Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "players/page"
```

Expected: no output.

- [ ] **2.5 — Commit**

```bash
git add src/app/"(app)"/campaigns/"[slug]"/players/page.tsx
git commit -m "feat(players): group characters by status — Party, Retired, Deceased sections"
```

---

## Task 3: Add `dndBeyondCampaignUrl` to Campaign schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **3.1 — Add field to Campaign model**

In `prisma/schema.prisma`, find the Campaign model's `sourcebookLabel` line (around line 325):
```prisma
  sourcebookLabel   String?           // e.g. "Curse of Strahd" — informational label only
```

Add the new field directly after it:
```prisma
  sourcebookLabel       String?
  dndBeyondCampaignUrl  String?
```

- [ ] **3.2 — Push schema to DB**

```bash
npm run db:push
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

- [ ] **3.3 — Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add dndBeyondCampaignUrl to Campaign"
```

---

## Task 4: Add `getDdbCampaignUrl` and `setDdbCampaignUrl` to campaigns router

**Files:**
- Modify: `src/server/routers/campaigns.ts`

- [ ] **4.1 — Add the two endpoints**

In `src/server/routers/campaigns.ts`, find the closing `});` of the router export (last line, after `updateSettings`). Insert the two new endpoints before it:

```ts
  getDdbCampaignUrl: campaignMemberProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { dndBeyondCampaignUrl: true },
      });
      return { url: campaign?.dndBeyondCampaignUrl ?? null };
    }),

  setDdbCampaignUrl: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        url: z
          .string()
          .regex(/dndbeyond\.com\/campaigns\/\d+/, 'Must be a D&D Beyond campaign URL')
          .nullable(),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: { dndBeyondCampaignUrl: input.url },
      });
      return { url: input.url };
    }),
```

Make sure `prisma` is already imported at the top of the file. It is — the `updateSettings` handler already uses `prisma` directly.

- [ ] **4.2 — Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "routers/campaigns"
```

Expected: no output.

- [ ] **4.3 — Commit**

```bash
git add src/server/routers/campaigns.ts
git commit -m "feat(campaigns): add getDdbCampaignUrl and setDdbCampaignUrl endpoints"
```

---

## Task 5: Add DDB link/sync UI to players page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/players/page.tsx`

This is the largest task. Work top-to-bottom through the file.

- [ ] **5.1 — Add new imports**

At the top of the file, extend the existing imports:

```tsx
// Add to lucide imports (already has Users, Plus):
import { Users, Plus, Link2, RefreshCw, X } from 'lucide-react';

// Add shadcn Dialog imports (new):
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// Add Input (new):
import { Input } from '@/components/ui/input';
```

- [ ] **5.2 — Add queries and mutations inside `PlayersPageInner`**

After the existing `removeCharacter` mutation declaration, add:

```tsx
const ddbUrl = trpc.campaigns.getDdbCampaignUrl.useQuery(
  { campaignId },
  { staleTime: 300_000 }
);

const setDdbUrl = trpc.campaigns.setDdbCampaignUrl.useMutation({
  onSuccess: () => utils.campaigns.getDdbCampaignUrl.invalidate({ campaignId }),
  onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
});

const syncDdb = trpc.charactersDndBeyond.importFromCampaign.useMutation({
  onSuccess: (data) => {
    utils.characters.getCampaignCharacters.invalidate({ campaignId });
    toast({
      title: 'DDB sync complete',
      description: `${data.imported} imported, ${data.failed} failed`,
    });
  },
  onError: (error) => {
    const isCobalt = error.message.includes('Cobalt');
    toast({
      title: isCobalt ? 'D&D Beyond session not configured' : 'Sync failed',
      description: isCobalt
        ? 'Add your CobaltSession cookie in Settings → API Keys.'
        : error.message,
      variant: 'destructive',
    });
  },
});
```

- [ ] **5.3 — Add local state for the link dialog**

After the existing `useRouter` / `useSearchParams` declarations, add:

```tsx
const [linkDialogOpen, setLinkDialogOpen] = useState(false);
const [linkUrlInput, setLinkUrlInput] = useState('');
```

- [ ] **5.4 — Replace the DM action row**

Find the current action row:
```tsx
{isDM && (
  <div className="flex justify-end">
    <Button size="sm" onClick={() => router.push('?add=true')}>
      <Plus className="mr-2 h-4 w-4" />
      Add Character
    </Button>
  </div>
)}
```

Replace with:
```tsx
{isDM && (
  <div className="flex justify-end items-center gap-2">
    {ddbUrl.data?.url ? (
      <>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          onClick={() => syncDdb.mutate({ campaignUrl: ddbUrl.data.url!, campaignId })}
          disabled={syncDdb.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncDdb.isPending ? 'animate-spin' : ''}`} />
          Sync DDB
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-8 w-8 p-0"
          onClick={() => setDdbUrl.mutate({ campaignId, url: null })}
          disabled={setDdbUrl.isPending}
          title="Unlink D&D Beyond"
        >
          <X className="h-4 w-4" />
        </Button>
      </>
    ) : (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setLinkUrlInput('');
          setLinkDialogOpen(true);
        }}
      >
        <Link2 className="mr-2 h-4 w-4" />
        Link D&D Beyond
      </Button>
    )}
    <Button size="sm" onClick={() => router.push('?add=true')}>
      <Plus className="mr-2 h-4 w-4" />
      Add Character
    </Button>
  </div>
)}
```

- [ ] **5.5 — Add the link dialog**

Just before the closing `</div>` of the component return (where `CharacterAddSheet` already lives), add:

```tsx
<Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Link D&D Beyond Campaign</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">
        Paste your D&D Beyond campaign URL. Characters will sync when you click Sync DDB.
      </p>
      <Input
        placeholder="https://www.dndbeyond.com/campaigns/7547491"
        value={linkUrlInput}
        onChange={(e) => setLinkUrlInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleLink();
        }}
      />
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={handleLink}
        disabled={setDdbUrl.isPending || !linkUrlInput.trim()}
      >
        Link
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **5.6 — Add `handleLink` function**

Inside `PlayersPageInner`, after the existing `handleSave`-style functions (after `removeCharacter` mutation), add:

```tsx
function handleLink() {
  setDdbUrl.mutate(
    { campaignId, url: linkUrlInput.trim() },
    { onSuccess: () => setLinkDialogOpen(false) }
  );
}
```

- [ ] **5.7 — Type-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "players/page"
```

Expected: no output.

- [ ] **5.8 — Commit**

```bash
git add src/app/"(app)"/campaigns/"[slug]"/players/page.tsx
git commit -m "feat(players): DDB campaign link and sync button"
```

---

## Task 6: Push and verify

- [ ] **6.1 — Final type-check across all touched files**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "players/page|campaigns\.ts|character\.repository"
```

Expected: no output.

- [ ] **6.2 — Manual smoke test**

1. Open `http://localhost:3847/campaigns/tales-from-the-bonfire-keep/players`
2. Confirm the "Link D&D Beyond" button appears in the action row (DM view).
3. Click it — dialog opens with URL input.
4. Paste `https://www.dndbeyond.com/campaigns/7547491` and click Link.
5. Dialog closes; button changes to amber "Sync DDB" + grey ✕.
6. Click Sync DDB — spinner appears, then toast shows import count.
7. Characters appear in the Party section.
8. Set a character's status to RETIRED via the dropdown — verify they move to the Retired section on next load.
9. Set a character to DECEASED — verify Deceased section appears.
10. Click ✕ to unlink — button reverts to "Link D&D Beyond".

- [ ] **6.3 — Push**

```bash
git push origin main
```
