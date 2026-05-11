# Party on Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the player party visible on the V2 home dashboard and add Party as a first-class entry in the V2 shell rail.

**Architecture:** Extend the existing `ActiveCampaignSummary` card with a Party row (avatar strip + level progress wired up to derived `partyLevel`). Fetch characters via the existing `trpc.characters.getCampaignCharacters` query on the home page and pass them down. Add one `NAV_ITEMS` entry to `src/components/shell/CommandRail.tsx` for the rail promotion.

**Tech Stack:** Next.js 15, React, tRPC v11, Tailwind, shadcn/ui, Playwright (workflow specs), `next/image`.

**Spec:** `docs/superpowers/specs/2026-05-11-party-on-home-design.md`

---

## Notes the engineer needs before starting

- The V2 shell rail is `src/components/shell/CommandRail.tsx` — NOT `src/components/layout/command-rail.tsx`. The latter is legacy/test-page-only.
- The home page lives at `src/app/(app)/page.tsx`. The campaign overview route `/campaigns/[slug]` redirects to `/` (no separate page).
- Local Playwright runs target prod unless you override `CI` and `BASE_URL`. From PowerShell: `$env:CI=$null; $env:BASE_URL='http://localhost:3847'` before `npx playwright test`. (See `memory/feedback_ci_true_routes_to_prod.md`.)
- After every commit, push to `origin/main` immediately. Pre-beta — main is prod.
- Test user for the home workflow spec is `vic@test.local`. Password lives in `$env:QA_TEST_PASSWORD`.
- The dev server runs against the homelab DB at `192.168.1.21:5432`. If a workflow assertion needs seeded characters, verify they exist there before running the test.

---

## Task 1: Promote Party to the V2 shell rail

**Files:**
- Modify: `src/components/shell/CommandRail.tsx:7-19` (imports), `:36-45` (NAV_ITEMS)
- Modify: `tests/workflows/home.workflow.spec.ts:25-36` (add a Party assertion to the existing rail test)

- [ ] **Step 1: Write the failing test assertion**

Add this line to the existing `renders CommandRail with V2 nav set` test in `tests/workflows/home.workflow.spec.ts`, immediately after the `rail-nav-npcs` assertion (line 33):

```ts
    await expect(page.getByTestId('rail-nav-party')).toBeVisible()
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
$env:CI=$null; $env:BASE_URL='http://localhost:3847'
npx playwright test tests/workflows/home.workflow.spec.ts -g "renders CommandRail with V2 nav set"
```

Expected: FAIL with `Locator getByTestId('rail-nav-party')` not visible / not found.

If the dev server is not running, start it first in another shell: `npm run dev`. The homelab workers + WS server are always-on, so no other processes are needed.

- [ ] **Step 3: Import `Shield` icon in the rail**

Replace the existing `lucide-react` import block in `src/components/shell/CommandRail.tsx` (lines 7-19):

```tsx
import {
  Home,
  ScrollText,
  Calendar,
  Users,
  Library,
  Map,
  BookOpen,
  Compass,
  Settings,
  Shield,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
```

The only addition is `Shield,` between `Settings,` and `ChevronsLeft,`.

- [ ] **Step 4: Add the Party entry to `NAV_ITEMS`**

Replace the `NAV_ITEMS` array in `src/components/shell/CommandRail.tsx` (lines 36-45):

```tsx
const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home',       label: 'Home',       icon: Home,       globalHref: '/' },
  { id: 'campaigns',  label: 'Campaigns',  icon: ScrollText, globalHref: '/campaigns' },
  { id: 'sessions',   label: 'Sessions',   icon: Calendar,   scopedPath: '/sessions',  fallbackHref: '/campaigns' },
  { id: 'party',      label: 'Party',      icon: Shield,     scopedPath: '/players',   fallbackHref: '/campaigns' },
  { id: 'npcs',       label: 'NPCs',       icon: Users,      scopedPath: '/npcs',      fallbackHref: '/campaigns' },
  { id: 'compendium', label: 'Compendium', icon: Library,    globalHref: '/homebrew' },
  { id: 'maps',       label: 'Maps',       icon: Map,        scopedPath: '/world-map', fallbackHref: '/campaigns' },
  { id: 'world',      label: 'World',      icon: BookOpen,   scopedPath: '/world',     fallbackHref: '/campaigns' },
  { id: 'quests',     label: 'Quests',     icon: Compass,    scopedPath: '/quests',    fallbackHref: '/campaigns' },
] as const
```

The only change is the new `{ id: 'party', ... }` line inserted between Sessions and NPCs.

- [ ] **Step 5: Run the test to verify it passes**

```powershell
npx playwright test tests/workflows/home.workflow.spec.ts -g "renders CommandRail with V2 nav set"
```

Expected: PASS.

- [ ] **Step 6: Type check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```powershell
git add src/components/shell/CommandRail.tsx tests/workflows/home.workflow.spec.ts
git commit -m "feat(rail): add Party to V2 shell nav between Sessions and NPCs"
git push origin main
```

---

## Task 2: Add a Party row to `ActiveCampaignSummary`

**Files:**
- Modify: `src/components/home/ActiveCampaignSummary.tsx` (props + Party row + empty state)
- Modify: `src/app/(app)/page.tsx:18-30` (add characters query + derivations), `:107-115` (pass new props)
- Modify: `tests/workflows/home.workflow.spec.ts` (add a Party row visibility test)

### Step group A — failing test

- [ ] **Step 1: Add the failing Playwright test**

Add this test at the end of the `describe('Home — session-first', ...)` block in `tests/workflows/home.workflow.spec.ts` (before the closing `})`):

```ts
  test('home shows the Party row with PARTY overline', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const partyRow = page.getByTestId('party-row')
    await expect(partyRow).toBeVisible()
    await expect(partyRow).toContainText(/PARTY/)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
$env:CI=$null; $env:BASE_URL='http://localhost:3847'
npx playwright test tests/workflows/home.workflow.spec.ts -g "Party row with PARTY overline"
```

Expected: FAIL — `getByTestId('party-row')` not found.

### Step group B — `ActiveCampaignSummary` changes

- [ ] **Step 3: Extend the props interface**

Open `src/components/home/ActiveCampaignSummary.tsx`. Replace the `ActiveCampaignSummaryProps` interface (lines 9-20):

```tsx
interface ActiveCampaignSummaryPartyMember {
  id: string
  characterId: string
  name: string
  portraitUrl?: string | null
  level?: number | null
}

interface ActiveCampaignSummaryProps {
  name: string
  slug?: string | null
  ongoingSince?: Date | string | null
  sessionCount: number
  npcCount?: number
  locationCount?: number
  itemCount?: number
  partyLevel?: number
  levelTarget?: number
  bannerUrl?: string | null
  party?: ActiveCampaignSummaryPartyMember[]
  pendingPartyCount?: number
  isDM?: boolean
}
```

- [ ] **Step 4: Update icon imports in `ActiveCampaignSummary`**

Replace line 6 of `src/components/home/ActiveCampaignSummary.tsx`:

```tsx
import { Shield, BookOpen, Users } from 'lucide-react'
```

(The only addition is `Users`, used as the fallback when a character has no portrait.)

Also add `next/image` at the top of the file, right after the existing imports:

```tsx
import Image from 'next/image'
```

- [ ] **Step 5: Add the Party row component inside `ActiveCampaignSummary`**

Update the function signature (line 35-45 of the original file) to destructure the new props:

```tsx
export function ActiveCampaignSummary({
  name,
  slug,
  ongoingSince,
  sessionCount,
  npcCount,
  locationCount,
  itemCount,
  partyLevel,
  levelTarget,
  party,
  pendingPartyCount,
  isDM,
}: ActiveCampaignSummaryProps) {
```

Then insert the Party row JSX between the title block (the closing `</div>` of the flex row that contains the Shield + name + `ongoingLabel`) and the `progress !== null` level block.

Concretely, locate the existing structure inside the returned `<Card>`:

```tsx
        <div className="flex items-start gap-4">
          ...shield + name + ongoingLabel...
        </div>

        {progress !== null && (
          <div className="space-y-2">
            ...
```

Insert this new block between those two siblings:

```tsx
        <div data-testid="party-row" className="space-y-2">
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            PARTY
            {party && party.length > 0 && (
              <span> · {party.length} active</span>
            )}
            {isDM && (pendingPartyCount ?? 0) > 0 && (
              <span className="text-[var(--q-amber)]">
                {' '}· {pendingPartyCount} pending
              </span>
            )}
          </div>
          {party && party.length > 0 ? (
            slug ? (
              <Link
                href={`/campaigns/${slug}/players`}
                className="flex items-center gap-2"
              >
                {party.slice(0, 6).map((member) => (
                  <div
                    key={member.id}
                    title={member.name}
                    className="relative h-7 w-7 overflow-hidden rounded-full border border-[var(--q-amber-dim)] bg-[hsl(240,10%,8%)]"
                  >
                    {member.portraitUrl ? (
                      <Image
                        src={member.portraitUrl}
                        alt={member.name}
                        fill
                        sizes="28px"
                        className="object-cover object-top"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Users size={14} className="text-[var(--q-text-faint)]" />
                      </div>
                    )}
                  </div>
                ))}
                {party.length > 6 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--q-amber-dim)] text-[10px] text-[var(--q-text-faint)]">
                    +{party.length - 6}
                  </div>
                )}
              </Link>
            ) : null
          ) : (
            <div className="flex items-center gap-3 text-xs text-[var(--q-text-faint)]">
              <span>No party yet</span>
              {isDM && slug && (
                <Link
                  href={`/campaigns/${slug}/players?add=true`}
                  className="text-[var(--q-amber)] hover:underline"
                >
                  Add character
                </Link>
              )}
            </div>
          )}
        </div>
```

The existing level progress bar block (`{progress !== null && ...}`) and stat-tile grid stay unchanged.

### Step group C — wire data in the home page

- [ ] **Step 6: Add the characters query in `src/app/(app)/page.tsx`**

After the existing `sessions` query (lines 23-26 of the original file), add:

```tsx
  const { data: characters } = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId: active?.id ?? '' },
    { enabled: !!active?.id, staleTime: 60_000 },
  )
```

- [ ] **Step 7: Derive party shape after the existing `completedSessions`/`recentSessions` derivations**

After the line that declares `planningFromList` (line 30), add:

```tsx
  const charactersList = (characters ?? []) as Array<{
    id: string
    status: string
    character: {
      id: string
      name: string
      portraitUrl: string | null
      level: number | null
    }
  }>
  const activeParty = charactersList
    .filter((cc) => cc.status === 'ACTIVE')
    .map((cc) => ({
      id: cc.id,
      characterId: cc.character.id,
      name: cc.character.name,
      portraitUrl: cc.character.portraitUrl,
      level: cc.character.level,
    }))
  const pendingPartyCount = charactersList.filter((cc) => cc.status === 'PENDING').length
  const levelValues = activeParty
    .map((p) => p.level)
    .filter((lvl): lvl is number => typeof lvl === 'number' && lvl > 0)
  const partyLevel =
    levelValues.length > 0
      ? Math.round(levelValues.reduce((a, b) => a + b, 0) / levelValues.length)
      : undefined
  const isDM = active?.role === 'OWNER' || active?.role === 'CO_DM'
```

The inline `Array<{...}>` cast keeps this strictly typed without needing the tRPC inference path. If `trpc.characters.getCampaignCharacters` already infers cleanly, the cast can be dropped — but verify with `npx tsc --noEmit` after this step.

- [ ] **Step 8: Pass the new props to `ActiveCampaignSummary`**

Replace the existing call site (lines 107-115 of the original file):

```tsx
            <ActiveCampaignSummary
              name={active.name}
              slug={active.slug}
              ongoingSince={active.createdAt}
              sessionCount={active.sessionCount}
              npcCount={active.npcCount}
              locationCount={active.locationCount}
              itemCount={active.itemCount}
              partyLevel={partyLevel}
              levelTarget={partyLevel ? 20 : undefined}
              party={activeParty}
              pendingPartyCount={pendingPartyCount}
              isDM={isDM}
            />
```

The existing `isDM` derivation inside the `setSlot` effect (line 39) can stay where it is — the new top-level `isDM` const is computed differently to be available outside the effect.

### Step group D — verify

- [ ] **Step 9: Type-check**

```powershell
npx tsc --noEmit
```

Expected: no errors. If the cast in Step 7 is fighting the inferred query result type, simplify by removing the explicit `Array<{...}>` annotation and letting tRPC infer.

- [ ] **Step 10: Run the failing test again — it should pass now**

```powershell
$env:CI=$null; $env:BASE_URL='http://localhost:3847'
npx playwright test tests/workflows/home.workflow.spec.ts -g "Party row with PARTY overline"
```

Expected: PASS.

- [ ] **Step 11: Run the full home workflow spec to confirm no regressions**

```powershell
npx playwright test tests/workflows/home.workflow.spec.ts
```

Expected: all tests in `Home — session-first` PASS.

- [ ] **Step 12: Manual visual verification**

In a browser (with `npm run dev` running), visit `http://localhost:3847/`:

- The home page shows the `ActiveCampaignSummary` card with a `PARTY` overline.
- If the active campaign has ACTIVE characters: avatar strip is visible, clicking it navigates to `/campaigns/{slug}/players`.
- If the active campaign has no characters: empty state shows `No party yet` and (for a DM) an `Add character` link to `/campaigns/{slug}/players?add=true`.
- The rail (left side) shows a `Party` item between Sessions and NPCs. Clicking it navigates to the players page; the item becomes the active highlight when there.
- The level progress bar in the summary card now renders when any active character has a level > 0.

If any of these fail visually, fix in source and re-run the workflow spec.

- [ ] **Step 13: Commit**

```powershell
git add src/components/home/ActiveCampaignSummary.tsx src/app/(app)/page.tsx tests/workflows/home.workflow.spec.ts
git commit -m "feat(home): party row in ActiveCampaignSummary with derived level"
git push origin main
```

---

## Task 3: Final integration check

**Files:** none modified — verification only.

- [ ] **Step 1: Lint**

```powershell
npm run lint
```

Expected: no new errors in the three modified files.

- [ ] **Step 2: Run the full guardrail + workflow spec once more from a clean shell**

```powershell
$env:CI=$null; $env:BASE_URL='http://localhost:3847'
npx playwright test tests/workflows/home.workflow.spec.ts
```

Expected: all PASS.

- [ ] **Step 3: Confirm push is up to date**

```powershell
git status
git log origin/main..HEAD --oneline
```

Expected: working tree clean; no unpushed commits.

---

## Out of scope (do not implement)

- Avatar click opening the character sheet drawer via `usePinnedItems().openSheet`.
- DDB sync trigger from the home card.
- Persisting `partyLevel` as a stored `Campaign` field.
- Migrating the legacy `src/components/layout/command-rail.tsx` (it's used only by `/campaigns/[slug]/sidebar-test`; out of scope here).
- Mobile-specific overflow tuning beyond the `+N` chip.
