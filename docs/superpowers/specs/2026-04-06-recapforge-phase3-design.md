# RecapForge Phase 3 — Speaker Mapping Persistence Design

## Overview

After a multi-track upload completes, the DM maps each speaker label (e.g. "Speaker 0", or a custom speakerTag) to a player character or marks them as DM. These mappings persist at the campaign level and are automatically applied to all future multi-track transcripts. The current transcript is patched in-place when the mapping is saved.

---

## Architecture

### New Files

- `src/server/routers/speaker-mapping.ts` — tRPC router (3 procedures)
- `src/components/recap/speaker-mapping-step.tsx` — inline mapping UI shown after upload completes

### Modified Files

- `src/server/routers/_app.ts` — register `speakerMapping` router
- `src/server/routers/multi-track-upload.ts` — add `sessionId` to `getStatus` input; add `transcriptId?` to response
- `src/lib/queue/multi-track-worker.ts` — auto-apply existing mappings when creating a new Transcript
- `src/components/recap/multi-track-progress.tsx` — add `sessionId` prop; transition to `SpeakerMappingStep` instead of calling `onComplete` directly

---

## Data Model

`SpeakerMapping` (already in schema):

```prisma
model SpeakerMapping {
  id            String     @id @default(cuid())
  campaignId    String
  campaign      Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  speakerLabel  String     // raw speakerTag or "Speaker N"
  characterId   String?
  character     Character? @relation(fields: [characterId], references: [id], onDelete: SetNull)
  characterName String     // denormalised display name
  isDM          Boolean    @default(false)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  @@unique([campaignId, speakerLabel])
  @@index([campaignId])
}
```

The `@@unique([campaignId, speakerLabel])` constraint drives upsert — one mapping per label per campaign.

---

## tRPC Router (`speakerMapping`)

All procedures use `campaignDMProcedure`.

### `getByCampaign`

```ts
input: z.object({ campaignId: z.string() })
// returns: SpeakerMapping[]
```

Fetches all mappings for the campaign. Used by `SpeakerMappingStep` to pre-fill existing assignments.

### `upsert`

```ts
input: z.object({
  campaignId: z.string(),
  speakerLabel: z.string().min(1).max(100),
  characterId: z.string().optional(),
  characterName: z.string().max(100),
  isDM: z.boolean().default(false),
})
```

Creates or updates the mapping for `(campaignId, speakerLabel)`. Uses Prisma `upsert` with the `@@unique` index as the `where` clause.

### `applyToTranscript`

```ts
input: z.object({
  campaignId: z.string(),
  transcriptId: z.string(),
})
```

Fetches all `SpeakerMapping` records for the campaign, builds a label→name lookup, then patches `Transcript.speakers` (JSON array) and `Transcript.timestamps` (JSON array with `.speaker` field) in a single `prisma.transcript.update`. Returns `{ updated: true }`.

**Security:** verifies the transcript belongs to a session in this campaign before patching.

---

## Worker Auto-Apply

In `src/lib/queue/multi-track-worker.ts`, after loading recordings and before transcribing:

```ts
const existingMappings = await prisma.speakerMapping.findMany({
  where: { campaignId },
  select: { speakerLabel: true, characterName: true, isDM: true },
});
const mappingLookup = new Map(existingMappings.map(m => [m.speakerLabel, m]));
```

When building the `speakers` array and `timestamps` for `prisma.transcript.create`, substitute:

```ts
const resolvedName = mappingLookup.get(speakerLabel)?.characterName ?? speakerLabel;
```

**Failure mode:** if `findMany` throws, log the error and continue with raw labels. Never block transcription for a mapping lookup failure.

---

## UI Flow

`MultiTrackProgress` currently calls `onComplete()` when `overallStatus === 'complete'`. Change: instead of calling `onComplete`, it renders `<SpeakerMappingStep>` inline, passing:

```ts
interface SpeakerMappingStepProps {
  campaignId: string;
  transcriptId: string;          // from getStatus response once complete
  speakerLabels: string[];       // derived from data.recordings in MultiTrackProgress (no re-query needed)
  onComplete: () => void;
}
```

`speakerLabels` is computed in `MultiTrackProgress` from the already-loaded `data.recordings`:

```ts
const speakerLabels = (data.recordings as Array<{ speakerTag?: string | null }>)
  .map((r, i) => r.speakerTag ?? `Track ${i + 1}`);
```

`MultiTrackProgress` also needs `sessionId: string` added to its props so it can pass it to `getStatus`.

`SpeakerMappingStep` behaviour:

1. Queries `speakerMapping.getByCampaign` to pre-fill existing assignments
2. Renders one row per label in `speakerLabels`:
   - Character dropdown — player characters from `characters` router (campaign-scoped)
   - isDM checkbox
4. "Save & Continue" button:
   - Calls `speakerMapping.upsert` for each mapped row (unmapped rows are skipped)
   - Calls `speakerMapping.applyToTranscript` (best-effort — failure is logged, not surfaced)
   - Calls `onComplete()`
5. "Skip" link — calls `onComplete()` without saving

**Empty character list:** dropdown shows disabled "No characters added" option. isDM checkbox still works.

**Error handling:** per-row upsert failures mark that row with a red indicator and allow retry. `applyToTranscript` failure is silent to the user — the transcript exists with raw labels and can be re-mapped if needed.

---

## `MultiTrackProgress` Changes

The component needs to know the `transcriptId` once processing is complete. Add it to the `getStatus` query response:

```ts
// getStatus returns:
{ recordings, total, done, failed, overallStatus, transcriptId?: string }
```

`transcriptId` is fetched via:

```ts
const transcript = await prisma.transcript.findFirst({
  where: { sessionId: input.sessionId },  // need sessionId in getStatus input
  orderBy: { createdAt: 'desc' },
  select: { id: true },
});
```

> **Note:** `getStatus` input currently only takes `campaignId` + `uploadGroupId`. Add `sessionId` to the input so `transcriptId` can be resolved.

State machine in `MultiTrackProgress`:

```
polling → overallStatus === 'complete' → show SpeakerMappingStep
         → overallStatus === 'failed'  → show error state
```

---

## Testing

### Unit test: `applyToTranscript` logic

File: `tests/unit/recap/speaker-mapping.test.ts`

- Given a transcript with speakers `["Speaker 0", "Speaker 1"]` and timestamps with `.speaker` fields
- Given mappings `{ "Speaker 0" → "Aria Dawnbringer", "Speaker 1" → isDM }`
- Assert the patched transcript has correct `speakers` JSON and all matching `timestamps` updated

### Workflow spec stub

Extend `tests/workflows/recapforge-multi-track.workflow.spec.ts`:

```ts
test.fixme('speaker mapping step appears after transcription completes', async ({ page }) => {
  // Phase 3 UI — implemented when worker + real R2 available in E2E env
});
```

---

## Constraints

- No new pages — the mapping UI lives entirely within the RecapForge panel (inline transition)
- Characters dropdown: player characters only (`Character` model, campaign-scoped). NPCs are excluded.
- `isDM` and character assignment are mutually exclusive per row (isDM checked → characterId cleared)
- `applyToTranscript` is idempotent — calling it twice with the same mappings produces the same result
- Worker auto-apply never blocks transcription on mapping lookup failure
