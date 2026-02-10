# Implementation Status

This document tracks what has been implemented vs what is still in the design phase.

## Phase 0: Foundation ✅ COMPLETE

**Goal**: Multi-user infrastructure without breaking existing features

### Database Schema

| Model | Status | Notes |
|-------|--------|-------|
| `CampaignRole` enum | ✅ Implemented | OWNER, CO_DM, PLAYER, SPECTATOR |
| `ContentVisibility` enum | ✅ Implemented | PRIVATE, CAMPAIGN, PUBLIC, UNLISTED |
| `CampaignMember` | ✅ Implemented | Full role-based membership with granular permissions |
| `CampaignInvite` | ✅ Implemented | Code-based and email-based invites |
| User extensions | ✅ Implemented | displayName, bio, campaignMemberships |
| Campaign extensions | ✅ Implemented | members, invites, inviteCode, isPublic, settings |

### Backend API

| Router/Function | Status | Location |
|-----------------|--------|----------|
| `verifyCampaignMembership()` | ✅ Implemented | `src/server/lib/ownership.ts` |
| `verifyCampaignRole()` | ✅ Implemented | `src/server/lib/ownership.ts` |
| `verifyCanEditNPCs()` | ✅ Implemented | `src/server/lib/ownership.ts` |
| `verifyCanViewNPCSecrets()` | ✅ Implemented | `src/server/lib/ownership.ts` |
| `verifyCanManageSessions()` | ✅ Implemented | `src/server/lib/ownership.ts` |
| `verifyCanInviteMembers()` | ✅ Implemented | `src/server/lib/ownership.ts` |
| `campaignMemberProcedure` | ✅ Implemented | `src/server/trpc.ts` |
| `campaignDMProcedure` | ✅ Implemented | `src/server/trpc.ts` |
| `campaignOwnerProcedure` | ✅ Implemented | `src/server/trpc.ts` |
| Members Router | ✅ Implemented | `src/server/routers/members.ts` |

### Members Router Endpoints

| Endpoint | Status | Description |
|----------|--------|-------------|
| `members.getAll` | ✅ | Get all campaign members |
| `members.getMyMembership` | ✅ | Get current user's membership |
| `members.getInvites` | ✅ | Get pending invites (DM only) |
| `members.createInvite` | ✅ | Create invite code |
| `members.regenerateInviteCode` | ✅ | Regenerate permanent invite code |
| `members.revokeInvite` | ✅ | Revoke an invite |
| `members.acceptInvite` | ✅ | Accept invite and join campaign |
| `members.updateRole` | ✅ | Change member role |
| `members.updatePermissions` | ✅ | Update granular permissions |
| `members.remove` | ✅ | Remove member from campaign |
| `members.leave` | ✅ | Leave a campaign |
| `members.transferOwnership` | ✅ | Transfer ownership to another member |

---

## Phase 1: Player Experience ✅ CORE COMPLETE

**Goal**: Players can join campaigns and manage their own characters

### Database Schema

| Model | Status | Notes |
|-------|--------|-------|
| `CharacterStatus` enum | ✅ Implemented | PENDING, ACTIVE, RETIRED, DECEASED, REMOVED |
| `Character` | ✅ Implemented | Full D&D 5e character with all stats |
| `CampaignCharacter` | ✅ Implemented | Join table with status and DM notes |

### Character Model Fields

| Field | Status | Notes |
|-------|--------|-------|
| Core identity (name, race, class, level) | ✅ | |
| Ability scores | ✅ | JSON: { str, dex, con, int, wis, cha } |
| Hit points | ✅ | JSON: { current, max, temp } |
| AC, speed, proficiency bonus | ✅ | |
| Features | ✅ | JSON for class/race features |
| Proficiencies | ✅ | JSON for skills, tools, etc. |
| Inventory | ✅ | JSON for equipment |
| Spellcasting | ✅ | JSON for spells and slots |
| Currency | ✅ | JSON: { cp, sp, ep, gp, pp } |
| Backstory & personality | ✅ | Traits, ideals, bonds, flaws |
| D&D Beyond sync fields | ✅ | dndBeyondId, dndBeyondUrl, lastSyncedAt |
| Portability flag | ✅ | isPortable for multi-campaign use |

### Backend API

| Endpoint | Status | Description |
|----------|--------|-------------|
| `characters.getMyCharacters` | ✅ | Get all user's characters |
| `characters.getById` | ✅ | Get single character (owner only) |
| `characters.getCampaignCharacters` | ✅ | Get party members |
| `characters.create` | ✅ | Create new character |
| `characters.update` | ✅ | Update character (owner only) |
| `characters.delete` | ✅ | Delete character (owner only) |
| `characters.addToCampaign` | ✅ | Submit character to join campaign |
| `characters.approveCharacter` | ✅ | DM approves pending character |
| `characters.updateCampaignStatus` | ✅ | DM changes character status |
| `characters.removeFromCampaign` | ✅ | Remove character from campaign |
| `characters.updateDMNotes` | ✅ | DM adds private notes |

### Campaigns Router Updates

| Change | Status | Description |
|--------|--------|-------------|
| `getAll` includes membership | ✅ | Returns myRole, myPermissions |
| `getById` uses membership check | ✅ | Verifies membership, not just ownership |
| `getBySlug` uses membership check | ✅ | Verifies membership, not just ownership |
| `create` creates owner membership | ✅ | Auto-creates CampaignMember on new campaign |
| NPC secrets filtered by role | ✅ | Players don't see secrets unless permitted |
| Character info included | ✅ | Active characters in campaign response |
| Member list included | ✅ | All members with user info |

### Frontend (Not Yet Implemented)

| Component | Status | Priority |
|-----------|--------|----------|
| Player Dashboard | ❌ Planned | High |
| Character Sheet | ❌ Planned | High |
| Character Creation Form | ❌ Planned | High |
| Campaign Join Flow | ❌ Planned | High |
| Party View | ❌ Planned | Medium |
| D&D Beyond Import | ❌ Planned | Medium |

---

## Phase 2: DM Collaboration (Not Started)

| Feature | Status |
|---------|--------|
| Campaign Members Management UI | ❌ Planned |
| Co-DM Features | ❌ Planned |
| Player Approval Workflow | ❌ Planned |
| Permission Override UI | ❌ Planned |

---

## Phase 3: Content Sharing (Not Started)

| Feature | Status |
|---------|--------|
| Homebrew visibility settings | ❌ Planned |
| Public homebrew browsing | ❌ Planned |
| Creator profiles | ❌ Planned |
| Favorites system | ❌ Planned |

---

## Phase 4: Real-Time Features (Not Started)

| Feature | Status |
|---------|--------|
| Live transcription during sessions | ❌ Planned |
| WebSocket presence | ❌ Planned |
| Dice rolling | ❌ Planned |
| Initiative tracker | ❌ Planned |

---

## Phase 5: Marketplace (Not Started)

| Feature | Status |
|---------|--------|
| Publishing workflow | ❌ Planned |
| Analytics | ❌ Planned |
| Collections | ❌ Planned |

---

## Cross-Cutting Features

| Feature | Status | Phase |
|---------|--------|-------|
| Mobile Responsive UI | ❌ Planned | All |
| Global Search | ❌ Planned | 0-1 |
| AI Session Summaries | ❌ Planned | 1 |
| Campaign Wiki/Lore | ❌ Planned | 1-2 |
| Session Scheduling | ❌ Planned | 2 |
| Notifications | ❌ Planned | 1-2 |
| Export/Backup | ❌ Planned | 2 |
| Encounter Builder | ❌ Planned | 2-3 |
| Onboarding Wizard | ❌ Planned | 1 |

---

## Integrations

| Integration | Status | Priority |
|-------------|--------|----------|
| Discord Bot | ❌ Planned | High |
| Calendar Sync | ❌ Planned | High |
| VTT Integration | ❌ Planned | Medium |

---

## Key Implementation Files

### Phase 0 Files
- `prisma/schema.prisma` - Database models
- `src/server/lib/ownership.ts` - Membership verification
- `src/server/trpc.ts` - tRPC middleware
- `src/server/routers/members.ts` - Members router
- `src/server/routers/campaigns.ts` - Updated campaigns router

### Phase 1 Files
- `prisma/schema.prisma` - Character and CampaignCharacter models
- `src/server/routers/characters.ts` - Characters router

### Migration Scripts
- `scripts/migrate-campaign-members.ts` - Migrates existing campaigns to membership model
