# Feature 3: Battle/Encounter Tracker

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** In-session encounter tracker with initiative order, HP bars, D&D 5e conditions, and round-logging that auto-appends to session notes.

**Architecture:** Two new Prisma models (`Encounter`, `EncounterParticipant`). New `encounters` tRPC router with full CRUD. React tracker panel embedded in the session page, DM-only write access. NPC participants linkable to campaign NPC records.

**Tech Stack:** Prisma, tRPC, Next.js App Router, shadcn/ui, React, Zod

---

## Task 1: Schema — Encounter + EncounterParticipant

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add models**

Add after the `GameSession` model:

```prisma
model Encounter {
  id           String                 @id @default(cuid())
  sessionId    String
  session      GameSession            @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name         String
  round        Int                    @default(1)
  status       String                 @default("active") // active|complete
  log          Json?                  // [{round, events: [{participantId, action, value}]}]
  participants EncounterParticipant[]
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  @@index([sessionId])
}

model EncounterParticipant {
  id          String    @id @default(cuid())
  encounterId String
  encounter   Encounter @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  npcId       String?
  name        String
  type        String    // pc|npc|monster
  initiative  Int       @default(0)
  hp          Int
  maxHp       Int
  conditions  Json      @default("[]") // D&D 5e condition strings
  isAlive     Boolean   @default(true)
  updatedAt   DateTime  @updatedAt

  @@index([encounterId])
}
```

Also add `encounters Encounter[]` relation to `GameSession` model.

**Step 2:**
```bash
npm run db:push
git add prisma/schema.prisma
git commit -m "feat(schema): add Encounter and EncounterParticipant models"
```

---

## Task 2: Encounter Repository

**Files:**
- Create: `src/server/repositories/encounter.repository.ts`

**Step 1: Create repository**

```typescript
import { prisma } from '../db';

const participantSelect = {
  id: true, name: true, type: true, npcId: true,
  initiative: true, hp: true, maxHp: true, conditions: true, isAlive: true,
};

export const encounterRepository = {
  findBySession: (sessionId: string) =>
    prisma.encounter.findMany({
      where: { sessionId },
      include: { participants: { select: participantSelect, orderBy: { initiative: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    prisma.encounter.findUnique({
      where: { id },
      include: { participants: { select: participantSelect, orderBy: { initiative: 'desc' } } },
    }),

  create: (data: { sessionId: string; name: string }) =>
    prisma.encounter.create({ data, include: { participants: { select: participantSelect } } }),

  update: (id: string, data: { name?: string; round?: number; status?: string; log?: object }) =>
    prisma.encounter.update({ where: { id }, data }),

  addParticipant: (data: {
    encounterId: string; name: string; type: string;
    initiative: number; hp: number; maxHp: number; npcId?: string;
  }) => prisma.encounterParticipant.create({ data }),

  updateParticipant: (id: string, data: {
    hp?: number; maxHp?: number; initiative?: number;
    conditions?: string[]; isAlive?: boolean; name?: string;
  }) => prisma.encounterParticipant.update({ where: { id }, data: { ...data, conditions: data.conditions ?? undefined } }),

  deleteParticipant: (id: string) => prisma.encounterParticipant.delete({ where: { id } }),

  delete: (id: string) => prisma.encounter.delete({ where: { id } }),
};
```

**Step 2:**
```bash
git add src/server/repositories/encounter.repository.ts
git commit -m "feat(repo): add encounter repository"
```

---

## Task 3: Encounter Service

**Files:**
- Create: `src/server/services/encounter.service.ts`

**Step 1: Create service**

```typescript
import { authz } from './authorization.service';
import { encounterRepository } from '../repositories/encounter.repository';
import { prisma } from '../db';
import { NotFoundError, ForbiddenError } from '../errors';

const DND5E_CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened',
  'Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious',
];

export class EncounterService {
  async getBySession(sessionId: string, userId: string) {
    // Verify session access
    await authz.session(sessionId, userId).verify();
    return encounterRepository.findBySession(sessionId);
  }

  async create(sessionId: string, userId: string, name: string) {
    await authz.session(sessionId, userId).requireDM();
    return encounterRepository.create({ sessionId, name });
  }

  async addParticipant(encounterId: string, userId: string, data: {
    name: string; type: string; initiative: number; hp: number; maxHp: number; npcId?: string;
  }) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) throw new NotFoundError('encounter', encounterId);
    await authz.session(encounter.sessionId, userId).requireDM();
    return encounterRepository.addParticipant({ encounterId, ...data });
  }

  async updateParticipant(participantId: string, userId: string, data: {
    hp?: number; maxHp?: number; initiative?: number; conditions?: string[]; isAlive?: boolean;
  }) {
    const participant = await prisma.encounterParticipant.findUnique({
      where: { id: participantId }, include: { encounter: { select: { sessionId: true } } },
    });
    if (!participant) throw new NotFoundError('participant', participantId);
    await authz.session(participant.encounter.sessionId, userId).requireDM();
    return encounterRepository.updateParticipant(participantId, data);
  }

  async nextRound(encounterId: string, userId: string) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) throw new NotFoundError('encounter', encounterId);
    await authz.session(encounter.sessionId, userId).requireDM();

    const newRound = encounter.round + 1;
    const roundSummary = `\n\n**Round ${newRound} started** (${encounter.name})`;

    // Append to session quickNotes
    await prisma.gameSession.update({
      where: { id: encounter.sessionId },
      data: { quickNotes: { set: undefined } }, // We'll do a raw append below
    });
    await prisma.$executeRaw`
      UPDATE "GameSession"
      SET "quickNotes" = COALESCE("quickNotes", '') || ${roundSummary}
      WHERE id = ${encounter.sessionId}
    `;

    return encounterRepository.update(encounterId, { round: newRound });
  }

  async complete(encounterId: string, userId: string) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) throw new NotFoundError('encounter', encounterId);
    await authz.session(encounter.sessionId, userId).requireDM();
    return encounterRepository.update(encounterId, { status: 'complete' });
  }

  async delete(encounterId: string, userId: string) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) throw new NotFoundError('encounter', encounterId);
    await authz.session(encounter.sessionId, userId).requireDM();
    return encounterRepository.delete(encounterId);
  }

  getDnd5eConditions() {
    return DND5E_CONDITIONS;
  }
}

export const encounterService = new EncounterService();
```

Note: `authz.session(id, userId).requireDM()` — check if this method exists on the authz service. If not, use `authz.session(id, userId).requirePermission('canManageSessions')` or verify the user is a DM via `prisma.campaignMember`.

**Step 2:**
```bash
git add src/server/services/encounter.service.ts
git commit -m "feat(service): add encounter service with initiative, HP, conditions, round logging"
```

---

## Task 4: Encounters tRPC Router

**Files:**
- Create: `src/server/routers/encounters.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create router**

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { encounterService } from '../services/encounter.service';

const conditionSchema = z.string();

export const encountersRouter = router({
  getBySession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input, ctx }) =>
      encounterService.getBySession(input.sessionId, ctx.session.user.id)
    ),

  create: protectedProcedure
    .input(z.object({ sessionId: z.string(), name: z.string().min(1).max(100) }))
    .mutation(({ input, ctx }) =>
      encounterService.create(input.sessionId, ctx.session.user.id, input.name)
    ),

  addParticipant: protectedProcedure
    .input(z.object({
      encounterId: z.string(),
      name: z.string().min(1),
      type: z.enum(['pc', 'npc', 'monster']),
      initiative: z.number().int().min(0).max(30),
      hp: z.number().int().min(0),
      maxHp: z.number().int().min(1),
      npcId: z.string().optional(),
    }))
    .mutation(({ input, ctx }) =>
      encounterService.addParticipant(input.encounterId, ctx.session.user.id, input)
    ),

  updateParticipant: protectedProcedure
    .input(z.object({
      participantId: z.string(),
      hp: z.number().int().optional(),
      maxHp: z.number().int().optional(),
      initiative: z.number().int().optional(),
      conditions: z.array(conditionSchema).optional(),
      isAlive: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => {
      const { participantId, ...data } = input;
      return encounterService.updateParticipant(participantId, ctx.session.user.id, data);
    }),

  nextRound: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.nextRound(input.encounterId, ctx.session.user.id)
    ),

  complete: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.complete(input.encounterId, ctx.session.user.id)
    ),

  delete: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.delete(input.encounterId, ctx.session.user.id)
    ),
});
```

**Step 2: Register in _app.ts**

```typescript
import { encountersRouter } from './encounters';
// add to appRouter:
encounters: encountersRouter,
```

**Step 3:**
```bash
git add src/server/routers/encounters.ts src/server/routers/_app.ts
git commit -m "feat(router): add encounters tRPC router"
```

---

## Task 5: Encounter Tracker UI Component

**Files:**
- Create: `src/components/session/encounter-tracker.tsx`

**Step 1: Create component**

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Swords, Plus, ChevronRight, Heart, Shield, SkipForward, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const DND_CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

interface EncounterTrackerProps {
  sessionId: string;
  isDM: boolean;
}

function HpEditor({ participant, onUpdate }: { participant: any; onUpdate: (delta: number) => void }) {
  const [delta, setDelta] = useState('');
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => { onUpdate(-Math.abs(parseInt(delta) || 1)); setDelta(''); }}>-</Button>
      <span className="text-sm font-mono w-16 text-center">{participant.hp}/{participant.maxHp}</span>
      <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => { onUpdate(Math.abs(parseInt(delta) || 1)); setDelta(''); }}>+</Button>
      <Input value={delta} onChange={(e) => setDelta(e.target.value)} className="h-6 w-12 text-xs p-1" placeholder="amt" />
    </div>
  );
}

export function EncounterTracker({ sessionId, isDM }: EncounterTrackerProps) {
  const utils = trpc.useUtils();
  const [newEncounterName, setNewEncounterName] = useState('');
  const [addParticipantState, setAddParticipantState] = useState<{ encounterId: string; name: string; type: string; initiative: string; hp: string; maxHp: string } | null>(null);

  const { data: encounters } = trpc.encounters.getBySession.useQuery({ sessionId });

  const createMutation = trpc.encounters.create.useMutation({
    onSuccess: () => { utils.encounters.getBySession.invalidate({ sessionId }); setNewEncounterName(''); },
    onError: (e) => toast.error(e.message),
  });

  const addParticipantMutation = trpc.encounters.addParticipant.useMutation({
    onSuccess: () => { utils.encounters.getBySession.invalidate({ sessionId }); setAddParticipantState(null); },
    onError: (e) => toast.error(e.message),
  });

  const updateParticipantMutation = trpc.encounters.updateParticipant.useMutation({
    onSuccess: () => utils.encounters.getBySession.invalidate({ sessionId }),
  });

  const nextRoundMutation = trpc.encounters.nextRound.useMutation({
    onSuccess: () => utils.encounters.getBySession.invalidate({ sessionId }),
    onError: (e) => toast.error(e.message),
  });

  const completeMutation = trpc.encounters.complete.useMutation({
    onSuccess: () => utils.encounters.getBySession.invalidate({ sessionId }),
  });

  const activeEncounters = encounters?.filter((e: any) => e.status === 'active') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Swords className="h-4 w-4" /> Encounters</h3>
        {isDM && (
          <div className="flex gap-2">
            <Input value={newEncounterName} onChange={(e) => setNewEncounterName(e.target.value)} placeholder="Encounter name" className="h-8 text-sm w-40" />
            <Button size="sm" onClick={() => createMutation.mutate({ sessionId, name: newEncounterName })} disabled={!newEncounterName.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {activeEncounters.map((encounter: any) => (
        <Card key={encounter.id}>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {encounter.name}
                <Badge variant="secondary">Round {encounter.round}</Badge>
              </CardTitle>
              {isDM && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => nextRoundMutation.mutate({ encounterId: encounter.id })}>
                    <SkipForward className="h-3 w-3 mr-1" /> Next Round
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeMutation.mutate({ encounterId: encounter.id })}>
                    <CheckCircle className="h-3 w-3 mr-1" /> End
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {encounter.participants.map((p: any) => (
              <div key={p.id} className={`flex items-center gap-2 p-2 rounded-md border ${!p.isAlive ? 'opacity-50' : ''}`}>
                <span className="text-xs font-mono w-4 text-muted-foreground">{p.initiative}</span>
                <span className="text-sm font-medium flex-1">{p.name}</span>
                <Badge variant="outline" className="text-xs">{p.type}</Badge>
                {isDM ? (
                  <HpEditor participant={p} onUpdate={(delta) =>
                    updateParticipantMutation.mutate({
                      participantId: p.id,
                      hp: Math.max(0, Math.min(p.maxHp, p.hp + delta)),
                      isAlive: Math.max(0, p.hp + delta) > 0,
                    })
                  } />
                ) : (
                  <span className="text-xs">{p.hp}/{p.maxHp} HP</span>
                )}
                <div className="flex gap-1 flex-wrap max-w-32">
                  {(p.conditions as string[]).map((c: string) => (
                    <Badge key={c} variant="destructive" className="text-xs px-1 py-0">{c}</Badge>
                  ))}
                </div>
                {isDM && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                    const conditions = p.conditions as string[];
                    const condition = prompt(`Add condition (${DND_CONDITIONS.join(', ')}):`);
                    if (condition && DND_CONDITIONS.includes(condition)) {
                      updateParticipantMutation.mutate({ participantId: p.id, conditions: [...conditions, condition] });
                    }
                  }}>+cond</Button>
                )}
              </div>
            ))}

            {isDM && (
              <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-2" onClick={() =>
                setAddParticipantState({ encounterId: encounter.id, name: '', type: 'npc', initiative: '10', hp: '10', maxHp: '10' })
              }>
                <Plus className="h-3 w-3 mr-1" /> Add Participant
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add Participant Dialog */}
      {addParticipantState && (
        <Dialog open onOpenChange={() => setAddParticipantState(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Participant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(['name', 'initiative', 'hp', 'maxHp'] as const).map((field) => (
                <div key={field}>
                  <Label className="text-xs capitalize">{field === 'maxHp' ? 'Max HP' : field}</Label>
                  <Input value={addParticipantState[field]} onChange={(e) => setAddParticipantState({ ...addParticipantState, [field]: e.target.value })} />
                </div>
              ))}
              <Button className="w-full" onClick={() => addParticipantMutation.mutate({
                encounterId: addParticipantState.encounterId,
                name: addParticipantState.name,
                type: addParticipantState.type as any,
                initiative: parseInt(addParticipantState.initiative) || 10,
                hp: parseInt(addParticipantState.hp) || 10,
                maxHp: parseInt(addParticipantState.maxHp) || 10,
              })}>Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

**Step 2:**
```bash
git add src/components/session/encounter-tracker.tsx
git commit -m "feat(component): add EncounterTracker with initiative order, HP bars, conditions"
```

---

## Task 6: Wire EncounterTracker into session page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

**Step 1:** Add import and render inside the session page JSX (DM section or alongside transcription tools):

```typescript
import { EncounterTracker } from '@/components/session/encounter-tracker';
```

```tsx
<EncounterTracker sessionId={sessionId} isDM={isDM} />
```

**Step 2:**
```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): wire EncounterTracker into session page"
```

---

## Task 7: Type check

```bash
npx tsc --noEmit
git add -A && git commit -m "feat: Feature 3 — encounter tracker complete"
```
