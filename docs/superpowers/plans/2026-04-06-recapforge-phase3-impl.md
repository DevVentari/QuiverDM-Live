# RecapForge Phase 3 — Speaker Mapping Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist speaker-label → character mappings per campaign, auto-apply on new multi-track transcripts, and surface a mapping UI inline after upload completes.

**Architecture:** A pure utility function handles label substitution and is tested independently. A new `speakerMapping` tRPC router (3 procedures) persists and applies mappings. The multi-track worker fetches existing mappings before creating a new Transcript and substitutes names directly. `MultiTrackProgress` transitions to a `SpeakerMappingStep` component when transcription completes.

**Tech Stack:** Next.js 15, tRPC v11, Prisma (PostgreSQL), BullMQ worker, shadcn/ui (Select, Checkbox, Button), Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/recap/speaker-mapping-utils.ts` | Create | Pure function: apply label→name lookup to transcript data |
| `src/server/routers/speaker-mapping.ts` | Create | tRPC router: getByCampaign, upsert, applyToTranscript |
| `src/components/recap/speaker-mapping-step.tsx` | Create | UI: per-speaker character dropdown + isDM checkbox |
| `tests/unit/recap/speaker-mapping.test.ts` | Create | Unit tests for the pure mapping utility |
| `src/server/routers/_app.ts` | Modify | Register speakerMapping router |
| `src/server/routers/multi-track-upload.ts` | Modify | getStatus: add sessionId input, transcriptId response |
| `src/lib/queue/multi-track-worker.ts` | Modify | Fetch + apply mappings when creating Transcript |
| `src/components/recap/multi-track-progress.tsx` | Modify | Add sessionId prop; transition to SpeakerMappingStep on complete |
| `tests/workflows/recapforge-multi-track.workflow.spec.ts` | Modify | Add test.fixme stub for speaker mapping step |

---

## Task 1: Utility Function + Unit Tests

**Files:**
- Create: `src/lib/recap/speaker-mapping-utils.ts`
- Create: `tests/unit/recap/speaker-mapping.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/recap/speaker-mapping.test.ts
import { describe, it, expect } from 'vitest';
import { applyMappingsToTranscriptData } from '../../../src/lib/recap/speaker-mapping-utils';

type SpeakerEntry = { id: string; name: string; segments: number };
type TimestampEntry = { start: number; end: number; text: string; speaker: string };

const speakers: SpeakerEntry[] = [
  { id: 'S0', name: 'Speaker 0', segments: 3 },
  { id: 'S1', name: 'Speaker 1', segments: 2 },
];

const timestamps: TimestampEntry[] = [
  { start: 0, end: 1000, text: 'Hello', speaker: 'Speaker 0' },
  { start: 1500, end: 2500, text: 'World', speaker: 'Speaker 1' },
  { start: 3000, end: 4000, text: 'Again', speaker: 'Speaker 0' },
];

describe('applyMappingsToTranscriptData', () => {
  it('replaces speaker labels in both speakers and timestamps arrays', () => {
    const lookup = new Map([
      ['Speaker 0', 'Aria Dawnbringer'],
      ['Speaker 1', 'Tharyn Ashveil'],
    ]);
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].name).toBe('Aria Dawnbringer');
    expect(result.speakers[1].name).toBe('Tharyn Ashveil');
    expect(result.timestamps[0].speaker).toBe('Aria Dawnbringer');
    expect(result.timestamps[1].speaker).toBe('Tharyn Ashveil');
    expect(result.timestamps[2].speaker).toBe('Aria Dawnbringer');
  });

  it('leaves unmapped labels unchanged', () => {
    const lookup = new Map<string, string>();
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].name).toBe('Speaker 0');
    expect(result.timestamps[1].speaker).toBe('Speaker 1');
  });

  it('partially maps when only some speakers have mappings', () => {
    const lookup = new Map([['Speaker 0', 'Aria Dawnbringer']]);
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].name).toBe('Aria Dawnbringer');
    expect(result.speakers[1].name).toBe('Speaker 1');
    expect(result.timestamps[0].speaker).toBe('Aria Dawnbringer');
    expect(result.timestamps[1].speaker).toBe('Speaker 1');
  });

  it('does not mutate input arrays', () => {
    const lookup = new Map([['Speaker 0', 'Aria Dawnbringer']]);
    applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(speakers[0].name).toBe('Speaker 0');
    expect(timestamps[0].speaker).toBe('Speaker 0');
  });

  it('preserves all other fields on entries', () => {
    const lookup = new Map([['Speaker 0', 'Aria Dawnbringer']]);
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].id).toBe('S0');
    expect(result.speakers[0].segments).toBe(3);
    expect(result.timestamps[0].start).toBe(0);
    expect(result.timestamps[0].text).toBe('Hello');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/recap/speaker-mapping.test.ts
```

Expected: FAIL with `Cannot find module '../../../src/lib/recap/speaker-mapping-utils'`

- [ ] **Step 3: Implement the utility function**

```ts
// src/lib/recap/speaker-mapping-utils.ts

export type SpeakerEntry = { id: string; name: string; segments: number };
export type TimestampEntry = { start: number; end: number; text: string; speaker: string };

export function applyMappingsToTranscriptData(
  speakers: SpeakerEntry[],
  timestamps: TimestampEntry[],
  lookup: Map<string, string>
): { speakers: SpeakerEntry[]; timestamps: TimestampEntry[] } {
  return {
    speakers: speakers.map((s) => ({
      ...s,
      name: lookup.get(s.name) ?? s.name,
    })),
    timestamps: timestamps.map((t) => ({
      ...t,
      speaker: lookup.get(t.speaker) ?? t.speaker,
    })),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/recap/speaker-mapping.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/recap/speaker-mapping-utils.ts tests/unit/recap/speaker-mapping.test.ts
git commit -m "feat(recapforge): speaker mapping utility + unit tests"
```

---

## Task 2: `speakerMapping` tRPC Router

**Files:**
- Create: `src/server/routers/speaker-mapping.ts`

**Context:**
- `campaignDMProcedure` is imported from `'../trpc'` — it validates `campaignId` in the input and verifies the caller is a DM/owner of that campaign.
- `prisma` singleton: `import { prisma } from '@/lib/prisma'`
- `TRPCError` from `'@trpc/server'`
- `SpeakerMapping` already exists in the Prisma schema with `@@unique([campaignId, speakerLabel])`
- `Transcript.speakers` and `Transcript.timestamps` are `Json?` fields — cast them to typed arrays

- [ ] **Step 1: Create the router file**

```ts
// src/server/routers/speaker-mapping.ts
import { router } from '../trpc';
import { campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';
import {
  applyMappingsToTranscriptData,
  type SpeakerEntry,
  type TimestampEntry,
} from '@/lib/recap/speaker-mapping-utils';

export const speakerMappingRouter = router({
  getByCampaign: campaignDMProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      return prisma.speakerMapping.findMany({
        where: { campaignId: input.campaignId },
        orderBy: { speakerLabel: 'asc' },
      });
    }),

  upsert: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        speakerLabel: z.string().min(1).max(100),
        characterId: z.string().optional(),
        characterName: z.string().max(100),
        isDM: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.speakerMapping.upsert({
        where: {
          campaignId_speakerLabel: {
            campaignId: input.campaignId,
            speakerLabel: input.speakerLabel,
          },
        },
        create: {
          campaignId: input.campaignId,
          speakerLabel: input.speakerLabel,
          characterId: input.characterId ?? null,
          characterName: input.characterName,
          isDM: input.isDM,
        },
        update: {
          characterId: input.characterId ?? null,
          characterName: input.characterName,
          isDM: input.isDM,
        },
      });
    }),

  applyToTranscript: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        transcriptId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Security: verify the transcript belongs to a session in this campaign
      const transcript = await prisma.transcript.findFirst({
        where: {
          id: input.transcriptId,
          session: { campaignId: input.campaignId },
        },
        select: { id: true, speakers: true, timestamps: true },
      });

      if (!transcript) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Transcript not found' });
      }

      // No speakers/timestamps to patch
      if (!Array.isArray(transcript.speakers) || !Array.isArray(transcript.timestamps)) {
        return { updated: false };
      }

      const mappingRows = await prisma.speakerMapping.findMany({
        where: { campaignId: input.campaignId },
        select: { speakerLabel: true, characterName: true },
      });

      const lookup = new Map(mappingRows.map((m) => [m.speakerLabel, m.characterName]));

      const { speakers, timestamps } = applyMappingsToTranscriptData(
        transcript.speakers as SpeakerEntry[],
        transcript.timestamps as TimestampEntry[],
        lookup
      );

      await prisma.transcript.update({
        where: { id: input.transcriptId },
        data: { speakers, timestamps },
      });

      return { updated: true };
    }),
});
```

- [ ] **Step 2: Type-check the router**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `speaker-mapping.ts`

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/speaker-mapping.ts
git commit -m "feat(recapforge): speakerMapping tRPC router"
```

---

## Task 3: Register Router + Update `getStatus`

**Files:**
- Modify: `src/server/routers/_app.ts`
- Modify: `src/server/routers/multi-track-upload.ts`

- [ ] **Step 1: Register the router in `_app.ts`**

Add at line 40 (after existing imports, before `multiTrackUploadRouter`):

```ts
import { speakerMappingRouter } from './speaker-mapping';
```

Add to the `appRouter` object after `multiTrackUpload`:

```ts
speakerMapping: speakerMappingRouter,
```

- [ ] **Step 2: Update `getStatus` in `multi-track-upload.ts`**

The current `getStatus` procedure (starts at line 122) takes `{ campaignId, uploadGroupId }`. Update it to also accept `sessionId` and return `transcriptId`.

Replace the `getStatus` procedure entirely:

```ts
getStatus: campaignDMProcedure
  .input(
    z.object({
      campaignId: z.string(),
      uploadGroupId: z.string().min(1).max(50),
      sessionId: z.string(),
    })
  )
  .query(async ({ input }) => {
    const recordings = await prisma.sessionRecording.findMany({
      where: {
        uploadGroupId: input.uploadGroupId,
        session: { campaignId: input.campaignId },
      },
      select: {
        id: true,
        mergeStatus: true,
        speakerTag: true,
        fileSize: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const total = recordings.length;
    const done = recordings.filter((r) => r.mergeStatus === 'complete').length;
    const failed = recordings.filter((r) => r.mergeStatus === 'failed').length;

    const overallStatus =
      failed > 0 ? 'failed'
      : done === total && total > 0 ? 'complete'
      : recordings.some((r) => r.mergeStatus === 'processing') ? 'processing'
      : 'pending';

    // Resolve transcriptId once processing is complete
    let transcriptId: string | null = null;
    if (overallStatus === 'complete') {
      const transcript = await prisma.transcript.findFirst({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      transcriptId = transcript?.id ?? null;
    }

    return { recordings, total, done, failed, overallStatus, transcriptId };
  }),
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/_app.ts src/server/routers/multi-track-upload.ts
git commit -m "feat(recapforge): register speakerMapping router; getStatus returns transcriptId"
```

---

## Task 4: Worker Auto-Apply

**Files:**
- Modify: `src/lib/queue/multi-track-worker.ts`

**Context:**
- File currently at `src/lib/queue/multi-track-worker.ts`
- `prisma` is already imported from `'../prisma'`
- `campaignId` is already available from `job.data`
- The `speakersJson` array and `segments` are built in step 5 of `processMultiTrack`
- Import `applyMappingsToTranscriptData` from `'../recap/speaker-mapping-utils'`

- [ ] **Step 1: Add import at top of file**

After the existing imports (after line 27), add:

```ts
import { applyMappingsToTranscriptData } from '../recap/speaker-mapping-utils';
```

- [ ] **Step 2: Fetch mappings after loading recordings (after line 112)**

After the `wordBoost` line (line 112 in original), add:

```ts
// Fetch existing speaker mappings — best-effort, never blocks transcription
let mappingLookup = new Map<string, string>();
try {
  const existingMappings = await prisma.speakerMapping.findMany({
    where: { campaignId },
    select: { speakerLabel: true, characterName: true },
  });
  mappingLookup = new Map(existingMappings.map((m) => [m.speakerLabel, m.characterName]));
} catch (err) {
  console.warn('[MultiTrackWorker] Failed to load speaker mappings, continuing without:', err);
}
```

- [ ] **Step 3: Apply mappings when building transcript data**

In the section that builds `speakersJson` (after `mergeTranscripts`), replace:

```ts
const uniqueSpeakers = [...new Set(tracks.map((t) => t.speakerTag))];
const speakersJson = uniqueSpeakers.map((name, i) => ({
  id: `S${i}`,
  name,
  segments: segments.filter((s) => s.speaker === name).length,
}));
```

With:

```ts
const uniqueSpeakers = [...new Set(tracks.map((t) => t.speakerTag))];
const rawSpeakers = uniqueSpeakers.map((name, i) => ({
  id: `S${i}`,
  name,
  segments: segments.filter((s) => s.speaker === name).length,
}));
const rawTimestamps = segments.map((s) => ({
  start: s.start,
  end: s.end,
  text: s.text,
  speaker: s.speaker,
}));

const { speakers: speakersJson, timestamps: resolvedTimestamps } = applyMappingsToTranscriptData(
  rawSpeakers,
  rawTimestamps,
  mappingLookup
);
```

- [ ] **Step 4: Use `resolvedTimestamps` in transcript.create**

In the `prisma.transcript.create` call, replace the `timestamps` field:

```ts
// BEFORE:
timestamps: segments.map((s) => ({
  start: s.start,
  end: s.end,
  text: s.text,
  speaker: s.speaker,
})),

// AFTER:
timestamps: resolvedTimestamps,
```

Also update `durationSeconds` to use `resolvedTimestamps` (it still accesses `segments` for end time — keep that as-is since `segments` is still in scope):

```ts
durationSeconds:
  segments.length > 0
    ? Math.round(segments[segments.length - 1].end / 1000)
    : 0,
```

This is unchanged — `segments` is still the raw merged array and its timing is correct regardless of name substitution.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/queue/multi-track-worker.ts
git commit -m "feat(recapforge): worker auto-applies speaker mappings on transcript create"
```

---

## Task 5: `SpeakerMappingStep` Component

**Files:**
- Create: `src/components/recap/speaker-mapping-step.tsx`

**Context:**
- Uses `trpc.speakerMapping.getByCampaign` and `trpc.characters.getCampaignCharacters`
- `characters.getCampaignCharacters` returns `Array<{ character: { id: string; name: string; ... }, ... }>`
- shadcn components: `Button`, `Checkbox`, `Select/SelectContent/SelectItem/SelectTrigger/SelectValue`
- Lucide icons: `Loader2`, `Mic`
- Design: dark theme — `border-white/10 bg-white/5`, amber CTA, `text-white/60`

- [ ] **Step 1: Create the component**

```tsx
// src/components/recap/speaker-mapping-step.tsx
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mic } from 'lucide-react';

interface SpeakerMappingStepProps {
  campaignId: string;
  transcriptId: string;
  speakerLabels: string[];
  onComplete: () => void;
}

interface MappingRow {
  speakerLabel: string;
  characterId: string;
  characterName: string;
  isDM: boolean;
  error?: string;
}

export function SpeakerMappingStep({
  campaignId,
  transcriptId,
  speakerLabels,
  onComplete,
}: SpeakerMappingStepProps) {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: existingMappings } = trpc.speakerMapping.getByCampaign.useQuery({ campaignId });
  const { data: characters } = trpc.characters.getCampaignCharacters.useQuery({ campaignId });

  const upsert = trpc.speakerMapping.upsert.useMutation();
  const applyToTranscript = trpc.speakerMapping.applyToTranscript.useMutation();

  // Initialize rows once existing mappings are loaded
  useEffect(() => {
    if (existingMappings === undefined) return;
    const existingMap = new Map(existingMappings.map((m) => [m.speakerLabel, m]));
    setRows(
      speakerLabels.map((label) => {
        const existing = existingMap.get(label);
        return {
          speakerLabel: label,
          characterId: existing?.characterId ?? '',
          characterName: existing?.characterName ?? '',
          isDM: existing?.isDM ?? false,
        };
      })
    );
  }, [existingMappings, speakerLabels]);

  const updateRow = (index: number, patch: Partial<MappingRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch, error: undefined } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    const errors: Record<number, string> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip rows with no mapping
      if (!row.characterId && !row.isDM) continue;
      try {
        await upsert.mutateAsync({
          campaignId,
          speakerLabel: row.speakerLabel,
          characterId: row.characterId || undefined,
          characterName: row.isDM ? 'DM' : row.characterName,
          isDM: row.isDM,
        });
      } catch (err) {
        errors[i] = String(err);
      }
    }

    if (Object.keys(errors).length > 0) {
      setRows((prev) => prev.map((r, i) => ({ ...r, error: errors[i] })));
      setSaving(false);
      return;
    }

    // Best-effort patch — failure is logged but never blocks the user
    try {
      await applyToTranscript.mutateAsync({ campaignId, transcriptId });
    } catch (err) {
      console.error('[SpeakerMappingStep] applyToTranscript failed:', err);
    }

    onComplete();
  };

  if (existingMappings === undefined || characters === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-white/80">Map Speakers to Characters</p>
        <p className="mt-0.5 text-xs text-white/40">
          Saved for this campaign — applied automatically in future sessions.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.speakerLabel}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <Mic className="h-4 w-4 shrink-0 text-amber-500/60" />
            <span className="w-28 shrink-0 truncate text-sm text-white/70">{row.speakerLabel}</span>

            <Select
              value={row.characterId}
              onValueChange={(val) => {
                const char = characters.find((c) => c.character.id === val);
                updateRow(i, {
                  characterId: val,
                  characterName: char?.character.name ?? '',
                  isDM: false,
                });
              }}
              disabled={row.isDM || saving}
            >
              <SelectTrigger className="h-7 flex-1 border-white/10 bg-white/5 text-xs">
                <SelectValue
                  placeholder={
                    characters.length === 0 ? 'No characters added' : 'Select character…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {characters.map((cc) => (
                  <SelectItem key={cc.character.id} value={cc.character.id}>
                    {cc.character.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex shrink-0 items-center gap-1.5">
              <Checkbox
                id={`dm-${i}`}
                checked={row.isDM}
                onCheckedChange={(checked) =>
                  updateRow(i, {
                    isDM: !!checked,
                    characterId: checked ? '' : row.characterId,
                    characterName: checked ? '' : row.characterName,
                  })
                }
                disabled={saving}
              />
              <label htmlFor={`dm-${i}`} className="cursor-pointer text-xs text-white/50">
                DM
              </label>
            </div>

            {row.error && <span className="shrink-0 text-xs text-red-400">✗</span>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-amber-500 text-black hover:bg-amber-400"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save & Continue'
          )}
        </Button>
        <button
          onClick={onComplete}
          disabled={saving}
          className="text-sm text-white/30 hover:text-white/60"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in the new file

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/speaker-mapping-step.tsx
git commit -m "feat(recapforge): SpeakerMappingStep component"
```

---

## Task 6: Update `MultiTrackProgress`

**Files:**
- Modify: `src/components/recap/multi-track-progress.tsx`

**Context:**
- Current file is 90 lines. Full replacement shown below.
- `getStatus` now requires `sessionId` in input and returns `transcriptId: string | null`.
- Remove the `useRef(false)` guard — replaced by `showMapping` state.
- When `overallStatus === 'complete'`, set `showMapping = true` and render `SpeakerMappingStep`.
- Parent components that use this will need to add `sessionId` to props — but as of this task no parent has been wired up yet, so only the component itself needs updating.

- [ ] **Step 1: Replace `multi-track-progress.tsx`**

```tsx
// src/components/recap/multi-track-progress.tsx
'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, Mic } from 'lucide-react';
import { SpeakerMappingStep } from './speaker-mapping-step';

interface MultiTrackProgressProps {
  uploadGroupId: string;
  campaignId: string;
  sessionId: string;
  onComplete: () => void;
}

export function MultiTrackProgress({
  uploadGroupId,
  campaignId,
  sessionId,
  onComplete,
}: MultiTrackProgressProps) {
  const [showMapping, setShowMapping] = useState(false);

  const { data } = trpc.multiTrackUpload.getStatus.useQuery(
    { campaignId, uploadGroupId, sessionId },
    {
      refetchInterval: (query) => {
        const status = (query.state.data as { overallStatus?: string } | undefined)?.overallStatus;
        return status === 'complete' || status === 'failed' ? false : 3000;
      },
    }
  );

  useEffect(() => {
    if (data?.overallStatus === 'complete' && !showMapping) {
      setShowMapping(true);
    }
  }, [data?.overallStatus, showMapping]);

  // Transition to speaker mapping once complete
  if (showMapping && data && data.transcriptId) {
    const speakerLabels = (
      data.recordings as Array<{ speakerTag?: string | null }>
    ).map((r, i) => r.speakerTag ?? `Track ${i + 1}`);

    return (
      <SpeakerMappingStep
        campaignId={campaignId}
        transcriptId={data.transcriptId}
        speakerLabels={speakerLabels}
        onComplete={onComplete}
      />
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing…
      </div>
    );
  }

  const progressPct =
    data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/40">
          <span>
            {data.overallStatus === 'complete'
              ? 'All tracks transcribed'
              : data.overallStatus === 'failed'
              ? 'Some tracks failed'
              : `Transcribing ${data.done} of ${data.total}…`}
          </span>
          <span>{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-1" />
      </div>

      <div className="space-y-1">
        {(
          data.recordings as Array<{
            id: string;
            mergeStatus: string;
            speakerTag?: string | null;
          }>
        ).map((rec, i) => (
          <div key={rec.id} className="flex items-center gap-2 text-sm text-white/60">
            {rec.mergeStatus === 'complete' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : rec.mergeStatus === 'failed' ? (
              <XCircle className="h-4 w-4 text-red-400" />
            ) : rec.mergeStatus === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <Mic className="h-4 w-4 text-white/20" />
            )}
            <span className="flex-1 truncate">{rec.speakerTag ?? `Track ${i + 1}`}</span>
            <span className="text-xs capitalize text-white/30">{rec.mergeStatus}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/multi-track-progress.tsx
git commit -m "feat(recapforge): MultiTrackProgress transitions to SpeakerMappingStep on complete"
```

---

## Task 7: Workflow Spec Stub + Final Check

**Files:**
- Modify: `tests/workflows/recapforge-multi-track.workflow.spec.ts`

- [ ] **Step 1: Add the fixme stub**

Read the current file and append at the end of the last `test.describe` block:

```ts
test.fixme(
  'speaker mapping step appears and saves to campaign after transcription completes',
  async ({ page }) => {
    // Phase 3 UI — requires worker + real R2 in E2E env
    // Expected flow:
    // 1. Multi-track upload completes (overallStatus = 'complete')
    // 2. SpeakerMappingStep renders inline
    // 3. DM selects character from dropdown for each speaker
    // 4. Clicks "Save & Continue"
    // 5. speakerMapping.upsert called per row
    // 6. speakerMapping.applyToTranscript called
    // 7. onComplete fires
  }
);
```

- [ ] **Step 2: Run all unit tests**

```bash
npx vitest run tests/unit/
```

Expected: all tests pass including the 5 new speaker-mapping tests

- [ ] **Step 3: Run full type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add tests/workflows/recapforge-multi-track.workflow.spec.ts
git commit -m "test(recapforge): add Phase 3 speaker mapping workflow spec stub"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```
