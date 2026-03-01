# Alpha Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the live 504 timeout (P0), add per-user Gemini API key support so AI works on Vercel (P1), and unify the design language between the prep wizard and the rest of the app (P2).

**Architecture:** P0 is a single config change. P1 threads through 5 files (schema → router → UI → AI lib → worker). P2 adds 3 CSS utility classes and applies them to 4 files; the prep wizard gets Tailwind replacements for hardcoded rgba values.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma + Neon PostgreSQL, BullMQ, Tailwind CSS, shadcn/ui

---

## P0 — Fix 504: Neon DB Keepalive Cron

### Task 1: Add Vercel cron to keep Neon DB warm

The `/api/health` endpoint already does `prisma.$queryRaw\`SELECT 1\`` — it's the perfect keepalive. Neon suspends after 5 minutes of inactivity; hitting it every 4 minutes prevents suspend.

**Files:**
- Modify: `vercel.json`

**Step 1: Read current vercel.json**

Open `vercel.json`. Current content:
```json
{
  "git": { "deploymentEnabled": { "vercel/react-server-components-cve-vu-zgya83": false } },
  "functions": { "src/app/api/**/*": { "maxDuration": 30 } }
}
```

**Step 2: Add crons array**

```json
{
  "git": {
    "deploymentEnabled": {
      "vercel/react-server-components-cve-vu-zgya83": false
    }
  },
  "functions": {
    "src/app/api/**/*": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/4 * * * *"
    }
  ]
}
```

**Step 3: Verify health endpoint works locally**

```bash
curl http://localhost:3847/api/health
```
Expected: `{"status":"ok","timestamp":"...","version":"...","uptime":...}`

**Step 4: Commit and deploy**

```bash
git add vercel.json
git commit -m "fix(infra): add Vercel cron keepalive to prevent Neon DB autosuspend"
git push origin main
```

After deploy, check Vercel dashboard → Project → Crons tab to confirm the job is registered.

**Fallback if cron isn't available on your Vercel plan:** Use UptimeRobot (free, uptimerobot.com) — create a new HTTP monitor for `https://app.nerdt.au/api/health`, interval 5 minutes.

---

## P1 — Gemini Per-User API Key

### Task 2: Add geminiApiKey to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (find the `model UserSettings` block)

**Step 1: Find the UserSettings model**

The current `UserSettings` model has four encrypted key fields: `openaiApiKey`, `anthropicApiKey`, `huggingfaceToken`, `dndBeyondCobaltCookie`.

**Step 2: Add geminiApiKey field**

In the `model UserSettings` block, add after `dndBeyondCobaltCookie`:
```prisma
  geminiApiKey            String?  @db.Text // Encrypted
```

The full field block should look like:
```prisma
  // Encrypted API keys
  openaiApiKey            String?  @db.Text // Encrypted
  anthropicApiKey         String?  @db.Text // Encrypted
  huggingfaceToken        String?  @db.Text // Encrypted
  dndBeyondCobaltCookie   String?  @db.Text // Encrypted
  geminiApiKey            String?  @db.Text // Encrypted
```

**Step 3: Push schema to database**

```bash
npm run db:push
```
Expected output: `Your database is now in sync with your Prisma schema.`

**Step 4: Verify Prisma client is updated**

```bash
npx tsc --noEmit 2>&1 | head -5
```
Expected: no errors related to `geminiApiKey`.

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add geminiApiKey field to UserSettings"
```

---

### Task 3: Update user-settings router

**Files:**
- Modify: `src/server/routers/user-settings.ts`

**Step 1: Update getSettings query**

In the `getSettings` query's return object (around line 89–102), add after the `hasDndBeyondCobaltCookie` / `maskedDndBeyondCobaltCookie` lines:
```ts
hasGeminiApiKey: !!settings.geminiApiKey,
maskedGeminiApiKey: settings.geminiApiKey ? maskApiKey(decrypt(settings.geminiApiKey)) : null,
```

**Step 2: Update getDecryptedKey enum**

The `keyName` enum currently has 4 values. Add `'geminiApiKey'`:
```ts
keyName: z.enum(['openaiApiKey', 'anthropicApiKey', 'huggingfaceToken', 'dndBeyondCobaltCookie', 'geminiApiKey']),
```
This applies to both `getDecryptedKey` and `deleteApiKey` procedures.

**Step 3: Update updateApiKeys input schema**

In the `updateApiKeys` input object, add:
```ts
geminiApiKey: z.string().optional(),
```

**Step 4: Update updateApiKeys mutation body**

After the `dndBeyondCobaltCookie` block in the mutation, add:
```ts
if (keys.geminiApiKey !== undefined) {
  encryptedData.geminiApiKey = keys.geminiApiKey ? encrypt(keys.geminiApiKey) : null;
}
```

**Step 5: Update updateApiKeys return value**

Add to the returned object:
```ts
hasGeminiApiKey: !!settings.geminiApiKey,
```

**Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 7: Commit**

```bash
git add src/server/routers/user-settings.ts
git commit -m "feat(api): add Gemini API key to user settings router"
```

---

### Task 4: Update settings page UI

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add Gemini to keyConfigs**

The `keyConfigs` array (around line 19–48) drives all API key rows. Add Gemini as the first entry — it should be prominently first because it's the recommended starting point for new users:

```ts
const keyConfigs = [
  {
    name: 'geminiApiKey' as const,
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    hasField: 'hasGeminiApiKey' as const,
    maskedField: 'maskedGeminiApiKey' as const,
    description: 'Recommended for new users — 1,000 free requests/day. Powers homebrew AI extraction.',
    badge: 'Free tier',
  },
  {
    name: 'openaiApiKey' as const,
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    hasField: 'hasOpenaiApiKey' as const,
    maskedField: 'maskedOpenaiApiKey' as const,
  },
  // ... existing entries unchanged
];
```

Add `description?: string` and `badge?: string` as optional fields — the type is implicit via `as const`.

**Step 2: Update the keyConfigs render to show description and badge**

In the JSX block that renders each config (around line 756–844), after the `<Label>{config.label}</Label>` line, add the description and badge:

```tsx
<div className="flex items-center justify-between">
  <Label>{config.label}</Label>
  <div className="flex items-center gap-2">
    {(config as any).badge && (
      <Badge variant="secondary" className="text-xs text-emerald-400 border-emerald-500/30">
        {(config as any).badge}
      </Badge>
    )}
    {hasKey && (
      <Badge variant="secondary" className="text-xs">
        Configured
      </Badge>
    )}
  </div>
</div>
{(config as any).description && !hasKey && (
  <p className="text-xs text-muted-foreground">{(config as any).description}</p>
)}
```

Replace the existing `<div className="flex items-center justify-between">` block around lines 762–769.

**Step 3: Update the deleteApiKey enum type**

The `deleteKey` mutation's `keyName` type is inferred from the zod enum. Since the router now includes `'geminiApiKey'`, this should work automatically. Verify no TypeScript error by running:

```bash
npx tsc --noEmit 2>&1 | grep settings
```

**Step 4: Visual test**

Start dev server (`npm run dev`) and navigate to `/settings`. Confirm:
- Gemini key row appears first with "Free tier" badge
- Description text shows when key is not configured
- "Add Key" → enter `AIzaTest123` → Save → row shows as Configured
- Delete button clears it

**Step 5: Commit**

```bash
git add src/app/\(app\)/settings/page.tsx
git commit -m "feat(ui): add Gemini API key field to settings — recommended for new users"
```

---

### Task 5: Thread user Gemini key through extraction lib

**Files:**
- Modify: `src/lib/ai/extraction.ts`

**Step 1: Update extractWithGemini signature**

The `extractWithGemini` function (around line 208) currently takes `(markdown, signal?)`. Add an optional `apiKey` parameter:

```ts
async function extractWithGemini(
  markdown: string,
  signal?: AbortSignal,
  apiKey?: string
): Promise<ExtractionResult> {
  const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY;
  if (!resolvedKey) {
    return { success: false, items: [], provider: 'gemini', error: 'GEMINI_API_KEY not configured' };
  }
  // Replace all uses of `apiKey` variable inside the function with `resolvedKey`
  // The fetch call uses: `?key=${apiKey}` → change to `?key=${resolvedKey}`
```

**Step 2: Add userKeys parameter to extractContent**

The `extractContent` function signature (around line 476):
```ts
export async function extractContent(
  markdown: string,
  provider: ExtractionProvider = 'gemini',
  userKeys?: { geminiApiKey?: string }
): Promise<ExtractionResult>
```

In the switch statement inside, update the Gemini case:
```ts
case 'gemini':
default:
  result = await extractWithGemini(chunks[i], signal, userKeys?.geminiApiKey);
  break;
```

**Step 3: Add userKeys parameter to extractWithFallback**

The `extractWithFallback` function signature (around line 552):
```ts
export async function extractWithFallback(
  markdown: string,
  preferredProvider?: ExtractionProvider,
  userKeys?: { geminiApiKey?: string }
): Promise<ExtractionResult>
```

Pass `userKeys` through to `extractContent` calls inside the for-loop:
```ts
const result = await extractContent(markdown, provider, userKeys);
```

**Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add src/lib/ai/extraction.ts
git commit -m "feat(ai): support per-user Gemini API key override in extraction pipeline"
```

---

### Task 6: Use user's Gemini key in the PDF worker

**Files:**
- Modify: `src/lib/queue/worker.ts`

**Step 1: Add decrypt import**

At the top of the file, add the decrypt import. Look for existing imports from `../../lib/encryption` or similar. Add:
```ts
import { decrypt } from '../encryption';
```

Check what path encryption lives at:
```bash
find E:/Projects/QuiverDM/src/lib -name "encryption*" | head -5
```

**Step 2: Fetch user's Gemini key before extraction call**

Around line 471 (just before `if (shouldExtract)`), add:
```ts
// Fetch user's Gemini key if available (allows per-user key without server env)
let userGeminiKey: string | undefined;
try {
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { geminiApiKey: true },
  });
  if (userSettings?.geminiApiKey) {
    userGeminiKey = decrypt(userSettings.geminiApiKey);
  }
} catch {
  // Non-fatal: fall back to server env key
}
```

**Step 3: Pass userKeys to extractWithFallback**

On line 488, update the call:
```ts
const extractionResult = await extractWithFallback(
  extractionPayload.markdown,
  extractionProvider,
  userGeminiKey ? { geminiApiKey: userGeminiKey } : undefined
);
```

**Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add src/lib/queue/worker.ts
git commit -m "feat(worker): use per-user Gemini API key for homebrew PDF extraction"
```

---

## P2 — Design System Consistency

### Task 7: Add CSS utility classes for design language

The prep wizard uses inline `rgba(212,168,83,*)` values. The global CSS already has `--primary: hsl(35 80% 55%)` (amber). We need three utility classes to bring the same decorative language to the main app.

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Read current globals.css utilities section**

The file has a `@layer utilities` block starting around line 121. Add the following three utilities at the end of that block (before the closing `}`):

```css
/* Decorative amber separator line — matches prep wizard header decoration */
.section-rule::before {
  content: '';
  display: block;
  height: 1px;
  background: linear-gradient(90deg, hsl(35 80% 55% / 0.3), transparent);
  margin-bottom: 0.5rem;
}

/* Overline label style — matches prep wizard "SESSION PREP" label */
.label-overline {
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: hsl(35 80% 55% / 0.4);
  line-height: 1;
}

/* Subtle grain texture on glass surfaces */
.glass-grain {
  position: relative;
  isolation: isolate;
}
.glass-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  opacity: 0.022;
  mix-blend-mode: overlay;
  z-index: 1;
}
```

**Step 2: Verify no syntax errors**

```bash
npm run build 2>&1 | grep -i "css\|error" | head -10
```
Or just start dev: `npm run dev` and check browser console.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): add section-rule, label-overline, glass-grain CSS utilities"
```

---

### Task 8: Apply grain texture to sidebar

**Files:**
- Modify: `src/components/sidebar.tsx`

**Step 1: Add glass-grain to aside**

The `<aside>` currently has classes: `glass-shell hidden md:flex flex-col border-r border-border transition-all duration-200`

Add `glass-grain`:
```tsx
className={cn(
  'glass-shell glass-grain hidden md:flex flex-col border-r border-border transition-all duration-200',
  collapsed ? 'w-16' : 'w-60'
)}
```

**Step 2: Visual test**

Navigate to any authenticated page and check the sidebar has the faint grain texture visible over the glass background (very subtle — squint at the sidebar).

**Step 3: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(design): apply grain texture to sidebar glass surface"
```

---

### Task 9: Apply section labels to dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Read current dashboard page**

The dashboard has sections: Quick Stats, Active Campaign (via `ActiveCampaignHero`), "Your Campaigns", "Characters", "Recent Homebrew", and Pending Invites. Find the `h2` or section header tags for each of these.

**Step 2: Add label-overline + section-rule above each major section header**

Before each `<h2>` or section header element in the return JSX, add:
```tsx
<div>
  <p className="label-overline">Campaigns</p>
  <div className="section-rule" />
  <h2 className="text-lg font-semibold">Your Campaigns</h2>
</div>
```

Apply to: Your Campaigns, Characters, Recent Homebrew. Skip Quick Stats (it's already a grid — doesn't need a section label).

**Step 3: Visual test**

Run `npm run dev`, navigate to `/dashboard`. Each section should have a small amber uppercase label above the heading with a gold gradient rule.

**Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(design): add overline labels and amber rules to dashboard sections"
```

---

### Task 10: Apply section labels to campaign overview

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/page.tsx`

**Step 1: Find section headers in campaign overview page**

The page has sections: stat pills, Last Session card, and Quick Actions card. Find the card titles or section dividers.

**Step 2: Add label-overline to card areas**

Above the Last Session card column and the Quick Actions card, add the overline pattern:
```tsx
<div>
  <p className="label-overline">Recent</p>
  <div className="section-rule" />
</div>
```

Keep it subtle — only 1–2 overlines on this page (not every single card title needs one).

**Step 3: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/page.tsx
git commit -m "feat(design): add overline labels to campaign overview sections"
```

---

### Task 11: Replace hardcoded rgba in prep wizard sidebar with Tailwind

**Files:**
- Modify: `src/components/session/prep/prep-step-sidebar.tsx`

**Context:** The fullscreen sidebar branch uses hardcoded `rgba(212,168,83,*)` inline styles. The CSS `--primary` token is `hsl(35 80% 55%)` which is the same amber. Replace inline style colors with Tailwind where possible; keep inline styles only for values Tailwind can't express (gradients, box-shadow).

**Step 1: Replace amber text colors**

- `color: 'rgba(232,213,176,1)'` → className `text-amber-100` (or `text-primary/90`)
- `color: 'rgba(232,213,176,0.55)'` → className `text-primary/55`
- `color: 'rgba(255,255,255,0.25)'` → className `text-white/25`
- `color: 'rgba(212,168,83,0.4)'` → className `text-primary/40`
- `color: 'rgba(212,168,83,1)'` → className `text-primary`
- `color: 'rgba(212,168,83,0.6)'` → className `text-primary/60`

**Step 2: Replace amber background colors**

- `background: 'rgba(212,168,83,0.15)'` → className `bg-primary/15`
- `background: 'rgba(212,168,83,0.06)'` → className `bg-primary/[0.06]`

**Step 3: Replace amber border colors**

- `borderColor: 'rgba(212,168,83,0.7)'` → className `border-primary/70`
- `borderColor: 'rgba(212,168,83,0.25)'` → className `border-primary/25`
- `borderColor: 'rgba(255,255,255,0.08)'` → className `border-white/[0.08]`

**Step 4: Keep these as inline styles (can't express in Tailwind)**

- `boxShadow: '0 0 12px rgba(212,168,83,0.15)'` — keep as inline style
- Gradient lines (`background: 'linear-gradient(90deg, rgba(212,168,83,0.3), transparent)'`) — keep as inline style

**Step 5: Type-check and visual test**

```bash
npx tsc --noEmit 2>&1 | grep prep-step
```

Start dev, navigate to a session prep page, and toggle fullscreen mode. The sidebar should look identical to before.

**Step 6: Commit**

```bash
git add src/components/session/prep/prep-step-sidebar.tsx
git commit -m "refactor(design): replace hardcoded rgba in prep wizard with Tailwind primary tokens"
```

---

### Task 12: Update kanban

**Files:**
- Modify: `docs/obsidian-vault/KANBAN.md`

**Step 1: Move Vercel Deployment card to Done**

In `🔴 Now — Alpha Launch Blockers`, change:
```
- [ ] **Vercel Deployment (infra)** — ...
```
to (move it to `✅ Done` section):
```
- [x] **Vercel Deployment (infra)** — App live at app.nerdt.au. Neon keepalive cron added.
```

**Step 2: Add Gemini API card to Next**

In `🟡 Next — Post-Alpha`, add:
```
- [ ] **Gemini API — Per-User Key & Recommended Onboarding** — Add Gemini key to user settings (1,000 free req/day). Surface prominently in Settings with "Recommended" callout. Update extraction worker to prefer user's key. Refs: `docs/plans/2026-03-01-alpha-readiness-impl.md`
```

Wait — this is actually already implemented in this plan. Mark it done instead.

**Step 3: Move prep wizard aesthetic idea to Backlog**

Move "Adopt Prep Wizard Aesthetic to Main UI" from `💡 Ideas` to `🟢 Later — Backlog` and update the description to reflect what was done:
```
- [ ] **Design Language Unification** — Amber accent system, grain texture, overline labels. P2 implementation applied grain to sidebar + section labels on dashboard/campaign. Prep wizard now uses CSS tokens. Further: NPC pages, sessions list, homebrew gallery.
```

**Step 4: Commit**

```bash
git add docs/obsidian-vault/KANBAN.md
git commit -m "chore(kanban): update cards for Vercel live, Gemini key, design consistency"
```

---

### Task 13: Deploy and verify

**Step 1: Push all commits**

```bash
git push origin main
```

**Step 2: Watch Vercel deployment**

```bash
# In a terminal with Vercel CLI installed:
vercel logs --follow
# Or check the Vercel dashboard
```

**Step 3: Verify 504 is gone**

Wait 5+ minutes after deploy (let Neon go to sleep), then:
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://app.nerdt.au/auth/signin
```
Expected: `200 <3s` — not a 504 timeout.

**Step 4: Verify AI extraction with Gemini key**

1. Log in to app.nerdt.au
2. Go to Settings → add a valid Gemini API key (get one free at aistudio.google.com)
3. Upload a small D&D homebrew PDF
4. Confirm extraction completes and items appear in homebrew library

**Step 5: Verify design changes**

- Sidebar has subtle grain texture
- Dashboard sections have amber overline labels
- Campaign overview has at least one overline label
- Prep wizard fullscreen mode looks identical to before

---

## Summary

| Track | Tasks | Deploy Required |
|-------|-------|----------------|
| P0 — Neon Keepalive | 1 | Yes (vercel.json) |
| P1 — Gemini Key | 5 (Tasks 2–6) | Yes (schema + code) |
| P2 — Design | 5 (Tasks 7–11) | Yes (CSS + components) |
| Housekeeping | 2 (Tasks 12–13) | Yes (final push) |
