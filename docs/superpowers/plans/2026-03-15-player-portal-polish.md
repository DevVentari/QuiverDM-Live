# Player Portal UI Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the player portal UI across 7 screens with richer components and seed realistic mock data for mail@blakewales.au.

**Architecture:** Two independent workstreams — (1) a one-shot seed script that upserts mock data into the local DB, and (2) UI changes across components and pages that improve visual density and atmosphere. No new routes, no schema changes, no new tRPC procedures (except adding `sessionNumber` to an existing select).

**Tech Stack:** Next.js 15 App Router, tRPC, Prisma, Tailwind, TypeScript, tsx (for seed script)

---

## Chunk 1: Mock Data Seed Script

### Task 1: Seed Script

**Files:**
- Create: `scripts/seed-player-portal-demo.ts`

This script runs once against the local DB and:
1. Updates the two existing sessions in "The Dragon's Awakening" (`cmm4mi0p20008gjr7yye30szh`) to have AI summaries and set status to `completed`
2. Marks three NPCs (`npc-test-1`, `npc-test-2`, `npc-test-3`) as `playerVisible = true`
3. Upserts a Character record for Blake (Eryndor Ashveil · Ranger · Lv 5) and links it to "The Dragon's Awakening" via `CampaignCharacter`
4. Updates Session 1 in "Tales from The Bonfire Keep" (`cmmivhfdq0001n08onagcvtdt`) to have an AI summary

- [ ] **Step 1: Write the seed script**

```typescript
// scripts/seed-player-portal-demo.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DA_CAMPAIGN = 'cmm4mi0p20008gjr7yye30szh';
const BK_CAMPAIGN = 'cmmivhfdq0001n08onagcvtdt';
const BLAKE_USER = 'cmm4mgdtr0001gjr7jn3fb00c';

async function main() {
  // 1. AI summaries + completed status for Dragon's Awakening sessions
  await prisma.gameSession.update({
    where: { id: 'cmm4migp5000cgjr7o4j4nov5' },
    data: {
      status: 'completed',
      playerVisibility: 'public',
      title: 'Session 1 — Arrival at Mirathel',
      aiSummary: `The party arrived in the city of Mirathel just as dusk painted the spires amber. A chance encounter with Brother Aldric at the Salted Anchor tavern revealed whispers of disturbance beneath the old temple district — something stirring in the sealed catacombs that hadn't moved in a century. The evening ended with the party accepting a clandestine meeting request slipped under Eryndor's door.`,
    },
  });

  await prisma.gameSession.update({
    where: { id: 'cmm4muczx000egjr7vykj83oo' },
    data: {
      status: 'completed',
      playerVisibility: 'public',
      title: 'Session 2 — The Shattered Gate',
      aiSummary: `Descending into the catacombs beneath the Mirathel temple district, the party discovered the Dragon Seal — a ritual lock carved into living rock, thrumming with contained power. Eryndor found a ranger's journal lodged in a crack near the seal, warning of an Awakening cycle that recurs every 400 years. Lord Malachar's agents were spotted retreating deeper into the tunnels. The seal is cracked. Something is coming through.`,
    },
  });

  // 2. AI summary for Bonfire Keep session
  await prisma.gameSession.update({
    where: { id: 'cmmivs4xt00b1n08oscw4bk2i' },
    data: {
      playerVisibility: 'public',
      aiSummary: `The party arrived at Bonfire Keep for the Garden Dinner, an annual noble gathering hosted by Lady Verath. Over candlelit courses, three separate factions made subtle overtures to the group — the Merchant Guild, the Silver Flame temple, and an unnamed figure in grey robes who left before dessert. Mira detected an illusion concealing something beneath the garden fountain.`,
    },
  });

  // 3. Mark NPCs as player-visible
  await prisma.nPC.updateMany({
    where: { id: { in: ['npc-test-1', 'npc-test-2', 'npc-test-3'] } },
    data: { playerVisible: true },
  });

  // 4. Upsert character for Blake in Dragon's Awakening
  const character = await prisma.character.upsert({
    where: { id: 'seed-eryndor-ashveil' },
    create: {
      id: 'seed-eryndor-ashveil',
      userId: BLAKE_USER,
      name: 'Eryndor Ashveil',
      class: 'Ranger',
      level: 5,
      race: 'Wood Elf',
    },
    update: {
      name: 'Eryndor Ashveil',
      class: 'Ranger',
      level: 5,
    },
  });

  // Link to campaign
  await prisma.campaignCharacter.upsert({
    where: { campaignId_characterId: { campaignId: DA_CAMPAIGN, characterId: character.id } },
    create: { campaignId: DA_CAMPAIGN, characterId: character.id },
    update: {},
  });

  // 5. Upsert character for Bonfire Keep
  const character2 = await prisma.character.upsert({
    where: { id: 'seed-mira-stonehaven' },
    create: {
      id: 'seed-mira-stonehaven',
      userId: BLAKE_USER,
      name: 'Mira Stonehaven',
      class: 'Cleric',
      level: 3,
      race: 'Dwarf',
    },
    update: {
      name: 'Mira Stonehaven',
      class: 'Cleric',
      level: 3,
    },
  });

  await prisma.campaignCharacter.upsert({
    where: { campaignId_characterId: { campaignId: BK_CAMPAIGN, characterId: character2.id } },
    create: { campaignId: BK_CAMPAIGN, characterId: character2.id },
    update: {},
  });

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the script**

```bash
cd E:/Projects/QuiverDM
npx tsx scripts/seed-player-portal-demo.ts
```

Expected: `Seed complete.` with no errors.

- [ ] **Step 3: Verify data**

```bash
python C:/Users/mail/.claude/skills/agent-skills/skills/read-only-postgres/scripts/query.py --db quiverdm-local --query "SELECT id, title, status, LEFT(\"aiSummary\",50) FROM \"GameSession\" WHERE \"campaignId\" IN ('cmm4mi0p20008gjr7yye30szh','cmmivhfdq0001n08onagcvtdt')"
```

Expected: 3 rows with non-null aiSummary.

- [ ] **Step 4: Commit**

```bash
cd E:/Projects/QuiverDM
git add scripts/seed-player-portal-demo.ts
git commit -m "chore: seed player portal demo data for local dev"
git push origin main
```

---

## Chunk 2: Service Layer — Add sessionNumber

The sessions list and hub currently omit `sessionNumber`. Add it so the UI can show "Session 3" pills.

### Task 2: Add sessionNumber to getCampaignHub

**Files:**
- Modify: `src/server/services/play.service.ts`

- [ ] **Step 1: Add sessionNumber to the gameSessions select**

In `getCampaignHub`, find the `gameSessions` include block. Change the `select` to add `sessionNumber`:

```typescript
// src/server/services/play.service.ts  line ~57
select: {
  id: true,
  title: true,
  status: true,
  date: true,
  aiSummary: true,
  playerVisibility: true,
  sessionNumber: true,   // ← add this line
},
```

- [ ] **Step 2: Type-check**

```bash
cd E:/Projects/QuiverDM
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/play.service.ts
git commit -m "feat(play): expose sessionNumber in getCampaignHub query"
git push origin main
```

---

## Chunk 3: Component Polish

### Task 3: Player Campaign Card — Party Avatars

Currently shows character info but no party member avatars. Add a small avatar row showing the first 3 member initials with coloured backgrounds.

The `getPlayerCampaigns` service needs to also return the first 3 campaign members. Update the service query, then update the card.

**Files:**
- Modify: `src/server/services/play.service.ts`
- Modify: `src/components/play/player-campaign-card.tsx`

- [ ] **Step 1: Add members to getPlayerCampaigns**

In `getPlayerCampaigns`, inside the `campaign` include block, add a `members` select after `characters`:

```typescript
// src/server/services/play.service.ts  line ~13 (inside campaign include)
members: {
  take: 4,
  select: {
    user: { select: { id: true, name: true, image: true } },
  },
},
```

And update the return mapping to include `members`:

```typescript
// replace the return block
return memberships.map(m => {
  const cc = m.campaign.characters[0] ?? null;
  return {
    campaignId: m.campaignId,
    name: m.campaign.name,
    slug: m.campaign.slug,
    bannerUrl: m.campaign.bannerUrl ?? null,
    role: m.role,
    nextSession: m.campaign.gameSessions[0] ?? null,
    character: cc
      ? { name: cc.character.name, class: cc.character.class ?? null, level: cc.character.level, portraitUrl: cc.character.portraitUrl ?? null }
      : null,
    memberCount: m.campaign.members.length,
    members: m.campaign.members.map(mb => ({
      id: mb.user.id,
      name: mb.user.name,
      image: mb.user.image,
    })),
  };
});
```

Note: `_count` requires adding `_count: { select: { members: true } }` to the campaign include, OR just use `m.campaign.members.length` since we're already fetching them. Use the length approach — no schema changes needed.

- [ ] **Step 2: Add avatar colour helper to campaign card**

Replace `src/components/play/player-campaign-card.tsx` with:

```tsx
'use client';
import Link from 'next/link';

const AVATAR_COLORS = [
  'bg-violet-900 text-violet-300',
  'bg-emerald-900 text-emerald-300',
  'bg-rose-900 text-rose-300',
  'bg-sky-900 text-sky-300',
  'bg-amber-900 text-amber-300',
  'bg-fuchsia-900 text-fuchsia-300',
];

function avatarColor(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

interface PlayerCampaignCardProps {
  campaignId: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  role: string;
  nextSession: { id: string; title: string | null; status: string; date: Date | string | null } | null;
  character: { name: string; class: string | null; level: number; portraitUrl?: string | null } | null;
  members: { id: string; name: string | null; image: string | null }[];
  memberCount: number;
}

export function PlayerCampaignCard({ name, slug, bannerUrl, role, nextSession, character, members, memberCount }: PlayerCampaignCardProps) {
  const isLive = nextSession?.status === 'in_progress';
  const visibleMembers = members.slice(0, 3);
  const overflow = memberCount - visibleMembers.length;

  return (
    <Link href={`/play/${slug}`} className="group block">
      <div className="stone-card overflow-hidden rounded-lg border border-white/8 hover:border-amber-500/30 transition-colors">
        <div className="relative h-24 bg-gradient-to-br from-indigo-950 to-black">
          {bannerUrl && (
            <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          )}
          {isLive ? (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">{name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role.toLowerCase().replace('_', ' ')}</p>
          {character && (
            <p className="text-xs text-amber-300/80 mt-0.5">
              {character.name}{character.class ? ` · ${character.class}` : ''} · Lv {character.level}
            </p>
          )}
          {nextSession && !isLive && nextSession.date ? (
            <p className="text-xs text-amber-400/70 mt-1">
              Next: {new Date(nextSession.date).toLocaleDateString()}
            </p>
          ) : !isLive && (
            <p className="text-xs text-muted-foreground/50 mt-1">No upcoming session</p>
          )}
          {visibleMembers.length > 0 && (
            <div className="flex items-center gap-0.5 mt-2">
              {visibleMembers.map(m => (
                <div
                  key={m.id}
                  className={`h-5 w-5 rounded-full border border-background/80 overflow-hidden flex items-center justify-center text-[9px] font-bold ${avatarColor(m.name)}`}
                >
                  {m.image
                    ? <img src={m.image} alt={m.name ?? ''} className="h-full w-full object-cover" />
                    : (m.name?.[0] ?? '?')}
                </div>
              ))}
              {overflow > 0 && (
                <span className="text-[10px] text-muted-foreground/60 ml-1">+{overflow}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Update the play home page to pass new props**

The `trpc.play.getHome` query now returns `members` and `memberCount`. The `PlayerCampaignCard` spread `{...c}` already passes all props — no page change needed as long as the card interface matches the service output. Verify the spread works:

In `src/app/(app)/play/page.tsx` the render is:
```tsx
<PlayerCampaignCard key={c.campaignId} {...c} />
```
This works if the service return shape matches the component props. Double-check types align after the service update.

- [ ] **Step 4: Type-check**

```bash
cd E:/Projects/QuiverDM
npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/play.service.ts src/components/play/player-campaign-card.tsx
git commit -m "feat(play): party avatar row on campaign cards"
git push origin main
```

---

### Task 4: Party Panel — Coloured Avatars

Currently avatars are plain `bg-white/10`. Apply the same colour-hash helper.

**Files:**
- Modify: `src/components/play/party-panel.tsx`

- [ ] **Step 1: Add colour helper and improve layout**

Replace `src/components/play/party-panel.tsx` with:

```tsx
const AVATAR_COLORS = [
  'bg-violet-900 text-violet-300',
  'bg-emerald-900 text-emerald-300',
  'bg-rose-900 text-rose-300',
  'bg-sky-900 text-sky-300',
  'bg-amber-900 text-amber-300',
  'bg-fuchsia-900 text-fuchsia-300',
];

function avatarColor(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

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
            <div className={`h-8 w-8 rounded-full overflow-hidden ring-1 ring-white/15 flex items-center justify-center text-xs font-bold ${avatarColor(m.user.name)}`}>
              {m.user.image
                ? <img src={m.user.image} alt={m.user.name ?? ''} className="h-full w-full object-cover" />
                : (m.user.name?.[0] ?? '?')}
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

- [ ] **Step 2: Commit**

```bash
git add src/components/play/party-panel.tsx
git commit -m "feat(play): coloured party member avatars"
git push origin main
```

---

### Task 5: Session Recap Card — AI Summary Preview

Currently only shows if `aiSummary` is set — already works. The card is sparse. Improve the read-more button style and ensure the preview clamps correctly.

**Files:**
- Modify: `src/components/play/session-recap-card.tsx`

- [ ] **Step 1: Update the recap card**

Replace `src/components/play/session-recap-card.tsx` with:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollText } from 'lucide-react';

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
        <p className="text-xs text-muted-foreground mb-3">
          {new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {aiSummary ? (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3 leading-relaxed">{aiSummary}</p>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/50 mb-3 py-2">
          <ScrollText className="h-3.5 w-3.5" />
          <span>Recap not yet generated</span>
        </div>
      )}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/play/${slug}/sessions/${sessionId}`}>Read full recap</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/play/session-recap-card.tsx
git commit -m "feat(play): improve session recap card empty state"
git push origin main
```

---

## Chunk 4: Page-Level Polish

### Task 6: Campaign Hub Page — Taller Hero + Character Badge

**Files:**
- Modify: `src/app/(app)/play/[slug]/page.tsx`

- [ ] **Step 1: Update the hub hero**

Change the hero `div` from `h-32` to `h-40`. Add a character badge pill instead of the plain text line. Replace the entire file content:

```tsx
'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { PartyPanel } from '@/components/play/party-panel';
import { SessionRecapCard } from '@/components/play/session-recap-card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Zap } from 'lucide-react';

export default function PlayCampaignHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.play.getCampaignHub.useQuery({ slug });

  if (isLoading) return <div className="p-6 animate-pulse space-y-4"><div className="h-40 bg-white/5 rounded-lg" /><div className="h-24 bg-white/5 rounded-lg" /></div>;
  if (!data) return null;

  const lastSession = data.sessions[0] ?? null;
  const liveSession = data.sessions.find(s => s.status === 'in_progress');

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="relative h-40 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-950 to-black mb-2">
        {data.bannerUrl && <img src={data.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <p className="overline-label text-amber-400/70">Campaign</p>
          <h1 className="font-display text-xl font-bold">{data.name}</h1>
          {data.character && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 text-xs text-amber-300/90">
                {data.character.name}
              </span>
              <span className="text-xs text-amber-300/60">
                {data.character.class ?? 'Unknown'} · Lv {data.character.level}
              </span>
            </div>
          )}
        </div>
      </div>
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
      {!liveSession && data.nextSession && (
        <div className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/3 px-4 py-3">
          <CalendarDays className="h-4 w-4 text-amber-400/70 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Next Session</p>
            <p className="text-sm font-medium text-foreground truncate">{data.nextSession.title ?? 'Untitled Session'}</p>
            {data.nextSession.date && (
              <p className="text-xs text-amber-400/70">{new Date(data.nextSession.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            )}
            {data.nextSession.quickNotes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.nextSession.quickNotes}</p>
            )}
          </div>
        </div>
      )}
      <PartyPanel members={data.members} />
      {lastSession && (
        <SessionRecapCard
          sessionId={lastSession.id}
          slug={slug}
          title={lastSession.title ?? ''}
          date={lastSession.date ? String(lastSession.date) : null}
          aiSummary={lastSession.aiSummary ?? null}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/play/\[slug\]/page.tsx
git commit -m "feat(play): taller campaign hub hero with character badge pill"
git push origin main
```

---

### Task 7: Sessions List Page — Session Number Pill + Preview

**Files:**
- Modify: `src/app/(app)/play/[slug]/sessions/page.tsx`

- [ ] **Step 1: Rewrite the sessions page**

The sessions data comes from `getCampaignHub` which now includes `sessionNumber`. Replace the file:

```tsx
'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          {data.sessions.map(s => {
            const isLive = s.status === 'in_progress';
            return (
              <Link
                key={s.id}
                href={`/play/${slug}/sessions/${s.id}`}
                className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/3 hover:bg-white/5 hover:border-amber-500/20 px-4 py-3 transition-colors"
              >
                <div className="h-8 w-8 rounded-md bg-amber-500/8 border border-amber-500/15 flex items-center justify-center font-display text-sm font-bold text-amber-400/80 shrink-0 mt-0.5">
                  {s.sessionNumber ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.title ?? 'Untitled Session'}</p>
                  {s.date && <p className="text-xs text-muted-foreground mt-0.5">{new Date(String(s.date)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  {s.aiSummary && (
                    <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">{s.aiSummary}</p>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide shrink-0 mt-0.5',
                  isLive
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : s.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-muted-foreground border border-white/10'
                )}>
                  {isLive ? 'Live' : s.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/play/\[slug\]/sessions/page.tsx
git commit -m "feat(play): session number pill, AI preview, status badge on recaps list"
git push origin main
```

---

### Task 8: NPCs Page — Letter Portrait + Faction Chip

**Files:**
- Modify: `src/app/(app)/play/[slug]/npcs/page.tsx`

- [ ] **Step 1: Rewrite the NPCs page**

```tsx
'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BookOpen } from 'lucide-react';

const PORTRAIT_COLORS = [
  'from-violet-950 to-violet-900 text-violet-400',
  'from-emerald-950 to-emerald-900 text-emerald-400',
  'from-rose-950 to-rose-900 text-rose-400',
  'from-sky-950 to-sky-900 text-sky-400',
  'from-amber-950 to-amber-900 text-amber-400',
];

function portraitColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return PORTRAIT_COLORS[code % PORTRAIT_COLORS.length];
}

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
          <p>Your DM hasn&apos;t shared any NPCs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {npcs.map(npc => (
            <div key={npc.id} className="stone-card overflow-hidden">
              <div className={`h-14 bg-gradient-to-br ${portraitColor(npc.name)} flex items-center justify-center relative`}>
                {npc.imageUrl
                  ? <img src={npc.imageUrl} alt={npc.name} className="absolute inset-0 w-full h-full object-cover object-top opacity-80" />
                  : <span className="font-display text-3xl font-bold opacity-40">{npc.name[0]}</span>
                }
              </div>
              <div className="p-3">
                <p className="font-medium text-sm">{npc.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {npc.role && <p className="text-xs text-amber-400/80">{npc.role}</p>}
                  {npc.faction && (
                    <span className="text-[10px] border border-white/10 bg-white/4 text-muted-foreground/70 rounded px-1.5 py-0.5">{npc.faction}</span>
                  )}
                </div>
                {npc.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{npc.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/play/\[slug\]/npcs/page.tsx
git commit -m "feat(play): NPC portrait header with letter initial and faction chip"
git push origin main
```

---

### Task 9: Play Home Page — Welcome Subtitle

Minor but adds warmth to the empty header.

**Files:**
- Modify: `src/app/(app)/play/page.tsx`

- [ ] **Step 1: Add user name to welcome line**

The `trpc.play.getHome` query doesn't return the user name. Use `useSession` from NextAuth to get the name.

Replace the header block in `src/app/(app)/play/page.tsx`:

```tsx
'use client';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc';
import { PlayerCampaignCard } from '@/components/play/player-campaign-card';
import { Sword } from 'lucide-react';

export default function PlayerHomePage() {
  const { data: campaigns, isLoading } = trpc.play.getHome.useQuery();
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0];

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
        {firstName && <p className="text-sm text-muted-foreground mt-1">Welcome back, {firstName}</p>}
      </div>
      {!campaigns?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Sword className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>You haven&apos;t joined any campaigns yet.</p>
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

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/play/page.tsx
git commit -m "feat(play): personalised welcome line on player home"
git push origin main
```

---

## Chunk 5: Verification

### Task 10: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd E:/Projects/QuiverDM
npm run dev
```

- [ ] **Step 2: Navigate to player portal**

Open http://localhost:3847/play — verify:
- Campaign cards show party avatars
- Character lines show correct names/class/level
- Welcome subtitle appears

- [ ] **Step 3: Navigate to campaign hub**

Open http://localhost:3847/play/the-dragon-s-awakening — verify:
- Hero is visibly taller
- Character badge pill appears
- Party panel has coloured avatars
- Session recap shows AI summary preview

- [ ] **Step 4: Navigate to sessions list**

Open http://localhost:3847/play/the-dragon-s-awakening/sessions — verify:
- Session number pills appear
- AI summary previews show
- Status badges styled correctly

- [ ] **Step 5: Navigate to NPCs**

Open http://localhost:3847/play/the-dragon-s-awakening/npcs — verify:
- Letter portrait headers appear for seeded NPCs
- Faction chips render where data exists

- [ ] **Step 6: Final push**

```bash
git push origin main
```
