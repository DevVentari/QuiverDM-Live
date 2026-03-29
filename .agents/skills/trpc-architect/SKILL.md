---
name: trpc-architect
description: Auto-invoke when creating tRPC routers, reviewing API endpoints, designing queries, or optimizing database access patterns. Use for any tRPC-related development in QuiverDM.
---

# tRPC Architect

Expert in tRPC architecture and QuiverDM's API patterns. Auto-invoked for API design work.

## When This Skill Applies

Auto-invoke when the user:
- Creates a new tRPC router
- Reviews existing API endpoints
- Asks about query optimization
- Works on authorization patterns
- Designs new API features
- Debugs tRPC errors

## QuiverDM tRPC Architecture

### Setup Files
- `src/server/trpc.ts` - Context and procedure definitions
- `src/server/routers/_app.ts` - Router registry
- `src/lib/trpc.ts` - Client configuration

### Procedure Types
```typescript
import { router, publicProcedure, protectedProcedure } from '../trpc';

// Public - no auth required
publicProcedure.query(...)

// Protected - requires session
protectedProcedure.query(...)
// ctx.session.user.id is guaranteed
```

### Context Structure
```typescript
interface Context {
  session: Session | null;
  // session.user.id available in protected procedures
}
```

## Best Practices

### 1. Input Validation
Always use Zod for strict input validation:
```typescript
.input(z.object({
  campaignId: z.string().cuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  tags: z.array(z.string()).max(20).optional(),
}))
```

### 2. Authorization
Check ownership before any data access:
```typescript
import { verifyCampaignOwnership, verifyNPCOwnership } from '../lib/ownership';

// In procedure:
const userId = ctx.session.user.id;
await verifyCampaignOwnership(input.campaignId, userId);
```

### 3. Query Optimization
Select only needed fields:
```typescript
const campaigns = await prisma.campaign.findMany({
  where: { userId },
  select: {
    id: true,
    name: true,
    slug: true,
    status: true,
    // Don't select large fields like glossary
  },
  orderBy: { updatedAt: 'desc' },
  take: 20,
});
```

### 4. Error Handling
Use TRPCError for proper error responses:
```typescript
import { TRPCError } from '@trpc/server';

if (!campaign) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Campaign not found',
  });
}

if (campaign.userId !== userId) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Not authorized to access this campaign',
  });
}
```

### 5. Transactions
Use transactions for multi-step operations:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const campaign = await tx.campaign.create({ data: campaignData });
  await tx.campaignMember.create({
    data: { campaignId: campaign.id, userId, role: 'OWNER' },
  });
  return campaign;
});
```

## Common Patterns

### List with Search & Pagination
```typescript
getAll: protectedProcedure
  .input(z.object({
    campaignId: z.string(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }))
  .query(async ({ input, ctx }) => {
    const where: Prisma.NPCWhereInput = {
      campaignId: input.campaignId,
    };

    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.nPC.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { name: 'asc' },
      }),
      prisma.nPC.count({ where }),
    ]);

    return { items, total, page: input.page, limit: input.limit };
  }),
```

### Nested Includes
```typescript
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input, ctx }) => {
    return prisma.campaign.findUnique({
      where: { id: input.id },
      include: {
        members: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        _count: {
          select: { gameSessions: true, npcs: true },
        },
      },
    });
  }),
```

### Batch Operations
```typescript
deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string()).min(1).max(100),
  }))
  .mutation(async ({ input, ctx }) => {
    // Verify all belong to user
    const items = await prisma.item.findMany({
      where: { id: { in: input.ids } },
      select: { id: true, campaign: { select: { userId: true } } },
    });

    const unauthorized = items.filter(i => i.campaign.userId !== ctx.session.user.id);
    if (unauthorized.length > 0) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    await prisma.item.deleteMany({
      where: { id: { in: input.ids } },
    });

    return { deleted: input.ids.length };
  }),
```

## Code Review Checklist

When reviewing tRPC routers:

- [ ] All inputs validated with Zod
- [ ] Protected procedures used for authenticated endpoints
- [ ] Ownership verified before data access
- [ ] Proper error codes (NOT_FOUND, FORBIDDEN, BAD_REQUEST)
- [ ] Only necessary fields selected
- [ ] Pagination for list endpoints
- [ ] Indexes exist for common query patterns
- [ ] No N+1 queries (use includes/joins)
- [ ] Transactions for multi-step mutations
- [ ] Return types are consistent

## Router Registration

New routers must be registered in `src/server/routers/_app.ts`:
```typescript
import { newRouter } from './new-feature';

export const appRouter = router({
  // ... existing
  newFeature: newRouter,
});
```

Client automatically gets typed access:
```typescript
const { data } = trpc.newFeature.getAll.useQuery({ ... });
```
