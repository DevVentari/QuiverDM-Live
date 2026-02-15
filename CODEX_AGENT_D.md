# Codex Agent D — Mobile Responsiveness & Seed Data

> **Branch**: `codex/mobile-seed-polish`
> **Worktree**: `.worktrees/codex-agent-d/`
> **Scope**: Mobile responsive fixes, database seed script, loading state improvements
> **DO NOT touch**: `src/server/services/`, `src/server/routers/`, `src/components/ui/`, `src/components/sidebar.tsx`

---

## Task 1: Mobile Responsiveness Fixes (Priority: HIGH)

Many pages use fixed layouts that break on mobile. Add responsive Tailwind classes.

### General Rules
- Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for card grids
- Use `flex-col sm:flex-row` for side-by-side layouts
- Use `w-full sm:w-auto` for buttons in rows
- Use `px-4 sm:px-6 lg:px-8` for page padding
- Use `text-xl sm:text-2xl lg:text-3xl` for headings
- Tables should use `overflow-x-auto` wrapper on mobile
- Modals/dialogs should be `w-full sm:max-w-md` or similar

### Pages to fix (read each one first):

1. **`src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`** (MOST IMPORTANT)
   - This is the largest page. Look for fixed-width containers, side-by-side layouts, tables
   - Transcript segments list should be scrollable
   - Audio/video player controls should stack vertically on mobile
   - Action buttons should wrap instead of overflow

2. **`src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`** — NPC detail
   - NPC info card with portrait should stack on mobile (image on top, info below)
   - Stat blocks should wrap or scroll horizontally

3. **`src/app/(app)/campaigns/[slug]/npcs/new/page.tsx`** — NPC creation form
   - Form fields should be full-width on mobile
   - Any side-by-side input groups should stack

4. **`src/app/(app)/campaigns/[slug]/settings/page.tsx`** — Campaign settings
   - Form should be full-width on mobile
   - Button groups should stack

5. **`src/app/(app)/campaigns/[slug]/members/page.tsx`** — Member management
   - Member list/table should scroll horizontally or card-ify on mobile
   - Role dropdowns should be accessible on touch

6. **`src/app/(app)/campaigns/[slug]/players/page.tsx`** — Players page
   - Player cards should stack on mobile

7. **`src/app/(app)/characters/[characterId]/page.tsx`** — Character detail
   - Character sheet layout should reflow for narrow screens
   - Stat blocks should be scrollable or stacked

8. **`src/app/(app)/characters/new/page.tsx`** — Character creation
   - Form fields full-width on mobile

9. **`src/app/(app)/homebrew/pdfs/[pdfId]/page.tsx`** — PDF viewer
   - Side-by-side PDF/content view should stack on mobile
   - Or hide PDF viewer on mobile and show extracted content only

10. **`src/app/(app)/join/page.tsx`** — Campaign join
    - Should be centered card, already likely OK but verify

### How to identify issues
For each file:
1. Read the entire file
2. Look for `className` attributes
3. Check if there are any `sm:`, `md:`, or `lg:` responsive classes
4. If there are none, the page is desktop-only
5. Add appropriate responsive classes

### DO NOT
- Change color schemes or visual design
- Add or remove features
- Modify component logic
- Change data fetching

---

## Task 2: Database Seed Script (Priority: HIGH)

Create `prisma/seed.ts` so beta testers can explore the app immediately after signup.

### Step 1: Check the Prisma schema
Read `prisma/schema.prisma` to understand:
- All model names and their fields
- Required fields vs optional
- Relations and foreign keys
- Enum types (especially Role, etc.)

### Step 2: Create seed script

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo DM user
  const hashedPassword = await hash('demo1234', 12);
  const dm = await prisma.user.upsert({
    where: { email: 'demo@quiverdm.com' },
    update: {},
    create: {
      email: 'demo@quiverdm.com',
      name: 'Demo DM',
      hashedPassword,
    },
  });
  console.log(`Created demo user: ${dm.email}`);

  // Create demo player
  const player = await prisma.user.upsert({
    where: { email: 'player@quiverdm.com' },
    update: {},
    create: {
      email: 'player@quiverdm.com',
      name: 'Demo Player',
      hashedPassword,
    },
  });
  console.log(`Created demo player: ${player.email}`);

  // Create campaigns
  // Read the Campaign model to get the right field names
  // Likely: name, slug, description, ownerId
  const campaign1 = await prisma.campaign.upsert({
    where: { slug: 'lost-mines-of-phandelver' },
    update: {},
    create: {
      name: 'Lost Mines of Phandelver',
      slug: 'lost-mines-of-phandelver',
      description: 'A classic introductory adventure set in the Sword Coast. The party has been hired to escort a wagon of supplies to the mining town of Phandalin.',
      ownerId: dm.id,
    },
  });

  const campaign2 = await prisma.campaign.upsert({
    where: { slug: 'curse-of-strahd' },
    update: {},
    create: {
      name: 'Curse of Strahd',
      slug: 'curse-of-strahd',
      description: 'A gothic horror campaign set in the dread domain of Barovia, ruled by the vampire lord Strahd von Zarovich.',
      ownerId: dm.id,
    },
  });

  console.log(`Created campaigns: ${campaign1.name}, ${campaign2.name}`);

  // Add campaign members
  // Check the CampaignMember model for exact field names
  // The DM is the owner already, add the player as a PLAYER member
  await prisma.campaignMember.upsert({
    where: {
      campaignId_userId: {
        campaignId: campaign1.id,
        userId: dm.id,
      },
    },
    update: {},
    create: {
      campaignId: campaign1.id,
      userId: dm.id,
      role: 'OWNER',
    },
  });

  await prisma.campaignMember.upsert({
    where: {
      campaignId_userId: {
        campaignId: campaign1.id,
        userId: player.id,
      },
    },
    update: {},
    create: {
      campaignId: campaign1.id,
      userId: player.id,
      role: 'PLAYER',
    },
  });

  // Create sample NPCs for campaign1
  // Check the NPC model for field names
  const npcs = [
    {
      name: 'Gundren Rockseeker',
      race: 'Dwarf',
      description: 'A sturdy dwarf entrepreneur who hired the party to escort supplies. He has a secret — he and his brothers have found the legendary Wave Echo Cave.',
      isPublic: false,
      campaignId: campaign1.id,
    },
    {
      name: 'Sildar Hallwinter',
      race: 'Human',
      description: 'A kindhearted human warrior and member of the Lords Alliance. He travels with Gundren and seeks to bring order to Phandalin.',
      isPublic: true,
      campaignId: campaign1.id,
    },
    {
      name: 'Halia Thornton',
      race: 'Human',
      description: 'The ambitious guildmaster of the Phandalin Miners Exchange. She has ties to the Zhentarim and her own hidden agenda.',
      isPublic: true,
      campaignId: campaign1.id,
    },
    {
      name: 'Glasstaff (Iarno Albrek)',
      race: 'Human',
      description: 'The mysterious leader of the Redbrands gang. He wields a glass staff and has connections to a shadowy figure known as the Black Spider.',
      isPublic: false,
      campaignId: campaign1.id,
    },
    {
      name: 'Strahd von Zarovich',
      race: 'Vampire',
      description: 'The ancient and powerful vampire lord who rules Barovia with an iron fist. He is cursed to forever pine for his lost love, Tatyana.',
      isPublic: false,
      campaignId: campaign2.id,
    },
  ];

  for (const npc of npcs) {
    // Use upsert with a unique constraint, or just create
    // Check if NPC model has a unique constraint on name+campaignId
    await prisma.nPC.create({
      data: npc,
    });
  }
  console.log(`Created ${npcs.length} NPCs`);

  // Create sample sessions for campaign1
  // Check the GameSession model for field names
  const session1 = await prisma.gameSession.create({
    data: {
      title: 'Session 1: Goblin Ambush',
      campaignId: campaign1.id,
      date: new Date('2026-01-15'),
      notes: 'The party was ambushed by goblins on the Triboar Trail. They tracked the goblins back to Cragmaw Hideout and rescued Sildar.',
      status: 'COMPLETED',
    },
  });

  const session2 = await prisma.gameSession.create({
    data: {
      title: 'Session 2: Arrival in Phandalin',
      campaignId: campaign1.id,
      date: new Date('2026-01-22'),
      notes: 'The party arrived in Phandalin and discovered the Redbrand menace. They gathered information from townsfolk.',
      status: 'COMPLETED',
    },
  });

  const session3 = await prisma.gameSession.create({
    data: {
      title: 'Session 3: Redbrand Hideout',
      campaignId: campaign1.id,
      date: new Date('2026-02-05'),
      status: 'PLANNED',
    },
  });

  console.log(`Created ${3} sessions`);

  // Create an invite code for testing
  // Check InviteCode model
  await prisma.inviteCode.upsert({
    where: { code: 'DEMO-BETA-2026' },
    update: {},
    create: {
      code: 'DEMO-BETA-2026',
      maxUses: 100,
      currentUses: 0,
      expiresAt: new Date('2027-01-01'),
      createdById: dm.id,
    },
  });
  console.log('Created demo invite code: DEMO-BETA-2026');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Step 3: Important adjustments

**BEFORE writing the seed file**, read `prisma/schema.prisma` carefully and adjust:
- Model names (might be `Npc` not `NPC`, `npc` not `nPC`)
- Field names (might be `owner` not `ownerId`, etc.)
- Enum values (check `Role` enum: might be `OWNER`, `DM`, `PLAYER`, etc.)
- Session status enum (might be `COMPLETED`, `PLANNED`, etc.)
- Required fields you might be missing
- Unique constraints that affect upsert `where` clauses

If a model doesn't support `upsert` with the fields you need, use `create` with a try-catch for duplicates, or use `findFirst` + conditional create.

### Step 4: Add to package.json

Add to `prisma` section of `package.json`:
```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

Also add to scripts:
```json
"db:seed": "npx prisma db seed"
```

---

## Task 3: Loading State Improvements (Priority: MEDIUM)

Some pages show a single full-page loading state when they have multiple independent data sources. Improve them to show partial data.

### Pages to improve:

1. **`src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`**
   - This page loads session data, transcripts, recordings — potentially 3+ queries
   - Instead of one big loading spinner, show the session header as soon as session data loads
   - Show skeleton cards for transcripts/recordings while those are still loading
   - Pattern:
   ```tsx
   // Show session header immediately when session loads
   if (sessionQuery.isLoading) return <FullPageSkeleton />;

   return (
     <div>
       <SessionHeader session={sessionQuery.data} />
       {transcriptQuery.isLoading ? (
         <TranscriptSkeleton />
       ) : (
         <TranscriptList data={transcriptQuery.data} />
       )}
     </div>
   );
   ```

2. **`src/app/(app)/settings/page.tsx`**
   - Has settings, billing, usage data
   - Show each section as it loads rather than blocking on all

### Skeleton patterns to use:

```tsx
// Simple skeleton block
<div className="animate-pulse space-y-4">
  <div className="h-4 bg-muted rounded w-3/4" />
  <div className="h-4 bg-muted rounded w-1/2" />
  <div className="h-32 bg-muted rounded" />
</div>

// Card grid skeleton
<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
  {[...Array(6)].map((_, i) => (
    <div key={i} className="animate-pulse">
      <div className="h-48 bg-muted rounded-lg" />
    </div>
  ))}
</div>
```

---

## Task 4: Empty State Improvements (Priority: LOW)

Some pages show blank space when there's no data. Add friendly empty states.

### Pattern:

```tsx
if (data && data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <IconComponent className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">No items yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Description of what this section will show.
      </p>
      <Button className="mt-4" onClick={onCreateAction}>
        Create First Item
      </Button>
    </div>
  );
}
```

### Pages to check (read first, only fix if empty state is missing):

1. `src/app/(app)/campaigns/page.tsx` — "No campaigns yet" with "Create Campaign" button
2. `src/app/(app)/characters/page.tsx` — "No characters yet" with "Create Character" button
3. `src/app/(app)/campaigns/[slug]/npcs/page.tsx` — "No NPCs yet" with "Create NPC" button
4. `src/app/(app)/campaigns/[slug]/sessions/page.tsx` — "No sessions yet" with "Create Session" button

Use appropriate Lucide icons: `Swords` for campaigns, `Users` for characters, `Scroll` for sessions, `BookUser` for NPCs.

---

## Key Patterns

**UI components:** Import from `@/components/ui/` — do NOT install new packages.

**Dark mode:** Use Tailwind theme tokens (`bg-muted`, `text-muted-foreground`, `border-border`), NEVER hardcode colors.

**Responsive breakpoints:** `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)

---

## Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint        # pass
```

Commit all changes on `codex/mobile-seed-polish` branch with descriptive messages.
