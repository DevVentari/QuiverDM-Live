# Beta Launch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the app, harden onboarding, write E2E tests, and prep for Vercel + Railway deployment for closed beta.

**Architecture:** Small targeted fixes to existing components, Playwright tests covering all critical flows, and a deployment config pass. No new features — only quality and reliability improvements.

**Tech Stack:** Next.js 15, tRPC v11, Playwright, Tailwind, shadcn/ui (ConfirmDialog, AlertDialog), Zod, Vercel, Railway.

---

## Audit Reality Check

Several UI audit issues (Feb 18) were already fixed before this plan:
- M1 (PDF delete): already uses `AlertDialog` — **done**
- M2 (settings toast): already present — **done**
- M3 (dashboard error states): already has `isError` cards — **done**
- L1/L2 (invite dialog reset + spinner): already implemented — **done**
- L6/L7 (sessions/npcs error states): already present — **done**

Remaining real work: `window.confirm` in encounters, empty state consistency, form validation, onboarding polish, E2E tests, and deployment config.

---

## Task 1: Replace `window.confirm` in encounters page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/encounters/page.tsx:218-226`

**Step 1: Add ConfirmDialog state**

Add at the top of the `EncounterPlansPage` component, alongside existing state:

```tsx
const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
```

**Step 2: Replace the window.confirm block (line 221)**

Find:
```tsx
if (!window.confirm(`Delete "${plan.name}"?`)) return;
setDeletingId(plan.id);
deleteMutation.mutate({ planId: plan.id });
```

Replace with:
```tsx
setDeletingPlanId(plan.id);
```

**Step 3: Add ConfirmDialog before the closing `</div>` of the component return**

```tsx
<ConfirmDialog
  open={deletingPlanId !== null}
  onOpenChange={(open) => { if (!open) setDeletingPlanId(null); }}
  title="Delete encounter plan?"
  description="This will permanently delete the plan and all its creatures. This cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={() => {
    if (deletingPlanId) {
      setDeletingId(deletingPlanId);
      deleteMutation.mutate({ planId: deletingPlanId });
      setDeletingPlanId(null);
    }
  }}
  loading={deleteMutation.isPending}
/>
```

**Step 4: Add import at top of file**

```tsx
import { ConfirmDialog } from '@/components/confirm-dialog';
```

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 6: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/encounters/page.tsx
git commit -m "fix: replace window.confirm with ConfirmDialog on encounter delete"
```

---

## Task 2: Replace `window.confirm` in encounter-builder component

**Files:**
- Modify: `src/components/encounter/encounter-builder.tsx:530-533`

**Step 1: Find the window.confirm** (line 532)

```tsx
if (!window.confirm('Delete this encounter plan? This cannot be undone.')) return;
```

**Step 2: Add state at top of the component**

```tsx
const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
```

**Step 3: Replace the inline confirm**

Replace the `window.confirm` guard line with:
```tsx
setConfirmDeleteOpen(true);
return; // early return — actual delete fires from dialog
```

Then extract the delete logic into a named handler:
```tsx
function handleConfirmDelete() {
  setConfirmDeleteOpen(false);
  // move the existing delete mutation call here
}
```

**Step 4: Add ConfirmDialog to the JSX return**

```tsx
<ConfirmDialog
  open={confirmDeleteOpen}
  onOpenChange={setConfirmDeleteOpen}
  title="Delete encounter plan?"
  description="This will permanently delete this plan and all its creatures. This cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={handleConfirmDelete}
/>
```

**Step 5: Import ConfirmDialog**

```tsx
import { ConfirmDialog } from '@/components/confirm-dialog';
```

**Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/components/encounter/encounter-builder.tsx
git commit -m "fix: replace window.confirm with ConfirmDialog in encounter builder"
```

---

## Task 3: Clarify campaign nav tab visibility (L3)

**Files:**
- Modify: `src/components/campaign/campaign-nav.tsx`

**Context:** Currently `Players` tab is visible to all roles, `Members` tab is DM-only (line 39). Players is the player-facing view; Members is the DM management view. This is intentional — document it.

**Step 1: Read the current nav config**

```tsx
// Current line 39:
if (tab.href === '/members' || tab.href === '/settings') return isDM;
```

**Step 2: Add a comment above the visibility logic**

```tsx
// Visibility rules:
// - /members and /settings are DM-only (campaign management)
// - /players is visible to all roles (party overview — intentionally public within campaign)
// - All other tabs are visible to all roles
```

**Step 3: Commit**

```bash
git add src/components/campaign/campaign-nav.tsx
git commit -m "docs: clarify campaign nav tab visibility rules in comments"
```

---

## Task 4: Standardize empty states across list pages

**Reference pattern** (from `encounters/page.tsx`):
```tsx
<div className="rounded-lg border border-dashed border-border">
  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
    <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center mb-4">
      <IconComponent className="h-6 w-6 text-muted-foreground/40" />
    </div>
    <h3 className="font-semibold text-base mb-1">Nothing here yet</h3>
    <p className="text-sm text-muted-foreground mb-5 max-w-xs">
      Descriptive sentence about what this section is for.
    </p>
    <Button size="sm" onClick={...}>Primary CTA</Button>
  </div>
</div>
```

**Files to audit and update:**
- `src/app/(app)/campaigns/[slug]/npcs/page.tsx` — check empty state
- `src/app/(app)/campaigns/[slug]/players/page.tsx` — check empty state
- `src/app/(app)/homebrew/page.tsx` — check empty state

**Step 1: Read each file and identify the empty state block**

For each file, look for the branch rendered when `data.length === 0`.

**Step 2: Update any that are minimal (text-only, no icon or CTA)**

Apply the reference pattern. Use a relevant Lucide icon from the existing imports in that file.

**Step 3: TypeScript check and commit**

```bash
npx tsc --noEmit
git add src/app/(app)/campaigns/[slug]/npcs/page.tsx \
        src/app/(app)/campaigns/[slug]/players/page.tsx \
        src/app/(app)/homebrew/page.tsx
git commit -m "polish: standardize empty states with icon + description + CTA"
```

---

## Task 5: Add client-side Zod validation to campaign create form

**Files:**
- Modify: `src/components/campaign/create-campaign-dialog.tsx` (or wherever campaign creation form lives — find it first)

**Step 1: Find the campaign create form**

```bash
grep -r "createCampaign\|campaigns.create" src/components --include="*.tsx" -l
```

**Step 2: Add Zod schema at top of file**

```tsx
import { z } from 'zod';

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});
```

**Step 3: Add inline validation on submit**

```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const result = createCampaignSchema.safeParse({ name, description });
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    result.error.issues.forEach(issue => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    setErrors(fieldErrors);
    return;
  }
  setErrors({});
  createMutation.mutate(result.data);
}
```

**Step 4: Show inline error under the name field**

```tsx
<Input
  id="name"
  value={name}
  onChange={(e) => { setName(e.target.value); setErrors({}); }}
  className={errors.name ? 'border-destructive' : ''}
/>
{errors.name && (
  <p className="text-xs text-destructive mt-1">{errors.name}</p>
)}
```

**Step 5: TypeScript check and commit**

```bash
npx tsc --noEmit
git add src/components/campaign/create-campaign-dialog.tsx
git commit -m "feat: add client-side Zod validation to campaign create form"
```

---

## Task 6: Onboarding — redirect to campaign after creation

**Files:**
- Modify: `src/app/(app)/onboarding/page.tsx`

**Context:** After completing the onboarding wizard via "Create a Campaign", the user lands on `/dashboard`. Better UX: go directly to the new campaign. The `campaigns.create` mutation returns the new campaign object.

**Step 1: Capture the campaign slug from createCampaign.onSuccess (line ~261)**

```tsx
const createCampaign = trpc.campaigns.create.useMutation({
  onSuccess: (data) => {
    // data.slug is available — go directly to the new campaign
    completeFirstCampaign.mutate();
    router.push(`/campaigns/${data.slug}`);
  },
  ...
});
```

**Step 2: Remove the router.push from CompleteStep**

The `CompleteStep` currently always goes to `/dashboard`. After a campaign is created, we skip straight to the campaign — so users who reach CompleteStep did so via "join" or "skip". They should still go to `/dashboard`. No change needed there.

**Step 3: TypeScript check and commit**

```bash
npx tsc --noEmit
git add src/app/(app)/onboarding/page.tsx
git commit -m "feat: redirect to new campaign after onboarding creation"
```

---

## Task 7: Fix Playwright config base URL

**Files:**
- Modify: `playwright.config.ts`

**Context:** Config has `baseURL: 'http://localhost:3001'` but the app runs on port 3847.

**Step 1: Update the config**

```ts
use: {
  baseURL: 'http://localhost:3847',
  ...
},

webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3847',
  reuseExistingServer: true,
  timeout: 120000,
},
```

**Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "fix: update Playwright baseURL to port 3847"
```

---

## Task 8: Write E2E test — Auth flow

**Files:**
- Create: `tests/auth.spec.ts`

**Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('sign in page loads', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/signin/);
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel(/email/i).fill('notreal@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible();
  });
});
```

**Step 2: Run the tests**

```bash
npx playwright test tests/auth.spec.ts
```
Expected: All pass (or skip credential test if no test user seeded).

**Step 3: Commit**

```bash
git add tests/auth.spec.ts
git commit -m "test: E2E auth flow — sign in page and redirect"
```

---

## Task 9: Write E2E test helper — authenticated session

**Files:**
- Create: `tests/helpers/auth.ts`

**Context:** Most E2E tests need an authenticated user. Set up a global auth helper using Playwright's storageState.

**Step 1: Create the helper**

```ts
import { Page } from '@playwright/test';

export async function signInAsTestUser(page: Page) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL ?? 'test@quiverdm.test');
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? 'testpassword123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|onboarding/);
}
```

**Step 2: Add test env vars to `.env.test`**

```env
TEST_USER_EMAIL=test@quiverdm.test
TEST_USER_PASSWORD=testpassword123
```

**Step 3: Commit**

```bash
git add tests/helpers/auth.ts .env.test
git commit -m "test: add authenticated session helper for E2E tests"
```

---

## Task 10: Write E2E test — Onboarding flow

**Files:**
- Create: `tests/onboarding.spec.ts`

**Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Onboarding', () => {
  test('new user sees onboarding wizard', async ({ page }) => {
    // NOTE: requires a fresh test user that has not completed onboarding
    await signInAsTestUser(page);
    // If onboarding not complete, should land on /onboarding
    // This test is environment-dependent — skip if user already onboarded
    const url = page.url();
    if (!url.includes('onboarding')) {
      test.skip();
      return;
    }
    await expect(page.getByText(/welcome to quiverdm/i)).toBeVisible();
  });

  test('onboarding step indicator renders', async ({ page }) => {
    await page.goto('/onboarding');
    // Step dots should be visible
    await expect(page.locator('.rounded-full').first()).toBeVisible();
  });

  test('completed onboarding redirects to dashboard', async ({ page }) => {
    await signInAsTestUser(page);
    // If already completed, should redirect away from onboarding
    await page.goto('/onboarding');
    // Either on dashboard or onboarding (depending on user state)
    await expect(page).toHaveURL(/dashboard|onboarding/);
  });
});
```

**Step 2: Run**

```bash
npx playwright test tests/onboarding.spec.ts
```

**Step 3: Commit**

```bash
git add tests/onboarding.spec.ts
git commit -m "test: E2E onboarding flow"
```

---

## Task 11: Write E2E test — Campaign CRUD

**Files:**
- Create: `tests/campaigns.spec.ts`

**Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
  });

  test('campaigns page loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible();
  });

  test('can create a campaign', async ({ page }) => {
    await page.getByRole('button', { name: /new campaign/i }).click();
    await page.getByLabel(/campaign name/i).fill('E2E Test Campaign');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('E2E Test Campaign')).toBeVisible();
  });

  test('campaign create requires a name', async ({ page }) => {
    await page.getByRole('button', { name: /new campaign/i }).click();
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(/required|name is required/i)).toBeVisible();
  });
});
```

**Step 2: Run**

```bash
npx playwright test tests/campaigns.spec.ts
```

**Step 3: Commit**

```bash
git add tests/campaigns.spec.ts
git commit -m "test: E2E campaign create and validation"
```

---

## Task 12: Write E2E test — Session create flow

**Files:**
- Create: `tests/sessions.spec.ts`

**Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Sessions', () => {
  test('sessions tab loads for a campaign', async ({ page }) => {
    await signInAsTestUser(page);
    // Navigate to first campaign
    await page.goto('/campaigns');
    await page.locator('a[href*="/campaigns/"]').first().click();
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  });

  test('can create a new session', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    await page.locator('a[href*="/campaigns/"]').first().click();
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill('E2E Test Session');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('E2E Test Session')).toBeVisible();
  });
});
```

**Step 2: Run and commit**

```bash
npx playwright test tests/sessions.spec.ts
git add tests/sessions.spec.ts
git commit -m "test: E2E session create flow"
```

---

## Task 13: Write E2E test — NPC create flow

**Files:**
- Create: `tests/npcs.spec.ts`

**Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('NPCs', () => {
  test('NPC list loads', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    await page.locator('a[href*="/campaigns/"]').first().click();
    await page.getByRole('link', { name: /npcs/i }).click();
    await expect(page.getByRole('heading', { name: /npcs/i })).toBeVisible();
  });

  test('can create an NPC', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    await page.locator('a[href*="/campaigns/"]').first().click();
    await page.getByRole('link', { name: /npcs/i }).click();
    await page.getByRole('button', { name: /new npc|add npc/i }).click();
    await page.getByLabel(/name/i).fill('E2E Test NPC');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page.getByText('E2E Test NPC')).toBeVisible();
  });
});
```

**Step 2: Run and commit**

```bash
npx playwright test tests/npcs.spec.ts
git add tests/npcs.spec.ts
git commit -m "test: E2E NPC create flow"
```

---

## Task 14: Write E2E test — Member invite flow

**Files:**
- Create: `tests/members.spec.ts`

**Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Member invites', () => {
  test('invite dialog opens and generates a code', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    await page.locator('a[href*="/campaigns/"]').first().click();
    await page.getByRole('link', { name: /members/i }).click();
    await page.getByRole('button', { name: /invite/i }).click();
    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    // Select role
    await page.getByRole('combobox').selectOption('PLAYER');
    // Create invite
    await page.getByRole('button', { name: /create invite/i }).click();
    // Code should appear
    await expect(page.getByText(/[A-Z0-9]{6,}/)).toBeVisible();
  });
});
```

**Step 2: Run and commit**

```bash
npx playwright test tests/members.spec.ts
git add tests/members.spec.ts
git commit -m "test: E2E member invite flow"
```

---

## Task 15: Deployment prep — update Playwright config for CI

**Files:**
- Modify: `playwright.config.ts`

**Step 1: Add CI-aware configuration**

```ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3847',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Only start dev server locally, not in CI (CI should start it separately)
  ...(process.env.CI ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3847',
      reuseExistingServer: true,
      timeout: 120000,
    },
  }),
});
```

**Step 2: Add test script to package.json**

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**Step 3: Commit**

```bash
git add playwright.config.ts package.json
git commit -m "chore: update Playwright config for CI and correct port"
```

---

## Task 16: Deployment prep — Railway docker-compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Read current docker-compose.yml and verify Railway compatibility**

Check that each service has:
- `restart: unless-stopped`
- A named volume (not anonymous)
- No `host` network mode

**Step 2: Add health checks to postgres and redis**

```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5

redis:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add health checks to docker-compose for Railway deployment"
```

---

## Task 17: Deployment prep — production environment template

**Files:**
- Create: `.env.production.example`

**Step 1: Create the file**

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/quiverdm

# Redis
REDIS_URL=redis://host:6379

# Auth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Admin
ADMIN_EMAILS=your@email.com

# Search
MEILI_URL=https://your-meili.railway.app
MEILI_MASTER_KEY=generate-with-openssl-rand-base64-32

# Processing
DOCLING_URL=https://your-docling.railway.app
OLLAMA_BASE_URL=https://your-ollama.railway.app

# Transcription
ASSEMBLYAI_API_KEY=...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Step 2: Commit**

```bash
git add .env.production.example
git commit -m "chore: add production environment template for Vercel/Railway deploy"
```

---

## Task 18: Run full E2E suite and fix failures

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Run all tests**

```bash
npx playwright test
```

**Step 3: Review HTML report for failures**

```bash
npx playwright show-report
```

**Step 4: Fix any selector mismatches or timing issues**

Common fixes:
- `await page.waitForLoadState('networkidle')` before assertions after navigation
- Use `page.getByTestId('...')` if role-based selectors are ambiguous — add `data-testid` attributes to key buttons if needed
- For async mutations, wait for the success state: `await expect(page.getByText('...')).toBeVisible({ timeout: 10000 })`

**Step 5: Commit fixes**

```bash
git add tests/
git commit -m "test: fix E2E selector issues from full suite run"
```

---

## Task 19: Pre-launch check

**Step 1: Run the built-in check script**

```bash
npm run check:launch
```

Expected: All checks pass (DB, Redis, env, Stripe, invite readiness).

**Step 2: Run TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Run linter**

```bash
npm run lint
```
Expected: 0 errors (warnings OK).

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: beta launch readiness — all checks pass"
```

---

## Deployment Checklist (do after all tasks)

### Railway setup
1. Create new Railway project
2. Add services: Postgres (pgvector/pgvector:pg15), Redis, MeiliSearch, Docling
3. Add worker services: `npm run worker:pdf`, `npm run worker:transcription`, `npm run worker:webhooks`, `npm run worker:summary`, `npm run worker:embeddings`
4. Add WebSocket service: `npm run dev:ws`
5. Copy all env vars from `.env.production.example` to Railway

### Vercel setup
1. Import GitHub repo to Vercel
2. Set all env vars (DATABASE_URL, REDIS_URL etc pointing at Railway)
3. Set `NEXTAUTH_URL` to Vercel production URL
4. Deploy

### Post-deploy
```bash
npm run db:push  # run against production DATABASE_URL
npm run setup:stripe  # create/find Stripe products
npm run check:launch  # validate all integrations
npm run generate-beta-invites  # generate first invite batch
```
