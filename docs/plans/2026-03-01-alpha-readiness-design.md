# Alpha Readiness Design — 2026-03-01

Three parallel tracks: P0 live blocker, P1 AI key gap, P2 design consistency.

---

## P0 — Neon DB Keepalive (live blocker)

**Problem:** App returns 504 Gateway Timeout after ~13 minutes of inactivity. Neon DB free tier suspends after 5 minutes; reconnect time exceeds Vercel's serverless function window.

**Solution:** Vercel cron job pinging `/api/health` every 4 minutes. The endpoint already does `prisma.$queryRaw\`SELECT 1\`` — no new code required.

### Changes

**`vercel.json`** — add crons array:
```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/4 * * * *"
    }
  ]
}
```
Keep existing `functions.maxDuration: 30` and git config.

**Note:** Vercel cron jobs require at least a Pro/Hobby plan with the cron feature enabled. If cron jobs are unavailable, use UptimeRobot (free) set to monitor `https://app.nerdt.au/api/health` every 5 minutes as an alternative.

---

## P1 — Gemini Per-User API Key

**Problem:** `getAvailableProviders()` reads only from `process.env`. On Vercel, Ollama is unavailable. If `GEMINI_API_KEY` isn't set server-side, all AI extraction silently fails for every user.

**Solution:** Add per-user Gemini key to the settings stack, and thread it through the extraction pipeline. The Gemini free tier gives users 1,000 req/day — enough for alpha use. Surface it as the recommended key to set.

### Changes

**`prisma/schema.prisma`** — `UserSettings` model:
```prisma
geminiApiKey  String? @db.Text // Encrypted
```
Run `npm run db:push` after.

**`src/server/routers/user-settings.ts`:**
- `getSettings`: add `hasGeminiApiKey` + `maskedGeminiApiKey` to returned object
- `getDecryptedKey` enum: add `'geminiApiKey'`
- `updateApiKeys` input: add `geminiApiKey: z.string().optional()`
- `updateApiKeys` mutation body: encrypt + store `geminiApiKey`
- `deleteApiKey` enum: add `'geminiApiKey'`

**`src/app/(app)/settings/page.tsx`** — `keyConfigs` array:
Add Gemini as the first entry:
```ts
{
  name: 'geminiApiKey' as const,
  label: 'Google Gemini API Key',
  placeholder: 'AIza...',
  hasField: 'hasGeminiApiKey' as const,
  maskedField: 'maskedGeminiApiKey' as const,
  description: 'Recommended — 1,000 free requests/day. Used for homebrew AI extraction.',
  badge: 'Free tier',
}
```
Extend the keyConfigs render to show `config.description` and `config.badge` where present.

**`src/lib/ai/extraction.ts`** — `extractWithGemini`:
Add optional `apiKey` parameter:
```ts
async function extractWithGemini(
  markdown: string,
  signal?: AbortSignal,
  apiKey?: string
): Promise<ExtractionResult>
```
Use `apiKey ?? process.env.GEMINI_API_KEY`. Update callers in `extractContent` to pass through.

**`src/lib/ai/extraction.ts`** — `extractContent` / `extractWithFallback`:
Add optional `userKeys?: { geminiApiKey?: string }` parameter. Pass to provider functions.

**Homebrew PDF worker** (`src/workers/homebrew-pdf-worker.ts` or equivalent):
When processing a job, fetch the user's decrypted Gemini key:
```ts
const settings = await prisma.userSettings.findUnique({ where: { userId } });
const geminiKey = settings?.geminiApiKey ? decrypt(settings.geminiApiKey) : undefined;
const result = await extractWithFallback(markdown, undefined, { geminiApiKey: geminiKey });
```

---

## P2 — Design System Consistency

**Problem:** The prep wizard fullscreen mode (`PrepStepSidebar`) hardcodes amber rgba values instead of using the CSS variable system. The rest of the app uses `var(--primary)` (which is already amber `hsl(35 80% 55%)`). The gap is decorative elements, not the color itself.

**Assessment:** The body already has the atmospheric amber/purple gradient + fixed background. `glass-shell`, `glass-panel`, `glass-row` utilities exist. The missing pieces are:
1. Grain/noise texture on key surfaces (sidebar, cards)
2. Decorative amber separator lines in main pages (matching prep wizard's header decoration)
3. Uppercase `tracking-[0.15em]` section labels on dashboard + campaign overview
4. Prep wizard should use `text-primary` / Tailwind classes not hardcoded rgba

### Changes

**`src/app/globals.css`** — add utility classes:
```css
/* Subtle grain texture overlay */
.grain {
  position: relative;
}
.grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* SVG noise */
  opacity: 0.025;
  pointer-events: none;
  border-radius: inherit;
}

/* Section header decoration (amber gradient line) */
.section-rule {
  height: 1px;
  background: linear-gradient(90deg, hsl(var(--primary) / 0.35), transparent);
  margin-bottom: 0.75rem;
}

/* Small uppercase label style matching prep wizard */
.label-overline {
  font-size: 0.625rem; /* 10px */
  font-weight: 500;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: hsl(var(--primary) / 0.45);
}
```

**`src/components/sidebar.tsx`** — add `grain` class to `<aside>`.

**`src/app/(app)/dashboard/page.tsx`** — add `label-overline` + `section-rule` before "Your Campaigns", "Characters", "Recent Homebrew" section headers.

**`src/app/(app)/campaigns/[slug]/page.tsx`** — same treatment on section headers.

**`src/components/session/prep/prep-step-sidebar.tsx`** — in fullscreen branch, replace hardcoded `rgba(212,168,83,*)` with Tailwind `text-primary`, `border-primary/30`, `bg-primary/15` etc. where applicable. Keep custom box-shadow and gradient line as-is (Tailwind can't express those).

---

## Kanban Updates

- Move "Vercel Deployment (infra)" card from `🔴 Now` to `✅ Done`
- Add to `🟡 Next`: **Gemini API Key — Per-User Setup** (P1 above)
- Move "Adopt Prep Wizard Aesthetic" from `💡 Ideas` to `🟢 Later — Backlog` (in progress as P2)

---

## Sequence

1. P0: `vercel.json` cron → deploy → verify health endpoint wakes DB
2. P1: Prisma migration → router → settings UI → worker → deploy
3. P2: CSS utilities → sidebar grain → section labels → prep wizard cleanup
