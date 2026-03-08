# Platform Roles & Admin Panel — Design

**Date:** 2026-03-08
**Status:** Approved

## Goal

Replace environment-variable admin checks with a DB-driven platform role system. Add fantasy-themed role names, an admin user management panel, and a platform-wide API usage dashboard.

## Platform Roles

New Prisma enum on User model:

| Level | DB Value | Display Name | Badge Style |
|-------|----------|-------------|-------------|
| 4 | `MYTHKEEPER` | Mythkeeper | Gold, divine glow |
| 3 | `WARDEN` | Warden | Purple, arcane shimmer |
| 2 | `DUNGEON_MASTER` | Dungeon Master | Amber, fire tones |
| 1 | `ADVENTURER` | Adventurer | Silver, steel |

Default on signup: `ADVENTURER`.

Migration: seed Blake's account as `MYTHKEEPER`. All existing users default to `ADVENTURER`.

### Role Permissions

| Action | Adventurer | DM | Warden | Mythkeeper |
|--------|------------|-----|--------|------------|
| Join campaigns | Yes | Yes | Yes | Yes |
| Create campaigns | No | Yes | Yes | Yes |
| View admin panel | No | No | Yes | Yes |
| View all users | No | No | Yes | Yes |
| View platform API usage | No | No | Yes | Yes |
| Promote Adventurer <-> DM | No | No | Yes | Yes |
| Suspend/unsuspend users | No | No | Yes | Yes |
| Force password reset | No | No | Yes | Yes |
| Promote to Warden/Mythkeeper | No | No | No | Yes |
| Impersonate users | No | No | No | Yes |
| Demote Warden/Mythkeeper | No | No | No | Yes |

Nobody can demote themselves.

## Plan Display Names

DB `tier` field stays `free`/`pro`/`team` (no Stripe changes). Display mapping:

| DB Value | Display Name |
|----------|-------------|
| `free` | Wanderer |
| `pro` | Hero |
| `team` | Fellowship |

Defined in `src/lib/platform.ts` as single source of truth.

## Admin Panel Pages

All under `/admin`, guard checks `platformRole >= WARDEN`.

### `/admin/users` — User Management

- Table: avatar, name, email, platform role badge, plan badge, last active, created
- Search/filter by role, plan, name
- Row actions: change role, suspend/unsuspend, force password reset, impersonate
- Impersonate: session flag + banner "Viewing as [user]" with exit button

### `/admin/api-usage` — Platform API Usage Dashboard

- **Summary cards**: total platform spend, total requests, per-provider breakdown
- **Per-user table**: user, requests, tokens in/out, estimated cost, expandable feature/model breakdown
- **Period selector** + 30-second polling (`refetchInterval`)

### Existing pages

- `/admin/invites` — unchanged
- `/admin/rules-sources` — unchanged

### Admin Nav

Sidebar inside `/admin` layout: Users | API Usage | Invites | Rules Sources

## tRPC Authorization

New procedures:
- `wardenProcedure` — requires `platformRole >= WARDEN`
- `mythkeeperProcedure` — requires `platformRole === MYTHKEEPER`

Replace all `ADMIN_EMAILS` checks with role-based procedures. Remove `ADMIN_EMAILS` env var after migration.

## Live API Usage (User-facing)

Existing `/settings/api-usage` gets `refetchInterval: 30000` on all queries. No other changes.

## Badges Component

Shared `<RoleBadge role={role} />` and `<PlanBadge tier={tier} />` components in `src/components/ui/`.

- Role badges: colored border + subtle glow matching badge style table above
- Plan badges: tier-appropriate styling (Wanderer muted, Hero gold, Fellowship royal purple)

## Future: Fateweaver

Campaign Book Generator — transcribes recordings + session summaries into a replayable campaign module. When another DM runs it in QuiverDM, DM Brain auto-integrates their players into the world. Separate feature, noted for future brainstorming.
