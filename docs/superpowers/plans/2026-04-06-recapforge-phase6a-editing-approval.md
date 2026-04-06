# RecapForge Phase 6a — Editing & Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let DMs click into any recap section to edit it, regen individual sections with an AI note, then approve or quick-fire the recap to mark it reviewed.

**Architecture:** All edits live in local React state on the recap page (`localSections: Record<string, string>`). A single `updateSections` mutation commits everything with a new status (`REVIEWED` or `QUICK_FIRE`). Per-section regen calls Anthropic synchronously in the tRPC mutation (one section, max_tokens: 512, ~2–4s) and returns new content to the client without writing to DB.

**Tech Stack:** tRPC v11, Prisma (PostgreSQL), Anthropic SDK (`claude-sonnet-4-6`), React `useState`, Next.js `useEffect` for beforeunload guard.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/recap/recap-prompts.ts` | Modify | Export `STYLE_INSTRUCTIONS` so section regen can import it |
| `src/lib/recap/recap-section-prompts.ts` | Create | `buildSectionRegenPrompt()` for single-section regen |
| `src/server/routers/recap.ts` | Modify | Add `regenSection` and `updateSections` procedures |
| `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx` | Modify | Inline editing UI, regen UI, approve/quick-fire buttons, beforeunload guard |
| `tests/workflows/recapforge-editing.workflow.spec.ts` | Create | Workflow spec stubs |

---

### Task 1: Export STYLE_INSTRUCTIONS + create section regen prompt

**Files:**
- Modify: `src/lib/recap/recap-prompts.ts`
- Create: `src/lib/recap/recap-section-prompts.ts`

- [ ] **Step 1: Export STYLE_INSTRUCTIONS from recap-prompts.ts**

In `src/lib/recap/recap-prompts.ts`, change line 27 from:
```ts
const STYLE_INSTRUCTIONS: Record<RecapStyleKey, string> = {
```
to:
```ts
export const STYLE_INSTRUCTIONS: Record<RecapStyleKey, string> = {
```

- [ ] **Step 2: Create src/lib/recap/recap-section-prompts.ts**

```ts
import { STYLE_INSTRUCTIONS, RecapStyleKey } from './recap-prompts';

export interface SectionRegenContext {
  correctedText: string;
  sectionKey: string;
  sectionTitle: string;
  style: RecapStyleKey;
  dmNote?: string;
}

export function buildSectionRegenPrompt(ctx: SectionRegenContext): { system: string; user: string } {
  const system =
    'You are an expert D&D session recorder. Respond ONLY with the section content text — no JSON, no markdown, no preamble, no title.';
  const instruction = STYLE_INSTRUCTIONS[ctx.style];
  const noteBlock = ctx.dmNote ? `\nDM NOTE (incorporate this): ${ctx.dmNote}\n` : '';
  const user = `Rewrite only the "${ctx.sectionTitle}" section of a D&D session recap.
Style instructions: ${instruction}
${noteBlock}
TRANSCRIPT:
${ctx.correctedText}

Write only the section content. Do not include the section title or any JSON.`;
  return { system, user };
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap-section-prompts\|recap-prompts" | head -10
```

Expected: no errors from those files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/recap/recap-prompts.ts src/lib/recap/recap-section-prompts.ts
git commit -m "feat(recap): add section regen prompt builder"
```

---

### Task 2: Add regenSection and updateSections procedures to recap router

**Files:**
- Modify: `src/server/routers/recap.ts`

- [ ] **Step 1: Add Anthropic import at top of recap.ts**

The file currently starts with:
```ts
import { z } from 'zod';
import { RecapStatus, RecapStyle } from '@prisma/client';
import { router, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { recapGenerationQueue } from '@/lib/queue/recap-generation-queue';
import { NotFoundError } from '../errors';
```

Change to:
```ts
import { z } from 'zod';
import { RecapStatus, RecapStyle } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { router, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { recapGenerationQueue } from '@/lib/queue/recap-generation-queue';
import { NotFoundError } from '../errors';
import { buildSectionRegenPrompt } from '@/lib/recap/recap-section-prompts';
import type { RecapStyleKey } from '@/lib/recap/recap-prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

- [ ] **Step 2: Add regenSection procedure**

Add before the closing `});` of the `router({...})` call (after `exportMarkdown`):

```ts
  regenSection: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
        sectionKey: z.string(),
        dmNote: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
        include: {
          session: {
            include: { transcripts: { orderBy: { createdAt: 'desc' }, take: 1 } },
          },
        },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);

      const transcript = recap.session.transcripts[0];
      if (!transcript?.correctedText) throw new Error('No transcript available for this session');

      const sections = recap.sections as Array<{ key: string; title: string; content: string }>;
      const target = sections.find((s) => s.key === input.sectionKey);
      if (!target) throw new Error(`Section "${input.sectionKey}" not found in recap`);

      const { system, user } = buildSectionRegenPrompt({
        correctedText: transcript.correctedText.slice(0, 12000),
        sectionKey: input.sectionKey,
        sectionTitle: target.title,
        style: recap.style as RecapStyleKey,
        dmNote: input.dmNote,
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      if (!content) throw new Error('Anthropic returned empty content');
      return { content };
    }),
```

- [ ] **Step 3: Add updateSections procedure**

Add after `regenSection`:

```ts
  updateSections: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
        sections: z.array(
          z.object({
            key: z.string(),
            title: z.string(),
            content: z.string(),
          })
        ),
        status: z.enum(['REVIEWED', 'QUICK_FIRE']),
      })
    )
    .mutation(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
        select: { id: true },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);

      const rawContent = input.sections.map((s) => s.content).join('\n\n');
      return prisma.sessionRecap.update({
        where: { id: input.recapId },
        data: {
          sections: input.sections,
          rawContent,
          status: input.status as RecapStatus,
        },
      });
    }),
```

- [ ] **Step 4: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/recap.ts
git commit -m "feat(recap): add regenSection and updateSections procedures"
```

---

### Task 3: Inline editing UI — local state and edit mode

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`

- [ ] **Step 1: Add local state and mutations at the top of RecapPage**

After the existing state declarations (`const [activeStyle, setActiveStyle]...`), add:

```tsx
const [localSections, setLocalSections] = useState<Record<string, string>>({});
const [editingKey, setEditingKey] = useState<string | null>(null);

const isDirty =
  sections?.some(
    (s) => s.key in localSections && localSections[s.key] !== s.content
  ) ?? false;

const effectiveSections = sections?.map((s) => ({
  ...s,
  content: s.key in localSections ? localSections[s.key]! : s.content,
}));
```

- [ ] **Step 2: Add updateSections mutation**

After `regenerateMutation`:

```tsx
const updateSectionsMutation = trpc.recap.updateSections.useMutation({
  onSuccess: () => {
    setLocalSections({});
    setEditingKey(null);
    void utils.recap.getBySession.invalidate({ campaignId, sessionId });
  },
  onError: (e) =>
    toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
});
```

- [ ] **Step 3: Replace static section content with edit-mode toggle**

Find the recap sections render block (currently starts at line ~277):
```tsx
{activeRecap?.status === 'AUTO_GENERATED' && sections && sections.length > 0 && (
```

Change the condition to also show for REVIEWED/QUICK_FIRE, and replace the inner `<p>` with an edit-mode toggle:

```tsx
{activeRecap &&
  ['AUTO_GENERATED', 'REVIEWED', 'QUICK_FIRE'].includes(activeRecap.status as string) &&
  effectiveSections &&
  effectiveSections.length > 0 && (
  <div className="space-y-4">
    {effectiveSections.map((section) => {
      const isEditing = editingKey === section.key;
      return (
        <div
          key={section.key}
          className="rounded-sm border border-border/40 overflow-hidden"
          style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
        >
          <div className="px-6 py-3.5 border-b border-border/20 flex items-center justify-between">
            <span
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'hsl(35 80% 48%)' }}
            >
              {section.title}
            </span>
            <button
              onClick={() => setEditingKey(isEditing ? null : section.key)}
              className="text-[10px] transition-opacity opacity-40 hover:opacity-80"
              style={{ color: 'hsl(35 20% 68%)' }}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <div className="px-6 py-5">
            {isEditing ? (
              <textarea
                autoFocus
                value={section.content}
                onChange={(e) =>
                  setLocalSections((prev) => ({ ...prev, [section.key]: e.target.value }))
                }
                className="w-full min-h-[120px] bg-transparent text-sm leading-relaxed resize-y outline-none"
                style={{ color: 'hsl(35 15% 72%)', border: '1px solid hsl(35 30% 22%)', borderRadius: 2, padding: '8px 10px' }}
              />
            ) : (
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap cursor-text"
                style={{ color: 'hsl(35 15% 72%)' }}
                onClick={() => setEditingKey(section.key)}
              >
                {section.content}
              </p>
            )}
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 4: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap/page" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/recap/page.tsx
git commit -m "feat(recap): inline section editing with local state"
```

---

### Task 4: Per-section regen with DM note

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`

- [ ] **Step 1: Add regen state and mutation**

After `updateSectionsMutation`:

```tsx
const [regenKey, setRegenKey] = useState<string | null>(null);
const [regenNote, setRegenNote] = useState('');

const regenSectionMutation = trpc.recap.regenSection.useMutation({
  onSuccess: (data) => {
    if (regenKey) {
      setLocalSections((prev) => ({ ...prev, [regenKey]: data.content }));
    }
    setRegenKey(null);
    setRegenNote('');
  },
  onError: (e) => {
    setRegenKey(null);
    toast({ title: 'Regen failed', description: e.message, variant: 'destructive' });
  },
});
```

- [ ] **Step 2: Add regen UI inside the edit mode block**

Inside the `isEditing` branch of the section card (after the `<textarea>`), add:

```tsx
{isEditing && (
  <div className="mt-3 flex gap-2 items-start">
    <input
      type="text"
      placeholder="DM note for regen (optional)"
      value={regenKey === section.key ? regenNote : ''}
      onChange={(e) => {
        setRegenKey(section.key);
        setRegenNote(e.target.value);
      }}
      className="flex-1 bg-transparent text-xs outline-none px-2 py-1.5 rounded-sm"
      style={{ border: '1px solid hsl(35 20% 20%)', color: 'hsl(35 10% 55%)' }}
    />
    <button
      onClick={() => {
        setRegenKey(section.key);
        regenSectionMutation.mutate({
          campaignId,
          recapId: activeRecap!.id as string,
          sectionKey: section.key,
          dmNote: regenNote || undefined,
        });
      }}
      disabled={regenSectionMutation.isPending && regenKey === section.key}
      className="text-xs px-3 py-1.5 rounded-sm transition-opacity disabled:opacity-40"
      style={{ background: 'hsl(35 50% 16%)', border: '1px solid hsl(35 40% 24%)', color: 'hsl(35 70% 58%)' }}
    >
      {regenSectionMutation.isPending && regenKey === section.key ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        'Regen'
      )}
    </button>
  </div>
)}
```

- [ ] **Step 3: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap/page" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/recap/page.tsx
git commit -m "feat(recap): per-section regen with optional DM note"
```

---

### Task 5: Approve / Quick-fire buttons + beforeunload guard

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`

- [ ] **Step 1: Add beforeunload guard**

After the mutation declarations (before `return (`), add:

```tsx
useEffect(() => {
  if (!isDirty) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);
```

- [ ] **Step 2: Add Approve and Quick-fire buttons to the top-right action bar**

The existing action bar is in the header `div.flex.items-center.gap-2` (around line 133). Currently it shows Export MD + Regenerate when `AUTO_GENERATED`. Add Approve and Quick-fire buttons:

```tsx
{activeRecap &&
  ['AUTO_GENERATED', 'REVIEWED', 'QUICK_FIRE'].includes(activeRecap.status as string) && (
  <>
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 text-xs"
      style={
        activeRecap.status === 'REVIEWED'
          ? { borderColor: 'hsl(35 60% 35%)', color: 'hsl(35 70% 58%)' }
          : {}
      }
      onClick={() =>
        updateSectionsMutation.mutate({
          campaignId,
          recapId: activeRecap.id as string,
          sections: effectiveSections ?? [],
          status: 'REVIEWED',
        })
      }
      disabled={updateSectionsMutation.isPending}
    >
      Approve
    </Button>
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 text-xs"
      style={
        activeRecap.status === 'QUICK_FIRE'
          ? { borderColor: 'hsl(50 80% 40%)', color: 'hsl(50 80% 62%)' }
          : {}
      }
      onClick={() =>
        updateSectionsMutation.mutate({
          campaignId,
          recapId: activeRecap.id as string,
          sections: effectiveSections ?? [],
          status: 'QUICK_FIRE',
        })
      }
      disabled={updateSectionsMutation.isPending}
    >
      Quick-fire
    </Button>
  </>
)}
```

Place these BEFORE the existing Export MD / Regenerate buttons block.

- [ ] **Step 3: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap/page" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/recap/page.tsx
git commit -m "feat(recap): approve and quick-fire with dirty-state guard"
```

---

### Task 6: Style picker dots for REVIEWED/QUICK_FIRE + workflow spec

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`
- Create: `tests/workflows/recapforge-editing.workflow.spec.ts`

- [ ] **Step 1: Update style picker dot logic**

Find the style picker block (around line 182). Currently it checks `hasRecap` with `status === 'AUTO_GENERATED'`. Replace with:

```tsx
{STYLES.map((style) => {
  const bestRecap =
    recaps?.find((r) => r.style === style.key && r.status === 'QUICK_FIRE') ??
    recaps?.find((r) => r.style === style.key && r.status === 'REVIEWED') ??
    recaps?.find((r) => r.style === style.key && r.status === 'AUTO_GENERATED');
  const dotColor = bestRecap
    ? bestRecap.status === 'QUICK_FIRE'
      ? 'bg-yellow-400/70'
      : bestRecap.status === 'REVIEWED'
      ? 'bg-amber-500/60'
      : 'bg-green-500/60'
    : null;
  const isActive = activeStyle === style.key;
  return (
    <button
      key={style.key}
      onClick={() => setActiveStyle(style.key)}
      className="px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
      style={{
        background: isActive ? 'hsl(35 80% 18%)' : 'hsl(240 10% 11%)',
        border: `1px solid ${isActive ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
        color: isActive
          ? 'hsl(35 80% 70%)'
          : bestRecap
          ? 'hsl(35 20% 60%)'
          : 'hsl(35 5% 40%)',
      }}
    >
      {style.label}
      {dotColor && !isActive && (
        <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
      )}
    </button>
  );
})}
```

- [ ] **Step 2: Create workflow spec**

Create `tests/workflows/recapforge-editing.workflow.spec.ts`:

```ts
import { test } from '@playwright/test';

test.fixme('DM edits a section, approves — status shows REVIEWED', async ({ page }) => {
  // Phase 6a — requires generated recap in DB, REVIEWED status persisted
  void page;
});

test.fixme('DM uses regen-with-note on a section — content updates in place', async ({ page }) => {
  // Phase 6a — requires Anthropic API key in E2E env
  void page;
});

test.fixme('navigate away with dirty edits — confirm dialog appears', async ({ page }) => {
  // Phase 6a — beforeunload guard
  void page;
});
```

- [ ] **Step 3: Type check full project**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/recap/page.tsx tests/workflows/recapforge-editing.workflow.spec.ts
git commit -m "feat(recap): style picker dots for REVIEWED/QUICK_FIRE + workflow spec"
git push origin main
```
