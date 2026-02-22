# QuiverDM UI Audit — 2026-02-18

## Audit Summary

Comprehensive review of all authenticated app pages and shared components.
Overall the app is in good shape — core flows work. Issues are mostly UX polish,
consistency gaps, and missing feedback patterns.

---

## Issues by Severity

### 🔴 Medium — Broken/Missing Interactions

| # | Page / File | Issue | Fix |
|---|---|---|---|
| M1 | `src/app/(app)/homebrew/pdfs/page.tsx` | PDF delete uses `window.confirm()` — inconsistent with rest of app, blocks UI | Replace with `<ConfirmDialog>` component |
| M2 | `src/app/(app)/campaigns/[slug]/settings/page.tsx` | No success feedback when settings are saved — user doesn't know if it worked | Add `toast({ title: 'Settings saved' })` in mutation `onSuccess` |
| M3 | `src/app/(app)/dashboard/page.tsx` | No error state for campaigns, characters, homebrew sections — silent failures | Add `isError` checks with error cards |

### 🟡 Low — UX Inconsistencies / Polish

| # | Page / File | Issue | Fix |
|---|---|---|---|
| L1 | `src/components/invite-dialog.tsx` | Role not reset when dialog closes — user may accidentally invite with wrong role | Reset `role` state in `onOpenChange` handler |
| L2 | `src/components/invite-dialog.tsx` | No loading spinner in Create button — button disabled but looks static | Add `<Loader2>` spinner when `createInvite.isPending` |
| L3 | `src/components/campaign/campaign-nav.tsx` | Players tab visible to all roles, Members tab is DM-only — inconsistent visibility rules | Review if Players should also be DM-only or document the intentional difference |
| L4 | Multiple pages | Inconsistent empty state messages — some are helpful, some are minimal | Standardize: all should explain what the feature is + primary CTA |
| L5 | Multiple forms | No real-time validation feedback — `required` set on inputs but no visual cues | Add Zod-based client validation with inline error messages |
| L6 | `src/app/(app)/campaigns/*/sessions/page.tsx` | Session list has no error state — silent failure if sessions can't load | Add `isError` check |
| L7 | `src/app/(app)/campaigns/*/npcs/page.tsx` | NPC list has no error state | Add `isError` check |

### 🟢 Low — Missing Features (Not Broken)

| # | Page / File | Issue | Note |
|---|---|---|---|
| F1 | `src/app/(app)/homebrew/pdfs/page.tsx` | No drag-and-drop for PDF upload — click-only | Future enhancement |
| F2 | Onboarding | Step indicator not clickable to jump to completed steps | Intentional UX or enhancement |

---

## Pages Confirmed Working ✅

- All campaign CRUD flows (create, read, update, delete with confirmation)
- Session flows (create, record, transcribe, recap, delete)
- NPC flows (create, edit, delete with confirmation)
- Character flows (create, edit, delete, D&D Beyond sync)
- Homebrew flows (browse, filter, search, PDF upload & processing)
- Members & Players management (invite, role change, remove)
- Settings (billing, API keys, subscription management)
- Feedback submission
- Onboarding wizard
- Join campaign via invite code
- Admin invite management
- Sidebar navigation with active states
- Role-based tab visibility (DM-only tabs)
- All destructive actions have confirmation dialogs (except M1)
- Loading states on all mutations

---

## Codex Agent Split Plan

### Agent A — Dashboard & List Error States
**Files:** `dashboard/page.tsx`, `sessions/page.tsx`, `npcs/page.tsx`
**Issues:** M3, L6, L7
- Add `isError` error cards to all dashboard query sections
- Add error states to session and NPC list pages

### Agent B — Feedback & Toast Consistency
**Files:** `campaigns/[slug]/settings/page.tsx` + audit all other mutation `onSuccess` handlers across all routers/pages for missing toasts
**Issues:** M2
- Add success toasts to all mutations missing feedback
- Campaign settings, NPC updates, character updates, member role changes

### Agent C — Dialog & Confirm Consistency
**Files:** `invite-dialog.tsx`, `homebrew/pdfs/page.tsx`
**Issues:** M1, L1, L2
- Replace `window.confirm` with `ConfirmDialog` for PDF delete
- Reset role state on invite dialog close
- Add loading spinner to Create Invite button

### Agent D — Empty States & Campaign Nav
**Files:** Multiple list pages, `campaign-nav.tsx`
**Issues:** L3, L4
- Standardize all empty state messages (icon + heading + description + CTA)
- Clarify/document Players vs Members tab visibility rules
