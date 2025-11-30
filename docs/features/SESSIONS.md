# Game Sessions

Game sessions track individual play sessions within a campaign, including scheduling, notes, transcription, and AI-generated summaries.

## Features

- **Session Management**: Create, schedule, and track sessions
- **Transcription**: Upload recordings for AI transcription
- **AI Summaries**: Auto-generate session recaps
- **Scheduling**: Plan sessions with player RSVPs
- **Session Notes**: Quick notes during play
- **Searchable History**: Find anything from past sessions

## Session Lifecycle

```
Scheduled → In Progress → Completed
    ↓           ↓            ↓
  RSVPs    Quick Notes   Transcription
                              ↓
                        AI Summary
                              ↓
                      Publish to Players
```

## Session States

| Status | Description |
|--------|-------------|
| `planning` | Session created but not started |
| `scheduled` | Date/time set, awaiting RSVPs |
| `in_progress` | Currently playing |
| `completed` | Session finished |

## Database Schema

```prisma
model GameSession {
  id            String    @id @default(cuid())
  campaignId    String
  campaign      Campaign  @relation(...)

  sessionNumber Int
  title         String?
  date          DateTime?
  status        String    @default("planning")

  // Notes
  quickNotes    String?   @db.Text  // During-session notes
  recap         String?   @db.Text  // Post-session summary

  // AI Summary
  aiSummary     Json?     // Structured summary
  summaryPublished Boolean @default(false)

  // Relations
  recordings    SessionRecording[]
  transcripts   Transcript[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([campaignId, sessionNumber])
}

model ScheduledSession {
  id           String    @id @default(cuid())
  campaignId   String
  campaign     Campaign  @relation(...)
  gameSessionId String?  // Links to actual session when created

  title        String?
  scheduledFor DateTime
  duration     Int?      // Minutes
  location     String?   // "Discord", "John's house"
  notes        String?

  rsvps        SessionRSVP[]
  reminderSent Boolean   @default(false)

  createdAt    DateTime  @default(now())
}

model SessionRSVP {
  id          String           @id @default(cuid())
  sessionId   String
  session     ScheduledSession @relation(...)
  userId      String
  user        User             @relation(...)

  status      String    // attending, maybe, declined
  note        String?   // "Might be 15 min late"

  @@unique([sessionId, userId])
}
```

## Session Scheduling

### Create Scheduled Session

```typescript
await trpc.sessions.schedule.mutate({
  campaignId,
  scheduledFor: new Date('2024-02-15T19:00:00'),
  duration: 180, // 3 hours
  location: 'Discord Voice Channel',
  notes: 'Continuing the dungeon crawl',
});
```

### RSVP

```typescript
await trpc.sessions.rsvp.mutate({
  scheduledSessionId,
  status: 'attending',
  note: 'Might be 10 min late',
});
```

### View Upcoming Sessions

```typescript
const { data: upcoming } = trpc.sessions.getUpcoming.useQuery({
  campaignId,
});

// Returns sessions with RSVP counts
// { session, attending: 4, maybe: 1, declined: 0 }
```

## Session Notes

### Quick Notes (During Session)

Auto-saving notes during play:

```typescript
// Auto-save as user types
await trpc.sessions.updateQuickNotes.mutate({
  sessionId,
  quickNotes: 'Party entered the tomb...',
});
```

### Recap (Post-Session)

DM writes or edits the recap:

```typescript
await trpc.sessions.updateRecap.mutate({
  sessionId,
  recap: '# Session 5 Recap\n\nThe party...',
});
```

## AI Session Summaries

### Generate Summary

After transcription completes:

```typescript
const summary = await trpc.sessions.generateSummary.mutate({
  sessionId,
});
```

### Summary Structure

```typescript
interface SessionSummary {
  title: string;              // AI-suggested title

  whatHappened: string[];     // Key events
  keyDecisions: string[];     // Important choices
  npcsEncountered: {
    name: string;
    description: string;
    isNew: boolean;
  }[];
  lootAndRewards: {
    item: string;
    recipient?: string;
  }[];
  questUpdates: {
    quest: string;
    status: 'new' | 'progress' | 'completed';
  }[];
  quotesOfTheSession: {
    quote: string;
    speaker: string;
  }[];

  nextSessionHooks: string[]; // Plot threads to follow
}
```

### Publish to Players

```typescript
await trpc.sessions.publishSummary.mutate({
  sessionId,
});

// Triggers notifications to all campaign members
```

## API Reference

### Sessions Router

```typescript
// List sessions for campaign
trpc.sessions.getAll.useQuery({ campaignId });

// Get single session
trpc.sessions.getById.useQuery({ id: sessionId });

// Create session
trpc.sessions.create.useMutation();

// Update session
trpc.sessions.update.useMutation();

// Start session (set to in_progress)
trpc.sessions.start.useMutation();

// Complete session
trpc.sessions.complete.useMutation();

// Delete session
trpc.sessions.delete.useMutation();
```

### Scheduling

```typescript
// Schedule session
trpc.sessions.schedule.useMutation();

// Update schedule
trpc.sessions.updateSchedule.useMutation();

// Cancel scheduled session
trpc.sessions.cancelSchedule.useMutation();

// RSVP
trpc.sessions.rsvp.useMutation();

// Get upcoming sessions
trpc.sessions.getUpcoming.useQuery({ campaignId });
```

### Summaries

```typescript
// Generate AI summary
trpc.sessions.generateSummary.useMutation();

// Edit summary
trpc.sessions.updateSummary.useMutation();

// Publish to players
trpc.sessions.publishSummary.useMutation();

// Unpublish
trpc.sessions.unpublishSummary.useMutation();
```

## Components

### SessionList

```tsx
<SessionList
  campaignId={campaignId}
  onSessionSelect={(id) => router.push(`/sessions/${id}`)}
/>
```

### SessionCard

```tsx
<SessionCard
  session={session}
  showRecap={isPlayer}
  showNotes={isDM}
/>
```

### ScheduleSession

```tsx
<ScheduleSession
  campaignId={campaignId}
  onScheduled={refetch}
/>
```

### RSVPButtons

```tsx
<RSVPButtons
  sessionId={scheduledSessionId}
  currentStatus={myRsvp?.status}
  onRsvp={handleRsvp}
/>
```

### SessionSummary

```tsx
<SessionSummary
  summary={session.aiSummary}
  editable={isDM}
  onEdit={handleEdit}
  onPublish={handlePublish}
/>
```

### QuickNotes

```tsx
<QuickNotes
  sessionId={sessionId}
  initialValue={session.quickNotes}
  autoSave={true}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/sessions.ts` | Session CRUD + scheduling |
| `src/server/routers/session-summary.ts` | AI summary generation |
| `src/lib/ai-summary.ts` | Summary generation logic |
| `src/app/campaigns/[id]/sessions/page.tsx` | Session list |
| `src/app/campaigns/[id]/sessions/[sessionId]/page.tsx` | Session detail |
| `src/app/campaigns/[id]/schedule/page.tsx` | Scheduling calendar |
| `src/components/session/` | UI components |

## Calendar Integration

### iCal Feed

Each user gets a personal iCal feed URL:

```
https://quiverdm.com/api/calendar/{userId}/feed.ics
```

Subscribe in any calendar app to see scheduled sessions.

### Google Calendar

OAuth integration for automatic sync:

```typescript
await trpc.calendar.connectGoogle.mutate();

// Sessions automatically appear in Google Calendar
// RSVPs sync back to QuiverDM
```

## Notifications

Session events trigger notifications:

| Event | Recipients | Channels |
|-------|------------|----------|
| Session scheduled | All members | Email, Push, Discord |
| 24h reminder | Attending members | Email, Push |
| 1h reminder | Attending members | Push |
| Session started | All members | Push |
| Recap published | All members | Email, Discord |

## Session Search

Find anything from past sessions:

```typescript
const results = await trpc.search.sessions.query({
  campaignId,
  query: 'dragon',
});

// Searches:
// - Session titles
// - Quick notes
// - Recaps
// - Transcripts
// - AI summaries
```

## Transcription Integration

See [TRANSCRIPTION.md](./TRANSCRIPTION.md) for full transcription documentation.

### Quick Reference

```typescript
// Upload recording
await trpc.sessions.uploadRecording.mutate({
  sessionId,
  file,
});

// Start transcription
await trpc.sessions.transcribe.mutate({
  sessionId,
  recordingId,
});

// Get transcription status
const status = trpc.sessions.getTranscriptionStatus.useQuery({
  sessionId,
});
```

## Player View

Players see a simplified session view:

- Session title and date
- Published recap (if available)
- Published AI summary (if available)
- Their own character's involvement

Players do NOT see:
- Quick notes (DM only)
- Unpublished recaps
- Raw transcripts (unless DM shares)
- DM session prep notes
