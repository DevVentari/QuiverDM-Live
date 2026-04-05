# RecapForge Phase 2 — Multi-File Upload & Merge

**Date:** 2026-04-05
**Module:** RecapForge
**Phase:** 2 of 7
**Supersedes:** Original Phase 2 (Craig zip processing) — replaced with individual multi-file upload

---

## Scope

Replace the Craig zip processing plan with a simpler multi-file upload flow: DM selects multiple individual audio files, optionally tags each with a speaker name, files are transcribed individually via AssemblyAI, and results are merged by timestamp into one unified `Transcript` record.

No Craig zip parsing. No Discord username extraction from filenames. Tags are optional AI hints, not hard attribution.

---

## Schema Changes

Small — repurpose the three Phase 1 Craig fields on `SessionRecording` and add two new ones.

### SessionRecording field renames + additions

```prisma
// Rename (via migration):
isCraigMultiTrack → isMultiTrack      Boolean @default(false)
craigTrackFiles   → trackFiles        Json?   // [{ filename, r2Key, speakerTag?, durationSeconds? }]
craigMergeStatus  → mergeStatus       String  @default("none")
                                      // "none" | "pending" | "processing" | "complete" | "failed"

// New fields:
uploadGroupId     String?             // shared across all files in one multi-upload batch
speakerTag        String?             // optional per-file speaker label (AI hint, e.g. "Kira", "DM")
```

The `uploadGroupId` is a cuid generated client-side at upload initiation time. All files in one upload batch share the same value. The merge worker queries `SessionRecording` by `uploadGroupId` to know when all files are done.

Add `@@index([uploadGroupId])` to `SessionRecording`.

---

## Upload Flow

```
DM selects multiple files
        ↓
UI: file list with per-file optional speakerTag input
        ↓
Submit → for each file:
  multiTrackUpload.initiate({ sessionId, fileName, fileSize, uploadGroupId, speakerTag? })
  → creates SessionRecording(isMultiTrack=true, mergeStatus="pending", uploadGroupId, speakerTag)
  → returns presigned R2 URL
        ↓
Files upload in parallel to R2
        ↓
All uploads complete → multiTrackUpload.process({ uploadGroupId, sessionId })
  → enqueues multi-track-processing BullMQ job
        ↓
Worker: for each recording in group
  → transcribes via AssemblyAI (speakerTag passed as word boost)
  → updates mergeStatus = "processing" per file
        ↓
All files transcribed
  → merge by timestamp into unified transcript
  → write Transcript record (source: "multi_track")
  → set all recordings mergeStatus = "complete"
  → broadcast multitrack:complete via WebSocket
```

---

## tRPC Router: `multiTrackUpload`

```typescript
// src/server/routers/multiTrackUpload.ts
export const multiTrackUploadRouter = router({
  // Initiate one file — returns presigned R2 URL
  initiate: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      fileName: z.string(),
      fileSize: z.number(),
      uploadGroupId: z.string(),   // client-generated cuid, shared across batch
      speakerTag: z.string().optional(),
    }))
    .mutation(/* create SessionRecording, return presigned URL */),

  // Trigger merge worker once all files are uploaded
  process: campaignDMProcedure
    .input(z.object({
      uploadGroupId: z.string(),
      sessionId: z.string(),
    }))
    .mutation(/* enqueue multi-track-processing job */),

  // Poll status for all files in the group
  getStatus: campaignDMProcedure
    .input(z.object({ uploadGroupId: z.string() }))
    .query(/* return per-file mergeStatus + overall progress */),
});
```

---

## BullMQ Worker: `multi-track-processing`

Queue name: `multi-track-processing`

```typescript
interface MultiTrackProcessingJob {
  uploadGroupId: string;
  sessionId: string;
  campaignId: string;
}

// Worker flow:
// 1. Load all SessionRecording rows with uploadGroupId
// 2. For each recording (in parallel, max 3 concurrent):
//    a. Download audio from R2
//    b. Submit to AssemblyAI WITHOUT speaker_labels
//       - If speakerTag present: include as boost_param word hint
//    c. Poll AssemblyAI until complete
//    d. Store raw transcript words with timestamps
//    e. Update recording.mergeStatus = "processing" → "complete"
//    f. Broadcast multitrack:track_complete via WebSocket
// 3. Merge all word-level transcripts by timestamp
//    - Each word attributed to its source recording
//    - If speakerTag exists on recording, use it as speaker label
//    - If no speakerTag, label as "Speaker N" (N = file index)
// 4. Write merged Transcript record (source: "multi_track")
// 5. Broadcast multitrack:complete via WebSocket
// 6. On any failure: set mergeStatus = "failed", broadcast multitrack:error

// Concurrency: 1 job at a time (AssemblyAI rate limits)
// Per-file concurrency: 3 (parallelise transcription within a job)
// Retries: 2 with exponential backoff
// Timeout: 45 minutes
```

---

## WebSocket Events

```typescript
type MultiTrackWSEvent =
  | { type: "multitrack:track_complete"; uploadGroupId: string; recordingId: string; total: number; completed: number }
  | { type: "multitrack:complete"; uploadGroupId: string; transcriptId: string }
  | { type: "multitrack:error"; uploadGroupId: string; recordingId?: string; error: string }
```

---

## UI Components

```
src/components/recap/
  multi-track-dropzone.tsx    # Multi-file drop zone + file list with tag inputs
  multi-track-progress.tsx    # Per-file progress bars + overall status
```

No new pages — upload flow lives in the existing session detail page or a sheet.

---

## File Storage

Each individual audio file uploaded to Cloudflare R2 via presigned URL, same pattern as existing single-file recordings. Key format: `recordings/{sessionId}/{uploadGroupId}/{fileName}`.

---

## Constraints

- Max file size: 500MB per file (existing R2 presigned URL limit)
- Accepted formats: same as existing pipeline (MP3, MP4, WAV, M4A, OGG, FLAC, WebM)
- `speakerTag` is free text, max 50 chars — no validation against existing character names (AI hint only)
- `uploadGroupId` is client-generated — a `cuid()` created in the browser before the first `initiate` call

---

## Deliverables

1. `SessionRecording` schema migration (rename 3 fields, add 2 new fields, add index)
2. `multiTrackUpload` tRPC router
3. `multi-track-processing` BullMQ worker + npm script
4. WebSocket event types registered on existing WS server
5. `MultiTrackDropzone` and `MultiTrackProgress` components
6. Workflow spec: `tests/workflows/recapforge-multi-track.workflow.spec.ts`
