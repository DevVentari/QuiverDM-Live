# Campaigns & Collaboration

Campaigns are the core organizational unit in QuiverDM. Each campaign contains sessions, NPCs, players, homebrew, and wiki pages.

## Status: ✅ Phase 0 Complete

The multi-user collaboration system is fully implemented in the backend.

## Features

- **Multi-User Support**: DMs, Co-DMs, Players, and Spectators
- **Role-Based Permissions**: Granular control over who can do what
- **Invite System**: Join via code, email, or direct invite
- **Campaign Settings**: Customize visibility and sharing

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **OWNER** | Campaign creator | Full control, can delete campaign |
| **CO_DM** | Assistant DM | Edit everything except delete/transfer |
| **PLAYER** | Party member | Manage own character, view shared content |
| **SPECTATOR** | Observer | Read-only access to shared content |

## Granular Permissions

Beyond roles, specific permissions can be granted to PLAYER and SPECTATOR roles:

| Permission | Default | Description |
|------------|---------|-------------|
| `canViewNPCSecrets` | false | See NPC secrets and hidden info |
| `canEditNPCs` | false | Create/edit NPCs |
| `canManageSessions` | false | Create/edit sessions |
| `canInviteMembers` | false | Invite new members |

Note: OWNER and CO_DM automatically have all permissions.

## Database Schema

```prisma
enum CampaignRole {
  OWNER     // Full control, can delete campaign
  CO_DM     // Almost full control, cannot delete or transfer
  PLAYER    // Manage own character, view shared content
  SPECTATOR // Read-only access to shared content
}

enum ContentVisibility {
  PRIVATE   // Only creator can see
  CAMPAIGN  // Visible to campaign members
  PUBLIC    // Visible to all users
  UNLISTED  // Anyone with link can view
}

model Campaign {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  description  String?  @db.Text
  bannerUrl    String?
  status       String   @default("active")

  // Legacy owner (kept for backward compatibility)
  userId       String
  user         User     @relation(...)

  // Multi-user collaboration
  members      CampaignMember[]
  invites      CampaignInvite[]
  inviteCode   String?  @unique  // Quick join code
  isPublic     Boolean  @default(false)
  settings     Json?

  // Content relations
  gameSessions GameSession[]
  npcs         NPC[]
  characters   CampaignCharacter[]
  // ... other relations
}

model CampaignMember {
  id          String       @id @default(cuid())
  campaignId  String
  campaign    Campaign     @relation(...)
  userId      String
  user        User         @relation(...)
  role        CampaignRole @default(PLAYER)
  joinedAt    DateTime     @default(now())
  invitedBy   String?

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
  campaign    Campaign     @relation(...)

  code        String?      @unique  // Random code for link sharing
  email       String?               // Direct email invitation
  role        CampaignRole @default(PLAYER)
  createdBy   String
  message     String?      @db.Text
  expiresAt   DateTime?
  usedAt      DateTime?
  usedBy      String?

  createdAt   DateTime     @default(now())
}
```

## API Reference

### Campaigns Router (`trpc.campaigns.*`)

```typescript
// Get all campaigns where user is a member
const { data: campaigns } = trpc.campaigns.getAll.useQuery();
// Returns: campaigns with myRole and myPermissions

// Get single campaign by ID
const { data: campaign } = trpc.campaigns.getById.useQuery({ id: campaignId });
// Returns: campaign with members, characters, filtered NPC secrets

// Get campaign by slug
const { data: campaign } = trpc.campaigns.getBySlug.useQuery({ slug: 'my-campaign' });

// Create campaign (automatically creates OWNER membership)
const mutation = trpc.campaigns.create.useMutation();
await mutation.mutateAsync({
  name: 'My Campaign',
  description: 'A new adventure',
});

// Update campaign
await trpc.campaigns.update.mutateAsync({
  id: campaignId,
  name: 'Updated Name',
  description: 'Updated description',
});

// Delete campaign (owner only)
await trpc.campaigns.delete.mutateAsync({ id: campaignId });
```

### Members Router (`trpc.members.*`)

```typescript
// Get all members of a campaign
const { data: members } = trpc.members.getAll.useQuery({ campaignId });

// Get current user's membership
const { data: membership } = trpc.members.getMyMembership.useQuery({ campaignId });

// Get pending invites (DM only)
const { data: invites } = trpc.members.getInvites.useQuery({ campaignId });

// Create an invite
await trpc.members.createInvite.mutateAsync({
  campaignId,
  role: 'PLAYER',           // Default role for invitee
  email: 'player@email.com', // Optional: email-specific invite
  message: 'Join us!',       // Optional message
  expiresInDays: 7,          // Optional expiration
});

// Regenerate permanent invite code (owner only)
const { inviteCode } = await trpc.members.regenerateInviteCode.mutateAsync({ campaignId });

// Revoke an invite
await trpc.members.revokeInvite.mutateAsync({
  campaignId,
  inviteId,
});

// Accept an invite (join campaign)
const result = await trpc.members.acceptInvite.mutateAsync({
  code: 'ABC123XY',
});
// Returns: { campaignId, campaignName, campaignSlug, role }

// Update member role (DM only, owner for CO_DM changes)
await trpc.members.updateRole.mutateAsync({
  campaignId,
  memberId,
  role: 'CO_DM',
});

// Update granular permissions (DM only)
await trpc.members.updatePermissions.mutateAsync({
  campaignId,
  memberId,
  canViewNPCSecrets: true,
  canEditNPCs: false,
});

// Remove member (DM only, owner for CO_DM)
await trpc.members.remove.mutateAsync({
  campaignId,
  memberId,
});

// Leave campaign (self-removal, owner cannot leave)
await trpc.members.leave.mutateAsync({ campaignId });

// Transfer ownership (owner only)
await trpc.members.transferOwnership.mutateAsync({
  campaignId,
  newOwnerId: userId,
});
```

## Authorization Middleware

### tRPC Procedures

```typescript
import {
  campaignMemberProcedure,
  campaignDMProcedure,
  campaignOwnerProcedure,
} from '@/server/trpc';

// Requires any campaign membership
campaignMemberProcedure
  .input(z.object({ campaignId: z.string(), ... }))
  .query(async ({ ctx, input }) => {
    // ctx.membership contains:
    // - campaign: { id, name, userId }
    // - member: { id, role, canViewNPCSecrets, ... } | null
    // - isOwner: boolean
    // - isCoOwner: boolean
    // - isPlayer: boolean
    // - isSpectator: boolean
  });

// Requires CO_DM or OWNER role
campaignDMProcedure
  .input(z.object({ campaignId: z.string(), ... }))
  .mutation(async ({ ctx, input }) => {
    // Only DMs can access this
  });

// Requires OWNER role only
campaignOwnerProcedure
  .input(z.object({ campaignId: z.string(), ... }))
  .mutation(async ({ ctx, input }) => {
    // Only owner can access this
  });
```

### Ownership Verification Functions

```typescript
import {
  verifyCampaignMembership,
  verifyCampaignRole,
  verifyCanEditNPCs,
  verifyCanViewNPCSecrets,
  verifyCanManageSessions,
  verifyCanInviteMembers,
  isDMLevel,
} from '@/server/lib/ownership';

// Check any access
const membership = await verifyCampaignMembership(campaignId, userId);

// Check specific role level
const membership = await verifyCampaignRole(campaignId, userId, CampaignRole.CO_DM);

// Check specific permission
const membership = await verifyCanEditNPCs(campaignId, userId);

// Helper for DM checks
if (isDMLevel(membership)) {
  // Show DM-only content
}
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database models and enums |
| `src/server/lib/ownership.ts` | Membership verification functions |
| `src/server/trpc.ts` | tRPC middleware (campaignMemberProcedure, etc.) |
| `src/server/routers/campaigns.ts` | Campaign CRUD with membership checks |
| `src/server/routers/members.ts` | Full member management API |
| `scripts/migrate-campaign-members.ts` | Migration for existing campaigns |

## Usage Examples

### Creating a Campaign

```typescript
// Create campaign - automatically creates OWNER membership
const campaign = await trpc.campaigns.create.mutateAsync({
  name: 'Dragon Heist',
  description: 'A heist adventure in Waterdeep',
});

// campaign.id is ready to use
// User is automatically OWNER
```

### Inviting Players

```typescript
// Generate a shareable invite link
const invite = await trpc.members.createInvite.mutateAsync({
  campaignId,
  role: 'PLAYER',
});
const inviteUrl = `https://quiverdm.com/join/${invite.code}`;

// Or use the permanent campaign invite code
const { inviteCode } = await trpc.members.regenerateInviteCode.mutateAsync({
  campaignId,
});
const quickJoinUrl = `https://quiverdm.com/join/${inviteCode}`;
```

### Joining a Campaign

```typescript
// Player enters invite code
const result = await trpc.members.acceptInvite.mutateAsync({
  code: 'ABC123XY',
});

// Redirect to campaign
router.push(`/campaigns/${result.campaignSlug}`);
```

### Checking Permissions in Components

```typescript
function CampaignPage({ campaignId }) {
  const { data: campaign } = trpc.campaigns.getById.useQuery({ id: campaignId });

  const isDM = campaign?.myRole === 'OWNER' || campaign?.myRole === 'CO_DM';
  const canEditNPCs = isDM || campaign?.myPermissions?.canEditNPCs;

  return (
    <div>
      {isDM && <DMControls />}
      {canEditNPCs && <NPCEditor />}
    </div>
  );
}
```

## Migration from Legacy Ownership

When creating new campaigns, the system automatically creates an OWNER membership.

For existing campaigns (created before multi-user support):

```bash
npx tsx scripts/migrate-campaign-members.ts
```

This script:
1. Finds all campaigns without CampaignMember records
2. Creates an OWNER membership for the campaign's userId
3. Reports migration results

The legacy `userId` field on Campaign is kept for backward compatibility but membership checks now use CampaignMember.
