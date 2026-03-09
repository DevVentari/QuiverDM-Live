# Session Cockpit Enhancements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 missing features to the existing session cockpit: panic tools (Generate NPC + Suggest Twist), Brain panel tab, post-session pipeline progress view, and initiative tracker.

**Architecture:** All changes are additive to the existing cockpit at `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`. Two new tRPC procedures added to `sessionsRouter`. Four new cockpit components. No new routes, no schema changes.

**Tech Stack:** Next.js 15, tRPC v11, React local state (initiative), shadcn/ui, Zod, `chatWithAI` from `src/lib/ai/chat.ts`

**Design doc:** `docs/plans/2026-03-09-session-cockpit-enhancements-design.md`

---

## Key Files to Know

- **Live page:** `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx` — 3-column cockpit
- **Sessions router:** `src/server/routers/sessions.ts` — add `generateQuickNpc`, `suggestTwist`
- **Session service:** `src/server/services/session.service.ts` — add AI methods, uses `generateWithOllama`
- **Cockpit toolbar:** `src/components/cockpit/cockpit-toolbar.tsx` — add new buttons + dialogs
- **Party panel:** `src/components/cockpit/party-overview-panel.tsx` — add initiative tracker
- **AI util:** `src/lib/ai/chat.ts` — use `chatWithAI(messages, { temperature })`
- **Auth pattern:** `const access = await authz.session(sessionId, userId).verify()` then check `access.isDM`
- **Error pattern:** `throw new NotFoundError('session', sessionId)` / `throw ForbiddenError.forPermission('manage', 'session')`

## Session Model Fields (already in DB)

```
aiSummaryStatus    String  "none|pending|processing|done|error"
playerRecapStatus  String  "none|pending|done|error"
derailmentStatus   String  "none|pending|done|error"
```

Brain ingestion "done" check: `worldState.lastIngestedSessionId === sessionId`

---

## Task 1: Panic Tools — tRPC Procedures

**Files:**
- Modify: `src/server/services/session.service.ts`
- Modify: `src/server/routers/sessions.ts`

### Step 1: Add `generateQuickNpc` to session service

In `session.service.ts`, add two methods to the `SessionService` class. Find where `generateWithOllama` is called (around line 292) to understand the pattern, then add after the last method:

```typescript
async generateQuickNpc(sessionId: string, userId: string, hint?: string): Promise<{
  name: string;
  role: string;
  trait: string;
  secret: string;
  voiceQuirk: string;
}> {
  const access = await authz.session(sessionId, userId).verify();
  if (!access.isDM) throw ForbiddenError.forPermission('manage', 'session');

  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new NotFoundError('session', sessionId);

  const prompt = `Generate a quick D&D NPC for an active session.
Campaign: ${session.campaign?.name ?? 'Unknown'}
${hint ? `DM hint: ${hint}` : ''}

Respond ONLY with valid JSON:
{
  "name": "Full Name",
  "role": "Brief role (e.g. 'tavern keeper', 'city guard')",
  "trait": "One distinctive personality trait",
  "secret": "One secret they're hiding",
  "voiceQuirk": "How they speak (e.g. 'speaks in rhymes', 'overly formal')"
}`;

  const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.9 });
  let text = raw.trim();
  if (text.startsWith('```')) text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text) as Record<string, string>;
  return {
    name: String(parsed.name ?? 'Unknown'),
    role: String(parsed.role ?? ''),
    trait: String(parsed.trait ?? ''),
    secret: String(parsed.secret ?? ''),
    voiceQuirk: String(parsed.voiceQuirk ?? ''),
  };
}

async suggestTwist(sessionId: string, userId: string, hint?: string): Promise<{ twists: string[] }> {
  const access = await authz.session(sessionId, userId).verify();
  if (!access.isDM) throw ForbiddenError.forPermission('manage', 'session');

  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new NotFoundError('session', sessionId);

  const notes = (session.quickNotes ?? '').slice(-300);
  const prompt = `You are a D&D Dungeon Master assistant. Suggest 3 short plot twists or complications for an active session.
Campaign: ${session.campaign?.name ?? 'Unknown'}
Recent notes: ${notes || '(none)'}
${hint ? `DM request: ${hint}` : ''}

Respond ONLY with valid JSON:
{
  "twists": [
    "Twist 1 (one sentence)",
    "Twist 2 (one sentence)",
    "Twist 3 (one sentence)"
  ]
}`;

  const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.9 });
  let text = raw.trim();
  if (text.startsWith('```')) text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const twists = Array.isArray(parsed.twists) ? parsed.twists.map(String) : [];
  return { twists: twists.slice(0, 3) };
}
```

Check that `sessionRepository.findById` includes `campaign: { select: { name: true } }` — if not, add a `select` or use `prisma.gameSession.findUnique` directly with an include.

### Step 2: Add procedures to sessions router

In `src/server/routers/sessions.ts`, add before the closing `});`:

```typescript
generateQuickNpc: protectedProcedure
  .input(z.object({
    sessionId: z.string().min(1),
    hint: z.string().max(200).optional(),
  }))
  .mutation(({ input, ctx }) =>
    sessionService.generateQuickNpc(input.sessionId, ctx.session.user.id, input.hint)
  ),

suggestTwist: protectedProcedure
  .input(z.object({
    sessionId: z.string().min(1),
    hint: z.string().max(200).optional(),
  }))
  .mutation(({ input, ctx }) =>
    sessionService.suggestTwist(input.sessionId, ctx.session.user.id, input.hint)
  ),
```

### Step 3: Verify TypeScript

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit
```

Expected: zero errors.

### Step 4: Commit

```bash
git add src/server/services/session.service.ts src/server/routers/sessions.ts
git commit -m "feat(cockpit): add generateQuickNpc and suggestTwist tRPC procedures"
```

---

## Task 2: Generate NPC Dialog Component

**Files:**
- Create: `src/components/cockpit/generate-npc-dialog.tsx`

### Step 1: Create the component

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Sparkles, Save } from 'lucide-react';

interface GenerateNpcDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  campaignId: string;
}

export function GenerateNpcDialog({ open, onClose, sessionId, campaignId }: GenerateNpcDialogProps) {
  const [hint, setHint] = useState('');
  const [result, setResult] = useState<{ name: string; role: string; trait: string; secret: string; voiceQuirk: string } | null>(null);

  const generate = trpc.sessions.generateQuickNpc.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(e.message),
  });

  const saveNpc = trpc.npcs.create.useMutation({
    onSuccess: () => {
      toast.success('NPC saved to campaign');
      onClose();
      setResult(null);
      setHint('');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    onClose();
    setResult(null);
    setHint('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Quick NPC
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Optional: gruff innkeeper, nervous merchant…"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !generate.isPending) {
                  generate.mutate({ sessionId, hint: hint || undefined });
                }
              }}
            />
            <Button
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={() => generate.mutate({ sessionId, hint: hint || undefined })}
              disabled={generate.isPending}
            >
              {generate.isPending ? 'Generating…' : 'Generate NPC'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-base text-foreground">{result.name}</div>
            <div className="text-muted-foreground italic">{result.role}</div>
            <div className="space-y-1 pt-1">
              <div><span className="text-xs uppercase tracking-widest text-muted-foreground">Trait </span>{result.trait}</div>
              <div><span className="text-xs uppercase tracking-widest text-muted-foreground">Secret </span>{result.secret}</div>
              <div><span className="text-xs uppercase tracking-widest text-muted-foreground">Voice </span>{result.voiceQuirk}</div>
            </div>
          </div>
        )}

        {result && (
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setResult(null); generate.reset(); }}>
              Regenerate
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={() => saveNpc.mutate({
                campaignId,
                name: result.name,
                description: `${result.role}. ${result.trait}`,
                secrets: result.secret,
              })}
              disabled={saveNpc.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              Save to Campaign
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Step 2: TypeScript check

```bash
npx tsc --noEmit
```

### Step 3: Commit

```bash
git add src/components/cockpit/generate-npc-dialog.tsx
git commit -m "feat(cockpit): add GenerateNpcDialog component"
```

---

## Task 3: Suggest Twist Dialog Component

**Files:**
- Create: `src/components/cockpit/suggest-twist-dialog.tsx`

### Step 1: Create the component

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

interface SuggestTwistDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}

export function SuggestTwistDialog({ open, onClose, sessionId }: SuggestTwistDialogProps) {
  const [hint, setHint] = useState('');
  const [twists, setTwists] = useState<string[]>([]);

  const suggest = trpc.sessions.suggestTwist.useMutation({
    onSuccess: (data) => setTwists(data.twists),
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    onClose();
    setTwists([]);
    setHint('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Suggest Twist
          </DialogTitle>
        </DialogHeader>

        {twists.length === 0 ? (
          <div className="space-y-3">
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Optional: betrayal, monster ambush…"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !suggest.isPending) {
                  suggest.mutate({ sessionId, hint: hint || undefined });
                }
              }}
            />
            <Button
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={() => suggest.mutate({ sessionId, hint: hint || undefined })}
              disabled={suggest.isPending}
            >
              {suggest.isPending ? 'Generating…' : 'Suggest Twists'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {twists.map((twist, i) => (
              <div key={i} className="rounded border border-border bg-card/50 p-2.5 text-sm">
                <span className="text-amber-400 font-mono text-xs mr-2">{i + 1}.</span>
                {twist}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { setTwists([]); suggest.reset(); }}>
              Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Step 2: TypeScript check + commit

```bash
npx tsc --noEmit
git add src/components/cockpit/suggest-twist-dialog.tsx
git commit -m "feat(cockpit): add SuggestTwistDialog component"
```

---

## Task 4: Wire Panic Tools into Toolbar

**Files:**
- Modify: `src/components/cockpit/cockpit-toolbar.tsx`

### Step 1: Add imports and state

Add to imports at the top:
```typescript
import { GenerateNpcDialog } from './generate-npc-dialog';
import { SuggestTwistDialog } from './suggest-twist-dialog';
import { Users, Zap } from 'lucide-react';
```

Add `campaignId: string` to `CockpitToolbarProps`.

Add state:
```typescript
const [npcOpen, setNpcOpen] = useState(false);
const [twistOpen, setTwistOpen] = useState(false);
```

### Step 2: Add buttons between dice roller and end session

```tsx
<Button
  size="sm"
  variant="ghost"
  className="h-8 gap-1.5 text-xs"
  onClick={() => setNpcOpen(true)}
>
  <Users className="h-3.5 w-3.5" />
  NPC
</Button>

<Button
  size="sm"
  variant="ghost"
  className="h-8 gap-1.5 text-xs"
  onClick={() => setTwistOpen(true)}
>
  <Zap className="h-3.5 w-3.5" />
  Twist
</Button>
```

### Step 3: Add dialogs to JSX

```tsx
<GenerateNpcDialog
  open={npcOpen}
  onClose={() => setNpcOpen(false)}
  sessionId={sessionId}
  campaignId={campaignId}
/>
<SuggestTwistDialog
  open={twistOpen}
  onClose={() => setTwistOpen(false)}
  sessionId={sessionId}
/>
```

### Step 4: Update live page to pass campaignId to toolbar

In `live/page.tsx`, the `CockpitToolbar` call needs `campaignId={campaign.id}`. Add the prop.

### Step 5: TypeScript check + commit

```bash
npx tsc --noEmit
git add src/components/cockpit/cockpit-toolbar.tsx src/app/\(session\)/campaigns/\[slug\]/sessions/\[sessionId\]/live/page.tsx
git commit -m "feat(cockpit): wire GenerateNPC and SuggestTwist into toolbar"
```

---

## Task 5: Pipeline Progress Dialog

**Files:**
- Create: `src/components/cockpit/pipeline-progress-dialog.tsx`
- Modify: `src/components/cockpit/cockpit-toolbar.tsx`

### Step 1: Create the component

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react';

type PipelineStage = {
  label: string;
  status: 'pending' | 'processing' | 'done' | 'error';
};

function StageIcon({ status }: { status: PipelineStage['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === 'error') return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (status === 'processing') return <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}

interface PipelineProgressDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  campaignId: string;
  slug: string;
}

export function PipelineProgressDialog({ open, onClose, sessionId, campaignId, slug }: PipelineProgressDialogProps) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const TIMEOUT_MS = 3 * 60 * 1000;

  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => setStartedAt(Date.now()),
    onError: () => setConfirmed(false),
  });

  const sessionQuery = trpc.sessions.getById.useQuery(
    { id: sessionId },
    { enabled: confirmed && !!startedAt, refetchInterval: 3000, staleTime: 0 }
  );

  const worldStateQuery = trpc.brain.state.get.useQuery(
    { campaignId },
    { enabled: confirmed && !!startedAt, refetchInterval: 5000, staleTime: 0 }
  );

  const session = sessionQuery.data as any;
  const worldState = worldStateQuery.data as any;

  const timedOut = startedAt ? Date.now() - startedAt > TIMEOUT_MS : false;

  const stages: PipelineStage[] = confirmed && startedAt ? [
    { label: 'Session complete', status: 'done' },
    {
      label: 'AI Summary',
      status: session?.aiSummaryStatus === 'done' ? 'done'
        : session?.aiSummaryStatus === 'error' ? 'error'
        : session?.aiSummaryStatus === 'processing' ? 'processing'
        : 'pending',
    },
    {
      label: 'Player Recap',
      status: session?.playerRecapStatus === 'done' ? 'done'
        : session?.playerRecapStatus === 'error' ? 'error'
        : session?.playerRecapStatus === 'pending' ? 'processing'
        : 'pending',
    },
    {
      label: 'Derailment Analysis',
      status: session?.derailmentStatus === 'done' ? 'done'
        : session?.derailmentStatus === 'error' ? 'error'
        : session?.derailmentStatus === 'pending' ? 'processing'
        : 'pending',
    },
    {
      label: 'Brain Ingestion',
      status: worldState?.lastIngestedSessionId === sessionId ? 'done' : 'pending',
    },
  ] : [];

  const allDone = stages.length > 0 && stages.every((s) => s.status === 'done' || s.status === 'error');
  const showViewButton = allDone || timedOut;

  const handleClose = () => {
    if (!confirmed) {
      onClose();
    }
    // Don't allow closing mid-pipeline — DM must click View Session
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => confirmed && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>End Session?</DialogTitle>
        </DialogHeader>

        {!confirmed ? (
          <>
            <p className="text-sm text-muted-foreground">
              This will mark the session as complete and trigger the AI summary pipeline.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Keep Playing</Button>
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                onClick={() => {
                  setConfirmed(true);
                  completeSession.mutate({ id: sessionId });
                }}
                disabled={completeSession.isPending}
              >
                {completeSession.isPending ? 'Ending…' : 'End Session'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2.5 py-1">
              {stages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-2.5 text-sm">
                  <StageIcon status={stage.status} />
                  <span className={stage.status === 'done' ? 'text-foreground' : stage.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                    {stage.label}
                  </span>
                </div>
              ))}
              {timedOut && !allDone && (
                <p className="text-xs text-muted-foreground pt-1">
                  Taking longer than expected — you can view the session now.
                </p>
              )}
            </div>
            {showViewButton && (
              <DialogFooter>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  onClick={() => router.push(`/campaigns/${slug}/sessions/${sessionId}`)}
                >
                  View Session
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Step 2: Replace EndSessionDialog in cockpit-toolbar.tsx

- Remove the old `EndSessionDialog` component and its import
- Import `PipelineProgressDialog`
- Replace `endOpen` state usage — the dialog now handles both stages internally
- Add `campaignId: string` and `slug: string` to `CockpitToolbarProps` if not already there
- Replace `<EndSessionDialog ... />` with `<PipelineProgressDialog open={endOpen} onClose={() => setEndOpen(false)} sessionId={sessionId} campaignId={campaignId} slug={slug} />`

### Step 3: Update live page to pass slug and campaignId to toolbar

In `live/page.tsx`, update the `CockpitToolbar` call:
```tsx
<CockpitToolbar
  sessionId={sessionId}
  slug={slug}
  campaignId={campaign.id}
  mode={mode}
  onToggleMode={toggleMode}
/>
```

### Step 4: TypeScript check + commit

```bash
npx tsc --noEmit
git add src/components/cockpit/pipeline-progress-dialog.tsx src/components/cockpit/cockpit-toolbar.tsx src/app/\(session\)/campaigns/\[slug\]/sessions/\[sessionId\]/live/page.tsx
git commit -m "feat(cockpit): replace EndSessionDialog with pipeline progress view"
```

---

## Task 6: Initiative Tracker Component

**Files:**
- Create: `src/components/cockpit/initiative-tracker.tsx`

### Step 1: Create the component

```tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, SkipForward, RotateCcw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
}

interface InitiativeTrackerProps {
  characterNames: string[];
}

export function InitiativeTracker({ characterNames }: InitiativeTrackerProps) {
  const [expanded, setExpanded] = useState(false);
  const [combatants, setCombatants] = useState<Combatant[]>(() =>
    characterNames.map((name, i) => ({
      id: `pc-${i}`,
      name,
      initiative: 0,
      isPlayer: true,
    }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const nextTurn = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % sorted.length;
      if (next === 0) setRound((r) => r + 1);
      return next;
    });
  }, [sorted.length]);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        nextTurn();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded, nextTurn]);

  const updateInitiative = (id: string, value: string) => {
    const num = parseInt(value) || 0;
    setCombatants((prev) => prev.map((c) => c.id === id ? { ...c, initiative: num } : c));
  };

  const removeCombatant = (id: string) => {
    setCombatants((prev) => prev.filter((c) => c.id !== id));
  };

  const addCreature = () => {
    if (!newName.trim()) return;
    setCombatants((prev) => [...prev, {
      id: `creature-${Date.now()}`,
      name: newName.trim(),
      initiative: parseInt(newInit) || 0,
      isPlayer: false,
    }]);
    setNewName('');
    setNewInit('');
  };

  const reset = () => {
    setCurrentIndex(0);
    setRound(1);
    setCombatants((prev) => prev.map((c) => ({ ...c, initiative: 0 })));
  };

  const currentCombatantId = sorted[currentIndex]?.id;

  return (
    <div ref={containerRef} className="border-t border-border mt-2 pt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-1"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Initiative
        {expanded && <span className="ml-auto font-mono text-amber-400/70">Rd {round}</span>}
      </button>

      {expanded && (
        <div className="space-y-1">
          {sorted.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors',
                c.id === currentCombatantId
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'border border-transparent'
              )}
            >
              <span className="font-mono text-muted-foreground w-4 text-center">{i + 1}</span>
              <span className={cn('flex-1 truncate', c.id === currentCombatantId ? 'text-amber-400 font-medium' : 'text-foreground')}>
                {c.name}
              </span>
              <Input
                type="number"
                value={c.initiative || ''}
                onChange={(e) => updateInitiative(c.id, e.target.value)}
                className="h-5 w-10 text-xs text-center px-1 bg-transparent border-border/50"
              />
              <button
                type="button"
                onClick={() => removeCombatant(c.id)}
                className="text-muted-foreground/40 hover:text-destructive transition-colors text-xs"
              >
                ×
              </button>
            </div>
          ))}

          {/* Add creature row */}
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Creature…"
              className="h-6 flex-1 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && addCreature()}
            />
            <Input
              type="number"
              value={newInit}
              onChange={(e) => setNewInit(e.target.value)}
              placeholder="0"
              className="h-6 w-10 text-xs text-center px-1"
              onKeyDown={(e) => e.key === 'Enter' && addCreature()}
            />
            <button type="button" onClick={addCreature} className="text-muted-foreground hover:text-amber-400 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex gap-1.5 pt-1">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
              onClick={nextTurn}
              disabled={sorted.length === 0}
            >
              <SkipForward className="h-3 w-3" />
              Next (N)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={reset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 2: TypeScript check + commit

```bash
npx tsc --noEmit
git add src/components/cockpit/initiative-tracker.tsx
git commit -m "feat(cockpit): add InitiativeTracker component"
```

---

## Task 7: Wire Initiative Tracker into Party Panel

**Files:**
- Modify: `src/components/cockpit/party-overview-panel.tsx`

### Step 1: Add import

```typescript
import { InitiativeTracker } from './initiative-tracker';
```

### Step 2: Extract character names and add tracker

After the existing character cards render, add at the bottom of the returned JSX (inside the `<div className="p-3 space-y-2">`):

```tsx
<InitiativeTracker
  characterNames={(query.data ?? []).map((c: any) => c.name)}
/>
```

The `query.data` is already loaded — this passes character names without any additional fetch.

### Step 3: TypeScript check + commit

```bash
npx tsc --noEmit
git add src/components/cockpit/party-overview-panel.tsx
git commit -m "feat(cockpit): add InitiativeTracker to party overview panel"
```

---

## Task 8: Brain Panel Tab

**Files:**
- Modify: `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`

### Step 1: Add Brain tab to right panel

In the right panel `<Tabs>` section, add a third tab. The current tabs are `prep` and `npcs`. Add:

```tsx
// In TabsList:
<TabsTrigger value="brain" className="flex-1 text-xs">Brain</TabsTrigger>

// In TabsContent:
<TabsContent value="brain" className="flex-1 overflow-y-auto m-0 p-3">
  <BrainCockpitPanel campaignId={campaign.id} />
</TabsContent>
```

### Step 2: Create inline BrainCockpitPanel component

Create `src/components/cockpit/brain-cockpit-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { HookList } from '@/components/brain/hook-list';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';

const TYPE_COLORS: Record<string, string> = {
  NPC: 'text-amber-400',
  PC: 'text-emerald-400',
  FACTION: 'text-purple-400',
  THREAT: 'text-red-400',
  LOCATION: 'text-blue-400',
};

interface BrainCockpitPanelProps {
  campaignId: string;
}

export function BrainCockpitPanel({ campaignId }: BrainCockpitPanelProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const stateQuery = trpc.brain.state.get.useQuery(
    { campaignId },
    { staleTime: 60_000, refetchInterval: 60_000 }
  );

  const entityQuery = trpc.brain.entities.list.useQuery(
    { campaignId, search: debouncedSearch || undefined },
    { enabled: debouncedSearch.length > 0, staleTime: 30_000 }
  );

  const worldState = stateQuery.data;
  const hooks = Array.isArray(worldState?.hooks)
    ? (worldState.hooks as Array<{ text: string; urgency: string; status?: string; id: string }>)
        .filter((h) => h.status !== 'resolved')
        .sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (order[a.urgency] ?? 1) - (order[b.urgency] ?? 1);
        })
        .slice(0, 5)
    : [];

  const threats = Array.isArray(worldState?.threats)
    ? (worldState.threats as Array<{ name: string; urgency: number }>).slice(0, 3)
    : [];

  if (stateQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading Brain…</p>;
  }

  const hasData = hooks.length > 0 || threats.length > 0 || (entityQuery.data?.length ?? 0) > 0;
  if (!worldState && !stateQuery.isLoading) {
    return <p className="text-xs text-muted-foreground italic">Brain not seeded. Seed from campaign settings.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Entity search */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Entity Lookup</p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entities…"
          className="h-7 text-xs"
        />
        {debouncedSearch && entityQuery.data && entityQuery.data.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {entityQuery.data.slice(0, 6).map((entity: any) => (
              <Popover key={entity.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className={TYPE_COLORS[entity.type] ?? 'text-muted-foreground'}>{entity.type}</span>
                    <span className="truncate">{entity.name}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-xs" side="left">
                  <p className="font-semibold">{entity.name}</p>
                  {entity.description && <p className="text-muted-foreground mt-1">{entity.description}</p>}
                  {entity.properties && Object.keys(entity.properties).length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {Object.entries(entity.properties as Record<string, unknown>).map(([k, v]) => (
                        <div key={k}><span className="text-muted-foreground">{k}: </span>{String(v)}</div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            ))}
          </div>
        )}
      </div>

      {/* Open hooks */}
      {hooks.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Open Hooks</p>
          <HookList hooks={hooks as any} />
        </div>
      )}

      {/* Threats */}
      {threats.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Active Threats</p>
          <div className="space-y-1">
            {threats.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div
                  className="h-1.5 rounded-full bg-red-500/60"
                  style={{ width: `${Math.round((t.urgency ?? 0.5) * 100)}%`, maxWidth: '60px' }}
                />
                <span className="truncate text-muted-foreground">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <p className="text-xs text-muted-foreground italic">No active hooks or threats. Run a session to populate Brain.</p>
      )}
    </div>
  );
}
```

Check if `useDebounce` hook exists at `src/hooks/use-debounce.ts`. If not, create it:

```typescript
// src/hooks/use-debounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

### Step 3: Import BrainCockpitPanel in live page

```typescript
import { BrainCockpitPanel } from '@/components/cockpit/brain-cockpit-panel';
```

### Step 4: TypeScript check + commit

```bash
npx tsc --noEmit
git add src/components/cockpit/brain-cockpit-panel.tsx src/app/\(session\)/campaigns/\[slug\]/sessions/\[sessionId\]/live/page.tsx src/hooks/use-debounce.ts
git commit -m "feat(cockpit): add Brain panel tab with hooks, threats, entity search"
```

---

## Task 9: Final Verification

### Step 1: Full TypeScript check

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit
```

Expected: zero errors.

### Step 2: Verify cockpit renders

Start dev server and navigate to a live session. Verify:
- Toolbar has NPC + Twist + Roll + End Session buttons
- NPC dialog generates an NPC and Save works
- Twist dialog shows 3 twists
- End Session shows pipeline stages after confirming
- Party panel has collapsed Initiative section that expands
- Right panel has 3 tabs: Prep | NPCs | Brain
- Brain tab shows entity search + hooks + threats

### Step 3: Final commit (if any cleanup needed)

```bash
git add -A
git commit -m "feat(cockpit): session mode dashboard enhancements complete"
```
