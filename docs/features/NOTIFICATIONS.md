# Notifications

Keep users informed about campaign activity across email, push notifications, Discord, and in-app alerts.

## Features

- **Multi-Channel**: Email, push, Discord webhooks, in-app
- **User Preferences**: Per-channel toggles
- **Smart Batching**: Digest mode for less interruption
- **Quiet Hours**: Respect user schedules

## Notification Types

| Event | Description | Default Channels |
|-------|-------------|------------------|
| `session.scheduled` | New session scheduled | Email, Push, Discord |
| `session.reminder.24h` | Session in 24 hours | Email, Push |
| `session.reminder.1h` | Session in 1 hour | Push |
| `session.started` | Session is now active | Push |
| `session.recap` | Recap published | Email, Push, Discord |
| `campaign.invite` | Invited to campaign | Email |
| `campaign.joined` | Someone joined campaign | In-app (DM only) |
| `character.approved` | Character approved by DM | Email, Push |
| `homebrew.shared` | Content shared to campaign | In-app |
| `mention` | Mentioned in notes/recap | Push, In-app |

## Database Schema

```prisma
model Notification {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(...)

  type         String    // Event type
  title        String
  body         String
  data         Json?     // Additional context

  // Delivery status
  channels     String[]  // Channels it was sent to
  readAt       DateTime?
  clickedAt    DateTime?

  // References
  campaignId   String?
  sessionId    String?
  contentId    String?   // Generic content reference

  createdAt    DateTime  @default(now())

  @@index([userId, readAt])
  @@index([userId, createdAt])
}

model NotificationPreferences {
  id           String    @id @default(cuid())
  userId       String    @unique
  user         User      @relation(...)

  // Channel toggles
  emailEnabled Boolean   @default(true)
  pushEnabled  Boolean   @default(true)
  discordEnabled Boolean @default(true)
  inAppEnabled Boolean   @default(true)

  // Per-type overrides (JSON)
  typeOverrides Json?    // { "session.reminder.24h": { email: false } }

  // Timing
  quietHoursStart String? // "22:00"
  quietHoursEnd   String? // "08:00"
  timezone        String  @default("UTC")

  // Digest mode
  digestMode    Boolean   @default(false)
  digestTime    String?   // "09:00" - when to send digest

  updatedAt     DateTime  @updatedAt
}

model PushSubscription {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(...)

  endpoint     String    @unique
  keys         Json      // { p256dh, auth }
  userAgent    String?

  createdAt    DateTime  @default(now())

  @@index([userId])
}
```

## API Reference

### Notifications Router

```typescript
// Get user's notifications
trpc.notifications.getAll.useQuery({
  unreadOnly: false,
  limit: 50,
});

// Get unread count
trpc.notifications.getUnreadCount.useQuery();

// Mark as read
trpc.notifications.markAsRead.useMutation({
  notificationId,
});

// Mark all as read
trpc.notifications.markAllAsRead.useMutation();

// Delete notification
trpc.notifications.delete.useMutation({
  notificationId,
});
```

### Preferences

```typescript
// Get preferences
trpc.notifications.getPreferences.useQuery();

// Update preferences
trpc.notifications.updatePreferences.useMutation({
  emailEnabled: true,
  pushEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  digestMode: false,
});

// Update per-type preference
trpc.notifications.updateTypePreference.useMutation({
  type: 'session.reminder.24h',
  channel: 'email',
  enabled: false,
});
```

### Push Subscriptions

```typescript
// Subscribe to push
trpc.notifications.subscribePush.useMutation({
  subscription: pushSubscriptionObject,
});

// Unsubscribe
trpc.notifications.unsubscribePush.useMutation({
  endpoint: subscription.endpoint,
});
```

## Sending Notifications

### Internal API

```typescript
import { sendNotification } from '@/lib/notifications';

await sendNotification({
  userId: targetUserId,
  type: 'session.recap',
  title: 'Session 5 Recap Available',
  body: 'The DM has published the recap for last night\'s session.',
  data: {
    campaignId,
    sessionId,
    url: `/campaigns/${campaignId}/sessions/${sessionId}`,
  },
});
```

### Bulk Notifications

```typescript
import { sendBulkNotification } from '@/lib/notifications';

// Notify all campaign members
await sendBulkNotification({
  userIds: campaignMemberIds,
  type: 'session.scheduled',
  title: 'Session 6 Scheduled',
  body: 'Friday at 7pm - The Siege of Thornhold continues!',
  data: { campaignId, scheduledSessionId },
});
```

## Email Notifications

### Provider: Resend

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'QuiverDM <notifications@quiverdm.com>',
  to: user.email,
  subject: notification.title,
  react: <SessionRecapEmail recap={recap} campaign={campaign} />,
});
```

### Email Templates

```tsx
// src/emails/SessionRecapEmail.tsx
export function SessionRecapEmail({ recap, campaign }) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container>
          <Heading>{campaign.name}</Heading>
          <Text>A new session recap is available!</Text>

          <Section>
            <Heading as="h2">{recap.title}</Heading>
            <Markdown>{recap.content}</Markdown>
          </Section>

          <Button href={recapUrl}>
            Read Full Recap
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

## Push Notifications

### Web Push Setup

```typescript
// Generate VAPID keys (one-time)
const vapidKeys = webpush.generateVAPIDKeys();

// Configure
webpush.setVapidDetails(
  'mailto:support@quiverdm.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Send push
await webpush.sendNotification(subscription, JSON.stringify({
  title: notification.title,
  body: notification.body,
  icon: '/icon-192.png',
  badge: '/badge-72.png',
  data: {
    url: notification.data.url,
  },
}));
```

### Service Worker

```typescript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: data.data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

## Discord Integration

### Webhook Setup

```typescript
// Store webhook URL per campaign
model CampaignDiscord {
  id           String    @id @default(cuid())
  campaignId   String    @unique
  webhookUrl   String
  channelName  String?

  // What to post
  postRecaps   Boolean   @default(true)
  postSchedule Boolean   @default(true)
  postReminders Boolean  @default(true)
}
```

### Sending Discord Messages

```typescript
import { sendDiscordNotification } from '@/lib/discord';

await sendDiscordNotification({
  campaignId,
  type: 'session.recap',
  embed: {
    title: '📜 Session 5 Recap',
    description: recap.summary,
    color: 0x8B5CF6, // Purple
    fields: [
      { name: 'Key Events', value: recap.keyEvents.join('\n') },
      { name: 'NPCs Met', value: recap.npcs.join(', ') },
    ],
    footer: { text: 'QuiverDM' },
    url: recapUrl,
  },
});
```

## In-App Notifications

### Notification Bell

```tsx
<NotificationBell>
  <NotificationList
    notifications={notifications}
    onNotificationClick={handleClick}
    onMarkAllRead={handleMarkAllRead}
  />
</NotificationBell>
```

### Real-Time Updates

```typescript
// Subscribe to new notifications
trpc.notifications.subscribe.useSubscription(undefined, {
  onData: (notification) => {
    // Show toast
    toast({
      title: notification.title,
      description: notification.body,
      action: (
        <Button onClick={() => router.push(notification.data.url)}>
          View
        </Button>
      ),
    });

    // Update unread count
    refetchUnreadCount();
  },
});
```

## Components

### NotificationBell

Header notification icon:

```tsx
<NotificationBell
  unreadCount={unreadCount}
  onClick={() => setOpen(true)}
/>
```

### NotificationList

Notification dropdown/panel:

```tsx
<NotificationList
  notifications={notifications}
  onNotificationClick={(n) => {
    markAsRead(n.id);
    router.push(n.data.url);
  }}
/>
```

### NotificationPreferencesForm

Settings form:

```tsx
<NotificationPreferencesForm
  preferences={preferences}
  onSave={handleSave}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/notifications.ts` | Notification endpoints |
| `src/lib/notifications.ts` | Notification sending logic |
| `src/lib/email.ts` | Email provider (Resend) |
| `src/lib/discord.ts` | Discord webhook integration |
| `src/lib/web-push.ts` | Push notification service |
| `src/emails/` | Email templates |
| `src/components/NotificationBell.tsx` | UI component |
| `public/sw.js` | Service worker for push |

## Quiet Hours

Notifications are held during quiet hours:

```typescript
function shouldSendNow(userId: string, channel: string): boolean {
  const prefs = await getPreferences(userId);

  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return true;
  }

  const now = DateTime.now().setZone(prefs.timezone);
  const start = DateTime.fromFormat(prefs.quietHoursStart, 'HH:mm', { zone: prefs.timezone });
  const end = DateTime.fromFormat(prefs.quietHoursEnd, 'HH:mm', { zone: prefs.timezone });

  // Check if now is within quiet hours
  if (start < end) {
    return now < start || now > end;
  } else {
    // Overnight quiet hours (e.g., 22:00 - 08:00)
    return now > end && now < start;
  }
}
```

## Digest Mode

When enabled, notifications are batched into a daily digest:

```typescript
// Cron job at user's digest time
async function sendDigests() {
  const users = await getUsersWithPendingDigest();

  for (const user of users) {
    const notifications = await getPendingNotifications(user.id);

    if (notifications.length === 0) continue;

    await sendEmail({
      to: user.email,
      subject: `QuiverDM Daily Digest - ${notifications.length} updates`,
      react: <DigestEmail notifications={notifications} />,
    });

    await markNotificationsSent(notifications);
  }
}
```

## Testing

### Test Notification

```typescript
// Admin/debug endpoint
await trpc.notifications.sendTest.mutate({
  channel: 'push',
});
```

### Webhook Testing

```bash
# Test Discord webhook
curl -X POST $WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Test notification from QuiverDM"}'
```
