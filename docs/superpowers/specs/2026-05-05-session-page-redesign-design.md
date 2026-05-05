# Session Page Redesign — Design Spec
**Date:** 2026-05-05

## Overview

Two parallel changes shipped together:

1. **PageLayout component** — a shared wrapper that gives every campaign subpage the same header structure (overline + amber section-rule + display title + optional actions). Eliminates per-page boilerplate and makes the layout invisible to the DM.

2. **Inline prep workspace** — the session hub's prep phase embeds the full two-column prep workspace directly instead of linking out to a separate `/sessions/prep` route. Brain drawer dropped; per-section AI Suggest buttons remain.

**Decisions locked in:**
- No brain drawer in the redesigned workspace
- No `SplitPageLayout` component — pages that want two columns implement the grid within `PageLayout`'s children
- `PageLayout` adopted on 3 pages in this spec; all other pages follow in a cleanup PR

---

## Part 1: PageLayout Component

### File
`src/components/layout/page-layout.tsx`

### Interface
```typescript
interface PageLayoutProps {
  overline: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}
```

### Max-width map
| Key | Tailwind class | Approx width |
|-----|---------------|-------------|
| `sm` | `max-w-xl` | 576px |
| `md` | `max-w-3xl` | 768px (default) |
| `lg` | `max-w-5xl` | 1024px |
| `xl` | `max-w-7xl` | 1280px |
| `full` | `w-full` | edge-to-edge |

### Rendered structure
Uses the existing `label-overline` and `section-rule` CSS classes from the design system.

```tsx
<div className={cn('space-y-5', maxWidthClass)}>
  <div>
    <p className="label-overline mb-1">{overline}</p>
    <div className="section-rule" />
    <div className="flex items-end justify-between mt-3">
      <h1 className="font-display text-xl font-bold tracking-wide">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {subtitle && (
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    )}
  </div>
  {children}
</div>
```

### Adoption scope (this spec)
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` — session hub
- `src/app/(app)/campaigns/[slug]/sessions/page.tsx` — sessions list
- `src/app/(app)/campaigns/[slug]/npcs/page.tsx` — NPCs list

All other campaign subpages follow in a subsequent cleanup PR.

---

## Part 2: PrepWorkspace — `inline` Mode

### Props added
```typescript
interface PrepWorkspaceProps {
  // ... existing props unchanged ...
  inline?: boolean;       // defaults false
  onComplete?: () => void; // called after successful completePrep (replaces router.push)
}
```

### Behaviour when `inline=true`
- `PrepHeader` is not rendered — the session hub owns the page header
- `PrepBrainDrawer` is not rendered
- `PrepBrainContextCard` is not rendered — per-section `BrainSuggestButton` covers this
- Outer `div` uses `flex flex-col` (not `flex flex-col min-h-screen`)
- Left aside: `w-48 shrink-0 border-r border-border/50 bg-card/30` — no sticky or `h-screen`, scrolls with the page
- `completePrep` mutation's `onSuccess` handler: if `onComplete` prop is provided, calls it instead of `router.push`

### completePrep onSuccess
```typescript
onSuccess: () => {
  if (onComplete) {
    onComplete();
  } else {
    toast({ title: 'Prep marked complete' });
    router.push(`/campaigns/${slug}/sessions/${sessionId}`);
  }
},
```

`PrepBrainDrawer` and `PrepBrainContextCard` component files are left in place. They are unused after this change but are deleted in a follow-up cleanup PR.

---

## Part 3: PhasePrep — Full Rewrite

`PhasePrep` currently shows `PrepStatusCard` + "Ready to Run" button. It becomes the inline prep host.

### New responsibilities
- Loads `getPrepContext` query (has `campaignId` prop)
- Parses `session.prepData` using `SessionPrepDataSchema`
- Merges campaign characters into `characterNotes` when none exist (same logic as the standalone prep page)
- Renders `PrepWorkspace` with `inline` prop
- Renders "Ready to Run" button below the workspace

### Data flow
```
PhasePrep
  ├── trpc.sessions.getPrepContext.useQuery({ campaignId })
  ├── parse session.prepData → initialData
  └── renders:
       PrepWorkspace (inline, onComplete=onStatusChange)
       Button "Ready to Run" → sessions.update({ status: 'in_progress' })
```

The "Ready to Run" button lives in `PhasePrep`, not inside `PrepWorkspace`. This keeps PrepWorkspace focused on prep editing and PhasePrep responsible for the phase transition.

### Loading state
While `getPrepContext` is loading, render a skeleton:
```tsx
<div className="space-y-3">
  <Skeleton className="h-8 w-1/3" />
  <Skeleton className="h-64 w-full" />
</div>
```

### Two-column layout
`PrepWorkspace` in inline mode renders:
```
[aside — 192px]         [main — flex-1]
PrepSectionNav           PrepSectionCard × 8
                         (BrainSuggestButton per section)
```

The "Ready to Run" button sits below the workspace (full-width, primary style).

---

## Part 4: Session Hub Page

### PageLayout adoption
The hub's outer `<div className="space-y-5 max-w-3xl">` is replaced with `PageLayout`:

```tsx
<PageLayout
  overline={`Session ${sessionNumber}`}
  title={sessionTitle ?? `Session ${sessionNumber}`}
  subtitle={sessionDate ? format(sessionDate, 'EEEE, MMMM d yyyy') : undefined}
  maxWidth={phase === 'prep' ? 'lg' : 'md'}
>
  <SessionPipeline currentPhase={phase} />
  {/* completed phase rows */}
  {/* current phase content */}
</PageLayout>
```

`maxWidth` is dynamic: `'lg'` (1024px, fits the two-column prep) when prep is active, `'md'` (768px) for all other phases.

### Completed phase rows
The `PhaseCompleteRow` for prep previously had an `editHref` pointing to the prep route. This is removed — once the session has moved past prep, there is no re-open CTA. The row shows the completion state only.

---

## Part 5: Route Changes

### `[sessionId]/prep/page.tsx`
Currently redirects to `/campaigns/${slug}/sessions/prep?sessionId=${sessionId}`.

Updated to redirect to the session hub:
```typescript
redirect(`/campaigns/${slug}/sessions/${sessionId}`);
```

### `/sessions/prep` (no sessionId in path)
Unchanged. This route creates a new session when no `sessionId` searchParam is present and redirects to itself with the new session ID. It remains valid for "start fresh prep session" flows.

---

## Files Changed

| Action | File | Change |
|--------|------|--------|
| Create | `src/components/layout/page-layout.tsx` | PageLayout component |
| Modify | `src/components/session/phase-prep.tsx` | Full rewrite: context query + PrepWorkspace inline + Ready to Run |
| Modify | `src/components/session/prep/prep-workspace.tsx` | Add `inline` + `onComplete` props; suppress header/drawer/brain card when inline |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | Adopt PageLayout; dynamic maxWidth; remove prep editHref |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx` | Update redirect target to session hub |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/page.tsx` | Adopt PageLayout |
| Modify | `src/app/(app)/campaigns/[slug]/npcs/page.tsx` | Adopt PageLayout |

---

## Out of Scope

- Other campaign pages adopting PageLayout (cleanup PR)
- Deleting `PrepBrainDrawer` and `PrepBrainContextCard` (cleanup PR)
- Mobile layout treatment for the two-column prep workspace
- Modifying the `/sessions/prep` create-flow page
