# Campaigns & Collaboration

Campaigns are the core organizational unit in QuiverDM. Each campaign contains sessions, NPCs, players, homebrew, and wiki pages.

## Features

- **Multi-User Support**: DMs, Co-DMs, Players, and Spectators
- **Role-Based Permissions**: Granular control over who can do what
- **Invite System**: Join via code, email, or direct invite
- **Campaign Settings**: Customize visibility and sharing

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Campaign creator | Full control, can delete campaign |
| **Co-DM** | Assistant DM | Edit everything except delete/transfer |
| **Player** | Party member | Manage own character, view shared content |
| **Spectator** | Observer | Read-only access to shared content |

## Granular Permissions

Beyond roles, specific permissions can be granted:

| Permission | Default | Description |
|------------|---------|-------------|
| `canViewNPCSecrets` | Co-DM only | See NPC secrets and hidden info |
| `canEditNPCs` | Co-DM only | Create/edit NPCs |
| `canManageSessions` | Co-DM only | Create/edit sessions |
| `canInviteMembers` | Owner/Co-DM | Invite new members |

## Invite System

### Invite Code (Quick Join)

```typescript
// Generate invite code
const campaign = await trpc.campaigns.generateInviteCode.mutate({
  campaignId,
  expiresIn: '7d', // Optional expiration
});
// Returns: { inviteCode: 'ABC123XY' }

// Player joins with code
await trpc.campaigns.joinByCode.mutate({
  code: 'ABC123XY',
  characterId: optionalCharacterId,
});
```

### Email Invite

```typescript
await trpc.campaigns.inviteByEmail.mutate({
  campaignId,
  email: 'player@example.com',
  role: 'PLAYER',
  message: 'Join our campaign!', // Optional
});
```

## Campaign Settings

```typescript
interface CampaignSettings {
  // Visibility
  isPublic: boolean;           // Discoverable in search

  // Player permissions
  allowPlayerNotes: boolean;   // Players can add session notes
  shareRecaps: boolean;        // Auto-share recaps with players
  shareNPCGallery: boolean;    // Players see NPC list (no secrets)

  // Content
  defaultHomebrewVisibility: 'private' | 'campaign';
}
```

## Database Schema

```prisma
model Campaign {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  description  String?  @db.Text
  bannerUrl    String?
  status       String   @default("active")

  // Legacy owner (migration compatibility)
  userId       String

  // Settings
  settings     Json?
  inviteCode   String?  @unique
  isPublic     Boolean  @default(false)

  // Relations
  members      CampaignMember[]
  gameSessions GameSession[]
  npcs         NPC[]
  characters   CampaignCharacter[]
  wikiPages    WikiPage[]
  homebrew     CampaignHomebrewContent[]
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

enum CampaignRole {
  OWNER
  CO_DM
  PLAYER
  SPECTATOR
}
```

## API Reference

### Campaigns Router

```typescript
// Get user's campaigns (as member)
trpc.campaigns.getAll.useQuery();

// Get single campaign
trpc.campaigns.getById.useQuery({ id: campaignId });

// Create campaign
trpc.campaigns.create.useMutation();

// Update campaign
trpc.campaigns.update.useMutation();

// Delete campaign (owner only)
trpc.campaigns.delete.useMutation();
```

### Members Sub-Router

```typescript
// List members
trpc.campaigns.members.list.useQuery({ campaignId });

// Invite member
trpc.campaigns.members.invite.useMutation();

// Update role
trpc.campaigns.members.updateRole.useMutation();

// Update permissions
trpc.campaigns.members.updatePermissions.useMutation();

// Remove member
trpc.campaigns.members.remove.useMutation();

// Leave campaign
trpc.campaigns.members.leave.useMutation();
```

## Components

### CampaignCard

```tsx
<CampaignCard
  campaign={campaign}
  role={membership.role}
  onSelect={() => router.push(`/campaigns/${campaign.id}`)}
/>
```

### MemberList

```tsx
<MemberList
  campaignId={campaignId}
  canManage={isOwnerOrCoDM}
  onRoleChange={handleRoleChange}
/>
```

### InviteDialog

```tsx
<InviteDialog
  campaignId={campaignId}
  inviteCode={campaign.inviteCode}
  onInviteSent={refetch}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/campaigns.ts` | Campaign CRUD + members |
| `src/server/lib/ownership.ts` | Role-based verification |
| `src/app/campaigns/page.tsx` | Campaign list |
| `src/app/campaigns/[id]/page.tsx` | Campaign detail |
| `src/app/campaigns/[id]/members/page.tsx` | Member management |
| `src/app/campaigns/[id]/join/page.tsx` | Join flow |

## Authorization Patterns

### Middleware

```typescript
// Verify user is campaign member
export const campaignMemberProcedure = protectedProcedure.use(
  async ({ ctx, next, rawInput }) => {
    const { campaignId } = rawInput as { campaignId: string };

    const membership = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: ctx.session.user.id,
        },
      },
    });

    if (!membership) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return next({ ctx: { ...ctx, membership } });
  }
);

// Verify specific roles
export const dmOnlyProcedure = campaignMemberProcedure.use(
  async ({ ctx, next }) => {
    if (!['OWNER', 'CO_DM'].includes(ctx.membership.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  }
);
```

### In Routers

```typescript
// Only DMs can create sessions
createSession: dmOnlyProcedure
  .input(createSessionSchema)
  .mutation(async ({ input, ctx }) => {
    // ctx.membership is available
  }),

// Players can view (filtered by role)
getNPCs: campaignMemberProcedure
  .input(z.object({ campaignId: z.string() }))
  .query(async ({ input, ctx }) => {
    const npcs = await prisma.nPC.findMany({ ... });

    // Hide secrets from players
    if (ctx.membership.role === 'PLAYER' && !ctx.membership.canViewNPCSecrets) {
      return npcs.map(npc => ({ ...npc, secrets: null }));
    }

    return npcs;
  }),
```

## Migration Guide

### From Single-User to Multi-User

When migrating existing campaigns:

1. Create `CampaignMember` for existing owner with role `OWNER`
2. All ownership checks now go through membership
3. Legacy `userId` field kept for backward compatibility

```typescript
// Migration script
const campaigns = await prisma.campaign.findMany();

for (const campaign of campaigns) {
  await prisma.campaignMember.create({
    data: {
      campaignId: campaign.id,
      userId: campaign.userId,
      role: 'OWNER',
    },
  });
}
```
