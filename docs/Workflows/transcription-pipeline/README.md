# Transcription Pipeline Workflow

## Overview

Handles audio/video transcription using WhisperX with optional speaker diarization.

## Components

### Backend
- `src/server/routers/session-transcription.ts` - Transcription control
- `src/server/routers/session-recordings.ts` - Recording management
- `src/server/routers/transcript.ts` - Transcript CRUD
- `src/lib/transcription/whisperx.ts` - WhisperX integration
- `src/lib/transcription/progress.ts` - Progress tracking
- `src/lib/transcription/db.ts` - Transcript database operations
- `src/lib/ffmpeg.ts` - Audio extraction from video

### Frontend
- `src/components/WhisperUpload.tsx` - Upload and transcription UI
- `src/components/TranscriptionProgress.tsx` - Progress display
- `src/components/SessionRecordingUpload.tsx` - Recording upload

## Prerequisites

### WhisperX Installation
```bash
# Python environment with WhisperX
pip install whisperx

# GPU support (optional but recommended)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Environment Variables
```env
HF_TOKEN=your-huggingface-token  # For speaker diarization
```

## Test Procedures

### 1. Check WhisperX Availability
```typescript
// Test: Check local WhisperX
trpc.sessionTranscription.checkLocalWhisper.query()
// Expected: { available: true, version: "x.x.x", device: "cuda" | "cpu" }
```

### 2. Upload Recording
```typescript
// Test: Create recording entry
trpc.sessionRecordings.create.mutate({
  sessionId: "session-id",
  type: "video",
  url: "/api/storage/recordings/file.mp4",
  fileSize: 1024000,
  durationSeconds: 3600
})
// Expected: Recording created with processingStatus: "queued"
```

### 3. Transcription Process

#### Basic Transcription
```typescript
// Test: Transcribe without speakers
trpc.sessionTranscription.transcribeSession.mutate({
  sessionId: "session-id",
  recordingId: "recording-id",
  filePath: "/path/to/file.mp4",
  modelSize: "medium",
  useGPU: true,
  useSpeakers: false
})
// Expected: Transcript created with segments
```

#### With Speaker Diarization
```typescript
// Test: Transcribe with speakers
trpc.sessionTranscription.transcribeSession.mutate({
  sessionId: "session-id",
  recordingId: "recording-id",
  filePath: "/path/to/file.mp4",
  modelSize: "medium",
  useGPU: true,
  useSpeakers: true,
  minSpeakers: 2,
  maxSpeakers: 6,
  speakerNames: ["DM", "Player 1", "Player 2"]
})
// Expected: Transcript with speaker labels
```

### 4. Progress Tracking
```typescript
// Test: Get transcription progress
trpc.sessionTranscription.getTranscriptionProgress.query({
  jobId: "job-id"
})
// Expected: { status, progress, stage, error? }

// Test: Get session jobs
trpc.sessionTranscription.getSessionTranscriptionJobs.query({
  sessionId: "session-id"
})
// Expected: Array of job progress objects
```

### 5. Transcript Management
```typescript
// Test: Get transcript
trpc.transcript.getTranscript.query({ transcriptId: "id" })
// Expected: Full transcript with segments

// Test: Update correction
trpc.transcript.updateCorrection.mutate({
  transcriptId: "id",
  correctedText: "Corrected text..."
})
// Expected: Transcript updated

// Test: Delete transcript
trpc.transcript.deleteTranscript.mutate({ transcriptId: "id" })
// Expected: Transcript deleted
```

## Processing Pipeline

```
1. Upload video/audio file
   ↓
2. Create recording entry in DB
   ↓
3. Start transcription job
   ↓
4. Extract audio (if video) via FFmpeg
   ↓
5. Run WhisperX transcription
   ↓
6. (Optional) Run speaker diarization
   ↓
7. Save transcript to database
   ↓
8. (Optional) Delete original file
```

## Model Sizes

| Model | VRAM | Speed | Accuracy |
|-------|------|-------|----------|
| tiny | ~1GB | Fastest | Lowest |
| base | ~1GB | Fast | Low |
| small | ~2GB | Medium | Medium |
| medium | ~5GB | Slow | High |
| large-v2 | ~10GB | Slowest | Highest |
| large-v3 | ~10GB | Slowest | Highest |

## Test Commands

```bash
# Quick test (small file, no speakers)
npm run test:quick

# Full test (with speakers)
npm run test:transcribe

# Full workflow
npm run transcribe:full
```

## Validation Checklist

- [ ] WhisperX available and GPU detected (if applicable)
- [ ] Recording upload creates DB entry
- [ ] FFmpeg extracts audio from video correctly
- [ ] Basic transcription produces segments
- [ ] Speaker diarization assigns speakers
- [ ] Progress updates in real-time
- [ ] Transcript saved to database
- [ ] Original file deletion works
- [ ] Error handling for failed jobs

## Test Data

Sample recordings for testing:
- `docs/D&D/Recordings/` - Real D&D session recordings

## Known Issues

- Large files (>1GB) may timeout on upload
- Speaker diarization requires HuggingFace token
- GPU memory errors with large-v3 on <12GB VRAM

## Test Results

See `results/` directory for test execution logs.
