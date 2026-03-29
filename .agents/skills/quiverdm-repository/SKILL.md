---
name: quiverdm-repository
description: Use when creating or extending a Prisma repository in QuiverDM — new model access layer, adding query functions, or wiring a repo into a service.
---

# QuiverDM Repository Pattern

One file per model: `src/server/repositories/<model>.repository.ts`. Thin Prisma wrappers — no business logic.

## Standard Shape

```typescript
import { prisma } from '../db';

export async function findById(id: string) {
  return prisma.myModel.findUnique({
    where: { id },
    include: { campaign: { select: { id: true, name: true } } },
  });
}

export async function findByCampaignId(campaignId: string, search?: string) {
  return prisma.myModel.findMany({
    where: {
      campaignId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, campaignId: true, name: true, createdAt: true },
  });
}

export async function findByIds(ids: string[]) {
  return prisma.myModel.findMany({ where: { id: { in: ids } } });
}

export async function create(data: { campaignId: string; name: string; /* ... */ }) {
  return prisma.myModel.create({ data });
}

export async function update(id: string, data: { name?: string; /* partial */ }) {
  return prisma.myModel.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.myModel.delete({ where: { id } });
}

export const myModelRepository = {
  findById,
  findByCampaignId,
  findByIds,
  create,
  update,
  remove,
};
```

## Registration

Add to `src/server/repositories/index.ts`:
```typescript
export * from './my-model.repository';
```

## Quick Reference

| Function | Purpose |
|---|---|
| `findById` | Single record with relations |
| `findByCampaignId` | Scoped list, supports search/filter |
| `findByIds` | Batch fetch (used after MeiliSearch returns IDs) |
| `create` | Insert, return full record |
| `update` | Partial update by id |
| `remove` | Hard delete by id |

## Key Patterns

- **Select only needed fields** in list queries — never `select: *` for lists
- **`includeSecrets: boolean = false`** flag on models with DM-only fields (secrets, notes)
- **`Prisma.JsonNull`** not plain `null` for nullable JSON field writes
- **`findByIds`** is the MeiliSearch re-hydration pattern — search returns IDs, repo fetches full records
- **No business logic** — validation and authorization live in services/routers, not repositories
