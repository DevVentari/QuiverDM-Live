# Session Management Workflow

## Overview

Handles game session CRUD, recording storage, and session-related operations.

## Components

### Backend
- `src/server/routers/sessions.ts` - Session CRUD router
- `src/server/routers/session-recordings.ts` - Recording management

### Frontend
- `src/app/campaigns/[slug]/sessions/` - Session pages
- `src/components/SessionRecordingUpload.tsx` - Recording upload
- `src/components/SessionRecordingManager.tsx` - Recording list

## Test Procedures

### 1. Session CRUD

#### Create Session
```typescript
trpc.sessions.create.mutate({
  campaignId: "campaign-id",
  title: "Session 1: The Beginning",
  sessionNumber: 1,
  date: new Date(),
  summary: "The party meets in a tavern..."
})
// Expected: Session created
```

#### Read Sessions
```typescript
// Get campaign sessions
trpc.sessions.getByCampaignId.query({ campaignId: "id" })
// Expected: Array of sessions ordered by number

// Get single session
trpc.sessions.getById.query({ id: "session-id" })
// Expected: Session with recordings, transcripts
```

#### Update Session
```typescript
trpc.sessions.update.mutate({
  id: "session-id",
  title: "Updated Title",
  summary: "Updated summary..."
})
// Expected: Session updated
```

#### Delete Session
```typescript
trpc.sessions.delete.mutate({ id: "session-id" })
// Expected: Session and related data deleted
```

### 2. Recording Management

#### Upload Recording
```typescript
// Via multipart form upload
const formData = new FormData();
formData.append('file', videoFile);
formData.append('sessionId', 'session-id');

fetch('/api/recordings/upload', {
  method: 'POST',
  body: formData
})
// Expected: Recording created with storage URL
```

#### Get Recordings
```typescript
trpc.sessionRecordings.getBySessionId.query({
  sessionId: "session-id"
})
// Expected: Array of recordings with transcripts
```

#### Delete Recording
```typescript
trpc.sessionRecordings.delete.mutate({
  id: "recording-id",
  deleteFiles: true
})
// Expected: Recording and files deleted
```

### 3. Storage Statistics
```typescript
trpc.sessionRecordings.getStorageStats.query({
  sessionId: "session-id"
})
// Expected: { totalSize, totalRecordings, ... }
```

## Authorization

| Action | OWNER | CO_DM | PLAYER | SPECTATOR |
|--------|-------|-------|--------|-----------|
| View Sessions | Yes | Yes | Yes | Yes |
| Create Session | Yes | Yes* | No | No |
| Update Session | Yes | Yes* | No | No |
| Delete Session | Yes | No | No | No |
| Upload Recording | Yes | Yes* | No | No |

*Requires `canManageSessions` permission

## Validation Checklist

- [ ] Session creation with auto-incrementing number
- [ ] Session ordering by date/number
- [ ] Recording upload to storage
- [ ] Recording file cleanup on delete
- [ ] Authorization for DM operations
- [ ] Session stats calculation

## Test Results

See `results/` directory for test execution logs.
