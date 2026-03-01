# Session Start Flow Simplification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collapse the two-button confusion on the session detail page into a single flow, navigate to the cockpit in the same tab, and complete the session from within the cockpit instead of bouncing back to the detail page.

**Architecture:** Three friction points are fixed with minimal changes to two files and one component. (1) Session detail page: "Start Session" now marks in_progress AND navigates to cockpit; "Launch Session" is removed; "Complete" is removed from the header — completion moves to the cockpit. (2) Session detail page: when session is already in_progress, a "Continue Session" button navigates back to the cockpit. (3) Cockpit page: "End Session" shows an AlertDialog that marks the session complete before navigating away.

**Tech Stack:** Next.js 15 App Router, tRPC v11, shadcn/ui AlertDialog

---

### Context

**Current button layout on session detail page (lines 875–904):**
- `isDM && isPlanning` → "Start Session" button — only changes DB status, stays on page
- `isDM && isActive` → "Complete" button — marks complete, stays on page
- `isDM` (all statuses) → "Launch Session" button — opens cockpit in **new tab** via `window.open`

**Current cockpit End Session (live/page.tsx:43–45):**
```tsx
const handleEndSession = useCallback(() => {
  router.push(`/campaigns/${slug}/sessions/${sessionId}`);
}, [router, slug, sessionId]);
```
Just navigates away — does not mark session complete.

**Target flow:**
```
Session detail (planning)
  → "Start Session" → marks in_progress + router.push to /live (same tab)

Session detail (in_progress)
  → "Continue Session" → router.push to /live (same tab)

Cockpit /live
  → "End Session" → AlertDialog → "Complete & Save" → sessions.complete + router.push to detail
                                 → "Cancel" → dismiss
```

---

### Task 1: Fix session detail page buttons

**File:** `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

**What to change** (around lines 747–904):

**Step 1: Update `startSession` mutation to navigate on success**

Find the existing `startSession` mutation (line 747). Change the `onSuccess` handler from invalidating the query to navigating to the cockpit. The router is already available in the component.

Replace:
```tsx
const startSession = trpc.sessions.startSession.useMutation({
  onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  onError: (error) => uiToast({ title: 'Error', description: error.message, variant: 'destructive' }),
});
```
With:
```tsx
const startSession = trpc.sessions.startSession.useMutation({
  onSuccess: () => router.push(`/campaigns/${slug}/sessions/${sessionId}/live`),
  onError: (error) => uiToast({ title: 'Error', description: error.message, variant: 'destructive' }),
});
```

**Step 2: Remove "Launch Session" button and "Complete" button, add "Continue Session"**

Find the button group (lines 875–904). Replace it with:

```tsx
{isDM && isPlanning && (
  <Button
    size="sm"
    onClick={() => startSession.mutate({ id: sessionId })}
    disabled={startSession.isPending}
    className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
  >
    <PlayCircle className="h-3.5 w-3.5" />
    {startSession.isPending ? 'Starting…' : 'Start Session'}
  </Button>
)}

{isDM && isActive && (
  <Button
    size="sm"
    className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
    onClick={() => router.push(`/campaigns/${slug}/sessions/${sessionId}/live`)}
  >
    <Swords className="h-3.5 w-3.5" />
    Continue Session
  </Button>
)}
```

The old "Launch Session" button (always-visible, new tab) is deleted entirely.
The old "Complete" button (`isDM && isActive`) is deleted — completion moves to the cockpit.

Note: `Swords` is already imported. `PlayCircle` is already imported.

**Step 3: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "sessions/\[sessionId\]"
```
Expected: no output

**Step 4: Commit**

```bash
git add "src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx"
git commit -m "fix(sessions): merge Start+Launch into single flow, add Continue Session for in-progress"
```

---

### Task 2: Add End Session confirmation dialog to cockpit

**File:** `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`

**Step 1: Add AlertDialog import**

The file already imports from `@/components/ui/tabs`. Add:
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

**Step 2: Add complete mutation and dialog state**

After the existing `const [mode, setMode] = useState<'rp' | 'combat'>('rp');` line, add:

```tsx
const [endDialogOpen, setEndDialogOpen] = useState(false);

const completeSession = trpc.sessions.complete.useMutation({
  onSuccess: () => router.push(`/campaigns/${slug}/sessions/${sessionId}`),
  onError: () => router.push(`/campaigns/${slug}/sessions/${sessionId}`),
});
```

**Step 3: Update handleEndSession to open dialog instead of navigating**

Replace:
```tsx
const handleEndSession = useCallback(() => {
  router.push(`/campaigns/${slug}/sessions/${sessionId}`);
}, [router, slug, sessionId]);
```
With:
```tsx
const handleEndSession = useCallback(() => {
  setEndDialogOpen(true);
}, []);
```

**Step 4: Add AlertDialog to JSX**

Inside the returned JSX, after `<CockpitToolbar ... />`, add:

```tsx
<AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>End Session?</AlertDialogTitle>
      <AlertDialogDescription>
        This will mark the session as complete and save your notes.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="bg-amber-500 hover:bg-amber-400 text-black"
        onClick={() => completeSession.mutate({ id: sessionId })}
        disabled={completeSession.isPending}
      >
        {completeSession.isPending ? 'Saving…' : 'Complete & Save'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 5: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "live"
```
Expected: no output

**Step 6: Commit**

```bash
git add "src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx"
git commit -m "fix(cockpit): End Session shows confirmation dialog and completes session"
```

---

### Task 3: Push and verify

```bash
git push origin main
```

Visit `https://quiverdm.com` and verify:
- Session detail page (planning): single "Start Session" button, no "Launch Session" button
- Clicking "Start Session" navigates same-tab to `/live`
- Session detail page (in_progress): "Continue Session" button navigates to `/live`
- Cockpit "End Session" button opens confirmation dialog
- "Complete & Save" marks session complete and redirects to detail page
