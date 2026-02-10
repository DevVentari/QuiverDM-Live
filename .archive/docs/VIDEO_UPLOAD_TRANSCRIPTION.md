# Video Upload & Transcription System

## Overview

QuiverDM now supports uploading large video files (up to 1GB), extracting audio, transcribing with WhisperX, and automatically deleting the original video file to save storage space.

## Features

### 1. Large File Upload Support
- **Upload limit**: 1GB (up from 4MB default)
- **Supported formats**:
  - Video: MP4, WebM, AVI, MOV, MKV
  - Audio: MP3, WAV, M4A, OGG
- **Progress tracking**: Real-time upload progress indicator

### 2. Automatic Storage Management
- **Audio extraction**: Videos are automatically converted to audio
- **Automatic cleanup**: Original video files are deleted after successful transcription
- **Storage tracking**: Database tracks which files have been deleted
- **Cost savings**: Video files are typically 10-50x larger than audio files

### 3. Enhanced Database Schema
```prisma
model SessionRecording {
  id               String      @id @default(cuid())
  sessionId        String
  type             String      // 'audio', 'video'
  originalUrl      String      // Original file URL
  extractedAudioUrl String?    // Extracted audio URL (for videos)
  fileSize         Int         // Original file size
  originalDeleted  Boolean     @default(false) // Cleanup status
  processingStatus String      @default("queued")
  transcripts      Transcript[]
  // ... other fields
}
```

## Usage

### Frontend Components

#### SessionRecordingUpload
Simple upload component for adding recordings to a session:

```tsx
import { SessionRecordingUpload } from '@/components/SessionRecordingUpload';

<SessionRecordingUpload
  sessionId="session-123"
  userId="user-456"
  onUploadComplete={(recording) => {
    console.log('Upload complete:', recording);
  }}
/>
```

#### SessionRecordingManager
Complete management interface with upload, transcription, and storage stats:

```tsx
import { SessionRecordingManager } from '@/components/SessionRecordingManager';

<SessionRecordingManager
  sessionId="session-123"
  userId="user-456"
  campaignId="campaign-789"
/>
```

### tRPC API

#### Upload Recording
```typescript
// 1. Upload file via API route
const formData = new FormData();
formData.append('file', videoFile);
formData.append('userId', userId);
formData.append('sessionId', sessionId);

const response = await fetch('/api/recordings/upload', {
  method: 'POST',
  body: formData,
});

const { url, type, fileSize } = await response.json();

// 2. Create database record
const recording = await trpc.sessionRecordings.create.mutate({
  sessionId,
  type,
  url,
  fileSize,
});
```

#### Transcribe and Auto-Delete
```typescript
const result = await trpc.sessionTranscription.transcribeSession.mutate({
  sessionId: 'session-123',
  recordingId: 'recording-456',
  filePath: '/absolute/path/to/video.mp4',
  fileUrl: '/api/storage/session-recordings/...',
  modelSize: 'medium',
  useSpeakers: true,
  deleteOriginalFile: true, // Default: true
});

// Returns:
// {
//   success: true,
//   transcriptId: '...',
//   deletedOriginalFile: true,
//   hasSpeakers: true,
//   ...
// }
```

#### Get Recordings
```typescript
const recordings = await trpc.sessionRecordings.getBySessionId.query({
  sessionId: 'session-123',
});
```

#### Storage Statistics
```typescript
const stats = await trpc.sessionRecordings.getStorageStats.query({
  sessionId: 'session-123',
});

// Returns:
// {
//   totalSize: 524288000,
//   totalRecordings: 3,
//   originalDeletedCount: 2,
//   originalKeptCount: 1,
//   averageSize: 174762667
// }
```

#### Delete Recording
```typescript
await trpc.sessionRecordings.delete.mutate({
  id: 'recording-456',
  deleteFiles: true, // Also delete files from storage
});
```

## Workflow

### Typical Session Recording Flow

1. **Upload Video**
   - User selects video file (up to 1GB)
   - File uploads to local storage or R2
   - Database record created with `processingStatus: 'queued'`

2. **Transcription**
   - User clicks "Transcribe"
   - Audio extracted from video (if video)
   - WhisperX processes audio with speaker diarization
   - Transcript saved to database

3. **Automatic Cleanup**
   - Original video file deleted from storage
   - Database updated: `originalDeleted: true`
   - `processingStatus: 'completed'`

4. **Storage Savings**
   - Example: 3-hour D&D session
     - Original video: ~2.5 GB
     - Extracted audio: ~150 MB
     - **Savings: ~94%**

## Configuration

### Next.js Config
The upload limit is configured in `next.config.js`:

```javascript
serverRuntimeConfig: {
  bodySizeLimit: '1gb',
}
```

### Transcription Options

```typescript
interface TranscriptionOptions {
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3';
  language?: string;           // Optional, auto-detect if not specified
  useGPU: boolean;             // Default: true
  useSpeakers: boolean;        // Default: false
  numSpeakers?: number;        // Exact count, or use min/max
  minSpeakers: number;         // Default: 1
  maxSpeakers: number;         // Default: 8
  speakerNames?: string[];     // Map speakers to player names
  batchSize: number;           // Default: 16
  deleteOriginalFile: boolean; // Default: true
}
```

## Storage Backends

The system supports both local storage and Cloudflare R2:

### Local Storage (Development)
- Files stored in `storage/session-recordings/`
- Served via `/api/storage/[...path]`
- Automatic cleanup supported

### Cloudflare R2 (Production)
- Files stored in R2 bucket
- Automatic cleanup supported
- Cost-effective for large files

To switch between storage backends, import from the appropriate module:

```typescript
// Local storage
import { uploadToLocal, deleteFromLocal } from '@/lib/local-storage';

// R2 storage
import { uploadToR2, deleteFromR2 } from '@/lib/r2-storage';
```

## Performance

### Upload Performance
- 1GB video: ~3-10 minutes (depending on connection speed)
- Real-time progress tracking
- Chunked upload support (via browser)

### Transcription Performance
- 3-hour session with medium model:
  - GPU (CUDA): ~25-35 minutes
  - CPU: ~1.5-2 hours
- Speaker diarization adds ~10-15% overhead

### Storage Savings
- Video → Audio conversion: ~90-95% size reduction
- Example savings:
  - 500MB video → 30MB audio
  - 2.5GB video → 150MB audio

## Error Handling

The system includes graceful error handling:

- **Upload failures**: User notified, can retry
- **Transcription failures**: Original file preserved
- **Cleanup failures**: Logged but doesn't fail transcription
- **Storage errors**: Graceful fallback, retry logic

## Monitoring

Track storage usage and cleanup status:

```typescript
// Get storage stats
const stats = await trpc.sessionRecordings.getStorageStats.query({
  sessionId,
});

// Monitor recordings
const recordings = await trpc.sessionRecordings.getBySessionId.query({
  sessionId,
});

// Check cleanup status
recordings.forEach(r => {
  if (r.originalDeleted) {
    console.log(`✓ Original deleted: ${r.id}`);
  } else {
    console.log(`⚠ Original kept: ${r.id}`);
  }
});
```

## Best Practices

1. **Always enable auto-delete** for video files (default behavior)
2. **Use medium model** for best quality/speed balance
3. **Enable speaker diarization** for D&D sessions
4. **Monitor storage stats** regularly
5. **Test with small files** before uploading large sessions
6. **Keep backup** of original files if needed (disable `deleteOriginalFile`)

## Troubleshooting

### Upload fails
- Check file size (must be < 1GB)
- Verify file type is video/* or audio/*
- Check network connection

### Transcription fails
- Verify WhisperX is installed: `npm run test:quick`
- Check GPU availability (or use CPU mode)
- Verify file path is accessible

### Original file not deleted
- Check `recordingId` is provided
- Verify `deleteOriginalFile: true`
- Check logs for deletion errors

## Future Enhancements

- Resumable uploads for large files
- Background transcription queue
- Multiple audio quality options
- Custom retention policies
- Bulk cleanup operations
- Storage quotas per user/campaign
