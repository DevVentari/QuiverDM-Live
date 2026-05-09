# Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-selectable parchment light theme to QuiverDM with DB-persisted preference and a toggle in the CommandRail footer and Settings page.

**Architecture:** CSS `html.light { }` override block on top of existing dark-first tokens. next-themes (already wired) applies the `light` class to `<html>`. A `ThemeInitializer` component syncs the DB preference to next-themes on session load. A `ThemeToggle` button writes locally (instant) and fires a DB write in the background.

**Tech Stack:** next-themes (already installed), Prisma, tRPC, Tailwind/shadcn, Lucide icons

---

## File Map

| File | Action | What it does |
|---|---|---|
| `src/styles/tokens.css` | Modify | Add `html.light { }` block — all Q and shadcn var overrides |
| `src/app/globals.css` | Modify | Add `html.light body { }` parchment gradient background |
| `prisma/schema.prisma` | Modify | Add `theme String @default("dark")` to UserSettings |
| `src/server/routers/user-settings.ts` | Modify | Add `theme` to `updatePreferences` input + `getSettings` response |
| `src/components/theme-initializer.tsx` | Create | Client component — syncs DB theme to next-themes on load |
| `src/app/providers.tsx` | Modify | Mount `<ThemeInitializer />` inside Providers |
| `src/components/ui/theme-toggle.tsx` | Create | Sun/Moon icon button — instant local switch + fire-and-forget DB write |
| `src/components/layout/command-rail.tsx` | Modify | Add `<ThemeToggle />` to rail footer |
| `src/components/settings/panels.tsx` | Modify | Add theme row to `AppearanceSettingsPanel` |

---

## Task 1: CSS — light token overrides

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add `html.light` Q-token block**

Append to the end of `src/styles/tokens.css`:

```css
/* ── Light theme (Parchment Manuscript) ── */
html.light {
  /* Shadcn compatibility */
  --background: 35 30% 93%;
  --foreground: 35 25% 12%;
  --card: 35 20% 97%;
  --card-foreground: 35 25% 12%;
  --popover: 35 25% 96%;
  --popover-foreground: 35 25% 12%;
  --primary: 35 80% 45%;
  --primary-foreground: 35 10% 98%;
  --secondary: 35 20% 88%;
  --secondary-foreground: 35 25% 20%;
  --muted: 35 15% 88%;
  --muted-foreground: 35 15% 42%;
  --accent: 35 80% 45%;
  --accent-foreground: 35 10% 98%;
  --destructive: 0 62% 40%;
  --destructive-foreground: 0 0% 98%;
  --border: 35 20% 76%;
  --input: 35 18% 80%;
  --ring: 35 80% 45%;

  /* QuiverDM Q-tokens */
  --q-bg:             oklch(0.96 0.012 80);
  --q-surface-flat:   oklch(0.93 0.014 80);
  --q-surface-raised: oklch(0.97 0.010 80);
  --q-surface-sunken: oklch(0.92 0.014 80);
  --q-card-bg:        oklch(0.97 0.010 80);
  --q-card-border:    oklch(0.55 0.10 60 / 0.25);
  --q-border:         oklch(0.55 0.04 60 / 0.3);
  --q-border-subtle:  oklch(0.55 0.04 60 / 0.15);
  --q-text:           oklch(0.20 0.025 60);
  --q-text-dim:       oklch(0.42 0.020 60);
  --q-text-faint:     oklch(0.55 0.018 60);
  --q-glow-amber:     oklch(0.7 0.16 55 / 0.08);
  --q-glow-mystic:    oklch(0.55 0.15 280 / 0.04);
  /* --q-amber* variants unchanged — amber is the same in both themes */
}
```

- [ ] **Step 2: Add `html.light body` background to `src/app/globals.css`**

In `src/app/globals.css`, append inside `@layer base` after the existing `body { }` rule (or directly after the closing `}` of the base layer):

```css
html.light body {
  background-image:
    radial-gradient(ellipse 60% 45% at 20% -5%, hsl(35 60% 82% / 0.6), transparent),
    radial-gradient(ellipse 40% 35% at 80% -5%, hsl(45 40% 90% / 0.5), transparent),
    radial-gradient(ellipse 80% 50% at 50% 105%, hsl(35 30% 88% / 0.4), transparent),
    linear-gradient(hsl(35 25% 93%), hsl(40 20% 91%));
}
```

- [ ] **Step 3: Manually verify tokens apply**

Start the dev server (`npm run dev`), open http://localhost:3847, open DevTools console and run:

```js
document.documentElement.classList.add('light')
```

Expected: page background shifts to warm cream/parchment. Text should shift to dark ink-brown. Amber accents unchanged. Remove with `document.documentElement.classList.remove('light')` to restore dark.

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/app/globals.css
git commit -m "feat(theme): add html.light parchment token overrides"
```

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `theme` field to UserSettings**

In `prisma/schema.prisma`, find the `UserSettings` model's display preferences comment block and add the `theme` field:

```prisma
  // Display preferences
  videoBackground Boolean @default(true)
  dmExperience    String?
  theme           String  @default("dark")
```

- [ ] **Step 2: Push schema to DB**

```bash
npm run db:push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(theme): add theme field to UserSettings"
```

---

## Task 3: tRPC — expose theme in userSettings router

**Files:**
- Modify: `src/server/routers/user-settings.ts`

- [ ] **Step 1: Add `theme` to `updatePreferences` input**

Find the `updatePreferences` procedure. Its current input is:

```ts
z.object({
  videoBackground: z.boolean().optional(),
})
```

Change it to:

```ts
z.object({
  videoBackground: z.boolean().optional(),
  theme: z.enum(['dark', 'light']).optional(),
})
```

The mutation body already uses `prisma.userSettings.upsert` with spread `...input` — no other change needed there.

- [ ] **Step 2: Add `theme` to `getSettings` response**

Find the `getSettings` query. It returns a large object literal. Add `theme` to the return:

```ts
theme: settings.theme ?? 'dark',
```

Place it alongside the other display preferences fields (`videoBackground`, `createdAt`, `updatedAt`).

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/user-settings.ts
git commit -m "feat(theme): expose theme in userSettings tRPC router"
```

---

## Task 4: ThemeInitializer — cross-device sync

**Files:**
- Create: `src/components/theme-initializer.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Create `src/components/theme-initializer.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { trpc } from '@/lib/trpc';

export function ThemeInitializer() {
  const { data: settings } = trpc.userSettings.getSettings.useQuery(undefined, {
    staleTime: 300_000,
  });
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (settings?.theme && settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
```

This component is a no-op when unauthenticated (the query returns null). It only fires `setTheme` when the DB value differs from the current local value — preventing unnecessary re-renders on every mount.

- [ ] **Step 2: Mount ThemeInitializer in Providers**

In `src/app/providers.tsx`, import and mount it as a sibling of `PostHogUserIdentifier` inside the `ThemeProvider`:

```tsx
import { ThemeInitializer } from '@/components/theme-initializer';
```

Inside the `return` of `Providers`, after `<PostHogUserIdentifier />`:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem={false}
  disableTransitionOnChange
>
  <PostHogUserIdentifier />
  <ThemeInitializer />
  {children}
  <Toaster />
</ThemeProvider>
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/theme-initializer.tsx src/app/providers.tsx
git commit -m "feat(theme): ThemeInitializer syncs DB theme preference on login"
```

---

## Task 5: ThemeToggle component

**Files:**
- Create: `src/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Create `src/components/ui/theme-toggle.tsx`**

```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const updatePreferences = trpc.userSettings.updatePreferences.useMutation();

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updatePreferences.mutate({ theme: next });
  };

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'flex items-center justify-center min-h-[44px] px-1.5 rounded transition-colors',
        'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]',
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.8} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.8} />
      )}
      {showLabel && (
        <span className="ml-2 text-sm">{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/theme-toggle.tsx
git commit -m "feat(theme): ThemeToggle component"
```

---

## Task 6: Add toggle to CommandRail footer

**Files:**
- Modify: `src/components/layout/command-rail.tsx`

- [ ] **Step 1: Import ThemeToggle**

At the top of `src/components/layout/command-rail.tsx`, add:

```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';
```

- [ ] **Step 2: Add toggle to footer**

Find the footer `<div>` at the bottom of `CommandRail` (it contains the Settings link). Add `<ThemeToggle />` to the left of the Settings `<Link>`:

```tsx
{/* Footer */}
<div
  className="relative z-10 border-t flex items-center gap-1 px-2 py-2 flex-shrink-0"
  style={{ borderColor: 'hsl(35 35% 18%)' }}
>
  {inCampaign && (
    <Link
      href={`/campaigns/${campaignSlug}/players`}
      title="Party"
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 min-h-[44px] rounded text-xs transition-colors',
        pathname.startsWith(`/campaigns/${campaignSlug}/players`)
          ? 'text-amber-400/90 bg-amber-500/[0.07]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
      )}
    >
      <Shield className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      {pinned && <span>Party</span>}
    </Link>
  )}
  <ThemeToggle />
  <Link
    href="/settings"
    title="Settings"
    className={cn(
      'flex items-center justify-center min-h-[44px] px-1.5 rounded transition-colors',
      pathname.startsWith('/settings') ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
    )}
  >
    <Settings className="h-4 w-4" strokeWidth={1.8} />
  </Link>
</div>
```

- [ ] **Step 3: Verify in browser**

Navigate to any app page. The rail footer should show a Sun icon (in dark mode) to the left of the Settings gear. Clicking it should immediately toggle the page to parchment light mode.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/command-rail.tsx
git commit -m "feat(theme): add ThemeToggle to CommandRail footer"
```

---

## Task 7: Add theme row to AppearanceSettingsPanel

**Files:**
- Modify: `src/components/settings/panels.tsx`

- [ ] **Step 1: Import ThemeToggle and useTheme**

At the top of `src/components/settings/panels.tsx`, add imports:

```tsx
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Palette } from 'lucide-react';
```

- [ ] **Step 2: Add theme row inside AppearanceSettingsPanel**

`AppearanceSettingsPanel` already queries `userSettings.getSettings` and has `updatePreferences`. Add a theme row below the existing `Animated Background` row:

```tsx
export function AppearanceSettingsPanel() {
  const utils = trpc.useUtils();
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
  const updatePreferences = trpc.userSettings.updatePreferences.useMutation({
    onSuccess: () => void utils.userSettings.getSettings.invalidate(),
  });
  const { theme, setTheme } = useTheme();

  const setThemeAndSave = (next: 'dark' | 'light') => {
    setTheme(next);
    updatePreferences.mutate({ theme: next });
  };

  return (
    <SettingsCard title="Appearance" description="Tune the mood of the archive without sacrificing readability.">
      {/* Existing animated background row */}
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 p-4">
        <div className="flex items-center gap-3">
          <MonitorPlay className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Animated Background</div>
            <div className="text-xs text-muted-foreground">
              Keep the ambient video loop behind the app. Disabled on mobile and when reduced motion is preferred.
            </div>
          </div>
        </div>
        <Switch
          checked={settings.data?.videoBackground ?? true}
          onCheckedChange={(checked) => updatePreferences.mutate({ videoBackground: checked })}
          disabled={updatePreferences.isPending}
        />
      </div>

      {/* Theme row */}
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 p-4">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Theme</div>
            <div className="text-xs text-muted-foreground">
              Choose between the dark grimoire and the parchment manuscript.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border/60 p-1">
          <button
            onClick={() => setThemeAndSave('dark')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
              theme === 'dark'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Moon className="h-3.5 w-3.5" strokeWidth={1.8} />
            Dark
          </button>
          <button
            onClick={() => setThemeAndSave('light')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
              theme === 'light'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Sun className="h-3.5 w-3.5" strokeWidth={1.8} />
            Light
          </button>
        </div>
      </div>
    </SettingsCard>
  );
}
```

Make sure `Moon`, `Sun`, and `cn` are imported at the top of the file. Check what's already imported and add only what's missing.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Navigate to `/settings/appearance`. The Appearance section should show both the Animated Background toggle and the new Dark/Light theme selector. The active theme button should have amber highlight. Clicking switches the theme.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/panels.tsx
git commit -m "feat(theme): theme selector in Appearance settings"
```

---

## Task 8: Push and verify end-to-end

- [ ] **Step 1: Full type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 2: Manual E2E flow**

1. Open http://localhost:3847, sign in
2. Click the Sun icon in the CommandRail footer → page switches to parchment light
3. Hard-reload the page → theme persists (next-themes localStorage)
4. Navigate to `/settings/appearance` → "Light" button is highlighted amber
5. Click "Dark" → page switches back to dark; "Dark" button is highlighted
6. Sign out, sign in again on a fresh browser → ThemeInitializer should restore the last saved theme from DB

- [ ] **Step 3: Push**

```bash
git push origin main
```
