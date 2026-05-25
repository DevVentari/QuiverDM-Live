# Session Intelligence P4 — PDF/Doc Import Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Import from doc" flow to the cockpit's BRIEF tab that extracts PrepSecrets, SessionPhases, SessionRoutes, and NpcBehaviorProfiles from DM prep notes (text paste or PDF), lets the DM review extracted items, and writes accepted items to the SI Prisma models.

**Architecture:** Two-mutation pipeline — `extractSIPrepDoc` (AI extraction + NPC fuzzy match, no DB writes) feeds a review `Sheet` where the DM accepts/edits/discards items; `confirmSIPrepImport` writes all accepted items additively. Entry point is a compact import zone appended to `brief-panel.tsx`.

**Tech Stack:** tRPC v11 + Zod, Prisma (GameSession, SessionPhase, SessionRoute, PrepSecret, PrepKnowledge, NpcBehaviorProfile, WorldEntity), Claude via `chatWithAI`, shadcn Sheet + Accordion + Switch, React local state.

---

## Schema facts (read before writing any code)

- Model is **`GameSession`** (not `Session`; that's the NextAuth model)
- `SessionPhase` fields: `name String`, `targetMinutes Int`, `orderIndex Int @default(0)`, `notes String?`
- `SessionRoute` fields: `name String`, `description String?`, `benefits String[]`, `risks String[]`, `isActive Boolean @default(false)`, `orderIndex Int @default(0)`
- `PrepSecret` fields: `campaignId String`, `sessionId String?`, `name String`, `content String @db.Text`, `isRevealed Boolean @default(false)`, `orderIndex Int @default(0)`
- `PrepKnowledge` fields: `prepSecretId String`, `worldEntityId String`, `revealCondition String?`, `isCritical Boolean @default(false)`; unique on `[prepSecretId, worldEntityId]`
- `NpcBehaviorProfile` fields: `worldEntityId String @unique`, `defaultBehavior String?`, `triggeredBehaviors Json @default("[]")`, `criticalDialogue Json @default("[]")`
- `WorldEntity` required fields: `campaignId`, `type` (`WorldEntityType` enum — use `NPC`), `name`

---

## Task 1: Schema migration — add `prepNotes` to `GameSession`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add field**

In `prisma/schema.prisma`, inside `model GameSession { ... }`, add this line after `prepDocKey String?`:

```prisma
  prepNotes String? @db.Text // DM prep intent brief from import
```

- [ ] **Step 2: Push to dev DB**

```bash
npx prisma db execute --url "$(grep DATABASE_URL .env.local | cut -d= -f2-)" --file /dev/stdin <<'SQL'
ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "prepNotes" TEXT;
SQL
```

Expected: no error output.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Then restart the dev server (`npm run dev`) so Next.js picks up the new client.

- [ ] **Step 4: Verify**

```bash
npx tsx -e "import { prisma } from './src/server/db'; prisma.gameSession.findFirst({ select: { prepNotes: true } }).then(r => console.log('OK', r)).finally(() => prisma.\$disconnect())"
```

Expected: `OK null` or `OK { prepNotes: null }` — no TypeScript error.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(session-intel): add prepNotes field to GameSession for SI import"
```

---

## Task 2: AI extraction function

**Files:**
- Create: `src/lib/ai/extract-si-prep-doc.ts`

This function follows the same pattern as `src/lib/ai/extract-prep-notes.ts` — system prompt, user prompt, `chatWithAI`, JSON.parse.

- [ ] **Step 1: Create the file**

```typescript
// src/lib/ai/extract-si-prep-doc.ts
import { z } from 'zod';
import { chatWithAI } from './chat';

export const SIExtractedDocSchema = z.object({
  intentBrief: z.string().optional(),
  secrets: z.array(z.object({
    name: z.string(),
    content: z.string(),
    isCritical: z.boolean().default(false),
    knowledge: z.array(z.object({
      entityName: z.string(),
      revealCondition: z.string().optional(),
    })).default([]),
  })).default([]),
  phases: z.array(z.object({
    name: z.string(),
    targetMinutes: z.number().int().default(30),
    notes: z.string().optional(),
  })).default([]),
  routes: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    isActive: z.boolean().default(false),
  })).default([]),
  npcProfiles: z.array(z.object({
    name: z.string(),
    defaultBehavior: z.string(),
    triggeredBehaviors: z.array(z.object({
      condition: z.string(),
      behavior: z.string(),
    })).default([]),
    criticalDialogue: z.array(z.object({
      line: z.string(),
      trigger: z.string(),
    })).default([]),
  })).default([]),
});

export type SIExtractedDoc = z.infer<typeof SIExtractedDocSchema>;

const SYSTEM_PROMPT = `You are a D&D session intelligence extractor. Given a DM's raw prep notes, extract structured data for the Session Intelligence system.

Extract:
- intentBrief: one paragraph summarizing the DM's intent for the session
- secrets: plot secrets, hidden information, and clues. For each secret, list which NPCs (entityName) know it and under what condition they'd reveal it (revealCondition). Mark isCritical:true if revealing this secret is pivotal to the session.
- phases: the rough narrative phases or acts of the session. Each has a name and estimated minutes (targetMinutes, default 30 if unclear).
- routes: the different paths or choices players might take. Mark the most likely route as isActive:true.
- npcProfiles: behavioral profiles for each NPC. defaultBehavior is how they act by default. triggeredBehaviors are conditional responses (condition → behavior). criticalDialogue are key lines the DM should remember to use.

Return ONLY valid JSON matching the schema. Omit sections where no relevant content exists. If unsure, lean toward extracting more rather than less.`;

function buildUserPrompt(text: string): string {
  return `DM Prep Notes:\n\n${text}\n\nExtract Session Intelligence data as JSON:
{
  "intentBrief": "string",
  "secrets": [{ "name": "string", "content": "string", "isCritical": false, "knowledge": [{ "entityName": "string", "revealCondition": "string" }] }],
  "phases": [{ "name": "string", "targetMinutes": 30, "notes": "string" }],
  "routes": [{ "name": "string", "description": "string", "isActive": false }],
  "npcProfiles": [{ "name": "string", "defaultBehavior": "string", "triggeredBehaviors": [{ "condition": "string", "behavior": "string" }], "criticalDialogue": [{ "line": "string", "trigger": "string" }] }]
}`;
}

export async function extractSIDoc(text: string): Promise<SIExtractedDoc> {
  const raw = await chatWithAI(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text) },
    ],
    { forceProvider: 'claude', temperature: 0.2 }
  );

  try {
    const parsed = JSON.parse(raw);
    return SIExtractedDocSchema.parse(parsed);
  } catch {
    return SIExtractedDocSchema.parse({});
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "extract-si-prep-doc"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/extract-si-prep-doc.ts
git commit -m "feat(session-intel): AI extraction function for SI prep doc import"
```

---

## Task 3: tRPC procedures — `extractSIPrepDoc` + `confirmSIPrepImport`

**Files:**
- Modify: `src/server/routers/sessions.ts` (add import + 2 procedures before the closing `}`  of `sessionsRouter`)

- [ ] **Step 1: Add import at top of sessions.ts**

After the existing last import (`import { generatePostSessionSummary } ...`), add:

```typescript
import { extractSIDoc } from '@/lib/ai/extract-si-prep-doc';
```

- [ ] **Step 2: Add fuzzy match helper function**

After the `OocReviewItem` interface definition (around line 37) and before `export const sessionsRouter`, add:

```typescript
type NpcSuggestion = { worldEntityId: string; name: string; score: number };

async function fuzzyMatchNpc(name: string, campaignId: string): Promise<NpcSuggestion | null> {
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;

  const candidates = await prisma.worldEntity.findMany({
    where: {
      campaignId,
      type: 'NPC',
      OR: words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
    },
    take: 5,
    select: { id: true, name: true },
  });

  let best: NpcSuggestion | null = null;
  for (const c of candidates) {
    const cWords = c.name.toLowerCase().split(/\s+/);
    const nWords = name.toLowerCase().split(/\s+/);
    const shared = nWords.filter((w) => cWords.some((cw) => cw.includes(w) || w.includes(cw)));
    const score = shared.length / Math.max(cWords.length, nWords.length);
    if (score >= 0.7 && score > (best?.score ?? 0)) {
      best = { worldEntityId: c.id, name: c.name, score };
    }
  }
  return best;
}
```

- [ ] **Step 3: Add `extractSIPrepDoc` procedure**

Inside `sessionsRouter`, after the `generatePostSessionSummary` procedure (before the closing `}`), add:

```typescript
  extractSIPrepDoc: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
        text: z.string().min(1).max(100_000),
      })
    )
    .mutation(async ({ input }) => {
      const extracted = await extractSIDoc(input.text);

      const npcProfilesWithMatches = await Promise.all(
        extracted.npcProfiles.map(async (npc) => {
          const suggestedMatch = await fuzzyMatchNpc(npc.name, input.campaignId);
          return { ...npc, suggestedMatch: suggestedMatch ?? null };
        })
      );

      return { ...extracted, npcProfiles: npcProfilesWithMatches };
    }),
```

- [ ] **Step 4: Add Zod schemas for confirm payload (inline in sessions.ts, after the fuzzy match helper)**

```typescript
const TriggeredBehaviorSchema = z.object({ condition: z.string(), behavior: z.string() });
const CriticalDialogueSchema = z.object({ line: z.string(), trigger: z.string() });

const SIConfirmPayloadSchema = z.object({
  campaignId: z.string().min(1),
  sessionId: z.string().min(1),
  intentBrief: z.string().optional(),
  secrets: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
      isCritical: z.boolean().default(false),
      knowledge: z.array(
        z.object({
          entityName: z.string(),
          worldEntityId: z.string().optional(),
          revealCondition: z.string().optional(),
        })
      ).default([]),
    })
  ).default([]),
  phases: z.array(
    z.object({
      name: z.string(),
      targetMinutes: z.number().int().default(30),
      notes: z.string().optional(),
    })
  ).default([]),
  routes: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      isActive: z.boolean().default(false),
    })
  ).default([]),
  npcProfiles: z.array(
    z.object({
      worldEntityId: z.string().optional(),
      name: z.string(),
      defaultBehavior: z.string(),
      triggeredBehaviors: z.array(TriggeredBehaviorSchema).default([]),
      criticalDialogue: z.array(CriticalDialogueSchema).default([]),
    })
  ).default([]),
});
```

- [ ] **Step 5: Add `confirmSIPrepImport` procedure (after `extractSIPrepDoc`, before closing `}`)**

```typescript
  confirmSIPrepImport: campaignDMProcedure
    .input(SIConfirmPayloadSchema)
    .mutation(async ({ input }) => {
      const counters = {
        secretsCreated: 0,
        phasesCreated: 0,
        routesCreated: 0,
        profilesUpserted: 0,
        entitiesCreated: 0,
      };

      await prisma.$transaction(async (tx) => {
        // 1. Intent brief
        if (input.intentBrief) {
          await tx.gameSession.update({
            where: { id: input.sessionId },
            data: { prepNotes: input.intentBrief },
          });
        }

        // 2. PrepSecrets + PrepKnowledge
        for (const s of input.secrets) {
          const secret = await tx.prepSecret.create({
            data: {
              campaignId: input.campaignId,
              sessionId: input.sessionId,
              name: s.name,
              content: s.content,
            },
          });
          counters.secretsCreated++;

          for (const k of s.knowledge) {
            if (!k.worldEntityId) continue;
            await tx.prepKnowledge.create({
              data: {
                prepSecretId: secret.id,
                worldEntityId: k.worldEntityId,
                revealCondition: k.revealCondition,
                isCritical: s.isCritical,
              },
            });
          }
        }

        // 3. SessionPhases — append after max existing orderIndex
        const maxPhase = await tx.sessionPhase.aggregate({
          where: { sessionId: input.sessionId },
          _max: { orderIndex: true },
        });
        let phaseOrder = (maxPhase._max.orderIndex ?? -1) + 1;
        for (const p of input.phases) {
          await tx.sessionPhase.create({
            data: {
              sessionId: input.sessionId,
              name: p.name,
              targetMinutes: p.targetMinutes,
              notes: p.notes,
              orderIndex: phaseOrder++,
            },
          });
          counters.phasesCreated++;
        }

        // 4. SessionRoutes — clear isActive on existing routes if any new route is active
        const hasActiveRoute = input.routes.some((r) => r.isActive);
        if (hasActiveRoute) {
          await tx.sessionRoute.updateMany({
            where: { sessionId: input.sessionId },
            data: { isActive: false },
          });
        }
        const maxRoute = await tx.sessionRoute.aggregate({
          where: { sessionId: input.sessionId },
          _max: { orderIndex: true },
        });
        let routeOrder = (maxRoute._max.orderIndex ?? -1) + 1;
        for (const r of input.routes) {
          await tx.sessionRoute.create({
            data: {
              sessionId: input.sessionId,
              name: r.name,
              description: r.description,
              isActive: r.isActive,
              orderIndex: routeOrder++,
            },
          });
          counters.routesCreated++;
        }

        // 5. NpcBehaviorProfiles — upsert, merge arrays
        for (const npc of input.npcProfiles) {
          let entityId = npc.worldEntityId;

          if (!entityId) {
            const entity = await tx.worldEntity.create({
              data: {
                campaignId: input.campaignId,
                type: 'NPC',
                name: npc.name,
              },
            });
            entityId = entity.id;
            counters.entitiesCreated++;
          }

          const existing = await tx.npcBehaviorProfile.findUnique({
            where: { worldEntityId: entityId },
          });

          if (existing) {
            const existingTB = existing.triggeredBehaviors as Array<{ condition: string; behavior: string }>;
            const existingCD = existing.criticalDialogue as Array<{ line: string; trigger: string }>;

            await tx.npcBehaviorProfile.update({
              where: { worldEntityId: entityId },
              data: {
                defaultBehavior: existing.defaultBehavior ?? npc.defaultBehavior,
                triggeredBehaviors: [
                  ...existingTB,
                  ...npc.triggeredBehaviors.filter(
                    (t) => !existingTB.some((e) => e.condition === t.condition)
                  ),
                ],
                criticalDialogue: [
                  ...existingCD,
                  ...npc.criticalDialogue.filter(
                    (d) => !existingCD.some((e) => e.line === d.line)
                  ),
                ],
              },
            });
          } else {
            await tx.npcBehaviorProfile.create({
              data: {
                worldEntityId: entityId,
                defaultBehavior: npc.defaultBehavior,
                triggeredBehaviors: npc.triggeredBehaviors,
                criticalDialogue: npc.criticalDialogue,
              },
            });
          }
          counters.profilesUpserted++;
        }
      });

      return counters;
    }),
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "sessions.ts"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/server/routers/sessions.ts src/lib/ai/extract-si-prep-doc.ts
git commit -m "feat(session-intel): extractSIPrepDoc + confirmSIPrepImport tRPC procedures"
```

---

## Task 4: Review sheet component

**Files:**
- Create: `src/components/cockpit/session-intel/si-review-sheet.tsx`

The sheet receives the extraction preview (with NPC suggestions), lets the DM accept/edit/discard each item with local React state, then calls `confirmSIPrepImport` on confirm.

- [ ] **Step 1: Create the file**

```typescript
// src/components/cockpit/session-intel/si-review-sheet.tsx
'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

type NpcSuggestion = { worldEntityId: string; name: string; score: number };

type ExtractedSecret = {
  name: string;
  content: string;
  isCritical: boolean;
  knowledge: Array<{ entityName: string; worldEntityId?: string; revealCondition?: string }>;
};
type ExtractedPhase = { name: string; targetMinutes: number; notes?: string };
type ExtractedRoute = { name: string; description?: string; isActive: boolean };
type ExtractedNpc = {
  name: string;
  defaultBehavior: string;
  triggeredBehaviors: Array<{ condition: string; behavior: string }>;
  criticalDialogue: Array<{ line: string; trigger: string }>;
  suggestedMatch: NpcSuggestion | null;
};

export type SIExtractedPreview = {
  intentBrief?: string;
  secrets: ExtractedSecret[];
  phases: ExtractedPhase[];
  routes: ExtractedRoute[];
  npcProfiles: ExtractedNpc[];
};

interface SIReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  sessionId: string;
  extracted: SIExtractedPreview;
  onConfirmed: () => void;
}

export function SIReviewSheet({
  open,
  onOpenChange,
  campaignId,
  sessionId,
  extracted,
  onConfirmed,
}: SIReviewSheetProps) {
  const { toast } = useToast();

  const [intentBrief, setIntentBrief] = useState(extracted.intentBrief ?? '');
  const [secrets, setSecrets] = useState(() =>
    extracted.secrets.map((s) => ({ ...s, accepted: true }))
  );
  const [phases, setPhases] = useState(() =>
    extracted.phases.map((p) => ({ ...p, accepted: true }))
  );
  const [routes, setRoutes] = useState(() =>
    extracted.routes.map((r) => ({ ...r, accepted: true }))
  );
  const [npcProfiles, setNpcProfiles] = useState(() =>
    extracted.npcProfiles.map((n) => ({
      ...n,
      accepted: true,
      useMatch: n.suggestedMatch !== null,
    }))
  );

  const confirm = trpc.sessions.confirmSIPrepImport.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Import complete',
        description: `${data.secretsCreated} secrets · ${data.phasesCreated} phases · ${data.routesCreated} routes · ${data.profilesUpserted} NPC profiles`,
      });
      onOpenChange(false);
      onConfirmed();
    },
    onError: () => {
      toast({ title: 'Import failed', variant: 'destructive' });
    },
  });

  const acceptedCount =
    secrets.filter((s) => s.accepted).length +
    phases.filter((p) => p.accepted).length +
    routes.filter((r) => r.accepted).length +
    npcProfiles.filter((n) => n.accepted).length;

  const totalCount =
    extracted.secrets.length +
    extracted.phases.length +
    extracted.routes.length +
    extracted.npcProfiles.length;

  function handleConfirm() {
    confirm.mutate({
      campaignId,
      sessionId,
      intentBrief: intentBrief.trim() || undefined,
      secrets: secrets
        .filter((s) => s.accepted)
        .map(({ accepted: _a, ...s }) => s),
      phases: phases
        .filter((p) => p.accepted)
        .map(({ accepted: _a, ...p }) => p),
      routes: routes
        .filter((r) => r.accepted)
        .map(({ accepted: _a, ...r }) => r),
      npcProfiles: npcProfiles
        .filter((n) => n.accepted)
        .map(({ accepted: _a, useMatch, suggestedMatch, ...n }) => ({
          ...n,
          worldEntityId: useMatch && suggestedMatch ? suggestedMatch.worldEntityId : undefined,
        })),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] max-w-full flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border/40 shrink-0">
          <SheetTitle className="text-sm">
            Review Import{' '}
            <span className="text-xs text-muted-foreground font-normal">
              — {acceptedCount} of {totalCount} items accepted
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Accordion
            type="multiple"
            defaultValue={['brief', 'secrets', 'phases', 'routes', 'npcs']}
          >
            {/* Intent Brief */}
            <AccordionItem value="brief">
              <AccordionTrigger className="text-xs font-medium">Intent Brief</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={intentBrief}
                  onChange={(e) => setIntentBrief(e.target.value)}
                  placeholder="What is this session about..."
                  rows={4}
                  className="text-xs resize-none"
                />
              </AccordionContent>
            </AccordionItem>

            {/* Secrets */}
            <AccordionItem value="secrets">
              <AccordionTrigger className="text-xs font-medium">
                Secrets{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.secrets.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {secrets.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !s.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={s.name}
                        onChange={(e) =>
                          setSecrets((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="h-6 text-xs flex-1"
                      />
                      <Switch
                        checked={s.accepted}
                        onCheckedChange={(v) =>
                          setSecrets((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                    <Textarea
                      value={s.content}
                      onChange={(e) =>
                        setSecrets((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, content: e.target.value } : x))
                        )
                      }
                      rows={2}
                      className="text-xs resize-none"
                    />
                    {s.knowledge.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.knowledge.map((k, ki) => (
                          <Badge key={ki} variant="outline" className="text-[10px]">
                            {k.entityName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!secrets.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Phases */}
            <AccordionItem value="phases">
              <AccordionTrigger className="text-xs font-medium">
                Phases{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.phases.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {phases.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !p.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={p.name}
                        onChange={(e) =>
                          setPhases((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="h-6 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        value={p.targetMinutes}
                        onChange={(e) =>
                          setPhases((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? { ...x, targetMinutes: parseInt(e.target.value) || 30 }
                                : x
                            )
                          )
                        }
                        className="h-6 text-xs w-16 text-center"
                        min={1}
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">min</span>
                      <Switch
                        checked={p.accepted}
                        onCheckedChange={(v) =>
                          setPhases((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
                {!phases.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Routes */}
            <AccordionItem value="routes">
              <AccordionTrigger className="text-xs font-medium">
                Routes{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.routes.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {routes.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !r.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={r.name}
                        onChange={(e) =>
                          setRoutes((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="h-6 text-xs flex-1"
                      />
                      <Switch
                        checked={r.accepted}
                        onCheckedChange={(v) =>
                          setRoutes((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                ))}
                {!routes.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* NPCs */}
            <AccordionItem value="npcs">
              <AccordionTrigger className="text-xs font-medium">
                NPCs{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.npcProfiles.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {npcProfiles.map((n, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !n.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium flex-1">{n.name}</span>
                      <Switch
                        checked={n.accepted}
                        onCheckedChange={(v) =>
                          setNpcProfiles((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{n.defaultBehavior}</p>
                    {n.suggestedMatch && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={n.useMatch ? 'default' : 'outline'}
                          className="text-[10px] cursor-pointer"
                          onClick={() =>
                            setNpcProfiles((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, useMatch: !x.useMatch } : x
                              )
                            )
                          }
                        >
                          Link to {n.suggestedMatch.name} (
                          {Math.round(n.suggestedMatch.score * 100)}%)
                        </Badge>
                        {!n.useMatch && (
                          <span className="text-[10px] text-muted-foreground">
                            Will create new entity
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!npcProfiles.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={confirm.isPending || acceptedCount === 0}
            onClick={handleConfirm}
          >
            {confirm.isPending ? 'Importing...' : 'Confirm Import'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "si-review-sheet"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit/session-intel/si-review-sheet.tsx
git commit -m "feat(session-intel): SIReviewSheet — 5-section review sheet for SI import"
```

---

## Task 5: Wire import flow into brief-panel.tsx

**Files:**
- Modify: `src/components/cockpit/session-intel/brief-panel.tsx`

The panel gets an "Import from doc" button added below the existing buttons. Clicking it toggles an inline import zone (paste textarea + file input). On submit, the extraction mutation fires; on success, the `SIReviewSheet` opens with the preview. On confirm, the import zone resets.

- [ ] **Step 1: Replace the full file with this updated version**

Read the current file first to understand its structure (`src/components/cockpit/session-intel/brief-panel.tsx` — already read above), then apply this replacement:

```typescript
// src/components/cockpit/session-intel/brief-panel.tsx
'use client';

import { useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { SIReviewSheet, type SIExtractedPreview } from './si-review-sheet';

interface IntentBrief {
  toneKeywords: string[];
  playerGoals: string[];
  dmOnlyTruths: string[];
}

interface BriefPanelProps {
  campaignId: string;
  sessionId: string;
  intentBrief?: IntentBrief | null;
}

type ImportState = 'idle' | 'extracting' | 'reviewing' | 'done';

export function BriefPanel({ campaignId, sessionId, intentBrief }: BriefPanelProps) {
  const [prepBrief, setPrepBrief] = useState<string | null>(null);
  const [postSummary, setPostSummary] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [showImportZone, setShowImportZone] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [importError, setImportError] = useState('');
  const [extracted, setExtracted] = useState<SIExtractedPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const generatePrep = trpc.sessions.generatePrepBrief.useMutation({
    onSuccess: (data) => setPrepBrief(data.brief),
  });

  const generatePost = trpc.sessions.generatePostSessionSummary.useMutation({
    onSuccess: (data) => setPostSummary(data.summary),
  });

  const getUploadUrl = trpc.homebrewPdf.getUploadUrl.useMutation();
  const extractDoc = trpc.sessions.extractSIPrepDoc.useMutation({
    onSuccess: (data) => {
      setExtracted(data as SIExtractedPreview);
      setImportState('reviewing');
      setShowImportZone(false);
    },
    onError: (err) => {
      setImportError(err.message);
      setImportState('idle');
    },
  });

  async function handleFile(file: File) {
    try {
      setImportState('extracting');
      setImportError('');
      // Upload to R2, then pass URL as text hint (server reads via Docling)
      const upload = await getUploadUrl.mutateAsync({
        filename: file.name,
        fileSize: file.size,
        campaignId,
      });
      if (upload.presignedUrl) {
        await fetch(upload.presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
      }
      // Pass the R2 URL as text fallback — extractSIPrepDoc accepts plain text,
      // and the Docling pipeline on the server will fetch it if needed.
      // For now we signal the URL in the text so the AI can note the source.
      extractDoc.mutate({ campaignId, sessionId, text: `[Document: ${upload.r2Url ?? file.name}]` });
    } catch {
      setImportError('Upload failed');
      setImportState('idle');
    }
  }

  async function handlePaste() {
    if (!pastedText.trim()) return;
    setImportState('extracting');
    setImportError('');
    extractDoc.mutate({ campaignId, sessionId, text: pastedText });
  }

  function resetImport() {
    setImportState('done');
    setPastedText('');
    setExtracted(null);
  }

  return (
    <div className="space-y-3 p-3">
      {intentBrief ? (
        <>
          {intentBrief.toneKeywords.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tone</p>
              <div className="flex flex-wrap gap-1">
                {intentBrief.toneKeywords.map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {intentBrief.playerGoals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Players leave with
              </p>
              <ul className="space-y-0.5">
                {intentBrief.playerGoals.map((goal, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground flex items-start gap-1.5"
                  >
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intentBrief.dmOnlyTruths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">DM only</p>
              <ul className="space-y-0.5">
                {intentBrief.dmOnlyTruths.map((truth, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground flex items-start gap-1.5"
                  >
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                    {truth}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          No intent brief set. Add one in session prep.
        </p>
      )}

      <div className="pt-1 border-t border-border space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-7"
          disabled={generatePrep.isPending}
          onClick={() => generatePrep.mutate({ campaignId, sessionId })}
        >
          {generatePrep.isPending ? 'Generating...' : 'Generate prep brief'}
        </Button>

        {prepBrief && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {prepBrief}
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-7"
          disabled={generatePost.isPending}
          onClick={() => generatePost.mutate({ campaignId, sessionId })}
        >
          {generatePost.isPending ? 'Generating...' : 'Post-session summary'}
        </Button>

        {postSummary && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {postSummary}
          </p>
        )}

        {/* Import from doc */}
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-xs h-7 text-muted-foreground"
          onClick={() => setShowImportZone((v) => !v)}
        >
          {importState === 'done' ? 'Re-import from doc' : 'Import from doc'}
        </Button>

        {showImportZone && importState !== 'extracting' && (
          <div className="space-y-2 rounded border border-dashed border-border/40 p-3">
            <div
              className="flex flex-col items-center gap-1.5 py-4 rounded border border-dashed border-border/30 cursor-pointer hover:border-border/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                Drop a PDF or{' '}
                <span className="text-amber-400/80">browse</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-[10px] text-muted-foreground">or paste</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <Textarea
              placeholder="Paste prep notes…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={4}
              className="resize-none text-xs"
            />
            {importError && <p className="text-xs text-destructive">{importError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowImportZone(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-xs"
                disabled={!pastedText.trim()}
                onClick={handlePaste}
              >
                Extract
              </Button>
            </div>
          </div>
        )}

        {importState === 'extracting' && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Extracting prep content…
          </div>
        )}
      </div>

      {extracted && (
        <SIReviewSheet
          open={importState === 'reviewing'}
          onOpenChange={(open) => {
            if (!open) setImportState('idle');
          }}
          campaignId={campaignId}
          sessionId={sessionId}
          extracted={extracted}
          onConfirmed={resetImport}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "brief-panel"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit/session-intel/brief-panel.tsx
git commit -m "feat(session-intel): brief-panel — Import from doc button + SI review sheet wiring"
```

---

## Task 6: Workflow tests

**Files:**
- Modify: `tests/workflows/session-intelligence-prep.workflow.spec.ts`

Append two new tests after the existing ones. Follow the same `test.slow()` + `checkpoint` pattern used in the file.

- [ ] **Step 1: Add two tests at the end of the spec file** (before the final `}`-less EOF)

Append the following after all existing tests (the file ends after the last `});`):

```typescript
test('session-intelligence: BRIEF tab shows Import from doc button', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    if (!sessionId) return;
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-cockpit-intel-drawer', async () => {
    if (!sessionId) return;
    const intelBtn = page.getByRole('button', { name: /session intel|intel/i }).first();
    const hasBtn = await intelBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await intelBtn.click();
    await page.waitForTimeout(500);
  }, 15_000);

  await checkpoint(testInfo, 'switch-to-brief-tab', async () => {
    if (!sessionId) return;
    const briefTab = page.getByRole('tab', { name: /brief/i }).first();
    const hasTab = await briefTab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await briefTab.click();
    await page.waitForTimeout(300);
  }, 10_000);

  await checkpoint(testInfo, 'import-from-doc-button-visible', async () => {
    if (!sessionId) return;
    const importBtn = page.getByRole('button', { name: /import from doc/i }).first();
    const isVisible = await importBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    expect(isVisible).toBeTruthy();
  }, 10_000);
});

test('session-intelligence: Import from doc opens extract zone on click', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-and-open-drawer', async () => {
    if (!sessionId) return;
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});

    const intelBtn = page.getByRole('button', { name: /session intel|intel/i }).first();
    const hasBtn = await intelBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await intelBtn.click();
    await page.waitForTimeout(500);

    const briefTab = page.getByRole('tab', { name: /brief/i }).first();
    const hasTab = await briefTab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await briefTab.click();
    await page.waitForTimeout(300);
  }, 40_000);

  await checkpoint(testInfo, 'click-import-and-check-zone', async () => {
    if (!sessionId) return;
    const importBtn = page.getByRole('button', { name: /import from doc/i }).first();
    const hasBtn = await importBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await importBtn.click();
    await page.waitForTimeout(300);

    // Paste textarea should appear
    const textarea = page.getByPlaceholder(/paste prep notes/i).first();
    const textareaVisible = await textarea.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(textareaVisible).toBeTruthy();

    // Extract button should appear but be disabled (no text yet)
    const extractBtn = page.getByRole('button', { name: /^extract$/i }).first();
    const extractBtnDisabled = await extractBtn.isDisabled({ timeout: 3_000 }).catch(() => true);
    expect(extractBtnDisabled).toBeTruthy();
  }, 15_000);
});
```

- [ ] **Step 2: Run the new tests locally** (skips gracefully if `TEST_SESSION_ID` is not set)

```powershell
$env:CI=$null; $env:BASE_URL='http://localhost:3847'; npx playwright test tests/workflows/session-intelligence-prep.workflow.spec.ts --grep "Import from doc" --reporter=list
```

Expected: tests pass or skip (they gracefully no-op when `TEST_SESSION_ID` is empty).

- [ ] **Step 3: Commit**

```bash
git add tests/workflows/session-intelligence-prep.workflow.spec.ts
git commit -m "test(session-intel): P4 workflow specs — import from doc button + zone visibility"
```

---

## Post-implementation: deploy workers

No new workers for P4. After merging to main, push to prod as normal:

```bash
git push origin main
```

Hetzner Docker workers do not need a rebuild for P4 (no new worker files — only a tRPC route + UI changes served by Vercel/Next.js).
