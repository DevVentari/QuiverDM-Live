---
name: quiverdm-auth
description: Use when choosing the right tRPC procedure type in QuiverDM — campaign member vs DM vs owner procedures, ctx.membership fields, role hierarchy, and common auth mistakes.
---

# QuiverDM Campaign Auth Procedures

## Procedure Selection

| Procedure | Require | Use When |
|---|---|---|
| `publicProcedure` | Nothing | Public data, no login |
| `protectedProcedure` | Session | Auth required, no campaign scope |
| `campaignMemberProcedure` | SPECTATOR+ | Any campaign data access |
| `campaignDMProcedure` | CO_DM or OWNER | DM features: NPCs, secrets, sessions |
| `campaignOwnerProcedure` | OWNER | Destructive: delete campaign, transfer |
| `adminProcedure` | ADMIN_EMAILS | Platform admin only |

**Role hierarchy:** `OWNER > CO_DM > PLAYER > SPECTATOR`

## Import

```typescript
import {
  campaignMemberProcedure,
  campaignDMProcedure,
  campaignOwnerProcedure,
  protectedProcedure,
  publicProcedure,
} from '../trpc';
```

## Usage

```typescript
// Any campaign member can read
getSession: campaignMemberProcedure
  .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
  .query(async ({ ctx, input }) => {
    const canSeeSecrets = ctx.membership.isDM;
    // ...
  }),

// DM-only features
updateNpc: campaignDMProcedure
  .input(z.object({ campaignId: z.string(), npcId: z.string(), name: z.string() }))
  .mutation(async ({ ctx, input }) => { /* ... */ }),

// Owner-only destructive actions
deleteCampaign: campaignOwnerProcedure
  .input(z.object({ campaignId: z.string() }))
  .mutation(async ({ ctx, input }) => { /* ... */ }),
```

## ctx.membership Fields

```typescript
ctx.membership.role        // 'OWNER' | 'CO_DM' | 'PLAYER' | 'SPECTATOR'
ctx.membership.isOwner     // role === 'OWNER'
ctx.membership.isDM        // role === 'OWNER' || role === 'CO_DM'
ctx.membership.userId      // same as ctx.session.user.id
ctx.membership.campaignId  // from input.campaignId
```

All campaign procedures auto-throw `ForbiddenError` if membership check fails — no manual check needed.

## Error Handling

```typescript
// Business logic errors (beyond auth):
throw new NotFoundError('npc', input.npcId);
throw ForbiddenError.forPermission('edit', 'NPC');
throw ValidationError.forField('name', 'Required');
// Static factory methods — no `new` keyword
```

## Common Mistakes

- Using `protectedProcedure` for campaign-scoped data — missing membership check
- Using `campaignOwnerProcedure` for DM features — CO_DMs should be able to help
- Forgetting `campaignId` in input schema — all campaign* procedures require it
- Manual role check after `campaignDMProcedure` — the procedure already enforces it
