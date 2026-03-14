# Player Portal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/play` route context giving players their own campaign hub, session recaps, shared content pages, and a real-time live session mode — all within the existing QuiverDM app.

**Architecture:** New `/play/[slug]` route tree with its own layout and minimal nav, separate from the DM `/campaigns/[slug]` surface. Player-scoped tRPC `play` router strips DM-only fields. Live session mode uses the existing WebSocket server with new event types for initiative, HP state, and DM spotlight content.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma, WebSocket (existing ws server at `src/server/websocket.ts` — native `ws` library, NOT Socket.IO), Tailwind + shadcn/ui, Framer Motion

---

## File Map

### New Files
```
prisma/schema.prisma                              — Add PlayerSessionState, SessionSpotlight, field additions
src/server/routers/play.ts                        — tRPC play router (player-scoped queries)
src/server/services/play.service.ts               — Player-scoped data access layer
src/app/(app)/play/layout.tsx                     — /play root layout (minimal nav)
src/app/(app)/play/page.tsx                       — Player home (all campaigns as player)
src/app/(app)/play/[slug]/layout.tsx              — Campaign context layout + bottom tab nav
src/app/(app)/play/[slug]/page.tsx                — Campaign hub
src/app/(app)/play/[slug]/session/page.tsx        — Live session mode
src/app/(app)/play/[slug]/sessions/page.tsx       — Session list
src/app/(app)/play/[slug]/sessions/[id]/page.tsx  — Session recap
src/app/(app)/play/[slug]/npcs/page.tsx           — Shared NPCs
src/app/(app)/play/[slug]/lore/page.tsx           — Shared homebrew/lore
src/components/play/play-nav.tsx                  — Player sidebar nav + mobile bottom tabs
src/components/play/player-campaign-card.tsx      — Campaign card on player home
src/components/play/party-panel.tsx               — Party roster with HP rings
src/components/play/session-recap-card.tsx        — Recap summary card
src/components/play/live-session/index.tsx        — Live session root component
src/components/play/live-session/initiative-strip.tsx
src/components/play/live-session/my-character-panel.tsx
src/components/play/live-session/dm-spotlight.tsx
src/components/play/live-session/quick-actions.tsx
src/hooks/use-player-session.ts                   — WebSocket hook for live session state
```

### Modified Files
```
prisma/schema.prisma                              — New models + field additions
src/server/routers/_app.ts                        — Register play router
src/server/websocket.ts                           — New WS event handlers
src/components/layout/sidebar.tsx                 — DM/Player context switcher
```

---

## Chunk 1: Schema + Foundation

### Task 1: Schema additions

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Open `prisma/schema.prisma`. After the `GameSession` model, add:

```prisma
model PlayerSessionState {
  id          String      @id @default(cuid())
  sessionId   String
  session     GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String
  characterId String?
  hp          Int
  maxHp       Int
  tempHp      Int         @default(0)
  conditions  Json        @default("[]")
  spellSlots  Json        @default("{}")
  hitDice     Json        @default("{}")
  updatedAt   DateTime    @updatedAt

  @@unique([sessionId, userId])
  @@index([sessionId])
}

model SessionSpotlight {
  id        String      @id @default(cuid())
  sessionId String
  session   GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  type      String      // 'text' | 'image' | 'statblock' | 'handout'
  content   Json
  createdAt DateTime    @default(now())
  clearedAt DateTime?

  @@index([sessionId])
}
```

- [ ] Add relations to `GameSession` model (find the existing relations block):

```prisma
playerSessionStates PlayerSessionState[]
spotlights          SessionSpotlight[]
```

- [ ] Check `GameSession` in `prisma/schema.prisma` for `playerVisibility`. **This field already exists** with `@default("dm-only")`. Do NOT add it again. If the default needs to be `"summary"`, update it there — but confirm with the team first. Skip this step if the field already exists.

- [ ] Check if `HomebrewContent` has `sharedWithPlayers`. If not, add:

```prisma
sharedWithPlayers Boolean @default(false)
```

- [ ] Check if `Npc` has `playerVisible`. If not, add:

```prisma
playerVisible Boolean @default(false)
```

- [ ] Run migration:

```bash
npm run db:push
```

Expected: no errors, schema synced.

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(player-portal): add PlayerSessionState, SessionSpotlight, visibility fields"
```

---

### Task 2: tRPC play router — read queries

**Files:**
- Create: `src/server/routers/play.ts`
- Create: `src/server/services/play.service.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] Create `src/server/services/play.service.ts`:

```typescript
// NOTE: This service uses protectedProcedure + manual membership checks rather than
// campaignMemberProcedure, because play queries are cross-campaign (getHome) or
// require custom player-scoped filtering. This is a deliberate deviation from the
// standard pattern — document it if extending this service.
import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/server/errors';

export const playService = {
  async getPlayerCampaigns(userId: string) {
    const memberships = await prisma.campaignMember.findMany({
      where: { userId },
      include: {
        campaign: {
          include: {
            sessions: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { id: true, title: true, date: true, status: true },
            },
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
      orderBy: { campaign: { updatedAt: 'desc' } },
    });
    return memberships.map(m => ({
      campaignId: m.campaignId,
      name: m.campaign.name,
      slug: m.campaign.slug,
      bannerUrl: m.campaign.bannerUrl ?? null,
      role: m.role,
      nextSession: m.campaign.sessions[0] ?? null,
    }));
  },

  async getCampaignHub(slug: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        sessions: {
          where: { status: { not: 'planning' } },
          orderBy: { date: 'desc' },
          // NOTE: limited to 5 — sufficient for hub, but session list page should
          // add a dedicated getSessions query if full history is needed
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            date: true,
            aiSummary: true,
            playerVisibility: true,
          },
        },
      },
    });
    if (!campaign) throw new NotFoundError('campaign', slug);

    const isMember = campaign.members.some(m => m.userId === userId);
    if (!isMember) throw ForbiddenError.forPermission('view', 'campaign');

    const activeSessions = campaign.sessions.filter(
      s => s.playerVisibility !== 'dm-only'
    );

    return {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description,
      bannerUrl: campaign.bannerUrl ?? null,
      members: campaign.members,
      sessions: activeSessions,
    };
  },

  async getSessionRecap(sessionId: string, userId: string) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        campaign: { include: { members: { where: { userId }, select: { role: true } } } },
      },
    });
    if (!session) throw new NotFoundError('session', sessionId);
    if (!session.campaign.members.length) throw ForbiddenError.forPermission('view', 'session');
    if (session.playerVisibility === 'dm-only') throw ForbiddenError.forPermission('view', 'session');

    return {
      id: session.id,
      title: session.title,
      status: session.status,
      date: session.date,
      aiSummary: session.aiSummary ?? null,
      playerVisibility: session.playerVisibility,
    };
  },

  async getSharedNpcs(campaignId: string, userId: string) {
    const member = await prisma.campaignMember.findFirst({ where: { campaignId, userId } });
    if (!member) throw ForbiddenError.forPermission('view', 'npcs');

    // NPC model fields: id, name, description, faction, role, imageUrl, tags
    // (race, occupation, personality do NOT exist on Npc — do not add them to select)
    return prisma.npc.findMany({
      where: { campaignId, playerVisible: true },
      select: {
        id: true, name: true, description: true,
        faction: true, role: true, imageUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async getSharedLore(campaignId: string, userId: string) {
    const member = await prisma.campaignMember.findFirst({ where: { campaignId, userId } });
    if (!member) throw ForbiddenError.forPermission('view', 'lore');

    // HomebrewContent is linked via CampaignHomebrewContent join table, NOT a direct
    // campaignId FK. Query through the relation. description lives in data: Json blob.
    return prisma.homebrewContent.findMany({
      where: { campaigns: { some: { campaignId } }, sharedWithPlayers: true },
      select: { id: true, name: true, type: true, imageUrl: true, data: true },
      orderBy: { name: 'asc' },
    });
  },

  async getPlayerSessionState(sessionId: string, userId: string) {
    return prisma.playerSessionState.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
  },

  async upsertPlayerSessionState(
    sessionId: string,
    userId: string,
    data: { hp: number; maxHp: number; tempHp?: number; conditions?: string[]; spellSlots?: Record<string, unknown>; hitDice?: Record<string, unknown> }
  ) {
    return prisma.playerSessionState.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId, ...data, conditions: data.conditions ?? [], spellSlots: data.spellSlots ?? {}, hitDice: data.hitDice ?? {} },
      update: data,
    });
  },
};
```

- [ ] Create `src/server/routers/play.ts`:

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { playService } from '@/server/services/play.service';

export const playRouter = router({
  getHome: protectedProcedure.query(({ ctx }) =>
    playService.getPlayerCampaigns(ctx.session.user.id)
  ),

  getCampaignHub: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ ctx, input }) =>
      playService.getCampaignHub(input.slug, ctx.session.user.id)
    ),

  getSessionRecap: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getSessionRecap(input.sessionId, ctx.session.user.id)
    ),

  getSharedNpcs: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getSharedNpcs(input.campaignId, ctx.session.user.id)
    ),

  getSharedLore: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getSharedLore(input.campaignId, ctx.session.user.id)
    ),

  getSessionState: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) =>
      playService.getPlayerSessionState(input.sessionId, ctx.session.user.id)
    ),

  updateSessionState: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      hp: z.number().int().min(0),
      maxHp: z.number().int().min(1),
      tempHp: z.number().int().min(0).optional(),
      conditions: z.array(z.string()).optional(),
      spellSlots: z.record(z.unknown()).optional(),
      hitDice: z.record(z.unknown()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { sessionId, ...data } = input;
      return playService.upsertPlayerSessionState(sessionId, ctx.session.user.id, data);
    }),
});
```

- [ ] Register in `src/server/routers/_app.ts` — find the router list and add:

```typescript
import { playRouter } from './play';
// in appRouter:
play: playRouter,
```

- [ ] Type-check:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] Commit:

```bash
git add src/server/routers/play.ts src/server/services/play.service.ts src/server/routers/_app.ts
git commit -m "feat(player-portal): add play tRPC router and service layer"
```

---

### Task 3: WebSocket events for live session

**Files:**
- Modify: `src/server/websocket.ts`

**IMPORTANT:** The WS server uses the native `ws` library — NOT Socket.IO. There are no `socket.on()` / `socket.to().emit()` calls. The pattern is `ws.onmessage` with a message-type switch and `wss.clients` broadcast loops. Read the file carefully before editing — match the existing pattern exactly.

- [ ] Open `src/server/websocket.ts`. Read the message handler switch statement to understand the existing `type` dispatch pattern and how rooms/sessions are tracked (likely a `Map<sessionId, Set<WebSocket>>`).

- [ ] Identify the auth/join handshake — the existing server uses a token-based `join_live_session` message. New player connections must go through the same handshake. Do NOT bypass auth.

- [ ] Add new message type handlers inside the existing switch, following the exact same pattern as existing handlers. Pseudocode (adapt to actual pattern in file):

```typescript
case 'player:state:update': {
  // msg.data: { sessionId, campaignId, userId, hp, maxHp, tempHp, conditions }
  // Broadcast to all clients subscribed to this session/campaign
  broadcastToSession(msg.data.sessionId, {
    type: 'player:state:updated',
    data: msg.data,
  }, ws); // ws = sender, exclude or include per your broadcast helper
  break;
}

case 'dm:spotlight:push': {
  // msg.data: { sessionId, campaignId, type, content }
  broadcastToSession(msg.data.sessionId, {
    type: 'dm:spotlight:pushed',
    data: msg.data,
  });
  break;
}

case 'dm:spotlight:clear': {
  broadcastToSession(msg.data.sessionId, { type: 'dm:spotlight:cleared' });
  break;
}

case 'dm:initiative:update': {
  // msg.data: { sessionId, campaignId, participants, currentTurnId, round }
  broadcastToSession(msg.data.sessionId, {
    type: 'dm:initiative:updated',
    data: msg.data,
  });
  break;
}
```

- [ ] Confirm there is a broadcast helper already — if not, add one following the existing pattern for broadcasting to all clients in a session.

- [ ] Commit:

```bash
git add src/server/websocket.ts
git commit -m "feat(player-portal): add WS events for player state, spotlight, initiative"
```

---

## Chunk 2: /play Layout + Player Home

### Task 4: /play root layout

**Files:**
- Create: `src/app/(app)/play/layout.tsx`
- Create: `src/components/play/play-nav.tsx`

- [ ] Create `src/components/play/play-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sword, Home, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlayNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6">
        <Link href="/play" className="flex items-center gap-2 text-sm font-semibold text-amber-400 font-display">
          <Sword className="h-4 w-4" />
          <span>Player Mode</span>
        </Link>
      </div>
      <Link
        href="/play"
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          pathname === '/play'
            ? 'bg-amber-500/10 text-amber-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        )}
      >
        <Home className="h-4 w-4" />
        My Campaigns
      </Link>
      <div className="mt-4 pt-4 border-t border-white/5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <Users className="h-4 w-4" />
          DM Dashboard
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] Create `src/app/(app)/play/layout.tsx`:

```tsx
import { PlayNav } from '@/components/play/play-nav';

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-56 flex-col border-r border-white/5 bg-background/50 shrink-0">
        <PlayNav />
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] Commit:

```bash
git add src/app/\(app\)/play/layout.tsx src/components/play/play-nav.tsx
git commit -m "feat(player-portal): add /play layout and nav"
```

---

### Task 5: Player home page

**Files:**
- Create: `src/app/(app)/play/page.tsx`
- Create: `src/components/play/player-campaign-card.tsx`

- [ ] Create `src/components/play/player-campaign-card.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface PlayerCampaignCardProps {
  campaignId: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  role: string;
  nextSession: { id: string; title: string; status: string; date: string | null } | null;
}

export function PlayerCampaignCard({ name, slug, bannerUrl, role, nextSession }: PlayerCampaignCardProps) {
  const isLive = nextSession?.status === 'in_progress';

  return (
    <Link href={`/play/${slug}`} className="group block">
      <div className="stone-card overflow-hidden rounded-lg border border-white/8 hover:border-amber-500/30 transition-colors">
        <div className="relative h-24 bg-gradient-to-br from-indigo-950 to-black">
          {bannerUrl && (
            <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          )}
          {isLive && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3" />
              LIVE
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">{name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role.toLowerCase().replace('_', ' ')}</p>
          {nextSession && !isLive && nextSession.date && (
            <p className="text-xs text-amber-400/70 mt-1">
              Next: {new Date(nextSession.date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] Create `src/app/(app)/play/page.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { PlayerCampaignCard } from '@/components/play/player-campaign-card';
import { Sword } from 'lucide-react';

export default function PlayerHomePage() {
  const { data: campaigns, isLoading } = trpc.play.getHome.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <p className="overline-label">Player Mode</p>
        <h1 className="font-display text-2xl font-bold">Your Campaigns</h1>
      </div>

      {!campaigns?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Sword className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>You haven't joined any campaigns yet.</p>
          <p className="text-sm mt-1">Ask your DM for an invite code.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <PlayerCampaignCard key={c.campaignId} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] Start dev server and navigate to `http://localhost:3847/play`. Verify page renders with correct campaign cards.

- [ ] Commit:

```bash
git add src/app/\(app\)/play/page.tsx src/components/play/player-campaign-card.tsx
git commit -m "feat(player-portal): player home page with campaign cards"
```

---

## Chunk 3: Campaign Hub

### Task 6: Campaign [slug] layout + context

**Files:**
- Create: `src/app/(app)/play/[slug]/layout.tsx`

- [ ] Create `src/app/(app)/play/[slug]/layout.tsx`:

```tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { BookOpen, Users, ScrollText, Wand2, Map } from 'lucide-react';

const tabs = [
  { label: 'Hub', href: '', icon: Map },
  { label: 'Recaps', href: '/sessions', icon: ScrollText },
  { label: 'Party', href: '/characters', icon: Users },
  { label: 'NPCs', href: '/npcs', icon: BookOpen },
  { label: 'Lore', href: '/lore', icon: Wand2 },
];

export default function PlayCampaignLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const base = `/play/${slug}`;

  return (
    <div className="flex flex-col min-h-screen pb-16 md:pb-0">
      <div className="flex-1">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/8 bg-background/95 backdrop-blur z-40">
        <div className="flex">
          {tabs.map(tab => {
            const href = `${base}${tab.href}`;
            const isActive = tab.href === ''
              ? pathname === base
              : pathname.startsWith(href);
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                  isActive ? 'text-amber-400' : 'text-muted-foreground'
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop sub-nav */}
      <div className="hidden md:block" />
    </div>
  );
}
```

- [ ] Commit:

```bash
git add src/app/\(app\)/play/\[slug\]/layout.tsx
git commit -m "feat(player-portal): campaign layout with mobile bottom tab nav"
```

---

### Task 7: Campaign hub page

**Files:**
- Create: `src/app/(app)/play/[slug]/page.tsx`
- Create: `src/components/play/party-panel.tsx`
- Create: `src/components/play/session-recap-card.tsx`

- [ ] Create `src/components/play/party-panel.tsx`:

```tsx
interface PartyMember {
  userId: string;
  role: string;
  user: { id: string; name: string | null; image: string | null };
}

export function PartyPanel({ members }: { members: PartyMember[] }) {
  return (
    <div className="stone-card p-4">
      <p className="overline-label mb-3">Party</p>
      <div className="flex flex-wrap gap-3">
        {members.map(m => (
          <div key={m.userId} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/20">
              {m.user.image
                ? <img src={m.user.image} alt={m.user.name ?? ''} className="h-full w-full object-cover" />
                : <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">{m.user.name?.[0]}</div>
              }
            </div>
            <div>
              <p className="text-sm font-medium leading-none">{m.user.name}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{m.role.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/play/session-recap-card.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SessionRecapCardProps {
  sessionId: string;
  slug: string;
  title: string;
  date: string | null;
  aiSummary: string | null;
}

export function SessionRecapCard({ sessionId, slug, title, date, aiSummary }: SessionRecapCardProps) {
  return (
    <div className="stone-card p-4">
      <p className="overline-label mb-2">Last Session</p>
      <h3 className="font-display text-base font-semibold mb-1">{title}</h3>
      {date && (
        <p className="text-xs text-muted-foreground mb-2">
          {new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {aiSummary && (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{aiSummary}</p>
      )}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/play/${slug}/sessions/${sessionId}`}>Read full recap</Link>
      </Button>
    </div>
  );
}
```

- [ ] Create `src/app/(app)/play/[slug]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { PartyPanel } from '@/components/play/party-panel';
import { SessionRecapCard } from '@/components/play/session-recap-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function PlayCampaignHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.play.getCampaignHub.useQuery({ slug });

  if (isLoading) return <div className="p-6 animate-pulse space-y-4"><div className="h-32 bg-white/5 rounded-lg" /><div className="h-24 bg-white/5 rounded-lg" /></div>;
  if (!data) return null;

  const lastSession = data.sessions[0] ?? null;
  const liveSession = data.sessions.find(s => s.status === 'in_progress');

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      {/* Hero */}
      <div className="relative h-32 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-950 to-black mb-2">
        {data.bannerUrl && <img src={data.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <p className="overline-label text-amber-400/70">Campaign</p>
          <h1 className="font-display text-xl font-bold">{data.name}</h1>
        </div>
      </div>

      {/* Live session banner */}
      {liveSession && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-red-400">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Session in progress: {liveSession.title}</span>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link href={`/play/${slug}/session`}>Join Live</Link>
          </Button>
        </div>
      )}

      <PartyPanel members={data.members} />

      {lastSession && (
        <SessionRecapCard
          sessionId={lastSession.id}
          slug={slug}
          title={lastSession.title}
          date={lastSession.date}
          aiSummary={lastSession.aiSummary ?? null}
        />
      )}
    </div>
  );
}
```

- [ ] Navigate to `http://localhost:3847/play/tales-from-the-bonfire-keep`. Verify hub renders with party panel and last session card.

- [ ] Commit:

```bash
git add src/app/\(app\)/play/\[slug\]/page.tsx src/components/play/party-panel.tsx src/components/play/session-recap-card.tsx
git commit -m "feat(player-portal): campaign hub page with party panel and session recap"
```

---

### Task 8: Session list + recap pages

**Files:**
- Create: `src/app/(app)/play/[slug]/sessions/page.tsx`
- Create: `src/app/(app)/play/[slug]/sessions/[id]/page.tsx`

- [ ] Create `src/app/(app)/play/[slug]/sessions/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText } from 'lucide-react';

export default function PlaySessionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = trpc.play.getCampaignHub.useQuery({ slug });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Campaign</p>
      <h1 className="font-display text-xl font-bold mb-6">Session Recaps</h1>

      {!data?.sessions.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.sessions.map(s => (
            <Link key={s.id} href={`/play/${slug}/sessions/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 hover:bg-white/5 px-4 py-3 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                {s.date && <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString()}</p>}
              </div>
              <span className="text-xs text-muted-foreground capitalize">{s.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `src/app/(app)/play/[slug]/sessions/[id]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function PlaySessionRecapPage() {
  const { id } = useParams<{ slug: string; id: string }>();
  const { data, isLoading } = trpc.play.getSessionRecap.useQuery({ sessionId: id });

  if (isLoading) return <div className="p-6 animate-pulse space-y-3"><div className="h-8 w-64 bg-white/5 rounded" /><div className="h-64 bg-white/5 rounded-lg" /></div>;
  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Session Recap</p>
      <h1 className="font-display text-2xl font-bold mb-1">{data.title}</h1>
      {data.date && (
        <p className="text-sm text-muted-foreground mb-6">
          {new Date(data.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {data.aiSummary ? (
        <div className="stone-card p-4 prose prose-invert prose-sm max-w-none">
          <p className="overline-label mb-3">AI Summary</p>
          <div className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">{data.aiSummary}</div>
        </div>
      ) : (
        <div className="stone-card p-8 text-center text-muted-foreground">
          <p>No summary available for this session yet.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] Commit:

```bash
git add src/app/\(app\)/play/\[slug\]/sessions/
git commit -m "feat(player-portal): session list and recap pages"
```

---

### Task 9: Shared NPCs + Lore pages

**Files:**
- Create: `src/app/(app)/play/[slug]/npcs/page.tsx`
- Create: `src/app/(app)/play/[slug]/lore/page.tsx`
- Create: `src/app/(app)/play/[slug]/characters/page.tsx`

- [ ] Create `src/app/(app)/play/[slug]/npcs/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BookOpen } from 'lucide-react';

export default function PlayNpcsPage() {
  const { slug } = useParams<{ slug: string }>();
  const hub = trpc.play.getCampaignHub.useQuery({ slug });
  const campaignId = hub.data?.id;
  const { data: npcs } = trpc.play.getSharedNpcs.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Campaign</p>
      <h1 className="font-display text-xl font-bold mb-6">Known NPCs</h1>

      {!npcs?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Your DM hasn't shared any NPCs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {npcs.map(npc => (
            <div key={npc.id} className="stone-card p-3 flex gap-3">
              {npc.imageUrl && (
                <img src={npc.imageUrl} alt={npc.name} className="h-12 w-12 rounded object-cover shrink-0" />
              )}
              <div>
                <p className="font-medium text-sm">{npc.name}</p>
                {npc.role && <p className="text-xs text-muted-foreground">{npc.role}</p>}
                {npc.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{npc.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `src/app/(app)/play/[slug]/lore/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Wand2 } from 'lucide-react';

export default function PlayLorePage() {
  const { slug } = useParams<{ slug: string }>();
  const hub = trpc.play.getCampaignHub.useQuery({ slug });
  const campaignId = hub.data?.id;
  const { data: lore } = trpc.play.getSharedLore.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Campaign</p>
      <h1 className="font-display text-xl font-bold mb-6">Shared Lore</h1>

      {!lore?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Your DM hasn't shared any lore yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lore.map(item => (
            <div key={item.id} className="stone-card p-4 flex gap-3">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="h-14 w-14 rounded object-cover shrink-0" />
              )}
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground capitalize mb-1">{item.type}</p>
                {/* description lives in data: Json blob — cast and extract */}
                {(item.data as Record<string, unknown>)?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {String((item.data as Record<string, unknown>).description)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `src/app/(app)/play/[slug]/characters/page.tsx` — placeholder redirecting to `/characters` for now:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayCharactersPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/characters'); }, [router]);
  return null;
}
```

- [ ] Commit:

```bash
git add src/app/\(app\)/play/\[slug\]/npcs/ src/app/\(app\)/play/\[slug\]/lore/ src/app/\(app\)/play/\[slug\]/characters/
git commit -m "feat(player-portal): shared NPCs, lore, and characters placeholder pages"
```

---

## Chunk 4: Live Session Mode

### Task 10: WebSocket hook for live session

**Files:**
- Create: `src/hooks/use-player-session.ts`

- [ ] Read `src/hooks/` to find the existing WebSocket hook pattern (e.g. `use-session-cockpit.ts` or similar).

- [ ] Create `src/hooks/use-player-session.ts` following the same pattern:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface InitiativeParticipant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  type: string;
}

export interface SpotlightContent {
  type: 'text' | 'image' | 'statblock' | 'handout';
  content: unknown;
}

export interface PlayerSessionState {
  hp: number;
  maxHp: number;
  tempHp: number;
  conditions: string[];
  spellSlots: Record<string, { used: number; max: number }>;
  hitDice: Record<string, { used: number; max: number }>;
}

export function usePlayerSession(campaignId: string, sessionId: string) {
  const { data: authSession } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [initiative, setInitiative] = useState<{ participants: InitiativeParticipant[]; currentTurnId: string | null; round: number } | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightContent | null>(null);
  const [partyStates, setPartyStates] = useState<Record<string, PlayerSessionState>>({});

  useEffect(() => {
    if (!campaignId || !authSession?.user) return;

    // NEXT_PUBLIC_WS_URL must be set in .env.local (dev: ws://localhost:3004)
    // and in Vercel/production env vars. Default port is 3004 (check src/server/websocket.ts).
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3004';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // CRITICAL: src/server/websocket.ts handleJoinLiveSession requires a short-lived
      // Redis token. No token → server closes with 4001 immediately.
      // Add play.getWsToken tRPC mutation: writes { sessionId, userId } to Redis with TTL,
      // returns a token string. Page fetches token before mounting, passes as hook prop.
      // Signature: usePlayerSession(campaignId, sessionId, token)
      ws.send(JSON.stringify({ type: 'join_live_session', sessionId, token }));
    };

    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'dm:initiative:updated':
          setInitiative(msg.data);
          break;
        case 'dm:spotlight:pushed':
          setSpotlight({ type: msg.data.type, content: msg.data.content });
          break;
        case 'dm:spotlight:cleared':
          setSpotlight(null);
          break;
        case 'player:state:updated':
          setPartyStates(prev => ({ ...prev, [msg.data.userId]: msg.data }));
          break;
      }
    };

    return () => ws.close();
  }, [campaignId, authSession]);

  function sendStateUpdate(state: Partial<PlayerSessionState>) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player:state:update',
        data: { sessionId, campaignId, userId: authSession?.user?.id, ...state },
      }));
    }
  }

  return { connected, initiative, spotlight, partyStates, sendStateUpdate };
}
```

- [ ] Commit:

```bash
git add src/hooks/use-player-session.ts
git commit -m "feat(player-portal): WebSocket hook for live session state"
```

---

### Task 11: Live session components

**Files:**
- Create: `src/components/play/live-session/initiative-strip.tsx`
- Create: `src/components/play/live-session/my-character-panel.tsx`
- Create: `src/components/play/live-session/dm-spotlight.tsx`
- Create: `src/components/play/live-session/quick-actions.tsx`
- Create: `src/components/play/live-session/index.tsx`

- [ ] Create `src/components/play/live-session/initiative-strip.tsx`:

```tsx
import { cn } from '@/lib/utils';
import type { InitiativeParticipant } from '@/hooks/use-player-session';

export function InitiativeStrip({ participants, currentTurnId, round }: {
  participants: InitiativeParticipant[];
  currentTurnId: string | null;
  round: number;
}) {
  return (
    <div className="bg-black/40 border-b border-white/8 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-amber-400/70 font-mono">Round {round}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {participants.filter(p => p.isAlive).map(p => (
          <div
            key={p.id}
            className={cn(
              'flex flex-col items-center min-w-[52px] px-1.5 py-1 rounded text-center transition-colors',
              currentTurnId === p.id
                ? 'bg-amber-500/20 ring-1 ring-amber-500/50'
                : 'bg-white/5'
            )}
          >
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{p.name.split(' ')[0]}</span>
            <span className={cn('text-xs font-mono font-bold', p.hp / p.maxHp < 0.3 ? 'text-red-400' : 'text-foreground')}>
              {p.hp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/play/live-session/my-character-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PlayerSessionState } from '@/hooks/use-player-session';

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

interface MyCharacterPanelProps {
  state: PlayerSessionState;
  onChange: (update: Partial<PlayerSessionState>) => void;
}

export function MyCharacterPanel({ state, onChange }: MyCharacterPanelProps) {
  const [editing, setEditing] = useState(false);
  const [hpInput, setHpInput] = useState(String(state.hp));
  const hpPct = Math.max(0, Math.min(1, state.hp / state.maxHp));

  function applyHp() {
    const val = parseInt(hpInput);
    if (!isNaN(val)) onChange({ hp: Math.max(0, Math.min(state.maxHp + state.tempHp, val)) });
    setEditing(false);
  }

  function toggleCondition(c: string) {
    const next = state.conditions.includes(c)
      ? state.conditions.filter(x => x !== c)
      : [...state.conditions, c];
    onChange({ conditions: next });
  }

  return (
    <div className="p-4 space-y-4">
      {/* HP */}
      <div className="stone-card p-4">
        <p className="overline-label mb-2">Hit Points</p>
        <div className="flex items-center gap-3 mb-2">
          <Button variant="outline" size="icon" className="h-9 w-9 text-lg shrink-0"
            onClick={() => onChange({ hp: Math.max(0, state.hp - 1) })}>−</Button>
          {editing ? (
            <input
              type="number"
              value={hpInput}
              onChange={e => setHpInput(e.target.value)}
              onBlur={applyHp}
              onKeyDown={e => e.key === 'Enter' && applyHp()}
              className="w-20 text-center text-2xl font-mono font-bold bg-transparent border-b border-amber-500 outline-none"
              autoFocus
            />
          ) : (
            <button onClick={() => { setEditing(true); setHpInput(String(state.hp)); }}
              className="text-2xl font-mono font-bold hover:text-amber-400 transition-colors">
              {state.hp} <span className="text-sm text-muted-foreground font-normal">/ {state.maxHp}</span>
            </button>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9 text-lg shrink-0"
            onClick={() => onChange({ hp: Math.min(state.maxHp, state.hp + 1) })}>+</Button>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${hpPct * 100}%` }} />
        </div>
        {state.tempHp > 0 && <p className="text-xs text-sky-400 mt-1">+{state.tempHp} temp</p>}
      </div>

      {/* Conditions */}
      <div className="stone-card p-4">
        <p className="overline-label mb-2">Conditions</p>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map(c => (
            <button key={c} onClick={() => toggleCondition(c)}
              className={cn('text-xs px-2 py-0.5 rounded-full border transition-colors',
                state.conditions.includes(c)
                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20')}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/play/live-session/dm-spotlight.tsx`:

```tsx
import type { SpotlightContent } from '@/hooks/use-player-session';

export function DmSpotlight({ spotlight }: { spotlight: SpotlightContent | null }) {
  if (!spotlight) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
        <div>
          <p className="text-2xl mb-2 opacity-30">⚔️</p>
          <p>Waiting for your DM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-auto">
      {spotlight.type === 'text' && (
        <div className="stone-card p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {String(spotlight.content)}
        </div>
      )}
      {spotlight.type === 'image' && (
        <img src={String(spotlight.content)} alt="DM shared" className="max-w-full rounded-lg" />
      )}
      {spotlight.type === 'statblock' && (
        <div className="stone-card p-4 font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(spotlight.content, null, 2)}
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `src/components/play/live-session/quick-actions.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dice6 } from 'lucide-react';

export function QuickActions() {
  const [lastRoll, setLastRoll] = useState<{ die: number; result: number } | null>(null);

  function roll(die: number) {
    setLastRoll({ die, result: Math.floor(Math.random() * die) + 1 });
  }

  return (
    <div className="border-t border-white/8 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Dice6 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Quick Roll</span>
        {lastRoll && (
          <span className="text-xs font-mono text-amber-400 ml-auto">
            d{lastRoll.die}: <strong>{lastRoll.result}</strong>
          </span>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {[4, 6, 8, 10, 12, 20].map(d => (
          <Button key={d} variant="outline" size="sm" className="h-7 px-2 text-xs font-mono"
            onClick={() => roll(d)}>d{d}</Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/play/live-session/index.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { usePlayerSession } from '@/hooks/use-player-session';
import { InitiativeStrip } from './initiative-strip';
import { MyCharacterPanel } from './my-character-panel';
import { DmSpotlight } from './dm-spotlight';
import { QuickActions } from './quick-actions';
import type { PlayerSessionState } from '@/hooks/use-player-session';

interface LiveSessionProps {
  campaignId: string;
  sessionId: string;
}

const DEFAULT_STATE: PlayerSessionState = {
  hp: 10, maxHp: 10, tempHp: 0, conditions: [], spellSlots: {}, hitDice: {},
};

export function LiveSession({ campaignId, sessionId }: LiveSessionProps) {
  const { connected, initiative, spotlight, sendStateUpdate } = usePlayerSession(campaignId, sessionId);
  const { data: savedState } = trpc.play.getSessionState.useQuery({ sessionId });
  const updateState = trpc.play.updateSessionState.useMutation();
  const [localState, setLocalState] = useState<PlayerSessionState | null>(null);

  const state: PlayerSessionState = localState ?? (savedState as PlayerSessionState) ?? DEFAULT_STATE;

  function handleChange(update: Partial<PlayerSessionState>) {
    const next = { ...state, ...update };
    setLocalState(next);
    sendStateUpdate(next);
    updateState.mutate({ sessionId, hp: next.hp, maxHp: next.maxHp, tempHp: next.tempHp, conditions: next.conditions });
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {initiative && (
        <InitiativeStrip
          participants={initiative.participants}
          currentTurnId={initiative.currentTurnId}
          round={initiative.round}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: my character (mobile: full width, desktop: sidebar) */}
        <div className="w-full md:w-80 md:border-r md:border-white/8 overflow-y-auto">
          <MyCharacterPanel state={state} onChange={handleChange} />
          <QuickActions />
        </div>

        {/* Right: DM spotlight (desktop only, mobile is separate tab) */}
        <div className="hidden md:flex flex-1 flex-col overflow-auto">
          <DmSpotlight spotlight={spotlight} />
        </div>
      </div>

      {!connected && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full">
          Reconnecting...
        </div>
      )}
    </div>
  );
}
```

- [ ] Commit:

```bash
git add src/components/play/live-session/
git commit -m "feat(player-portal): live session components (initiative, HP, spotlight, dice)"
```

---

### Task 12: Live session page

**Files:**
- Create: `src/app/(app)/play/[slug]/session/page.tsx`

- [ ] Create `src/app/(app)/play/[slug]/session/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { LiveSession } from '@/components/play/live-session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PlayLiveSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = trpc.play.getCampaignHub.useQuery({ slug });

  const liveSession = data?.sessions.find(s => s.status === 'in_progress');

  if (!data) return <div className="p-6 animate-pulse h-screen bg-background" />;

  if (!liveSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <p className="text-muted-foreground mb-4">No session is currently in progress.</p>
        <Button variant="outline" asChild>
          <Link href={`/play/${slug}`}>Back to Hub</Link>
        </Button>
      </div>
    );
  }

  return <LiveSession campaignId={data.id} sessionId={liveSession.id} />;
}
```

- [ ] Commit:

```bash
git add src/app/\(app\)/play/\[slug\]/session/
git commit -m "feat(player-portal): live session page"
```

---

## Chunk 5: DM Controls + Sidebar Switcher

### Task 13: DM controls — visibility toggles

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` (or session detail)
- Modify: `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`

- [ ] Find the session detail page used by DMs (`src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` or similar). Check `trpc.sessions.getById` data shape.

- [ ] **Before implementing:** check what values the existing `playerVisibility` field actually uses in production data and existing code — the schema comment says `dm-only | summary-only | public`, but the plan uses `dm-only | summary | full`. Resolve this discrepancy first by grepping for `playerVisibility` across `src/`. Use whichever values are already in the codebase. Update the Zod enum below and the Select options to match.

- [ ] Add a `playerVisibility` toggle to the session detail page for DMs — use a `Select` component with options matching the confirmed enum values. Wire to a new `sessions.updateVisibility` mutation or the existing `sessions.update` mutation:

```tsx
// Find the session actions section and add:
{isDM && (
  <div className="flex items-center gap-2">
    <label className="text-xs text-muted-foreground">Players see:</label>
    <Select
      value={session.playerVisibility ?? 'summary'}
      onValueChange={(val) => updateSession.mutate({ sessionId: session.id, playerVisibility: val })}
    >
      <SelectTrigger className="h-7 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="dm-only">DM Only</SelectItem>
        <SelectItem value="summary">Summary</SelectItem>
        <SelectItem value="full">Full</SelectItem>
      </SelectContent>
    </Select>
  </div>
)}
```

- [ ] Find `sessions.update` in `src/server/routers/sessions.ts`. Add `playerVisibility` to the update input schema if not present:

```typescript
// Use the values confirmed in the step above — not necessarily these exact strings:
playerVisibility: z.enum(['dm-only', 'summary', 'full']).optional(),
```

- [ ] Find the NPC detail page. Add a `playerVisible` toggle for DMs — a simple switch:

```tsx
{isDM && (
  <div className="flex items-center gap-2">
    <Switch
      checked={npc.playerVisible ?? false}
      onCheckedChange={(val) => updateNpc.mutate({ npcId: npc.id, playerVisible: val })}
    />
    <label className="text-xs text-muted-foreground">Visible to players</label>
  </div>
)}
```

- [ ] Add `playerVisible` to `npcs.update` input schema if not present.

- [ ] Commit:

```bash
git commit -m "feat(player-portal): DM visibility controls for sessions and NPCs"
```

---

### Task 14: Sidebar DM/Player context switcher

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] Read `src/components/layout/sidebar.tsx`. Find where the user avatar / bottom section is rendered.

- [ ] Add a context switcher that appears when the user is both a DM on some campaigns AND a player on others:

```tsx
// Near the bottom of the sidebar, above user avatar:
<div className="px-3 pb-2">
  <div className="flex rounded-md overflow-hidden border border-white/10 text-xs">
    <Link href="/dashboard"
      className={cn('flex-1 px-2 py-1.5 text-center transition-colors',
        pathname.startsWith('/campaigns') ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-white/5')}>
      DM
    </Link>
    <Link href="/play"
      className={cn('flex-1 px-2 py-1.5 text-center transition-colors',
        pathname.startsWith('/play') ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-white/5')}>
      Player
    </Link>
  </div>
</div>
```

- [ ] Run type-check and lint:

```bash
npx tsc --noEmit && npm run lint
```

Fix any errors.

- [ ] Commit:

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(player-portal): DM/Player context switcher in sidebar"
```

---

### Task 15: Final build check + push

- [ ] Run full build:

```bash
npm run build
```

Expected: no errors.

- [ ] Fix any TypeScript or build errors before pushing.

- [ ] Push to prod:

```bash
git push origin main
```

- [ ] Verify on `https://quiverdm.com/play` — player home loads, campaign hub accessible, bottom tab nav shows on mobile.
