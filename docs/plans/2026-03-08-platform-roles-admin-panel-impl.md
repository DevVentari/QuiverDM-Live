# Platform Roles & Admin Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace env-based admin checks with DB-driven platform roles (Mythkeeper/Warden/DM/Adventurer), add admin user management and platform API usage dashboard, rename plan display names (Wanderer/Hero/Fellowship), add live polling to API usage page.

**Architecture:** Add `PlatformRole` enum to Prisma User model. Create shared `requirePlatformRole()` middleware and new tRPC procedures (`wardenProcedure`, `mythkeeperProcedure`). Replace all `ADMIN_EMAILS` checks. Build admin pages under existing `/admin` route with sidebar nav.

**Tech Stack:** Prisma, tRPC v11, Next.js 15 App Router, Tailwind, shadcn/ui, Lucide icons

**Design doc:** `docs/plans/2026-03-08-platform-roles-admin-panel-design.md`

---

### Task 1: Prisma Schema — PlatformRole Enum + User Field

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** The User model is at lines 48-83. The CampaignRole enum is at lines 132-137. Add the new enum near CampaignRole, and add the field to User.

**Step 1: Add PlatformRole enum after CampaignRole**

In `prisma/schema.prisma`, after the `CampaignRole` enum block (line ~137), add:

```prisma
enum PlatformRole {
  ADVENTURER
  DUNGEON_MASTER
  WARDEN
  MYTHKEEPER
}
```

**Step 2: Add platformRole field to User model**

In the User model, after the `tier` field (line ~63), add:

```prisma
  platformRole        PlatformRole    @default(ADVENTURER)
```

**Step 3: Push schema**

Run: `npx prisma db push`
Expected: Schema synced, no errors.

**Step 4: Seed your account as MYTHKEEPER**

Run in Prisma Studio or via a one-off script:
```bash
npx prisma db execute --stdin <<< "UPDATE \"User\" SET \"platformRole\" = 'MYTHKEEPER' WHERE email = 'dev@blakewales.au';"
```

If that fails (Windows), use Prisma Studio: `npx prisma studio`, find user, set platformRole to MYTHKEEPER.

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add PlatformRole enum (Mythkeeper/Warden/DM/Adventurer)"
```

---

### Task 2: Platform Constants + Display Names

**Files:**
- Create: `src/lib/platform.ts`

**Context:** This file is the single source of truth for platform role hierarchy, display names, and plan (tier) display names. Used by both server and client code.

**Step 1: Create the platform constants file**

Create `src/lib/platform.ts`:

```typescript
import { PlatformRole } from '@prisma/client';

export const PLATFORM_ROLE_HIERARCHY: Record<PlatformRole, number> = {
  [PlatformRole.ADVENTURER]: 1,
  [PlatformRole.DUNGEON_MASTER]: 2,
  [PlatformRole.WARDEN]: 3,
  [PlatformRole.MYTHKEEPER]: 4,
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  [PlatformRole.ADVENTURER]: 'Adventurer',
  [PlatformRole.DUNGEON_MASTER]: 'Dungeon Master',
  [PlatformRole.WARDEN]: 'Warden',
  [PlatformRole.MYTHKEEPER]: 'Mythkeeper',
};

export const PLAN_LABELS: Record<string, string> = {
  free: 'Wanderer',
  pro: 'Hero',
  team: 'Fellowship',
};

export function hasMinimumRole(userRole: PlatformRole, requiredRole: PlatformRole): boolean {
  return PLATFORM_ROLE_HIERARCHY[userRole] >= PLATFORM_ROLE_HIERARCHY[requiredRole];
}

export function canPromoteTo(actorRole: PlatformRole, targetRole: PlatformRole): boolean {
  if (targetRole === PlatformRole.WARDEN || targetRole === PlatformRole.MYTHKEEPER) {
    return actorRole === PlatformRole.MYTHKEEPER;
  }
  return hasMinimumRole(actorRole, PlatformRole.WARDEN);
}

export function canDemoteFrom(actorRole: PlatformRole, targetRole: PlatformRole): boolean {
  if (targetRole === PlatformRole.WARDEN || targetRole === PlatformRole.MYTHKEEPER) {
    return actorRole === PlatformRole.MYTHKEEPER;
  }
  return hasMinimumRole(actorRole, PlatformRole.WARDEN);
}
```

**Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/platform.ts
git commit -m "feat: add platform role hierarchy, display names, and plan labels"
```

---

### Task 3: tRPC Warden + Mythkeeper Procedures

**Files:**
- Modify: `src/server/trpc.ts` (lines 46-57 area, after protectedProcedure)

**Context:** `protectedProcedure` is defined at lines 46-57. Campaign procedures follow at lines 77-133. Add the new platform role procedures between them (after protectedProcedure, before campaign procedures).

**Step 1: Add wardenProcedure and mythkeeperProcedure**

After the `protectedProcedure` definition (line ~57), add:

```typescript
import { PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';
```

(Add imports at top of file)

Then after `protectedProcedure`:

```typescript
export const wardenProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { platformRole: true },
  });

  if (!user || !hasMinimumRole(user.platformRole, PlatformRole.WARDEN)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires Warden or higher role' });
  }

  return next({
    ctx: {
      ...ctx,
      platformRole: user.platformRole,
    },
  });
});

export const mythkeeperProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { platformRole: true },
  });

  if (!user || user.platformRole !== PlatformRole.MYTHKEEPER) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires Mythkeeper role' });
  }

  return next({
    ctx: {
      ...ctx,
      platformRole: user.platformRole,
    },
  });
});
```

**Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/server/trpc.ts
git commit -m "feat(trpc): add wardenProcedure and mythkeeperProcedure for platform role auth"
```

---

### Task 4: Replace All ADMIN_EMAILS Checks

**Files:**
- Modify: `src/app/(app)/admin/layout.tsx` (lines 10-24)
- Modify: `src/server/routers/feedback.ts` (lines 31-45, and usages at ~108, 125, 171)
- Modify: `src/server/routers/invites.ts` (lines 15-30, and usages at ~74, 117, 132, 147, 156)
- Modify: `src/server/routers/rules.ts` (lines 7-20, and usages at ~35, 42, 60)
- Modify: `src/lib/email.ts` (lines 135-155)
- Modify: `src/app/(app)/settings/page.tsx` (lines ~887-913, admin section visibility)

**Context:** There are 4 places with `requireAdmin()` functions using `ADMIN_EMAILS` env var. Replace them all with DB-driven role checks.

**Step 1: Update admin layout guard**

Replace the `ADMIN_EMAILS` logic in `src/app/(app)/admin/layout.tsx` with:

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });

  if (!user || !hasMinimumRole(user.platformRole, PlatformRole.WARDEN)) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
```

**Step 2: Replace requireAdmin in feedback router**

In `src/server/routers/feedback.ts`, remove the `requireAdmin()` function (lines 31-45). Replace all calls to `requireAdmin(ctx.session.user.email)` with using `wardenProcedure` instead of `protectedProcedure` for those endpoints. Specifically:

- Change admin-only endpoints from `protectedProcedure` + `requireAdmin(...)` to `wardenProcedure` (remove the requireAdmin call).

**Step 3: Replace requireAdmin in invites router**

In `src/server/routers/invites.ts`, remove the `requireAdmin()` function (lines 15-30). Replace all `await requireAdmin(ctx.session.user.id)` calls — change those endpoints to use `wardenProcedure`.

**Step 4: Replace requireAdmin in rules router**

In `src/server/routers/rules.ts`, remove the `requireAdmin()` function (lines 7-20). Change admin endpoints to use `wardenProcedure`.

**Step 5: Update email service**

In `src/lib/email.ts` (lines 135-155), replace `ADMIN_EMAILS` lookup with a Prisma query for Wardens+:

```typescript
async sendUsageAlert(params: { ... }): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { PlatformRole } = await import('@prisma/client');

  const admins = await prisma.user.findMany({
    where: { platformRole: { in: [PlatformRole.WARDEN, PlatformRole.MYTHKEEPER] } },
    select: { email: true },
  });

  const adminEmails = admins.map(a => a.email).filter(Boolean) as string[];
  if (!adminEmails.length) return;

  // ... rest unchanged, just uses the new adminEmails array
}
```

**Step 6: Update settings page admin section visibility**

In `src/app/(app)/settings/page.tsx`, the admin section (lines ~887-913) currently shows for everyone but links to `/admin` which would just redirect non-admins. Add a check using a new tRPC query or fetch the user's platformRole. The simplest approach: add `platformRole` to the existing profile query response, then conditionally render the admin section.

In `src/server/routers/user-settings.ts`, in the `getProfile` query, add `platformRole` to the select.

In the settings page, wrap the Admin card with:

```typescript
{profile?.platformRole && hasMinimumRole(profile.platformRole as PlatformRole, PlatformRole.WARDEN) && (
  <Card>...</Card>
)}
```

**Step 7: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

**Step 8: Commit**

```bash
git add src/app/(app)/admin/layout.tsx src/server/routers/feedback.ts src/server/routers/invites.ts src/server/routers/rules.ts src/lib/email.ts src/app/(app)/settings/page.tsx src/server/routers/user-settings.ts
git commit -m "refactor(auth): replace ADMIN_EMAILS with DB-driven platformRole checks"
```

---

### Task 5: Role + Plan Badge Components

**Files:**
- Create: `src/components/ui/role-badge.tsx`
- Create: `src/components/ui/plan-badge.tsx`

**Context:** These badges will be used across the app — admin user table, settings page, user profiles. Follow the design system: dark theme, atmospheric, fantasy-inspired. shadcn Badge as base.

**Step 1: Create RoleBadge component**

Create `src/components/ui/role-badge.tsx`:

```tsx
import { PlatformRole } from '@prisma/client';
import { PLATFORM_ROLE_LABELS } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { Crown, Shield, Flame, Sword } from 'lucide-react';

const ROLE_STYLES: Record<PlatformRole, { className: string; icon: typeof Crown }> = {
  [PlatformRole.MYTHKEEPER]: {
    className: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400 shadow-yellow-500/20 shadow-sm',
    icon: Crown,
  },
  [PlatformRole.WARDEN]: {
    className: 'border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-purple-500/20 shadow-sm',
    icon: Shield,
  },
  [PlatformRole.DUNGEON_MASTER]: {
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-amber-500/20 shadow-sm',
    icon: Flame,
  },
  [PlatformRole.ADVENTURER]: {
    className: 'border-slate-500/50 bg-slate-500/10 text-slate-400',
    icon: Sword,
  },
};

export function RoleBadge({ role, className }: { role: PlatformRole; className?: string }) {
  const style = ROLE_STYLES[role];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {PLATFORM_ROLE_LABELS[role]}
    </span>
  );
}
```

**Step 2: Create PlanBadge component**

Create `src/components/ui/plan-badge.tsx`:

```tsx
import { PLAN_LABELS } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { Compass, Swords, Users } from 'lucide-react';

const PLAN_STYLES: Record<string, { className: string; icon: typeof Compass }> = {
  free: {
    className: 'border-stone-500/50 bg-stone-500/10 text-stone-400',
    icon: Compass,
  },
  pro: {
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-amber-500/20 shadow-sm',
    icon: Swords,
  },
  team: {
    className: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 shadow-indigo-500/20 shadow-sm',
    icon: Users,
  },
};

export function PlanBadge({ tier, className }: { tier: string; className?: string }) {
  const style = PLAN_STYLES[tier] ?? PLAN_STYLES.free;
  const Icon = style.icon;
  const label = PLAN_LABELS[tier] ?? tier;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
```

**Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/ui/role-badge.tsx src/components/ui/plan-badge.tsx
git commit -m "feat(ui): add RoleBadge and PlanBadge components with fantasy theming"
```

---

### Task 6: Admin Users Router

**Files:**
- Create: `src/server/routers/admin-users.ts`
- Modify: `src/server/routers/_app.ts`

**Context:** This router handles user management — list all users, change roles, suspend, force password reset, impersonate. Uses `wardenProcedure` for most endpoints, `mythkeeperProcedure` for role changes to Warden/Mythkeeper and impersonation.

**Step 1: Create the admin users router**

Create `src/server/routers/admin-users.ts`:

```typescript
import { z } from 'zod';
import { router, wardenProcedure, mythkeeperProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { canPromoteTo, canDemoteFrom } from '@/lib/platform';
import { ForbiddenError, NotFoundError } from '../errors';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

export const adminUsersRouter = router({
  list: wardenProcedure
    .input(z.object({
      search: z.string().optional(),
      role: z.nativeEnum(PlatformRole).optional(),
      tier: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
          { displayName: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      if (input.role) where.platformRole = input.role;
      if (input.tier) where.tier = input.tier;

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          image: true,
          platformRole: true,
          tier: true,
          createdAt: true,
          updatedAt: true,
          onboardingCompleted: true,
          subscriptionStatus: true,
          _count: { select: { campaigns: true, campaignMemberships: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (users.length > input.limit) {
        const next = users.pop();
        nextCursor = next?.id;
      }

      return { users, nextCursor };
    }),

  getById: wardenProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          image: true,
          bio: true,
          platformRole: true,
          tier: true,
          createdAt: true,
          updatedAt: true,
          onboardingCompleted: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          _count: { select: { campaigns: true, campaignMemberships: true, homebrewContent: true, homebrewPDFs: true } },
        },
      });
      if (!user) throw new NotFoundError('user', input.userId);
      return user;
    }),

  changeRole: wardenProcedure
    .input(z.object({
      userId: z.string(),
      newRole: z.nativeEnum(PlatformRole),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new ForbiddenError('Cannot change your own role');
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { platformRole: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      const actorRole = ctx.platformRole as PlatformRole;

      if (!canDemoteFrom(actorRole, target.platformRole)) {
        throw new ForbiddenError('Insufficient role to modify this user');
      }
      if (!canPromoteTo(actorRole, input.newRole)) {
        throw new ForbiddenError('Insufficient role to assign this role');
      }

      return prisma.user.update({
        where: { id: input.userId },
        data: { platformRole: input.newRole },
        select: { id: true, platformRole: true },
      });
    }),

  suspend: wardenProcedure
    .input(z.object({
      userId: z.string(),
      suspended: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new ForbiddenError('Cannot suspend yourself');
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { platformRole: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      if (target.platformRole === PlatformRole.MYTHKEEPER) {
        throw new ForbiddenError('Cannot suspend a Mythkeeper');
      }

      // Note: requires adding `suspended Boolean @default(false)` to User model
      return prisma.user.update({
        where: { id: input.userId },
        data: { suspended: input.suspended },
        select: { id: true, suspended: true },
      });
    }),

  forcePasswordReset: wardenProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new ForbiddenError('Cannot force-reset your own password');
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, platformRole: true },
      });
      if (!target?.email) throw new NotFoundError('user', input.userId);

      if (target.platformRole === PlatformRole.MYTHKEEPER) {
        throw new ForbiddenError('Cannot force-reset a Mythkeeper password');
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { email: target.email, token, expires },
      });

      const { emailService } = await import('@/lib/email');
      await emailService.sendPasswordReset({ email: target.email, token });

      return { success: true };
    }),

  impersonate: mythkeeperProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, name: true },
      });
      if (!target) throw new NotFoundError('user', input.userId);

      // Return the target user info — the client sets a session cookie/flag
      // The actual impersonation is handled client-side via a special session token
      return { userId: target.id, email: target.email, name: target.name };
    }),
});
```

**Step 2: Add `suspended` field to User model**

In `prisma/schema.prisma`, add to the User model after `platformRole`:

```prisma
  suspended           Boolean         @default(false)
```

Push schema: `npx prisma db push`

**Step 3: Register router in _app.ts**

In `src/server/routers/_app.ts`, add import and registration:

```typescript
import { adminUsersRouter } from './admin-users';
// In the router object:
adminUsers: adminUsersRouter,
```

**Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add prisma/schema.prisma src/server/routers/admin-users.ts src/server/routers/_app.ts
git commit -m "feat(api): add admin users router with role management, suspend, impersonate"
```

---

### Task 7: Admin API Usage Router

**Files:**
- Create: `src/server/routers/admin-api-usage.ts`
- Modify: `src/server/routers/_app.ts`

**Context:** Platform-wide API usage dashboard for Wardens+. Aggregates across ALL users. Has summary, per-user breakdown, and per-user detail queries.

**Step 1: Create the admin API usage router**

Create `src/server/routers/admin-api-usage.ts`:

```typescript
import { z } from 'zod';
import { router, wardenProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const adminApiUsageRouter = router({
  getPlatformSummary: wardenProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const byProvider = await prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      const totalCost = byProvider.reduce((sum, p) => sum + (p._sum.estimatedCost ?? 0), 0);
      const totalRequests = byProvider.reduce((sum, p) => sum + (p._sum.requestCount ?? 0), 0);

      return { byProvider, totalCost, totalRequests, periodDays: days };
    }),

  getByUser: wardenProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 30;
      const limit = input?.limit ?? 50;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const userUsage = await prisma.apiUsageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
        orderBy: { _sum: { estimatedCost: 'desc' } },
        take: limit,
      });

      const userIds = userUsage.map(u => u.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, displayName: true, image: true, platformRole: true, tier: true },
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      return userUsage.map(u => ({
        user: userMap.get(u.userId) ?? { id: u.userId, name: null, email: null },
        requests: u._sum.requestCount ?? 0,
        tokensIn: u._sum.tokensIn ?? 0,
        tokensOut: u._sum.tokensOut ?? 0,
        estimatedCost: u._sum.estimatedCost ?? 0,
      }));
    }),

  getUserDetail: wardenProcedure
    .input(z.object({
      userId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const [byFeature, byModel] = await Promise.all([
        prisma.apiUsageLog.groupBy({
          by: ['feature'],
          where: { userId: input.userId, createdAt: { gte: since } },
          _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        }),
        prisma.apiUsageLog.groupBy({
          by: ['model', 'provider'],
          where: { userId: input.userId, createdAt: { gte: since } },
          _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        }),
      ]);

      return { byFeature, byModel };
    }),
});
```

**Step 2: Register router in _app.ts**

In `src/server/routers/_app.ts`:

```typescript
import { adminApiUsageRouter } from './admin-api-usage';
// In the router object:
adminApiUsage: adminApiUsageRouter,
```

**Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/server/routers/admin-api-usage.ts src/server/routers/_app.ts
git commit -m "feat(api): add admin API usage router with platform-wide cost aggregation"
```

---

### Task 8: Admin Layout + Navigation

**Files:**
- Modify: `src/app/(app)/admin/layout.tsx`

**Context:** The current admin layout is just a guard + wrapper div. Add a sidebar nav with links to all admin pages. The guard was already updated in Task 4 to use platformRole.

**Step 1: Add admin sidebar navigation**

Update `src/app/(app)/admin/layout.tsx` to include a sidebar:

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });

  if (!user || !hasMinimumRole(user.platformRole, PlatformRole.WARDEN)) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminNav role={user.platformRole} />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Create AdminNav component**

Create `src/components/admin/admin-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlatformRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import { Users, Zap, Ticket, BookOpen, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/api-usage', label: 'API Usage', icon: Zap },
  { href: '/admin/invites', label: 'Invites', icon: Ticket },
  { href: '/admin/rules-sources', label: 'Rules Sources', icon: BookOpen },
];

export function AdminNav({ role }: { role: PlatformRole }) {
  const pathname = usePathname();

  return (
    <nav className="w-56 min-h-screen border-r border-border/50 bg-card/30 p-4 space-y-1">
      <div className="flex items-center gap-2 px-3 py-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm tracking-wide uppercase text-primary">
          Admin Panel
        </span>
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/(app)/admin/layout.tsx src/components/admin/admin-nav.tsx
git commit -m "feat(ui): add admin panel sidebar navigation"
```

---

### Task 9: Admin Users Page

**Files:**
- Create: `src/app/(app)/admin/users/page.tsx`

**Context:** User management page showing all platform users with search, role/plan filters, and action buttons (change role, suspend, force password reset). Uses the `adminUsers` tRPC router from Task 6.

**Step 1: Create the admin users page**

Create `src/app/(app)/admin/users/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { PlatformRole } from '@prisma/client';
import { PLATFORM_ROLE_LABELS, PLAN_LABELS } from '@/lib/platform';
import { RoleBadge } from '@/components/ui/role-badge';
import { PlanBadge } from '@/components/ui/plan-badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Search, UserCog, Ban, KeyRound, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [roleDialogUser, setRoleDialogUser] = useState<{ id: string; name: string | null; role: PlatformRole } | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlatformRole>(PlatformRole.ADVENTURER);

  const users = trpc.adminUsers.list.useQuery({
    search: search || undefined,
    role: roleFilter !== 'all' ? (roleFilter as PlatformRole) : undefined,
    tier: tierFilter !== 'all' ? tierFilter : undefined,
  }, { refetchInterval: 30_000 });

  const changeRole = trpc.adminUsers.changeRole.useMutation({
    onSuccess: () => {
      toast({ title: 'Role updated' });
      users.refetch();
      setRoleDialogUser(null);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const suspend = trpc.adminUsers.suspend.useMutation({
    onSuccess: (_, vars) => {
      toast({ title: vars.suspended ? 'User suspended' : 'User unsuspended' });
      users.refetch();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const forcePasswordReset = trpc.adminUsers.forcePasswordReset.useMutation({
    onSuccess: () => {
      toast({ title: 'Password reset email sent' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage platform users, roles, and access</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {Object.entries(PLAN_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-border/50 bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(user.displayName ?? user.name ?? '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{user.displayName ?? user.name ?? 'Unnamed'}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><RoleBadge role={user.platformRole} /></TableCell>
                <TableCell><PlanBadge tier={user.tier} /></TableCell>
                <TableCell className="text-muted-foreground">
                  {user._count.campaigns} owned / {user._count.campaignMemberships} member
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setRoleDialogUser({ id: user.id, name: user.displayName ?? user.name, role: user.platformRole });
                        setSelectedRole(user.platformRole);
                      }}>
                        <UserCog className="h-4 w-4 mr-2" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => forcePasswordReset.mutate({ userId: user.id })}>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Force Password Reset
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => suspend.mutate({ userId: user.id, suspended: true })}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Suspend
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialogUser?.name ?? 'User'}</DialogTitle>
            <DialogDescription>
              Current role: {roleDialogUser ? PLATFORM_ROLE_LABELS[roleDialogUser.role] : ''}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as PlatformRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogUser(null)}>Cancel</Button>
            <Button
              onClick={() => roleDialogUser && changeRole.mutate({ userId: roleDialogUser.id, newRole: selectedRole })}
              disabled={changeRole.isPending}
            >
              {changeRole.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/(app)/admin/users/page.tsx
git commit -m "feat(ui): add admin users page with role management, suspend, password reset"
```

---

### Task 10: Admin API Usage Page

**Files:**
- Create: `src/app/(app)/admin/api-usage/page.tsx`

**Context:** Platform-wide API usage dashboard for Wardens+. Shows aggregate summary cards at top, per-user cost table below with expandable detail rows. Uses `adminApiUsage` router from Task 7. Polls every 30 seconds.

**Step 1: Create the admin API usage page**

Create `src/app/(app)/admin/api-usage/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RoleBadge } from '@/components/ui/role-badge';
import { PlanBadge } from '@/components/ui/plan-badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Zap, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
};

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export default function AdminApiUsagePage() {
  const [days, setDays] = useState(30);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const summary = trpc.adminApiUsage.getPlatformSummary.useQuery({ days }, { refetchInterval: 30_000 });
  const byUser = trpc.adminApiUsage.getByUser.useQuery({ days }, { refetchInterval: 30_000 });
  const userDetail = trpc.adminApiUsage.getUserDetail.useQuery(
    { userId: expandedUser!, days },
    { enabled: !!expandedUser, refetchInterval: 30_000 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform API Usage</h1>
          <p className="text-muted-foreground">Cost and usage across all users</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(summary.data?.totalCost ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.data?.totalRequests ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        {summary.data?.byProvider.map((p) => (
          <Card key={p.provider}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {PROVIDER_LABELS[p.provider] ?? p.provider}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCost(p._sum.estimatedCost ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{(p._sum.requestCount ?? 0).toLocaleString()} requests</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-User Table */}
      <div className="rounded-lg border border-border/50 bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Tokens In</TableHead>
              <TableHead className="text-right">Tokens Out</TableHead>
              <TableHead className="text-right">Est. Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byUser.data?.map((row) => (
              <>
                <TableRow
                  key={row.user.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => setExpandedUser(expandedUser === row.user.id ? null : row.user.id)}
                >
                  <TableCell>
                    {expandedUser === row.user.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{'displayName' in row.user ? (row.user as Record<string, unknown>).displayName as string : null ?? row.user.name ?? 'Unnamed'}</div>
                      <div className="text-sm text-muted-foreground">{row.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{'platformRole' in row.user && <RoleBadge role={(row.user as Record<string, unknown>).platformRole as import('@prisma/client').PlatformRole} />}</TableCell>
                  <TableCell>{'tier' in row.user && <PlanBadge tier={(row.user as Record<string, unknown>).tier as string} />}</TableCell>
                  <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatTokens(row.tokensIn)}</TableCell>
                  <TableCell className="text-right">{formatTokens(row.tokensOut)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCost(row.estimatedCost)}</TableCell>
                </TableRow>
                {expandedUser === row.user.id && userDetail.data && (
                  <TableRow key={`${row.user.id}-detail`}>
                    <TableCell colSpan={8} className="bg-muted/30 p-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium mb-2">By Feature</h4>
                          <div className="space-y-1">
                            {userDetail.data.byFeature.map((f) => (
                              <div key={f.feature} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{f.feature}</span>
                                <span>{formatCost(f._sum.estimatedCost ?? 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">By Model</h4>
                          <div className="space-y-1">
                            {userDetail.data.byModel.map((m) => (
                              <div key={`${m.model}-${m.provider}`} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{m.model}</span>
                                <span>{formatCost(m._sum.estimatedCost ?? 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

**Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/(app)/admin/api-usage/page.tsx
git commit -m "feat(ui): add admin API usage dashboard with per-user cost breakdown"
```

---

### Task 11: Live Polling on User API Usage Page

**Files:**
- Modify: `src/app/(app)/settings/api-usage/page.tsx` (lines 65-68)

**Context:** The user-facing API usage page currently has no auto-refresh. Add `refetchInterval: 30_000` to all four queries.

**Step 1: Add refetchInterval to all queries**

In `src/app/(app)/settings/api-usage/page.tsx`, update the queries at lines 65-68:

```typescript
const summary = trpc.apiUsage.getSummary.useQuery(undefined, { refetchInterval: 30_000 });
const byFeature = trpc.apiUsage.getByFeature.useQuery(undefined, { refetchInterval: 30_000 });
const byModel = trpc.apiUsage.getByModel.useQuery(undefined, { refetchInterval: 30_000 });
const recentCalls = trpc.apiUsage.getRecentCalls.useQuery(undefined, { refetchInterval: 30_000 });
```

Note: If the queries currently pass no input, they may need `undefined` as the first argument to pass the options object as the second argument. Check the current code — if they already pass no input, just add the options object.

**Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/(app)/settings/api-usage/page.tsx
git commit -m "feat(ui): add 30-second live polling to user API usage page"
```

---

### Task 12: Update Settings Page — Role Badge + Plan Labels

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Context:** The settings page should show the user's platform role badge and use the new plan display names (Wanderer/Hero/Fellowship) wherever the tier is displayed. Also, the admin section should only show for Wardens+ (done in Task 4), and should link to `/admin/users` as the primary admin page (not just invites).

**Step 1: Add role badge to profile section**

Import `RoleBadge` and `PlanBadge` components. Display the user's platform role near their profile info. Replace any raw tier string display with `<PlanBadge>`.

**Step 2: Update admin section links**

The admin card should link to `/admin` (which will show the sidebar nav). Update the existing "Beta Invite Codes" link to be a general "Admin Panel" link, or add multiple links.

**Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat(ui): add role/plan badges to settings page, update admin links"
```

---

### Task 13: Verification + Type Check + Build

**Files:** None (verification only)

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Manual smoke test**

1. Open `http://localhost:3847/settings` — verify role badge shows, plan name says "Wanderer"/"Hero"/"Fellowship"
2. Open `http://localhost:3847/admin/users` — verify user table loads, role badges display
3. Open `http://localhost:3847/admin/api-usage` — verify summary cards and per-user table
4. Open `http://localhost:3847/settings/api-usage` — verify data refreshes every 30 seconds
5. Try changing a test user's role via the admin users page
