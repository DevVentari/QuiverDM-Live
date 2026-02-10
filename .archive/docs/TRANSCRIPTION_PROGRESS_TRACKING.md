# Real-Time Transcription Progress Tracking

## Overview

QuiverDM now features real-time progress tracking for WhisperX transcription with detailed substep updates, estimated time remaining (ETA), and WebSocket-based live updates to the frontend.

## Architecture

### Components

1. **Python Progress Events** (`scripts/transcribe_whisperx.py`)
   - Emits structured JSON progress events to stderr
   - Format: `__PROGRESS__{json}__END__`
   - Includes: stage, percentage, message, timestamp, details

2. **TypeScript Progress Parsing** (`src/lib/whisperx.ts`)
   - Uses `spawn()` to capture stderr in real-time
   - Parses progress events and triggers callbacks
   - Supports chunk-level progress aggregation

3. **Progress Tracker** (`src/lib/transcription-progress.ts`)
   - `TranscriptionProgressTracker` class for managing progress
   - Updates database with substep, ETA, and progress details
   - Automatically broadcasts to WebSocket clients

4. **WebSocket Server** (`src/server/websocket.ts`)
   - Long-running WebSocket server on port 3001
   - Job-specific channels for subscriptions
   - Broadcasts progress updates to connected clients

5. **Frontend Components**
   - `useTranscriptionProgress` hook - WebSocket connection
   - `TranscriptionProgress` component - UI display

## Database Schema

Enhanced `TranscriptionJob` model includes:

```prisma
model TranscriptionJob {
  // ... existing fields ...
  currentSubStep          String?  // Detailed substep (e.g., "Chunk 2/5: Aligning timestamps")
  estimatedTimeRemaining  Int?     // Seconds remaining (estimated)
  progressDetails         Json?    // Additional metadata (speakers, batch info, etc.)
}
```

## Progress Stages

The Python script emits progress for these stages:

1. **loading_model** (0-100%)
   - Loading WhisperX model
   - Details: model, device, compute_type

2. **transcribing** (0-100%)
   - Running batched transcription
   - Details: batch_size, audio_path, segments count

3. **aligning** (0-100%)
   - Word-level timestamp alignment
   - Details: language

4. **diarizing** (0-100%) - Optional
   - Speaker detection and assignment
   - Details: min_speakers, max_speakers, speakers_detected

## Usage

### Backend: Starting a Transcription Job

```typescript
import { trpc } from '@/lib/trpc';

// Start transcription with progress tracking
const result = await trpc.sessionTranscription.transcribeSession.mutate({
  sessionId: 'session_id',
  filePath: '/path/to/audio.mp3',
  modelSize: 'medium',
  useSpeakers: true,
  speakerNames: ['DM', 'Player1', 'Player2'],
});

// Get job ID for progress tracking
const jobId = result.jobId;
```

### Frontend: Displaying Progress

```tsx
import { TranscriptionProgress } from '@/components/TranscriptionProgress';

export default function TranscriptionPage({ jobId }: { jobId: string }) {
  return (
    <div>
      <h1>Transcription in Progress</h1>
      <TranscriptionProgress jobId={jobId} />
    </div>
  );
}
```

### Advanced: Custom Progress Hook

```tsx
import { useTranscriptionProgress } from '@/hooks/useTranscriptionProgress';

export function MyCustomComponent({ jobId }: { jobId: string }) {
  const { progress, isConnected, error } = useTranscriptionProgress({
    jobId,
    enabled: true,
    wsUrl: 'ws://localhost:3001', // Optional, defaults to localhost:3001
  });

  if (!progress) return <div>Loading...</div>;

  return (
    <div>
      <p>Status: {progress.status}</p>
      <p>Progress: {progress.progress}%</p>
      <p>Current Step: {progress.currentStep}</p>
      <p>Details: {progress.currentSubStep}</p>
      {progress.estimatedTimeRemaining && (
        <p>ETA: {progress.estimatedTimeRemaining}s</p>
      )}
    </div>
  );
}
```

## WebSocket Protocol

### Connection

Connect to `ws://localhost:3001?jobId={jobId}` or send a subscribe message:

```json
{
  "type": "subscribe",
  "jobId": "job_abc123"
}
```

### Progress Messages

Server sends progress updates in this format:

```json
{
  "type": "progress",
  "jobId": "job_abc123",
  "data": {
    "jobId": "job_abc123",
    "status": "processing",
    "progress": 45,
    "currentChunk": 2,
    "totalChunks": 5,
    "currentStep": "transcribing",
    "currentSubStep": "Chunk 2/5: Aligning timestamps - 45%",
    "estimatedTimeRemaining": 320,
    "progressDetails": {
      "language": "en",
      "batch_size": 16,
      "speakers_detected": 3
    }
  }
}
```

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "jobId": "job_abc123"
}
```

## Progress Details

The `progressDetails` JSON field can contain:

- `currentChunk` - Current audio chunk being processed
- `totalChunks` - Total number of audio chunks
- `chunkPath` - Name of current chunk file
- `language` - Detected/specified language
- `batch_size` - WhisperX batch size
- `model` - WhisperX model being used
- `device` - 'cuda' or 'cpu'
- `compute_type` - 'float16' or 'int8'
- `speakers_detected` - Number of unique speakers found
- `segments` - Number of transcription segments

## ETA Calculation

ETA is calculated based on:

1. Job start time (`startedAt`)
2. Current progress percentage
3. Formula: `remaining_time = (elapsed_time / progress%) * (100 - progress%)`

Updates automatically as progress advances.

## Configuration

### WebSocket Port

Set the WebSocket server port via environment variable:

```env
WS_PORT=3001
```

Default is 3001 if not specified.

### Instrumentation

The WebSocket server is initialized via Next.js instrumentation:

- File: `src/instrumentation.ts`
- Enabled by: `experimental.instrumentationHook` in `next.config.js`

## Testing

### Quick Test

```bash
# Start the dev server (initializes WebSocket server)
npm run dev

# In another terminal, run a quick transcription test
npm run test:quick
```

### Full Session Test

```bash
# Start dev server
npm run dev

# Run full transcription with speaker diarization
npm run transcribe:full
```

### Manual WebSocket Test

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3001?jobId=test_job_id');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'subscribe', jobId: 'test_job_id' }));
};

ws.onmessage = (event) => {
  console.log('Progress update:', JSON.parse(event.data));
};
```

## Troubleshooting

### WebSocket Not Connecting

1. Ensure `next.config.js` has `instrumentationHook: true`
2. Check that port 3001 is not in use
3. Verify `src/instrumentation.ts` exists
4. Restart the dev server

### No Progress Updates

1. Check that `updateTranscriptionProgress()` is being called
2. Verify Python script is emitting `__PROGRESS__` events
3. Check WebSocket server logs in terminal
4. Ensure client is subscribed to correct job ID

### Slow Updates

1. Progress events are emitted in real-time from Python
2. Database writes happen on each update
3. Consider throttling updates if too frequent

## Future Enhancements

- [ ] Progress persistence across server restarts
- [ ] Redis pub/sub for multi-instance deployments
- [ ] Client-side polling fallback if WebSocket fails
- [ ] Progress history/replay capability
- [ ] Audio preview at current transcription point
- [ ] Pause/resume transcription support

## Performance Considerations

- WebSocket server is lightweight (<5MB memory)
- Database updates are async and non-blocking
- Each progress event triggers one DB write + WebSocket broadcast
- Average update frequency: 5-10 updates per chunk (every 2-5 seconds)
- Total updates for 3-hour session: ~100-200 events
