# Campaign Management Workflow

## Overview

Handles campaign CRUD operations, member management, invites, and role-based access control.

## Components

### Backend
- `src/server/routers/campaigns.ts` - Campaign CRUD router
- `src/server/routers/members.ts` - Member and invite management
- `src/server/services/campaign.service.ts` - Business logic
- `src/server/repositories/campaign.repository.ts` - Data access
- `src/server/services/authorization.service.ts` - Access control

### Frontend
- `src/app/campaigns/` - Campaign pages
- `src/app/campaigns/[slug]/` - Campaign detail pages

## Test Procedures

### 1. Campaign CRUD

#### Create Campaign
```typescript
// Test: Create new campaign
trpc.campaigns.create.mutate({
  name: "Test Campaign",
  description: "A test campaign for workflow validation"
})
// Expected: Campaign created with unique slug, OWNER membership created
```

#### Read Campaigns
```typescript
// Test: Get all user campaigns
trpc.campaigns.getAll.query()
// Expected: Array of campaigns with myRole and myPermissions

// Test: Get by ID
trpc.campaigns.getById.query({ id: "campaign-id" })
// Expected: Full campaign details with members, sessions, NPCs

// Test: Get by slug
trpc.campaigns.getBySlug.query({ slug: "test-campaign" })
// Expected: Same as getById
```

#### Update Campaign
```typescript
// Test: Update campaign (owner only)
trpc.campaigns.update.mutate({
  id: "campaign-id",
  name: "Updated Name",
  status: "active"
})
// Expected: Campaign updated, slug regenerated if name changed
```

#### Delete Campaign
```typescript
// Test: Delete campaign (owner only)
trpc.campaigns.delete.mutate({ id: "campaign-id" })
// Expected: Campaign and related data deleted
```

### 2. Member Management

#### Invite Member
```typescript
// Test: Create invite
trpc.members.createInvite.mutate({
  campaignId: "campaign-id",
  email: "player@example.com",
  role: "PLAYER"
})
// Expected: Invite created with unique code
```

#### Accept/Decline Invite
```typescript
// Test: Accept invite
trpc.campaigns.acceptInvite.mutate({ inviteId: "invite-id" })
// Expected: Membership created, invite marked as used

// Test: Decline invite
trpc.campaigns.declineInvite.mutate({ inviteId: "invite-id" })
// Expected: Invite deleted
```

### 3. Authorization Tests

| Role | Create | Read | Update | Delete | Invite |
|------|--------|------|--------|--------|--------|
| OWNER | N/A | Yes | Yes | Yes | Yes |
| CO_DM | N/A | Yes | No | No | Yes* |
| PLAYER | N/A | Yes | No | No | No |
| SPECTATOR | N/A | Yes | No | No | No |

*CO_DM can invite PLAYER/SPECTATOR only

## Validation Checklist

- [ ] Campaign creation generates unique slug
- [ ] Owner membership auto-created on campaign creation
- [ ] Non-members cannot access campaign
- [ ] Role hierarchy enforced (OWNER > CO_DM > PLAYER > SPECTATOR)
- [ ] Permission-based access works (canEditNPCs, canManageSessions, etc.)
- [ ] Invite flow works end-to-end
- [ ] Campaign stats accurate

## Known Issues

Document any known issues or edge cases here.

## Test Results

See `results/` directory for test execution logs.
