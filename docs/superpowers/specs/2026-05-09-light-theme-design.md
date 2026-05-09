# Light Theme — Design Spec

**Date:** 2026-05-09
**Status:** Approved

## Overview

Add a user-selectable light theme to QuiverDM. Aesthetic direction: **Parchment Manuscript** — warm cream/tan backgrounds, ink-brown text, amber accents unchanged. Implementation uses CSS `html.light` overrides on top of the existing dark-first token system. Theme preference is stored in `UserSettings` and synced across devices on login.

## 1. Token Architecture

### Approach

Keep existing `:root` dark defaults in `src/styles/tokens.css` untouched. Add a single `html.light { }` block that overrides only the background, surface, text, and border vars. Amber (`--q-amber` and all its variants) is **identical in both themes** — it is the visual constant.

### Proposed `html.light` token values

| Token | Dark (current) | Light (new) |
|---|---|---|
| `--q-bg` | `oklch(0.12 0.005 265)` | `oklch(0.96 0.012 80)` |
| `--q-surface-flat` | `oklch(0.16 0.01 60)` | `oklch(0.93 0.014 80)` |
| `--q-surface-raised` | `oklch(0.19 0.012 60)` | `oklch(0.97 0.010 80)` |
| `--q-surface-sunken` | `oklch(0.10 0.005 265)` | `oklch(0.92 0.014 80)` |
| `--q-card-bg` | `oklch(0.17 0.012 60)` | `oklch(0.97 0.010 80)` |
| `--q-card-border` | `oklch(0.7 0.16 55 / 0.18)` | `oklch(0.55 0.10 60 / 0.25)` |
| `--q-border` | `oklch(0.28 0.02 60 / 0.4)` | `oklch(0.55 0.04 60 / 0.3)` |
| `--q-border-subtle` | `oklch(0.28 0.02 60 / 0.18)` | `oklch(0.55 0.04 60 / 0.15)` |
| `--q-text` | `oklch(0.92 0.005 60)` | `oklch(0.20 0.025 60)` |
| `--q-text-dim` | `oklch(0.65 0.01 60)` | `oklch(0.42 0.020 60)` |
| `--q-text-faint` | `oklch(0.45 0.01 60)` | `oklch(0.55 0.018 60)` |
| `--q-glow-amber` | `oklch(0.7 0.16 55 / 0.12)` | `oklch(0.7 0.16 55 / 0.08)` |
| `--q-glow-mystic` | `oklch(0.55 0.15 280 / 0.08)` | `oklch(0.55 0.15 280 / 0.04)` |
| All `--q-amber*` variants | unchanged | unchanged |

### shadcn compatibility vars

The shadcn vars (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--border`, `--input`, `--ring`, etc.) are dark-only in `:root` today. A matching `html.light { }` block provides their light equivalents. No component code changes required.

Light shadcn values:

| Var | Light value |
|---|---|
| `--background` | `35 30% 93%` |
| `--foreground` | `35 25% 12%` |
| `--card` | `35 20% 97%` |
| `--card-foreground` | `35 25% 12%` |
| `--popover` | `35 25% 96%` |
| `--popover-foreground` | `35 25% 12%` |
| `--primary` | `35 80% 45%` |
| `--primary-foreground` | `35 10% 98%` |
| `--secondary` | `35 20% 88%` |
| `--secondary-foreground` | `35 25% 20%` |
| `--muted` | `35 15% 88%` |
| `--muted-foreground` | `35 15% 42%` |
| `--accent` | `35 80% 45%` |
| `--accent-foreground` | `35 10% 98%` |
| `--destructive` | `0 62% 40%` |
| `--destructive-foreground` | `0 0% 98%` |
| `--border` | `35 20% 76%` |
| `--input` | `35 18% 80%` |
| `--ring` | `35 80% 45%` |

## 2. Body Background

The dark body background in `globals.css` uses hardcoded HSL values (not CSS vars). An `html.light body` rule is added below the existing `body` rule. The dark styles are not touched.

```css
html.light body {
  background-image:
    /* Warm amber wash from upper-left */
    radial-gradient(ellipse 60% 45% at 20% -5%, hsl(35 60% 82% / 0.6), transparent),
    /* Cool ivory from upper-right */
    radial-gradient(ellipse 40% 35% at 80% -5%, hsl(45 40% 90% / 0.5), transparent),
    /* Warm amber from bottom */
    radial-gradient(ellipse 80% 50% at 50% 105%, hsl(35 30% 88% / 0.4), transparent),
    /* Parchment base */
    linear-gradient(hsl(35 25% 93%), hsl(40 20% 91%));
}
```

No vignette in light mode.

## 3. Prisma Schema

Add `theme` to `UserSettings.displayPreferences`:

```prisma
// Display preferences
videoBackground Boolean @default(true)
dmExperience    String?
theme           String  @default("dark")  // "dark" | "light"
```

## 4. tRPC — userSettings router

Two changes to `src/server/routers/user-settings.ts`:

**`updatePreferences` input** — add `theme: z.enum(["dark", "light"]).optional()`

**`getSettings` response** — add `theme: settings.theme ?? "dark"` to the returned object

No new procedures required.

## 5. ThemeInitializer — cross-device sync

A new client component `src/components/providers/theme-initializer.tsx` sits inside `Providers` (after `ThemeProvider`). It reads `userSettings.getSettings` and syncs the stored theme to next-themes on session load:

```tsx
'use client';
export function ThemeInitializer() {
  const { data: settings } = trpc.userSettings.getSettings.useQuery();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (settings?.theme && settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings?.theme]);

  return null;
}
```

Placed inside `Providers` as a sibling of `PostHogUserIdentifier`. Only fires when authenticated (query returns null for unauthenticated users, no-op).

No FOUC on same device — next-themes reads localStorage. Brief theme adjust on first login from a new device is acceptable.

## 6. Toggle Component

New component `src/components/ui/theme-toggle.tsx`:

```tsx
'use client';
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  const utils = trpc.useUtils();
  const updatePreferences = trpc.userSettings.updatePreferences.useMutation();

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updatePreferences.mutate({ theme: next }); // fire and forget
  };

  return (
    <button onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
      {theme === 'dark' ? <Sun /> : <Moon />}
      {showLabel && <span>...</span>}
    </button>
  );
}
```

Toggle is instant (local state via next-themes). DB write is fire-and-forget — no loading state.

### Placements

**CommandRail footer** (`src/components/layout/command-rail.tsx`) — icon button added to the left of the existing Settings link in the footer `<div>`. Matches the existing icon button style (`h-4 w-4`, `muted-foreground hover:text-foreground`).

**Settings page** — "Appearance" section added above or below the existing display preferences. Uses a Dark / Light toggle group (two buttons), same visual pattern as other toggle controls on the page.

## 7. Files Changed

| File | Change |
|---|---|
| `src/styles/tokens.css` | Add `html.light { }` block with all overrides |
| `src/app/globals.css` | Add `html.light body { }` background override |
| `prisma/schema.prisma` | Add `theme String @default("dark")` to UserSettings |
| `src/server/routers/user-settings.ts` | Add `theme` to `updatePreferences` + `getSettings` |
| `src/components/providers/theme-initializer.tsx` | New — DB→theme sync on login |
| `src/app/providers.tsx` | Mount `<ThemeInitializer />` inside Providers |
| `src/components/ui/theme-toggle.tsx` | New — toggle button component |
| `src/components/layout/command-rail.tsx` | Add `<ThemeToggle />` to footer |
| `src/components/settings/panels.tsx` | Add theme toggle row to `AppearanceSettingsPanel` |

## Out of Scope

- Marketing/landing pages — remain dark, no toggle exposed there
- Auth pages — remain dark
- Per-campaign theme overrides
- System/auto theme mode
