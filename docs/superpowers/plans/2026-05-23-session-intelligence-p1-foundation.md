# Session Intelligence — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the session prep data layer (schema + tRPC) and four new prep workspace sections: Intent Brief, Secrets Web, Phase Pacing, and Escape Routes.

**Architecture:** New Prisma models (PrepSecret, PrepKnowledge, SessionPhase, SessionRoute, SecretRevelation, NpcBehaviorProfile) + two nullable fields on Session. Three new tRPC routers. Four new collapsible section components wired into the existing PrepWorkspace → PhasePrep stack. No Brain integration yet — that is Phase 3.

**Tech Stack:** Prisma + PostgreSQL, tRPC v11 + Zod, Next.js App Router, shadcn/ui, React

**Spec:** `docs/superpowers/specs/2026-05-23-session-intelligence-design.md`

**This is Phase 1 of 4.** Phases 2–4 cover: cockpit tab strip + NPC profiles (P2), Brain integration (P3), PDF import (P4).

---

## File Map

**Create:**
- `src/server/routers/prepSecrets.ts` — PrepSecret + PrepKnowledge CRUD
- `src/server/routers/sessionPhases.ts` — SessionPhase CRUD
- `src/server/routers/sessionRoutes.ts` — SessionRoute CRUD
- `src/components/session/prep/intent-brief-section.tsx`
- `src/components/session/prep/secrets-web-section.tsx`
- `src/components/session/prep/phase-pacing-section.tsx`
- `src/components/session/prep/route-builder-section.tsx`
- `tests/workflows/session-intelligence-prep.workflow.spec.ts`

**Modify:**
- `prisma/schema.prisma` — add Session fields + 6 new models
- `src/server/routers/sessions.ts` — add `updateIntentBrief` procedure
- `src/server/trpc.ts` (or router index) — register 3 new routers
- `src/app/(app)/session/[id]/_components/PrepWorkspace.tsx` — add 4 new sections

---

## Task 1: Prisma schema — Session fields + new models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **1.1 Add nullable fields to Session model**

Find the `model Session {` block and add two fields:

```prisma
intentBrief  Json?    // { toneKeywords: string[], playerGoals: string[], dmOnlyTruths: string[] }
prepDocKey   String?  // R2 key for uploaded prep PDF
```

- [ ] **1.2 Add SessionPhase model**

```prisma
model SessionPhase {
  id            String   @id @default(cuid())
  sessionId     String
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name          String
  targetMinutes Int
  orderIndex    Int      @default(0)
  notes         String?
  createdAt     DateTime @default(now())

  @@index([sessionId])
}
```

- [ ] **1.3 Add SessionRoute model**

```prisma
model SessionRoute {
  id          String   @id @default(cuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name        String
  description String?
  benefits    String[]
  risks       String[]
  isActive    Boolean  @default(false)
  orderIndex  Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([sessionId])
}
```

- [ ] **1.4 Add PrepSecret model**

```prisma
model PrepSecret {
  id          String    @id @default(cuid())
  campaignId  String
  campaign    Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sessionId   String?
  session     Session?  @relation(fields: [sessionId], references: [id])
  name        String
  content     String
  isRevealed  Boolean   @default(false)
  orderIndex  Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  knowledge   PrepKnowledge[]
  revelations SecretRevelation[]

  @@index([campaignId])
  @@index([sessionId])
}
```

- [ ] **1.5 Add PrepKnowledge model**

```prisma
model PrepKnowledge {
  id               String      @id @default(cuid())
  prepSecretId     String
  prepSecret       PrepSecret  @relation(fields: [prepSecretId], references: [id], onDelete: Cascade)
  worldEntityId    String
  worldEntity      WorldEntity @relation(fields: [worldEntityId], references: [id], onDelete: Cascade)
  revealCondition  String?
  isCritical       Boolean     @default(false)
  criticalDialogue String?
  createdAt        DateTime    @default(now())

  @@unique([prepSecretId, worldEntityId])
  @@index([prepSecretId])
  @@index([worldEntityId])
}
```

- [ ] **1.6 Add SecretRevelation model**

```prisma
model SecretRevelation {
  id            String     @id @default(cuid())
  prepSecretId  String
  prepSecret    PrepSecret @relation(fields: [prepSecretId], references: [id], onDelete: Cascade)
  sessionId     String
  session       Session    @relation(fields: [sessionId], references: [id])
  revealedAt    DateTime   @default(now())
  revealedBy    String?
  method        String?
  syncedToGraph Boolean    @default(false)

  @@index([prepSecretId])
  @@index([sessionId])
  @@index([syncedToGraph])
}
```

- [ ] **1.7 Add NpcBehaviorProfile model**

```prisma
model NpcBehaviorProfile {
  id                 String      @id @default(cuid())
  worldEntityId      String      @unique
  worldEntity        WorldEntity @relation(fields: [worldEntityId], references: [id], onDelete: Cascade)
  defaultBehavior    String?
  triggeredBehaviors Json        @default("[]")
  // [{ condition: string, behavior: string }]
  criticalDialogue   Json        @default("[]")
  // [{ line: string, trigger: string }]
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
}
```

- [ ] **1.8 Add back-relations on Session and WorldEntity**

On `Session`, add:
```prisma
phases      SessionPhase[]
routes      SessionRoute[]
prepSecrets PrepSecret[]
revelations SecretRevelation[]
```

On `WorldEntity`, add:
```prisma
prepKnowledge    PrepKnowledge[]
behaviorProfile  NpcBehaviorProfile?
```

On `Campaign`, add:
```prisma
prepSecrets PrepSecret[]
```

- [ ] **1.9 Push schema to dev database**

```bash
npx prisma db execute --url "$(grep DATABASE_URL .env.local | cut -d= -f2-)" --file <(npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script)
```

Simpler alternative — generate and inspect SQL first, then push:
```bash
npx prisma generate
```

Then push via direct URL from `.env.local` (not `.env` — that hits localhost:5433 which is dead):
```bash
DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'=' -f2-) npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **1.10 Restart dev server**

After `prisma generate`, the running `npm run dev` holds the old client in memory. Kill and restart:
```bash
# In your dev terminal: Ctrl+C, then:
npm run dev
```

- [ ] **1.11 Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add session intelligence models — PrepSecret, SessionPhase, SessionRoute, NpcBehaviorProfile, SecretRevelation"
```

---

## Task 2: prepSecrets tRPC router

**Files:**
- Create: `src/server/routers/prepSecrets.ts`

- [ ] **2.1 Write the router**

```typescript
import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { NotFoundError } from '@/server/errors';

export const prepSecretsRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.prepSecret.findMany({
        where: {
          campaignId: ctx.campaignId,
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        },
        include: {
          knowledge: {
            include: { worldEntity: { select: { id: true, name: true, type: true } } },
          },
          revelations: { select: { id: true, sessionId: true, revealedAt: true, revealedBy: true } },
        },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  create: campaignDMProcedure
    .input(z.object({
      name: z.string().min(1),
      content: z.string().min(1),
      sessionId: z.string().optional(),
      orderIndex: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.prepSecret.create({
        data: {
          campaignId: ctx.campaignId,
          sessionId: input.sessionId,
          name: input.name,
          content: input.content,
          orderIndex: input.orderIndex,
        },
      });
    }),

  update: campaignDMProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      content: z.string().optional(),
      sessionId: z.string().nullable().optional(),
      orderIndex: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const secret = await ctx.prisma.prepSecret.findFirst({
        where: { id, campaignId: ctx.campaignId },
      });
      if (!secret) throw new NotFoundError('prepSecret', id);
      return ctx.prisma.prepSecret.update({ where: { id }, data });
    }),

  delete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const secret = await ctx.prisma.prepSecret.findFirst({
        where: { id: input.id, campaignId: ctx.campaignId },
      });
      if (!secret) throw new NotFoundError('prepSecret', input.id);
      await ctx.prisma.prepSecret.delete({ where: { id: input.id } });
    }),

  addKnowledge: campaignDMProcedure
    .input(z.object({
      prepSecretId: z.string(),
      worldEntityId: z.string(),
      revealCondition: z.string().optional(),
      isCritical: z.boolean().default(false),
      criticalDialogue: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify secret belongs to this campaign
      const secret = await ctx.prisma.prepSecret.findFirst({
        where: { id: input.prepSecretId, campaignId: ctx.campaignId },
      });
      if (!secret) throw new NotFoundError('prepSecret', input.prepSecretId);
      return ctx.prisma.prepKnowledge.upsert({
        where: { prepSecretId_worldEntityId: { prepSecretId: input.prepSecretId, worldEntityId: input.worldEntityId } },
        create: input,
        update: {
          revealCondition: input.revealCondition,
          isCritical: input.isCritical,
          criticalDialogue: input.criticalDialogue,
        },
      });
    }),

  removeKnowledge: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.prepKnowledge.delete({ where: { id: input.id } });
    }),
});
```

- [ ] **2.2 Register in root router**

Open the file that defines the app router (likely `src/server/routers/index.ts` or `src/server/trpc.ts` — look for where other routers are imported and merged). Add:

```typescript
import { prepSecretsRouter } from './prepSecrets';

// inside the router() call:
prepSecrets: prepSecretsRouter,
```

- [ ] **2.3 Commit**

```bash
git add src/server/routers/prepSecrets.ts src/server/routers/index.ts
git commit -m "feat(api): prepSecrets router — PrepSecret + PrepKnowledge CRUD"
```

---

## Task 3: sessionPhases tRPC router

**Files:**
- Create: `src/server/routers/sessionPhases.ts`

- [ ] **3.1 Write the router**

```typescript
import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';
import { NotFoundError } from '@/server/errors';

export const sessionPhasesRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sessionPhase.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  upsertMany: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      phases: z.array(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        targetMinutes: z.number().int().min(1),
        orderIndex: z.number().int(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Replace all phases for the session atomically
      await ctx.prisma.$transaction([
        ctx.prisma.sessionPhase.deleteMany({ where: { sessionId: input.sessionId } }),
        ctx.prisma.sessionPhase.createMany({
          data: input.phases.map(p => ({
            sessionId: input.sessionId,
            name: p.name,
            targetMinutes: p.targetMinutes,
            orderIndex: p.orderIndex,
            notes: p.notes,
          })),
        }),
      ]);
      return ctx.prisma.sessionPhase.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),
});
```

- [ ] **3.2 Register in root router**

```typescript
import { sessionPhasesRouter } from './sessionPhases';
// inside router():
sessionPhases: sessionPhasesRouter,
```

- [ ] **3.3 Commit**

```bash
git add src/server/routers/sessionPhases.ts src/server/routers/index.ts
git commit -m "feat(api): sessionPhases router — phase pacing CRUD"
```

---

## Task 4: sessionRoutes tRPC router

**Files:**
- Create: `src/server/routers/sessionRoutes.ts`

- [ ] **4.1 Write the router**

```typescript
import { z } from 'zod';
import { router, campaignDMProcedure, campaignMemberProcedure } from '@/server/trpc';

export const sessionRoutesRouter = router({
  list: campaignMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sessionRoute.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  upsertMany: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      routes: z.array(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        benefits: z.array(z.string()),
        risks: z.array(z.string()),
        orderIndex: z.number().int(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction([
        ctx.prisma.sessionRoute.deleteMany({ where: { sessionId: input.sessionId } }),
        ctx.prisma.sessionRoute.createMany({
          data: input.routes.map(r => ({
            sessionId: input.sessionId,
            name: r.name,
            description: r.description,
            benefits: r.benefits,
            risks: r.risks,
            orderIndex: r.orderIndex,
          })),
        }),
      ]);
      return ctx.prisma.sessionRoute.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { orderIndex: 'asc' },
      });
    }),

  setActive: campaignDMProcedure
    .input(z.object({ sessionId: z.string(), routeId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      // Clear all active, then set the chosen one
      await ctx.prisma.$transaction([
        ctx.prisma.sessionRoute.updateMany({
          where: { sessionId: input.sessionId },
          data: { isActive: false },
        }),
        ...(input.routeId ? [
          ctx.prisma.sessionRoute.update({
            where: { id: input.routeId },
            data: { isActive: true },
          }),
        ] : []),
      ]);
    }),
});
```

- [ ] **4.2 Register in root router**

```typescript
import { sessionRoutesRouter } from './sessionRoutes';
// inside router():
sessionRoutes: sessionRoutesRouter,
```

- [ ] **4.3 Commit**

```bash
git add src/server/routers/sessionRoutes.ts src/server/routers/index.ts
git commit -m "feat(api): sessionRoutes router — escape route CRUD + active tracking"
```

---

## Task 5: updateIntentBrief procedure on sessions router

**Files:**
- Modify: `src/server/routers/sessions.ts`

- [ ] **5.1 Add the procedure**

Find the sessions router and add a new `campaignDMProcedure`:

```typescript
updateIntentBrief: campaignDMProcedure
  .input(z.object({
    sessionId: z.string(),
    intentBrief: z.object({
      toneKeywords: z.array(z.string()),
      playerGoals: z.array(z.string()),
      dmOnlyTruths: z.array(z.string()),
    }),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.prisma.session.update({
      where: { id: input.sessionId },
      data: { intentBrief: input.intentBrief },
    });
  }),
```

- [ ] **5.2 Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors related to `intentBrief` or the new models.

- [ ] **5.3 Commit**

```bash
git add src/server/routers/sessions.ts
git commit -m "feat(api): sessions.updateIntentBrief procedure"
```

---

## Task 6: Intent Brief section component

**Files:**
- Create: `src/components/session/prep/intent-brief-section.tsx`

- [ ] **6.1 Write the component**

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface IntentBriefSectionProps {
  sessionId: string;
  initial?: {
    toneKeywords: string[];
    playerGoals: string[];
    dmOnlyTruths: string[];
  } | null;
}

export function IntentBriefSection({ sessionId, initial }: IntentBriefSectionProps) {
  const [brief, setBrief] = useState({
    toneKeywords: initial?.toneKeywords ?? [],
    playerGoals: initial?.playerGoals ?? [],
    dmOnlyTruths: initial?.dmOnlyTruths ?? [],
  });
  const [toneInput, setToneInput] = useState('');
  const [dirty, setDirty] = useState(false);

  const update = trpc.sessions.updateIntentBrief.useMutation();

  function addTone(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !toneInput.trim()) return;
    e.preventDefault();
    const next = { ...brief, toneKeywords: [...brief.toneKeywords, toneInput.trim()] };
    setBrief(next);
    setToneInput('');
    setDirty(true);
  }

  function removeTone(kw: string) {
    setBrief(prev => ({ ...prev, toneKeywords: prev.toneKeywords.filter(t => t !== kw) }));
    setDirty(true);
  }

  function save() {
    update.mutate({ sessionId, intentBrief: brief }, { onSuccess: () => setDirty(false) });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tone</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {brief.toneKeywords.map(kw => (
            <Badge
              key={kw}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => removeTone(kw)}
            >
              {kw} ×
            </Badge>
          ))}
        </div>
        <Input
          placeholder="Add tone keyword, press Enter"
          value={toneInput}
          onChange={e => setToneInput(e.target.value)}
          onKeyDown={addTone}
          className="max-w-xs"
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Players leave with</p>
        <Textarea
          placeholder="One goal per line"
          value={brief.playerGoals.join('\n')}
          onChange={e => {
            setBrief(prev => ({ ...prev, playerGoals: e.target.value.split('\n').filter(Boolean) }));
            setDirty(true);
          }}
          rows={3}
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">DM-only truths</p>
        <Textarea
          placeholder="One truth per line — not visible to players"
          value={brief.dmOnlyTruths.join('\n')}
          onChange={e => {
            setBrief(prev => ({ ...prev, dmOnlyTruths: e.target.value.split('\n').filter(Boolean) }));
            setDirty(true);
          }}
          rows={3}
        />
      </div>

      {dirty && (
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save brief'}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **6.2 Commit**

```bash
git add src/components/session/prep/intent-brief-section.tsx
git commit -m "feat(ui): IntentBriefSection — tone keywords, player goals, DM truths"
```

---

## Task 7: Secrets Web section component

**Files:**
- Create: `src/components/session/prep/secrets-web-section.tsx`

- [ ] **7.1 Write the component**

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Trash2, Plus } from 'lucide-react';

interface SecretsWebSectionProps {
  campaignId: string;
  sessionId: string;
}

export function SecretsWebSection({ campaignId, sessionId }: SecretsWebSectionProps) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', content: '' });

  const { data: secrets, refetch } = trpc.prepSecrets.list.useQuery({ sessionId });
  const create = trpc.prepSecrets.create.useMutation({ onSuccess: () => { refetch(); setCreating(false); setForm({ name: '', content: '' }); } });
  const del = trpc.prepSecrets.delete.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-3">
      {secrets?.map(secret => (
        <div key={secret.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{secret.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{secret.content}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {secret.knowledge.map(k => (
                <Badge key={k.id} variant="outline" className="text-xs gap-1">
                  {k.isCritical && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                  {k.worldEntity.name}
                  {k.revealCondition && <span className="opacity-50">· {k.revealCondition}</span>}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => del.mutate({ id: secret.id })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {creating ? (
        <div className="space-y-2 p-3 rounded-md border border-border bg-muted/20">
          <Input
            placeholder="Secret name"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            placeholder="Secret content — what the DM knows"
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => create.mutate({ name: form.name, content: form.content, sessionId, orderIndex: secrets?.length ?? 0 })}
              disabled={!form.name || !form.content || create.isPending}
            >
              Add secret
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> Add secret
        </Button>
      )}
    </div>
  );
}
```

- [ ] **7.2 Commit**

```bash
git add src/components/session/prep/secrets-web-section.tsx
git commit -m "feat(ui): SecretsWebSection — secret list with NPC knowledge badges"
```

---

## Task 8: Phase Pacing section component

**Files:**
- Create: `src/components/session/prep/phase-pacing-section.tsx`

- [ ] **8.1 Write the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface Phase {
  id?: string;
  name: string;
  targetMinutes: number;
  notes: string;
  orderIndex: number;
}

interface PhasePacingSectionProps {
  sessionId: string;
}

export function PhasePacingSection({ sessionId }: PhasePacingSectionProps) {
  const { data: saved } = trpc.sessionPhases.list.useQuery({ sessionId });
  const [phases, setPhases] = useState<Phase[]>([]);
  const [dirty, setDirty] = useState(false);
  const save = trpc.sessionPhases.upsertMany.useMutation({ onSuccess: () => setDirty(false) });

  useEffect(() => {
    if (saved) setPhases(saved.map(p => ({ id: p.id, name: p.name, targetMinutes: p.targetMinutes, notes: p.notes ?? '', orderIndex: p.orderIndex })));
  }, [saved]);

  function addPhase() {
    setPhases(prev => [...prev, { name: '', targetMinutes: 30, notes: '', orderIndex: prev.length }]);
    setDirty(true);
  }

  function removePhase(i: number) {
    setPhases(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, orderIndex: idx })));
    setDirty(true);
  }

  function updatePhase(i: number, field: keyof Phase, value: string | number) {
    setPhases(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
    setDirty(true);
  }

  const totalMinutes = phases.reduce((sum, p) => sum + p.targetMinutes, 0);

  return (
    <div className="space-y-3">
      {phases.map((phase, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/20">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Phase name"
            value={phase.name}
            onChange={e => updatePhase(i, 'name', e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number"
              min={1}
              value={phase.targetMinutes}
              onChange={e => updatePhase(i, 'targetMinutes', parseInt(e.target.value) || 1)}
              className="w-16 h-8 text-sm text-right"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removePhase(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-2" onClick={addPhase}>
          <Plus className="h-3.5 w-3.5" /> Add phase
        </Button>
        <span className="text-xs text-muted-foreground">Total: {totalMinutes} min</span>
      </div>

      {dirty && (
        <Button size="sm" onClick={() => save.mutate({ sessionId, phases })} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save phases'}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **8.2 Commit**

```bash
git add src/components/session/prep/phase-pacing-section.tsx
git commit -m "feat(ui): PhasePacingSection — phase list with time budgets"
```

---

## Task 9: Route Builder section component

**Files:**
- Create: `src/components/session/prep/route-builder-section.tsx`

- [ ] **9.1 Write the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';

interface Route {
  id?: string;
  name: string;
  description: string;
  benefits: string[];
  risks: string[];
  orderIndex: number;
}

interface RouteBuilderSectionProps {
  sessionId: string;
}

export function RouteBuilderSection({ sessionId }: RouteBuilderSectionProps) {
  const { data: saved } = trpc.sessionRoutes.list.useQuery({ sessionId });
  const [routes, setRoutes] = useState<Route[]>([]);
  const [dirty, setDirty] = useState(false);
  const [benefitInputs, setBenefitInputs] = useState<Record<number, string>>({});
  const [riskInputs, setRiskInputs] = useState<Record<number, string>>({});
  const save = trpc.sessionRoutes.upsertMany.useMutation({ onSuccess: () => setDirty(false) });

  useEffect(() => {
    if (saved) setRoutes(saved.map(r => ({ id: r.id, name: r.name, description: r.description ?? '', benefits: r.benefits, risks: r.risks, orderIndex: r.orderIndex })));
  }, [saved]);

  function addRoute() {
    setRoutes(prev => [...prev, { name: '', description: '', benefits: [], risks: [], orderIndex: prev.length }]);
    setDirty(true);
  }

  function removeRoute(i: number) {
    setRoutes(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, orderIndex: idx })));
    setDirty(true);
  }

  function updateRoute(i: number, field: keyof Route, value: unknown) {
    setRoutes(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    setDirty(true);
  }

  function addChip(i: number, field: 'benefits' | 'risks', value: string) {
    if (!value.trim()) return;
    updateRoute(i, field, [...routes[i][field], value.trim()]);
    field === 'benefits' ? setBenefitInputs(p => ({ ...p, [i]: '' })) : setRiskInputs(p => ({ ...p, [i]: '' }));
  }

  function removeChip(i: number, field: 'benefits' | 'risks', chip: string) {
    updateRoute(i, field, routes[i][field].filter(c => c !== chip));
  }

  return (
    <div className="space-y-4">
      {routes.map((route, i) => (
        <div key={i} className="p-3 rounded-md border border-border/50 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Input placeholder="Route name" value={route.name} onChange={e => updateRoute(i, 'name', e.target.value)} className="flex-1 h-8 text-sm font-medium" />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeRoute(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Description (optional)" value={route.description} onChange={e => updateRoute(i, 'description', e.target.value)} className="h-8 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-green-400 mb-1">Benefits</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {route.benefits.map(b => (
                  <Badge key={b} variant="outline" className="text-xs border-green-800 gap-1 cursor-pointer" onClick={() => removeChip(i, 'benefits', b)}>
                    {b} <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
              <Input placeholder="Add benefit, Enter" value={benefitInputs[i] ?? ''} onChange={e => setBenefitInputs(p => ({ ...p, [i]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip(i, 'benefits', benefitInputs[i] ?? ''); } }} className="h-7 text-xs" />
            </div>
            <div>
              <p className="text-xs text-red-400 mb-1">Risks</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {route.risks.map(r => (
                  <Badge key={r} variant="outline" className="text-xs border-red-900 gap-1 cursor-pointer" onClick={() => removeChip(i, 'risks', r)}>
                    {r} <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
              <Input placeholder="Add risk, Enter" value={riskInputs[i] ?? ''} onChange={e => setRiskInputs(p => ({ ...p, [i]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip(i, 'risks', riskInputs[i] ?? ''); } }} className="h-7 text-xs" />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={addRoute}>
          <Plus className="h-3.5 w-3.5" /> Add route
        </Button>
        {dirty && (
          <Button size="sm" onClick={() => save.mutate({ sessionId, routes })} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save routes'}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **9.2 Commit**

```bash
git add src/components/session/prep/route-builder-section.tsx
git commit -m "feat(ui): RouteBuilderSection — escape routes with benefit/risk chips"
```

---

## Task 10: Wire new sections into PrepWorkspace

**Files:**
- Modify: `src/app/(app)/session/[id]/_components/PrepWorkspace.tsx`

- [ ] **10.1 Add imports and new section components**

At the top of `PrepWorkspace.tsx`, add imports:

```typescript
import { IntentBriefSection } from '@/components/session/prep/intent-brief-section';
import { SecretsWebSection } from '@/components/session/prep/secrets-web-section';
import { PhasePacingSection } from '@/components/session/prep/phase-pacing-section';
import { RouteBuilderSection } from '@/components/session/prep/route-builder-section';
```

- [ ] **10.2 Add new sections to the render**

The component currently renders `<PhasePrep />` inside a Surface. Wrap the existing content and add the four new collapsible sections after it. Use shadcn `Accordion` for the collapsible pattern (already in the project):

```typescript
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Inside the return, after existing PhasePrep content:
<Accordion type="multiple" className="space-y-2 mt-6">
  <AccordionItem value="intent-brief" className="border border-border/50 rounded-lg overflow-hidden">
    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
      Session Intent
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">
      <IntentBriefSection
        sessionId={session.id as string}
        initial={(session.intentBrief as { toneKeywords: string[]; playerGoals: string[]; dmOnlyTruths: string[] } | null) ?? null}
      />
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="secrets-web" className="border border-border/50 rounded-lg overflow-hidden">
    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
      Secrets Web
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">
      <SecretsWebSection campaignId={campaignId} sessionId={session.id as string} />
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="phase-pacing" className="border border-border/50 rounded-lg overflow-hidden">
    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
      Phase Pacing
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">
      <PhasePacingSection sessionId={session.id as string} />
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="escape-routes" className="border border-border/50 rounded-lg overflow-hidden">
    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
      Escape Routes
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">
      <RouteBuilderSection sessionId={session.id as string} />
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

- [ ] **10.3 Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors before continuing. Common issue: `session.id` typed as `unknown` — cast to `string` or update the prop type.

- [ ] **10.4 Commit**

```bash
git add src/app/(app)/session/[id]/_components/PrepWorkspace.tsx
git commit -m "feat(ui): wire session intelligence sections into PrepWorkspace"
```

---

## Task 11: Workflow test

**Files:**
- Create: `tests/workflows/session-intelligence-prep.workflow.spec.ts`

- [ ] **11.1 Write the workflow spec**

```typescript
import { test, expect } from '@playwright/test';

// Run with:
// $env:CI=$null; $env:BASE_URL='http://localhost:3847'; npx playwright test tests/workflows/session-intelligence-prep.workflow.spec.ts

test.describe('Session Intelligence — Prep Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as DM — adjust selectors to match your auth flow
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', process.env.TEST_DM_EMAIL ?? 'dm@test.com');
    await page.fill('[name="password"]', process.env.TEST_DM_PASSWORD ?? 'testpass');
    await page.click('[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('DM can set session intent brief', async ({ page }) => {
    // Navigate to a known test session's prep page
    const slug = process.env.TEST_CAMPAIGN_SLUG ?? 'test-campaign';
    const sessionId = process.env.TEST_SESSION_ID ?? '';
    await page.goto(`/session/${sessionId}`);

    // Open Intent Brief accordion
    await page.click('text=Session Intent');
    await page.waitForSelector('[placeholder="Add tone keyword, press Enter"]');

    // Add a tone keyword
    await page.fill('[placeholder="Add tone keyword, press Enter"]', 'claustrophobic');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=claustrophobic')).toBeVisible();

    // Add a player goal
    await page.fill('[placeholder="One goal per line"]', 'Fear of Vespera');
    await page.click('text=Save brief');
    await expect(page.locator('text=Save brief')).not.toBeVisible({ timeout: 3000 });
  });

  test('DM can add a secret to the Secrets Web', async ({ page }) => {
    const sessionId = process.env.TEST_SESSION_ID ?? '';
    await page.goto(`/session/${sessionId}`);

    await page.click('text=Secrets Web');
    await page.click('text=Add secret');

    await page.fill('[placeholder="Secret name"]', 'The Scale was recovered');
    await page.fill('[placeholder="Secret content — what the DM knows"]', "Vespera's cult recovered The Scale beneath Dragonspear.");
    await page.click('text=Add secret');

    await expect(page.locator('text=The Scale was recovered')).toBeVisible();
  });

  test('DM can add phases with time budgets', async ({ page }) => {
    const sessionId = process.env.TEST_SESSION_ID ?? '';
    await page.goto(`/session/${sessionId}`);

    await page.click('text=Phase Pacing');
    await page.click('text=Add phase');

    const nameInput = page.locator('[placeholder="Phase name"]').last();
    await nameInput.fill('Awakening');
    const minutesInput = page.locator('input[type="number"]').last();
    await minutesInput.fill('15');

    await page.click('text=Save phases');
    await expect(page.locator('text=Save phases')).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Awakening')).toBeVisible();
  });

  test('DM can add an escape route with benefits and risks', async ({ page }) => {
    const sessionId = process.env.TEST_SESSION_ID ?? '';
    await page.goto(`/session/${sessionId}`);

    await page.click('text=Escape Routes');
    await page.click('text=Add route');

    await page.fill('[placeholder="Route name"]', 'Sewer Shaft');

    // Add a benefit
    await page.fill('[placeholder="Add benefit, Enter"]', 'Hidden from guards');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Hidden from guards')).toBeVisible();

    // Add a risk
    await page.fill('[placeholder="Add risk, Enter"]', 'Exhaustion saves every 30 min');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Exhaustion saves every 30 min')).toBeVisible();

    await page.click('text=Save routes');
    await expect(page.locator('text=Save routes')).not.toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **11.2 Run the test (expect failures until dev is running and test env is configured)**

```bash
$env:CI=$null; $env:BASE_URL='http://localhost:3847'; npx playwright test tests/workflows/session-intelligence-prep.workflow.spec.ts --headed
```

Fix any selector mismatches against the actual rendered UI.

- [ ] **11.3 Commit**

```bash
git add tests/workflows/session-intelligence-prep.workflow.spec.ts
git commit -m "test(workflow): session intelligence prep — intent brief, secrets, phases, routes"
```

---

## Done

Phase 1 complete. The DM can now:
- Set tone keywords, player goals, and DM-only truths on any session
- Build a Secrets Web with NPC knowledge assignments
- Define session phases with time budgets
- Define escape routes with benefit/risk chips

**Next:** Phase 2 — Cockpit tab strip + NPC behavioral profiles (`docs/superpowers/plans/2026-05-23-session-intelligence-p2-cockpit.md`)
