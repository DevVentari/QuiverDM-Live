# Integrations

Connect QuiverDM with external tools: Discord, calendars, virtual tabletops, and D&D Beyond.

## Discord Integration

### Bot Commands

The QuiverDM Discord bot provides campaign access from Discord.

#### Setup

1. Add bot to server: [Invite Link]
2. Link to campaign: `/quiver link ABC123` (invite code)
3. Set announcement channel: `/quiver channel #dnd-announcements`

#### Commands

| Command | Description |
|---------|-------------|
| `/quiver link <code>` | Link server to campaign |
| `/quiver unlink` | Unlink from campaign |
| `/quiver channel <#channel>` | Set announcement channel |
| `/quiver schedule` | Show upcoming sessions |
| `/quiver rsvp <yes\|no\|maybe>` | RSVP to next session |
| `/quiver recap` | Get latest session recap |
| `/quiver roll <dice>` | Roll dice (e.g., `2d6+3`) |
| `/quiver npc <name>` | Look up NPC info |
| `/quiver character <name>` | Look up character info |
| `/quiver wiki <search>` | Search campaign wiki |

### Webhooks (No Bot Required)

For servers that can't add bots, use webhooks:

```typescript
// Configure webhook in campaign settings
await trpc.discord.setWebhook.mutate({
  campaignId,
  webhookUrl: 'https://discord.com/api/webhooks/...',
  events: ['session.recap', 'session.scheduled', 'session.reminder'],
});
```

### What Gets Posted

| Event | Discord Message |
|-------|-----------------|
| Session scheduled | Embed with date, time, location, RSVP reactions |
| 24h reminder | Reminder with attendee list |
| Session started | "Session is live!" notification |
| Recap published | Embed with summary and link |

### Database Schema

```prisma
model DiscordIntegration {
  id           String    @id @default(cuid())
  campaignId   String    @unique
  campaign     Campaign  @relation(...)

  // Server info
  guildId      String
  guildName    String?

  // Webhook (if using webhooks instead of bot)
  webhookUrl   String?
  webhookId    String?

  // Channel settings
  announcementChannelId String?
  announcementChannelName String?

  // What to post
  postRecaps     Boolean @default(true)
  postSchedule   Boolean @default(true)
  postReminders  Boolean @default(true)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

---

## Calendar Integration

### iCal Feed

Every user gets a personal calendar feed URL:

```
https://quiverdm.com/api/calendar/{userId}/feed.ics
```

Subscribe in any calendar app (Google, Apple, Outlook, etc.).

#### Feed Contents

- All scheduled sessions for campaigns user belongs to
- Event title: `[Campaign] Session Title`
- Event time: Scheduled start + duration
- Event location: Session location (Discord link, etc.)
- Event description: Session notes

#### Generating iCal

```typescript
import ical from 'ical-generator';

export function generateCalendarFeed(sessions: ScheduledSession[]) {
  const calendar = ical({
    name: 'QuiverDM Sessions',
    timezone: 'UTC',
  });

  for (const session of sessions) {
    calendar.createEvent({
      start: session.scheduledFor,
      end: addMinutes(session.scheduledFor, session.duration || 180),
      summary: `[${session.campaign.name}] ${session.title || 'Game Session'}`,
      description: session.notes,
      location: session.location,
      url: `https://quiverdm.com/campaigns/${session.campaignId}/sessions/${session.id}`,
    });
  }

  return calendar.toString();
}
```

### Google Calendar OAuth

For two-way sync:

```typescript
// Connect Google Calendar
await trpc.calendar.connectGoogle.mutate();

// Callback handles OAuth
// Stores refresh token for user

// Sessions auto-sync to Google Calendar
// RSVPs sync back (via webhook)
```

#### OAuth Flow

```
1. User clicks "Connect Google Calendar"
2. Redirect to Google OAuth consent
3. User grants calendar access
4. Callback stores refresh_token
5. Create calendar events for existing sessions
6. Set up webhook for RSVP sync
```

### Database Schema

```prisma
model CalendarIntegration {
  id           String    @id @default(cuid())
  userId       String    @unique
  user         User      @relation(...)

  provider     String    // google, outlook
  accessToken  String    @db.Text
  refreshToken String    @db.Text
  expiresAt    DateTime

  // Google-specific
  calendarId   String?   // Which calendar to use

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

---

## D&D Beyond Integration

### Character Import

Import characters from D&D Beyond:

```typescript
await trpc.characters.importFromDndBeyond.mutate({
  dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345678',
});
```

### Character Sync

Keep characters in sync:

```typescript
// Manual sync
await trpc.characters.syncDndBeyond.mutate({
  characterId,
});

// Auto-sync (background job)
// Runs daily for characters with dndBeyondId
```

### What Syncs

| Data | Direction | Notes |
|------|-----------|-------|
| Name, Race, Class | DDB → QuiverDM | |
| Level, Background | DDB → QuiverDM | |
| Ability Scores | DDB → QuiverDM | |
| HP, AC, Speed | DDB → QuiverDM | |
| Features | DDB → QuiverDM | Class, race, feats |
| Spells | DDB → QuiverDM | Known and prepared |
| Equipment | DDB → QuiverDM | With quantities |
| Portrait | DDB → QuiverDM | Avatar image |

### Cobalt Token

For private characters, users provide their D&D Beyond Cobalt token:

```typescript
// Store in user settings (encrypted)
await trpc.userSettings.update.mutate({
  dndBeyondCobaltCookie: 'CobaltSession=...',
});
```

### Homebrew Export

Export QuiverDM homebrew in D&D Beyond-compatible format:

```typescript
const exportData = await trpc.homebrew.exportToDndBeyond.mutate({
  homebrewIds: ['item_1', 'spell_2'],
});

// Returns formatted JSON for manual import to D&D Beyond
```

---

## VTT Integration

### Foundry VTT

#### Character Export

Export characters as Foundry actor JSON:

```typescript
const foundryActor = await trpc.characters.exportFoundry.mutate({
  characterId,
  system: 'dnd5e', // Foundry system
});

// Download as .json file
```

#### Journal Import

Import Foundry journal entries as wiki pages:

```typescript
await trpc.wiki.importFoundryJournal.mutate({
  campaignId,
  journalData: foundryJournalJson,
});
```

#### Module Integration

QuiverDM Foundry module (future):
- Sync characters bidirectionally
- Import session notes
- Link scenes to wiki pages

### Roll20

#### Character Export

Export in Roll20 JSON format:

```typescript
const roll20Char = await trpc.characters.exportRoll20.mutate({
  characterId,
});
```

#### API Integration

Limited by Roll20 API, but can:
- Export character data
- Link to Roll20 campaign

### Fantasy Grounds

Export homebrew in Fantasy Grounds XML format:

```typescript
const fgModule = await trpc.homebrew.exportFantasyGrounds.mutate({
  homebrewIds: ['creature_1', 'item_2'],
});

// Downloads as .mod file
```

---

## Export/Import

### Campaign Export

Full campaign backup:

```typescript
const exportData = await trpc.campaigns.export.mutate({
  campaignId,
  format: 'json', // or 'markdown', 'pdf'
  include: {
    sessions: true,
    npcs: true,
    wiki: true,
    homebrew: true,
    characters: true,
    transcripts: false, // Large, optional
  },
});
```

### Export Formats

| Format | Use Case |
|--------|----------|
| JSON | Full backup, import to another instance |
| Markdown | Wiki-style export, Obsidian import |
| PDF | Printable campaign book |

### Campaign Import

```typescript
await trpc.campaigns.import.mutate({
  data: importedJson,
  conflictResolution: 'skip', // or 'overwrite', 'rename'
});
```

---

## API Reference

### Discord Router

```typescript
trpc.discord.link.useMutation();
trpc.discord.unlink.useMutation();
trpc.discord.setChannel.useMutation();
trpc.discord.setWebhook.useMutation();
trpc.discord.getStatus.useQuery({ campaignId });
```

### Calendar Router

```typescript
trpc.calendar.getFeedUrl.useQuery();
trpc.calendar.connectGoogle.useMutation();
trpc.calendar.disconnectGoogle.useMutation();
trpc.calendar.getStatus.useQuery();
```

### Export Router

```typescript
trpc.export.campaign.useMutation();
trpc.export.characters.useMutation();
trpc.export.homebrew.useMutation();
trpc.import.campaign.useMutation();
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/discord-bot/` | Discord.js bot implementation |
| `src/lib/discord.ts` | Discord webhook utilities |
| `src/lib/ical.ts` | iCal feed generation |
| `src/lib/google-calendar.ts` | Google Calendar OAuth |
| `src/lib/dndbeyond-sync.ts` | D&D Beyond integration |
| `src/lib/vtt-export/` | VTT export utilities |
| `src/server/routers/discord.ts` | Discord endpoints |
| `src/server/routers/calendar.ts` | Calendar endpoints |
| `src/server/routers/export.ts` | Export/import endpoints |

---

## Environment Variables

```env
# Discord
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# D&D Beyond (for API access)
DNDBEYOND_API_KEY=
```

---

## Webhook Events

For external integrations, QuiverDM can send webhooks:

```typescript
// Configure webhook
await trpc.webhooks.create.mutate({
  campaignId,
  url: 'https://your-service.com/webhook',
  events: ['session.created', 'session.completed', 'recap.published'],
  secret: 'webhook-secret-for-verification',
});
```

### Webhook Payload

```typescript
{
  event: 'session.completed',
  timestamp: '2024-02-15T22:00:00Z',
  campaign: {
    id: 'campaign_123',
    name: 'Dragon Heist',
  },
  data: {
    sessionId: 'session_456',
    sessionNumber: 5,
    title: 'The Siege of Thornhold',
  },
  signature: 'sha256=...', // HMAC signature
}
```
