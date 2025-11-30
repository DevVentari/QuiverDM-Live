# QuiverDM Product Vision: The All-in-One D&D Ecosystem

> **"D&D Beyond for homebrew meets DMsGuild"**

## Vision Statement

QuiverDM is a complete D&D ecosystem where:
- **DMs** manage campaigns, sessions, and content seamlessly
- **Players** manage their own characters with integrated homebrew
- **Content Creators** publish and share homebrew with the community
- **AI** powers everything invisibly (not as a feature, but as magic behind the scenes)

---

## Current State vs Target State

| Capability | Current | Target |
|------------|---------|--------|
| Users | Single-user (DM only) | Multi-user (DM, Players, Creators) |
| Characters | DM-managed "Player" records | Player-owned Character sheets |
| Collaboration | None | Campaign membership, co-DMs, player access |
| Content Sharing | Private only | Private, Campaign, Public, Marketplace |
| Sessions | Post-session transcription | Live transcription + real-time features |
| Homebrew | Personal library | Shareable/publishable ecosystem |

---

## Core Principles

1. **Mobile-First** - Players use phones at the table; every feature must work well on mobile
2. **AI-Powered, Not AI-Branded** - AI makes things magical, but users don't see "AI" everywhere
3. **Search Everything** - Global search across all content types is fundamental UX
4. **DM Time-Saver** - Every feature should reduce DM prep time, not add to it

---

## Roadmap Overview

| Phase | Timeline | Focus |
|-------|----------|-------|
| **0: Foundation** | Weeks 1-3 | Multi-user model, campaign membership, roles |
| **1: Player Experience** | Weeks 4-7 | Character sheets, join campaigns, player dashboard |
| **2: DM Collaboration** | Weeks 8-10 | Co-DMs, member management, permissions |
| **3: Content Sharing** | Weeks 11-13 | Public homebrew, creator profiles, favorites |
| **4: Real-Time** | Weeks 14-19 | Live transcription, presence, dice, initiative |
| **5: Marketplace** | Weeks 20-23 | Publishing workflow, analytics, collections |

### Cross-Cutting Features (Integrated Throughout)

These features are woven into multiple phases rather than being standalone:

| Feature | Integrated In | Description |
|---------|---------------|-------------|
| **Mobile Responsive UI** | All Phases | Every page mobile-optimized from day 1 |
| **Global Search** | Phase 0-1 | Search across sessions, NPCs, homebrew, transcripts |
| **AI Session Summaries** | Phase 1 | Auto-generate recaps from transcription |
| **Campaign Wiki/Lore** | Phase 1-2 | World-building pages (locations, factions, lore) |
| **Session Scheduling** | Phase 2 | Calendar, next session, player RSVPs |
| **Notifications** | Phase 1-2 | Email/push for invites, recaps, schedule changes |
| **Export/Backup** | Phase 2 | Download campaign data as PDF/JSON |
| **Encounter Builder** | Phase 2-3 | Build combat with CR calculation |
| **Onboarding Wizard** | Phase 1 | Guided campaign setup with templates |

### Integrations (Phase 3+)

| Integration | Priority | Description |
|-------------|----------|-------------|
| **Discord Bot** | High | Post recaps, schedule sessions, dice rolls in Discord |
| **Calendar Sync** | High | Google Calendar / iCal export for sessions |
| **VTT Integration** | Medium | Foundry/Roll20 character sync, session linking |

---

## Phase 0: Foundation

**Goal**: Multi-user infrastructure without breaking existing features

### New Data Models

```prisma
enum CampaignRole {
  OWNER      // Full control
  CO_DM      // Almost full control
  PLAYER     // Manage own character, view shared content
  SPECTATOR  // Read-only
}

enum ContentVisibility {
  PRIVATE    // Only creator
  CAMPAIGN   // Campaign members
  PUBLIC     // Everyone
  UNLISTED   // Link-only access
}

model CampaignMember {
  id          String       @id @default(cuid())
  campaignId  String
  campaign    Campaign     @relation(...)
  userId      String
  user        User         @relation(...)
  role        CampaignRole @default(PLAYER)
  joinedAt    DateTime     @default(now())

  // Granular permissions
  canViewNPCSecrets    Boolean @default(false)
  canEditNPCs          Boolean @default(false)
  canManageSessions    Boolean @default(false)
  canInviteMembers     Boolean @default(false)

  @@unique([campaignId, userId])
}

model CampaignInvite {
  id          String       @id @default(cuid())
  campaignId  String
  code        String?      @unique  // For link sharing
  email       String?               // For direct invite
  role        CampaignRole @default(PLAYER)
  expiresAt   DateTime?
  usedAt      DateTime?
  usedBy      String?
}
```

### User & Campaign Extensions

```prisma
model User {
  // ... existing fields
  displayName          String?
  bio                  String?  @db.Text
  campaignMemberships  CampaignMember[]
  characters           Character[]
}

model Campaign {
  // ... existing fields
  members      CampaignMember[]
  invites      CampaignInvite[]
  inviteCode   String?  @unique  // Quick join code
  isPublic     Boolean  @default(false)
}
```

### Code Changes

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add CampaignMember, CampaignInvite, enums |
| `src/server/lib/ownership.ts` | Add role-based verification |
| `src/server/trpc.ts` | Add campaignMemberProcedure middleware |
| `src/server/routers/campaigns.ts` | Add members sub-router |
| `src/lib/auth.ts` | Extend session with role info |

### Migration Strategy

1. Create new tables (non-breaking)
2. For each existing Campaign, create CampaignMember with role=OWNER for current userId
3. Update routers to use membership checks

---

## Phase 1: Player Experience

**Goal**: Players can join campaigns and manage their own characters

### Character Model

```prisma
model Character {
  id              String    @id @default(cuid())

  // Ownership - flexible model
  userId          String?   // null = DM-controlled (NPC or unassigned)
  user            User?     @relation(...)
  isPortable      Boolean   @default(true)  // Can be used in multiple campaigns

  // Core identity
  name            String
  race            String?
  class           String?
  subclass        String?
  level           Int       @default(1)
  background      String?

  // Visuals
  portraitUrl     String?

  // Flexible data (D&D Beyond compatible)
  stats           Json?     // Ability scores, HP, AC
  features        Json?     // Class/racial features
  inventory       Json?     // Items
  spellbook       Json?     // Spells
  backstory       String?   @db.Text
  notes           String?   @db.Text

  // D&D Beyond sync
  dndBeyondId     String?   @unique
  dndBeyondUrl    String?
  lastSyncedAt    DateTime?

  // Campaign associations
  campaignCharacters  CampaignCharacter[]
}

model CampaignCharacter {
  id           String    @id @default(cuid())
  campaignId   String
  characterId  String

  isActive     Boolean   @default(true)
  status       String    @default("active")  // active, retired, deceased
  dmNotes      String?   @db.Text  // DM-only notes

  @@unique([campaignId, characterId])
}
```

### Features

1. **Player Dashboard** (`/dashboard`)
   - My Characters list
   - Campaigns I'm in
   - Quick access to active sessions

2. **Character Sheet** (`/characters/[id]`)
   - Full character management
   - Stats, features, inventory, spells
   - D&D Beyond sync button
   - Add to campaign flow

3. **Campaign Join Flow**
   - Join via invite code
   - Join via email invite
   - Select/create character for campaign

4. **Player Campaign View** (`/campaigns/[id]`)
   - Session recaps (shared by DM)
   - Campaign notes
   - NPC gallery (public info only)
   - Other party members

---

## Phase 2: DM Collaboration

**Goal**: DMs can collaborate and manage player access

### Features

1. **Campaign Members Management** (`/campaigns/[id]/members`)
   - View all members with roles
   - Invite new members (code, email, or username)
   - Change roles
   - Remove members
   - Set granular permissions

2. **Co-DM Features**
   - Shared NPC editing
   - Both can create/edit sessions
   - Both see all secrets
   - Cannot delete campaign (owner only)

3. **Player Approval Workflow**
   - DM approves characters joining campaign
   - DM can assign existing NPCs to players
   - Character status management (active/retired/deceased)

4. **Permission Overrides**
   - Player X can see NPC secrets (spy character)
   - Player Y can manage sessions (note-taker)

---

## Phase 3: Content Sharing

**Goal**: Homebrew can be shared beyond private use

### Schema Additions

```prisma
model HomebrewContent {
  // ... existing fields
  visibility   ContentVisibility  @default(PRIVATE)
  publishedAt  DateTime?
  version      Int                @default(1)
  downloads    Int                @default(0)
}

model ContentFavorite {
  id         String          @id @default(cuid())
  userId     String
  contentId  String
  createdAt  DateTime        @default(now())

  @@unique([userId, contentId])
}
```

### Features

1. **Visibility Controls** - Set content as Private/Campaign/Public/Unlisted
2. **Public Homebrew Browser** (`/homebrew/browse`) - Search and filter public content
3. **Content Favorites** - Bookmark public content
4. **Creator Profiles** (`/creators/[username]`) - Public profile with published content

---

## Phase 4: Real-Time Features

**Goal**: Live session support

### Infrastructure

Expand existing WebSocket infrastructure with Redis PubSub for scaling:

```
Channels:
- campaign:{id}:presence      // Who's online
- session:{id}:live           // Active session updates
- session:{id}:transcription  // Live transcription stream
- session:{id}:dice           // Dice rolls
```

### Features (Priority Order)

1. **Session Presence** - See who's online, "Join session" button
2. **Live Session Dashboard** - DM controls, attendance, shared notes
3. **Live Transcription** - Stream transcription as it happens
4. **Shared Dice Rolling** - Party-visible rolls, DM secret rolls
5. **Initiative Tracker** - Shared combat order

---

## Phase 5: Content Marketplace

**Goal**: Enable content creator ecosystem

### Features

1. **Publishing Workflow** - Draft → Review → Published states
2. **Analytics Dashboard** - Download/favorite counts
3. **Collections/Bundles** - Group related content
4. **Future: Monetization** - Paid content, creator payouts

---

## Cross-Cutting Feature Details

### Global Search

**Integrated in**: Phase 0-1

A unified search experience across all content types.

```
Search Index (MeiliSearch):
- Sessions (titles, notes, recaps)
- Transcripts (full text, speaker labels)
- NPCs (name, description, secrets for DMs)
- Players/Characters (name, backstory)
- Homebrew (name, description, type)
- Wiki Pages (title, content)
```

**Features**:
- Single search bar in header (available everywhere)
- Faceted results by type
- Quick filters (this campaign only, all campaigns)
- Keyboard shortcut (Cmd/Ctrl+K)
- Recent searches

**Implementation**: Extend existing MeiliSearch integration to index all content types.

---

### AI Session Summaries

**Integrated in**: Phase 1

Automatically generate session recaps from transcription.

**Flow**:
1. Transcription completes (existing)
2. AI analyzes transcript → generates structured summary
3. DM reviews/edits summary
4. Publish to players

**Summary Structure**:
```markdown
## Session 5: The Siege of Thornhold

### What Happened
- Party arrived at Thornhold to find it under siege
- Negotiated with orc warband leader
- Discovered traitor among the guards

### Key Decisions
- Chose diplomacy over combat
- Agreed to investigate the missing shipments

### NPCs Encountered
- Grukka the Wise (orc warband leader)
- Captain Aldric (revealed as traitor)

### Loot & Rewards
- 500gp from grateful townsfolk
- Map to the Sunken Temple

### Quotes of the Session
> "I seduce the orc... with my cooking skills" - Bard
```

**AI Provider**: Use existing Anthropic/OpenAI/Gemini integration.

---

### Campaign Wiki/Lore Pages

**Integrated in**: Phase 1-2

World-building beyond just NPCs.

**New Model**:
```prisma
model WikiPage {
  id           String    @id @default(cuid())
  campaignId   String
  campaign     Campaign  @relation(...)

  title        String
  slug         String    // URL-friendly
  content      String    @db.Text  // Markdown
  category     String    // location, faction, lore, item, etc.
  parentId     String?   // For hierarchical pages

  // Visibility (players can see some pages)
  isPublic     Boolean   @default(false)  // Visible to players

  // Metadata
  tags         String[]
  coverImage   String?

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([campaignId, slug])
}
```

**Categories**:
- **Locations** - Cities, dungeons, regions
- **Factions** - Organizations, guilds, governments
- **Lore** - History, mythology, cosmology
- **Items** - Artifacts, magic items (beyond homebrew stats)
- **Custom** - User-defined categories

**Features**:
- Rich markdown editor
- Image uploads
- Hierarchical pages (Location > City > District)
- Player visibility toggle per page
- Link to NPCs, sessions, homebrew
- AI-assisted generation (describe a location → get a wiki page)

---

### Session Scheduling

**Integrated in**: Phase 2

Coordinate when the party plays next.

**New Model**:
```prisma
model ScheduledSession {
  id           String    @id @default(cuid())
  campaignId   String
  campaign     Campaign  @relation(...)

  title        String?   // "Session 6" or custom name
  scheduledFor DateTime
  duration     Int?      // Minutes
  location     String?   // "Discord", "John's house", etc.
  notes        String?   // Prep notes

  // RSVPs
  rsvps        SessionRSVP[]

  // Reminders
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

**Features**:
- DM creates scheduled session with date/time
- Players receive notification
- RSVP with attending/maybe/declined
- Optional notes ("I'll be late")
- Calendar view of upcoming sessions
- Reminder notifications (24h before, 1h before)
- Auto-create GameSession record when session starts

---

### Notifications System

**Integrated in**: Phase 1-2

Keep everyone informed without checking the app constantly.

**Notification Types**:
| Event | Recipients | Channels |
|-------|------------|----------|
| Session scheduled | All members | Email, Push, Discord |
| Session reminder (24h, 1h) | Attending members | Email, Push |
| Recap published | All members | Email, Push, Discord |
| Invited to campaign | Invitee | Email |
| Character approved | Player | Email, Push |
| New homebrew shared | Campaign members | In-app |

**Technical**:
- Email: Resend or SendGrid
- Push: Web Push API (PWA)
- Discord: Webhook integration
- In-app: Notification bell with unread count

**User Preferences**:
- Per-channel toggles (email yes, push no)
- Quiet hours setting
- Digest mode (daily summary vs instant)

---

### Export/Backup

**Integrated in**: Phase 2

Users own their data. Full export anytime.

**Export Formats**:
- **JSON** - Complete data, importable to another instance
- **PDF** - Printable campaign book with all content
- **Markdown** - Wiki-style export for external use

**What's Included**:
- Campaign settings and metadata
- All sessions with notes, recaps, transcripts
- NPCs with stats and secrets
- Wiki pages
- Character sheets
- Homebrew content used in campaign

**Features**:
- One-click full campaign export
- Selective export (just NPCs, just sessions)
- Scheduled automatic backups (optional)
- Import from export (migrate between instances)

---

### Encounter Builder

**Integrated in**: Phase 2-3

Build balanced combat encounters quickly.

**Features**:
- Party composition input (characters + levels)
- Monster search (SRD + homebrew creatures)
- Auto-calculate encounter difficulty (Easy/Medium/Hard/Deadly)
- XP budget tracking
- Save encounters to sessions
- Quick-add from existing NPCs

**Data Model**:
```prisma
model Encounter {
  id           String    @id @default(cuid())
  campaignId   String
  sessionId    String?   // Optional link to session

  name         String
  description  String?

  // Monsters in encounter
  monsters     EncounterMonster[]

  // Calculated fields (stored for quick reference)
  difficulty   String?   // easy, medium, hard, deadly
  totalXp      Int?
  adjustedXp   Int?      // After multiplier for multiple monsters

  createdAt    DateTime  @default(now())
}

model EncounterMonster {
  id           String    @id @default(cuid())
  encounterId  String

  // Either homebrew or SRD reference
  homebrewId   String?   // Link to HomebrewContent (creature)
  srdMonster   String?   // SRD monster name

  quantity     Int       @default(1)
  notes        String?   // "Hidden behind altar", "Arrives round 3"
}
```

**CR Calculation**:
- Use standard 5e XP thresholds by level
- Apply multiplier for multiple monsters
- Compare to party XP threshold

---

### Onboarding Wizard

**Integrated in**: Phase 1

First-time users get guided setup.

**Flow**:
```
1. Welcome → "Are you a DM or Player?"
   ├── DM → Create Campaign flow
   └── Player → Join Campaign flow

2. DM: Create Campaign
   ├── Campaign name + description
   ├── Choose template (blank, classic fantasy, homebrew-heavy)
   ├── Import existing content? (D&D Beyond, PDF)
   └── Invite players (optional, skip for later)

3. Player: Join Campaign
   ├── Enter invite code
   ├── Create or import character
   └── View campaign overview
```

**Campaign Templates**:
- **Blank** - Empty campaign, full control
- **Classic Fantasy** - Pre-populated with common locations/factions
- **One-Shot** - Simplified structure for single sessions
- **West Marches** - Multiple parties, shared world

**Contextual Tips**:
- First session: "Add your session recording to get a transcript"
- First NPC: "NPCs can have secrets only you see"
- First homebrew: "Import from PDF or create manually"

---

### Discord Bot Integration

**Integrated in**: Phase 3+

Meet players where they already are.

**Bot Commands**:
```
/quiver schedule         - Show upcoming sessions
/quiver rsvp [yes|no|maybe] - RSVP to next session
/quiver recap            - Get latest session recap
/quiver roll 2d6+3       - Roll dice
/quiver npc [name]       - Quick NPC lookup
/quiver link             - Link Discord server to campaign
```

**Webhooks** (no bot required):
- Post session recaps automatically
- Post session reminders
- Announce new scheduled sessions

**Setup**:
1. Add QuiverDM bot to Discord server
2. `/quiver link` with campaign invite code
3. Set which channel for announcements

---

### Calendar Sync

**Integrated in**: Phase 3+

Sessions appear in players' calendars automatically.

**Supported**:
- Google Calendar (OAuth integration)
- iCal feed URL (works with any calendar app)
- Outlook/Office 365

**Features**:
- Auto-create calendar events for scheduled sessions
- Include session title, location (Discord link), notes
- Update/delete when session changes
- Per-user calendar connection

---

### VTT Integration

**Integrated in**: Phase 3+ (Medium Priority)

Connect to virtual tabletops for seamless play.

**Foundry VTT**:
- Export characters as Foundry actor JSON
- Import Foundry journal entries as wiki pages
- Link sessions to Foundry game instances

**Roll20**:
- Character sheet sync (limited by Roll20 API)
- Campaign link for quick access

**Fantasy Grounds**:
- Export homebrew in FG format

**Approach**: Start with export/import, not real-time sync. Real-time is complex and each VTT has different APIs.

---

### Mobile-First Design

**Integrated in**: All Phases

Every feature designed for mobile use at the table.

**Principles**:
- Touch-friendly tap targets (44px minimum)
- Bottom navigation on mobile
- Swipe gestures where appropriate
- Offline-capable for character sheets (PWA)
- Quick actions (dice roll, HP update) accessible in 1-2 taps

**Priority Mobile Views**:
1. Character sheet (player's primary view)
2. NPC quick reference (DM during session)
3. Session notes (quick capture)
4. Dice roller
5. Initiative tracker

**Technical**:
- Tailwind responsive utilities throughout
- Test on actual devices, not just Chrome DevTools
- Consider PWA for offline character sheets

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Character ownership | Flexible (portable OR campaign-locked) | Supports multiple play styles |
| Player access level | Full participation | Not just view-only; manage characters, add notes |
| Real-time technology | tRPC subscriptions + Redis PubSub | Type-safe, scalable, uses existing infra |
| Content visibility | Enum (PRIVATE → PUBLIC) | Simpler than ACLs, sufficient for needs |
| Migration approach | Gradual, non-breaking | Each phase deployable independently |

---

## Success Metrics

| Metric | What it Measures |
|--------|------------------|
| Users with 2+ campaigns | Returning DMs |
| Campaigns with 3+ members | Collaboration adoption |
| Characters claimed by players | Player adoption |
| Public homebrew published | Creator ecosystem health |
| Live sessions used | Real-time feature value |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Data migration breaks existing users | Incremental migrations, testing, rollback scripts |
| Permission bugs leak data | Fail-closed defaults, security tests, audit logging |
| Real-time doesn't scale | Redis PubSub from start, managed service option |
| Feature creep into VTT | Stay focused on DM tools, not battle maps |
| D&D Beyond API changes | Abstract sync layer, cache last known state |

---

## Implementation Files by Phase

### Phase 0: Foundation
- `prisma/schema.prisma` - CampaignMember, CampaignInvite, enums
- `src/server/lib/ownership.ts` - Role-based verification
- `src/server/trpc.ts` - campaignMemberProcedure middleware
- `src/server/routers/campaigns.ts` - Members sub-router
- `src/lib/auth.ts` - Extend session with role
- `src/components/GlobalSearch.tsx` - Search command palette (Cmd+K)
- `src/server/routers/search.ts` - Unified search endpoint

### Phase 1: Player Experience
- `prisma/schema.prisma` - Character, CampaignCharacter, WikiPage
- `src/server/routers/characters.ts` - New router (replaces players)
- `src/server/routers/wiki.ts` - Wiki pages CRUD
- `src/server/routers/session-summary.ts` - AI summary generation
- `src/app/dashboard/page.tsx` - Redesign for player view
- `src/app/characters/[id]/page.tsx` - Character sheet (mobile-first)
- `src/app/campaigns/[id]/join/page.tsx` - Join flow
- `src/app/campaigns/[id]/wiki/page.tsx` - Campaign wiki
- `src/lib/ai-summary.ts` - Session summary generation

### Phase 2: DM Collaboration
- `prisma/schema.prisma` - ScheduledSession, SessionRSVP
- `src/app/campaigns/[id]/members/page.tsx` - Member management UI
- `src/app/campaigns/[id]/schedule/page.tsx` - Session scheduling
- `src/server/routers/scheduling.ts` - Scheduling endpoints
- `src/server/routers/campaigns.ts` - Invite and permission endpoints
- All existing routers - Update permission checks for co-DM

### Phase 3: Content Sharing
- `prisma/schema.prisma` - Add visibility, ContentFavorite
- `src/server/routers/homebrew.ts` - Add public endpoints
- `src/app/homebrew/browse/page.tsx` - Public browser
- `src/app/creators/[username]/page.tsx` - Creator profiles

### Phase 4: Real-Time
- `src/lib/websocket-server.ts` - Expand for collaboration channels
- `src/server/routers/realtime.ts` - New router for subscriptions
- `src/app/campaigns/[id]/live/page.tsx` - Live session dashboard

### Cross-Cutting (All Phases)
- All `src/app/**/*.tsx` - Mobile-responsive design
- `src/components/ui/*` - Touch-friendly components
- `src/lib/meilisearch.ts` - Index all content types
- `src/lib/notifications.ts` - Notification service
- `src/lib/email.ts` - Email sending (Resend/SendGrid)

### Phase 1 Additions
- `src/app/onboarding/page.tsx` - Onboarding wizard
- `src/components/OnboardingWizard.tsx` - Step-by-step flow
- `src/lib/notifications.ts` - Basic notification system

### Phase 2 Additions
- `prisma/schema.prisma` - Encounter, EncounterMonster
- `src/server/routers/encounters.ts` - Encounter builder endpoints
- `src/app/campaigns/[id]/encounters/page.tsx` - Encounter builder UI
- `src/server/routers/export.ts` - Campaign export endpoints
- `src/app/campaigns/[id]/export/page.tsx` - Export UI

### Phase 3+ Integrations
- `src/server/routers/discord.ts` - Discord bot/webhook integration
- `src/server/routers/calendar.ts` - Calendar sync endpoints
- `src/lib/discord-bot/` - Discord.js bot implementation
- `src/lib/ical.ts` - iCal feed generation
- `src/lib/vtt-export/` - VTT export utilities
