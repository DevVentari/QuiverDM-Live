# Player Dashboard Design

> Validated design for unified dashboard serving both DMs and players

## Summary

Transform the existing DM-only dashboard into a unified, mobile-first dashboard that adapts based on user context and roles across campaigns.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dashboard type | Unified | Most users are both DMs and players; avoid maintaining two dashboards |
| Layout priority | Context-aware | Show active/upcoming session prominently if today; otherwise characters first |
| Character cards | Minimal | Name, class, level, campaign badge - full details one tap away |
| Campaign display | Single list with badges | Role badge provides context; simpler than grouping |
| Sidebar | Collapsed to bottom | Quick actions only; remove tips/news/stats clutter |
| Quick actions | Role-aware | Show relevant actions based on user's campaign ownership |

## Page Structure

```
┌─────────────────────────────┐
│  Context Banner (if active) │  ← Session happening now or soon
├─────────────────────────────┤
│  Welcome, {firstName}       │
│  Subtitle based on context  │
├─────────────────────────────┤
│  My Characters              │  ← Horizontal scroll on mobile
│  [Card] [Card] [+New]       │
├─────────────────────────────┤
│  My Campaigns               │  ← Vertical list
│  [Campaign row with badge]  │
│  [Campaign row with badge]  │
├─────────────────────────────┤
│  Quick Actions (bottom)     │
└─────────────────────────────┘
```

## Context Banner

Logic for showing contextual information at the top:

| Condition | Banner Content |
|-----------|----------------|
| Session in progress | Purple banner - "Session Active in {Campaign}" with Join button |
| Session scheduled today | Subtle banner - "{Campaign} session at 7pm" |
| Pending campaign invite | "You've been invited to {Campaign}" with Accept/Decline |
| None of the above | Banner hidden |

## Welcome Header

- Greeting uses first name only (not "Dungeon Master")
- Subtitle adapts to context:
  - "You have a session today"
  - "3 characters across 2 campaigns"
  - "Ready to start your adventure?" (new user)

## My Characters Section

Horizontal scrolling card row on mobile, grid on desktop.

### Card Layout

```
┌──────────┐
│ Portrait │
│ Thorin   │
│ Dwarf    │
│ Fighter 8│
│ ⚔️ CoS   │
└──────────┘
```

### Card Contents

- Portrait thumbnail (or class icon placeholder)
- Character name
- Race (single word)
- Class + Level
- Campaign badge (abbreviated)

### Interactions

- Tap card → `/characters/[id]`
- Tap "+ Create" → `/characters/new`

### Empty State

```
🎭 No characters yet
Create your first character to join a campaign

[Create Character]
```

### Data Source

`trpc.characters.getMyCharacters` (exists)

## My Campaigns Section

Vertical list with role badges.

### Row Layout

```
┌─────────────────────────────────────────────┐
│ 🏰 Curse of Strahd              DM 👑      │
│ 12 sessions · 5 players                     │
│ Last session: 3 days ago                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🐉 Dragon Heist                 Player 🎭   │
│ Playing: Thorin (Fighter 8)                 │
│ Next session: Tomorrow 7pm                  │
└─────────────────────────────────────────────┘
```

### Row Contents by Role

| Role | Shows |
|------|-------|
| DM/Co-DM | Session count, player count, last session date |
| Player | Your character name/class, next session date |

### Role Badges

- 👑 DM (Owner)
- 👥 Co-DM
- 🎭 Player
- 👁️ Spectator

### Interactions

- Tap row → `/campaigns/[id]`
- "+ New" button → `/campaigns/new`

### Data Source

**NEW ENDPOINT NEEDED**: `trpc.campaigns.getMyMemberships`

Returns campaigns where user is a member (any role), including:
- Campaign details
- User's role
- User's character in that campaign (if player)
- Next scheduled session (if any)

## Quick Actions

Sticky bar at bottom on mobile, inline on desktop.

### Actions by Role

| Action | Show When |
|--------|-----------|
| Create Character | Always |
| Join Campaign | Always |
| Create Campaign | Always (everyone can DM) |
| Upload PDF | User owns ≥1 campaign |

### Layout

```
[🎭 Create Character]  [🔗 Join Campaign]
[🏰 Create Campaign]   [📚 Upload PDF]
```

## New User Empty State

When user has no characters AND no campaign memberships:

```
🎲 Welcome to QuiverDM

Are you here to play or run a game?

┌─────────────┐    ┌─────────────┐
│ 🎭 I'm a    │    │ 👑 I'm a    │
│   Player    │    │     DM      │
└─────────────┘    └─────────────┘

(You can do both later!)
```

- **Player path** → Join Campaign flow
- **DM path** → Create Campaign flow

## Technical Requirements

### New Backend Endpoint

```typescript
// src/server/routers/campaigns.ts
getMyMemberships: protectedProcedure.query(async ({ ctx }) => {
  // Return all campaigns where user is a member
  // Include: campaign, role, permissions, user's character, next session
})
```

### Frontend Components

| Component | Location |
|-----------|----------|
| Dashboard page | `src/app/dashboard/page.tsx` (replace existing) |
| ContextBanner | `src/components/dashboard/ContextBanner.tsx` |
| CharacterCard | `src/components/dashboard/CharacterCard.tsx` |
| CampaignRow | `src/components/dashboard/CampaignRow.tsx` |
| QuickActions | `src/components/dashboard/QuickActions.tsx` |
| EmptyState | `src/components/dashboard/EmptyState.tsx` |

### Data Fetching

Convert from server component with Prisma to client component with tRPC:
- Enables real-time updates
- Consistent with rest of app patterns
- Better loading states

## Mobile Considerations

- Touch targets: 44px minimum
- Horizontal scroll for characters (swipe gesture)
- Sticky quick actions at bottom
- No sidebar on mobile
- Portrait-optimized card layout
