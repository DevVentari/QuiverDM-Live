# Hameria Ire Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully populated "Tales from the Bonfire Keep" demo campaign to `prisma/seed.ts`, drawn from `docs/hameria-ire-jsons/`, alongside a new `CampaignDocument` Prisma model for world documentation.

**Architecture:** Refactor the monolithic `prisma/seed.ts` into a modular `prisma/seeds/` directory with one file per campaign. `hameria-ire.ts` reads JSON source files at seed time and maps them to `NPC`, `GameSession`, `HomebrewContent`, `CampaignDocument`, and `Player` records. A new `CampaignDocument` model in the schema provides a first-class home for lore, faction docs, location guides, and timelines — with `brainIngestStatus` fields ready for the DM Brain worker.

**Tech Stack:** Prisma ORM, TypeScript, `fs.readFileSync`, Vitest for integration tests.

**Design spec:** `docs/superpowers/specs/2026-05-05-hameria-ire-seed-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `CampaignDocument` model + `Campaign.documents` relation |
| `prisma/seed.ts` | Modify | Refactor to ~30-line orchestrator |
| `prisma/seeds/users.ts` | Create | Demo user creation, extracted from seed.ts |
| `prisma/seeds/lost-mines.ts` | Create | Lost Mines campaign + NPCs + sessions |
| `prisma/seeds/curse-of-strahd.ts` | Create | Curse of Strahd campaign + NPC |
| `prisma/seeds/hameria-ire.ts` | Create | Full Hameria Ire seeder, reads from JSON files |
| `tests/seed/hameria-ire-seed.test.ts` | Create | Integration tests verifying record counts |

---

## Task 1: Add CampaignDocument to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the CampaignDocument model**

In `prisma/schema.prisma`, add this model after the `GameSession` model:

```prisma
model CampaignDocument {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  title      String
  slug       String
  type       String    // 'lore' | 'faction' | 'location' | 'adventure' | 'timeline'
  content    String    @db.Text
  data       Json?
  tags       String[]
  sourceFile String?
  order      Int      @default(0)

  brainIngestStatus String    @default("none") // none | pending | processing | done | error
  brainIngestAt     DateTime?

  searchText String   @db.Text

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([campaignId, slug])
  @@index([campaignId])
  @@index([campaignId, type])
}
```

- [ ] **Step 2: Add the relation to Campaign**

Find the `model Campaign` block. Add this line to its relations section (near `npcs`, `sessions`, etc.):

```prisma
  documents         CampaignDocument[]
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name add_campaign_document
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CampaignDocument model"
```

---

## Task 2: Write the integration test (failing)

**Files:**
- Create: `tests/seed/hameria-ire-seed.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// tests/seed/hameria-ire-seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedHameriaIre } from '../../prisma/seeds/hameria-ire';

const prisma = new PrismaClient();
let campaignId: string;
let testUserId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'hameria-seed-test@test.com', name: 'Test DM', onboardingCompleted: true },
  });
  testUserId = user.id;
  await seedHameriaIre(prisma, testUserId);
  const campaign = await prisma.campaign.findUnique({
    where: { slug: 'tales-from-the-bonfire-keep' },
  });
  campaignId = campaign!.id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { slug: 'tales-from-the-bonfire-keep' } });
  await prisma.homebrewContent.deleteMany({ where: { userId: testUserId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
});

describe('seedHameriaIre', () => {
  it('creates the campaign', async () => {
    const campaign = await prisma.campaign.findUnique({
      where: { slug: 'tales-from-the-bonfire-keep' },
    });
    expect(campaign).not.toBeNull();
    expect(campaign!.name).toBe('Tales from the Bonfire Keep');
  });

  it('creates NPCs', async () => {
    const count = await prisma.nPC.count({ where: { campaignId } });
    expect(count).toBeGreaterThan(5);
  });

  it('creates 9 sessions', async () => {
    const count = await prisma.gameSession.count({ where: { campaignId } });
    expect(count).toBe(9);
  });

  it('creates homebrew content (monsters + races)', async () => {
    const count = await prisma.homebrewContent.count({ where: { userId: testUserId } });
    expect(count).toBeGreaterThan(0);
  });

  it('creates campaign documents', async () => {
    const count = await prisma.campaignDocument.count({ where: { campaignId } });
    expect(count).toBeGreaterThan(5);
  });

  it('creates 3 players', async () => {
    const count = await prisma.player.count({ where: { campaignId } });
    expect(count).toBe(3);
  });

  it('is idempotent — running twice produces the same counts', async () => {
    await seedHameriaIre(prisma, testUserId);
    const npcCount = await prisma.nPC.count({ where: { campaignId } });
    expect(npcCount).toBeGreaterThan(5);
    const docCount = await prisma.campaignDocument.count({ where: { campaignId } });
    expect(docCount).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: FAIL — `Cannot find module '../../prisma/seeds/hameria-ire'`

---

## Task 3: Refactor seed.ts into modules

**Files:**
- Create: `prisma/seeds/users.ts`
- Create: `prisma/seeds/lost-mines.ts`
- Create: `prisma/seeds/curse-of-strahd.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Create `prisma/seeds/users.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  const hashedPassword = await hash('demo1234', 12);

  const dm = await prisma.user.upsert({
    where: { email: 'demo@quiverdm.com' },
    update: {},
    create: { email: 'demo@quiverdm.com', name: 'Demo DM', onboardingCompleted: true },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: dm.email! } },
    update: {},
    create: {
      userId: dm.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: dm.email!,
      password: hashedPassword,
    },
  });

  const player = await prisma.user.upsert({
    where: { email: 'player@quiverdm.com' },
    update: {},
    create: { email: 'player@quiverdm.com', name: 'Demo Player', onboardingCompleted: true },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: player.email! } },
    update: {},
    create: {
      userId: player.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: player.email!,
      password: hashedPassword,
    },
  });

  console.log(`Created demo users: ${dm.email}, ${player.email}`);
  return { dm, player };
}
```

- [ ] **Step 2: Create `prisma/seeds/lost-mines.ts`**

```ts
import { PrismaClient, CampaignRole } from '@prisma/client';

export async function seedLostMines(prisma: PrismaClient, userId: string) {
  const campaign = await prisma.campaign.upsert({
    where: { slug: 'lost-mines-of-phandelver' },
    update: {},
    create: {
      name: 'Lost Mines of Phandelver',
      slug: 'lost-mines-of-phandelver',
      description:
        'A classic introductory adventure set in the Sword Coast. The party has been hired to escort a wagon of supplies to the mining town of Phandalin.',
      status: 'active',
      userId,
    },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
    update: {},
    create: {
      campaignId: campaign.id,
      userId,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  const npcs = [
    {
      name: 'Gundren Rockseeker',
      description:
        'A sturdy dwarf entrepreneur who hired the party to escort supplies. He has a secret — he and his brothers have found the legendary Wave Echo Cave.',
      faction: 'Rockseeker Clan',
      secrets: 'Knows the location of Wave Echo Cave. Currently captured by the Black Spider.',
      tags: ['ally', 'dwarf', 'quest-giver'],
    },
    {
      name: 'Sildar Hallwinter',
      description:
        'A kindhearted human warrior and member of the Lords Alliance. He travels with Gundren and seeks to bring order to Phandalin.',
      faction: "Lords' Alliance",
      secrets: 'Searching for Iarno Albrek, a fellow Alliance member who went missing.',
      tags: ['ally', 'human', 'warrior'],
    },
    {
      name: 'Halia Thornton',
      description:
        'The ambitious guildmaster of the Phandalin Miners Exchange. She has ties to the Zhentarim and her own hidden agenda.',
      faction: 'Zhentarim',
      secrets: 'Secretly a Zhentarim agent. Wants to take over the Redbrand operation for herself.',
      tags: ['neutral', 'human', 'merchant'],
    },
    {
      name: 'Glasstaff (Iarno Albrek)',
      description:
        'The mysterious leader of the Redbrands gang. He wields a glass staff and has connections to a shadowy figure known as the Black Spider.',
      faction: 'Redbrands',
      secrets: 'Actually Iarno Albrek, a former Lords Alliance member corrupted by the Black Spider.',
      tags: ['villain', 'human', 'mage'],
    },
  ];

  for (const npc of npcs) {
    const existing = await prisma.nPC.findFirst({ where: { campaignId: campaign.id, name: npc.name } });
    if (!existing) {
      await prisma.nPC.create({ data: { ...npc, campaignId: campaign.id } });
    }
  }

  const existingSessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign.id },
    select: { sessionNumber: true },
  });
  const existingNumbers = new Set(existingSessions.map((s) => s.sessionNumber));

  const sessions = [
    {
      title: 'Session 1: Goblin Ambush',
      sessionNumber: 1,
      date: new Date('2026-01-15'),
      quickNotes:
        'The party was ambushed by goblins on the Triboar Trail. They tracked the goblins back to Cragmaw Hideout and rescued Sildar.',
      status: 'completed',
    },
    {
      title: 'Session 2: Arrival in Phandalin',
      sessionNumber: 2,
      date: new Date('2026-01-22'),
      quickNotes:
        'The party arrived in Phandalin and discovered the Redbrand menace. They gathered information from townsfolk.',
      status: 'completed',
    },
    {
      title: 'Session 3: Redbrand Hideout',
      sessionNumber: 3,
      date: new Date('2026-02-05'),
      quickNotes: null,
      status: 'active',
    },
  ];

  for (const session of sessions) {
    if (!existingNumbers.has(session.sessionNumber)) {
      await prisma.gameSession.create({ data: { ...session, campaignId: campaign.id } });
    }
  }

  console.log(`Seeded Lost Mines of Phandelver`);
}
```

- [ ] **Step 3: Create `prisma/seeds/curse-of-strahd.ts`**

```ts
import { PrismaClient, CampaignRole } from '@prisma/client';

export async function seedCurseOfStrahd(prisma: PrismaClient, userId: string) {
  const campaign = await prisma.campaign.upsert({
    where: { slug: 'curse-of-strahd' },
    update: {},
    create: {
      name: 'Curse of Strahd',
      slug: 'curse-of-strahd',
      description:
        'A gothic horror campaign set in the dread domain of Barovia, ruled by the vampire lord Strahd von Zarovich.',
      status: 'active',
      userId,
    },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
    update: {},
    create: {
      campaignId: campaign.id,
      userId,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  const existing = await prisma.nPC.findFirst({
    where: { campaignId: campaign.id, name: 'Strahd von Zarovich' },
  });
  if (!existing) {
    await prisma.nPC.create({
      data: {
        campaignId: campaign.id,
        name: 'Strahd von Zarovich',
        description:
          'The ancient and powerful vampire lord who rules Barovia with an iron fist. He is cursed to forever pine for his lost love, Tatyana.',
        faction: 'Castle Ravenloft',
        secrets: 'Can be weakened by the Sunsword, Holy Symbol of Ravenkind, and the Tome of Strahd.',
        tags: ['villain', 'vampire', 'boss'],
      },
    });
  }

  console.log(`Seeded Curse of Strahd`);
}
```

- [ ] **Step 4: Rewrite `prisma/seed.ts` as orchestrator**

Replace the entire file content with:

```ts
import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeds/users';
import { seedLostMines } from './seeds/lost-mines';
import { seedCurseOfStrahd } from './seeds/curse-of-strahd';
import { seedHameriaIre } from './seeds/hameria-ire';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');

  const { dm, player } = await seedUsers(prisma);

  await seedLostMines(prisma, dm.id);
  await seedCurseOfStrahd(prisma, dm.id);
  await seedHameriaIre(prisma, dm.id);

  // Shared invite code
  await prisma.inviteCode.upsert({
    where: { code: 'DEMO-BETA-2026' },
    update: {},
    create: { code: 'DEMO-BETA-2026', expiresAt: new Date('2027-01-01') },
  });

  // Player membership on Lost Mines
  const lostMines = await prisma.campaign.findUnique({ where: { slug: 'lost-mines-of-phandelver' } });
  if (lostMines) {
    await prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId: lostMines.id, userId: player.id } },
      update: {},
      create: { campaignId: lostMines.id, userId: player.id, role: 'PLAYER' },
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Run the seed — verify it still works**

```bash
npx prisma db seed
```

Expected output ends with: `Seeding complete!`
Expected error: `Cannot find module './seeds/hameria-ire'` — this is expected, fix in next task.

To work around the missing module temporarily, comment out the `seedHameriaIre` import and call in `seed.ts`. Run seed. Then uncomment before Task 4.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts prisma/seeds/users.ts prisma/seeds/lost-mines.ts prisma/seeds/curse-of-strahd.ts
git commit -m "refactor: split seed.ts into modular seeds directory"
```

---

## Task 4: Create hameria-ire.ts — campaign + NPCs

**Files:**
- Create: `prisma/seeds/hameria-ire.ts`

- [ ] **Step 1: Create the file with helpers + campaign upsert + NPC seeder**

```ts
import { PrismaClient, CampaignRole } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const JSON_DIR = path.join(process.cwd(), 'docs/hameria-ire-jsons');

function readJson(filename: string): any {
  const filepath = path.join(JSON_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function toSearchText(content: string, title: string, tags: string[]): string {
  const stripped = content.replace(/[#*`\[\]()_~>|]/g, ' ').replace(/\s+/g, ' ').trim();
  return [title, ...tags, stripped.slice(0, 2000)].join(' ');
}

export async function seedHameriaIre(prisma: PrismaClient, userId: string) {
  // Campaign
  const campaign = await prisma.campaign.upsert({
    where: { slug: 'tales-from-the-bonfire-keep' },
    update: {},
    create: {
      name: 'Tales from the Bonfire Keep',
      slug: 'tales-from-the-bonfire-keep',
      description:
        'A cosmic D&D campaign set in Hameria Ire — a world held in stasis by an ancient crime, on the edge of reckoning.',
      status: 'active',
      userId,
    },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
    update: {},
    create: {
      campaignId: campaign.id,
      userId,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  // NPCs
  const npcFile = readJson('npcs_npcs.json');
  const npcs: any[] = npcFile.data ?? [];
  let npcCount = 0;

  for (const npc of npcs) {
    if (!npc.name || npc.name.trim() === '' || npc.name === 'Features') continue;

    const existing = await prisma.nPC.findFirst({
      where: { campaignId: campaign.id, name: npc.name },
    });
    if (existing) continue;

    const description = [npc.description, npc.personality].filter(Boolean).join('\n\n') || null;

    await prisma.nPC.create({
      data: {
        campaignId: campaign.id,
        name: npc.name,
        description,
        role: npc.type_alignment || null,
        stats: {
          mechanics: npc.mechanics ?? {},
          traits: npc.traits ?? [],
          actions: npc.actions ?? [],
          ability_scores: npc.ability_scores ?? {},
          ideals: npc.ideals ?? null,
          bonds: npc.bonds ?? null,
          flaws: npc.flaws ?? null,
        },
        tags: npcFile.metadata?.tags ?? [],
      },
    });
    npcCount++;
  }

  console.log(`Seeded ${npcCount} NPCs for Tales from the Bonfire Keep`);
}
```

- [ ] **Step 2: Run the integration test — NPC and campaign assertions should pass**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: `creates the campaign` PASS, `creates NPCs` PASS. Other tests still FAIL (sessions/homebrew/docs/players not seeded yet).

---

## Task 5: Add sessions (adventures)

**Files:**
- Modify: `prisma/seeds/hameria-ire.ts`

- [ ] **Step 1: Add the adventures seeder at the bottom of `seedHameriaIre`, before the final `}`**

```ts
  // Sessions (adventures)
  const adventureFiles = [
    'adventures_01-whispered-names.json',
    'adventures_01b-the-withered-root.json',
    'adventures_01c-the-salted-current.json',
    'adventures_02-the-starfall-conspiracy.json',
    'adventures_03-the-withering-world.json',
    'adventures_04-desperate-alliance.json',
    'adventures_05-the-hunt-begins.json',
    'adventures_06-the-dreaming-deep.json',
    'adventures_07-the-glass-sea.json',
  ];

  const existingSessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign.id },
    select: { sessionNumber: true },
  });
  const existingNumbers = new Set(existingSessions.map((s) => s.sessionNumber));

  let sessionCount = 0;
  for (let i = 0; i < adventureFiles.length; i++) {
    const file = adventureFiles[i];
    if (!fs.existsSync(path.join(JSON_DIR, file))) {
      console.warn(`[hameria-ire seed] Adventure file not found: ${file}`);
      continue;
    }
    const adventure = readJson(file);
    const sessionNumber = (adventure.metadata?.weight ?? i + 1) as number;
    const finalNumber = existingNumbers.has(sessionNumber) ? sessionNumber + 100 + i : sessionNumber;

    if (existingNumbers.has(finalNumber)) continue;

    await prisma.gameSession.create({
      data: {
        campaignId: campaign.id,
        sessionNumber: finalNumber,
        title: adventure.metadata?.title ?? file,
        status: 'planning',
        prepData: { rawContent: adventure.content ?? '' },
      },
    });
    existingNumbers.add(finalNumber);
    sessionCount++;
  }

  console.log(`Seeded ${sessionCount} sessions for Tales from the Bonfire Keep`);
```

- [ ] **Step 2: Run the test — session assertion should now pass**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: `creates 9 sessions` PASS.

---

## Task 6: Add homebrew content (monsters + races)

**Files:**
- Modify: `prisma/seeds/hameria-ire.ts`

- [ ] **Step 1: Add the homebrew seeder at the bottom of `seedHameriaIre`, before the final `}`**

```ts
  // Homebrew content — items
  const itemFiles = ['mechanics_items.json', 'mechanics_pregenitor-artifacts.json'];
  let itemCount = 0;

  for (const itemFile of itemFiles) {
    if (!fs.existsSync(path.join(JSON_DIR, itemFile))) continue;
    const file = readJson(itemFile);
    const items: any[] = file.data ?? [];
    for (const item of items) {
      if (!item.name || item.name.startsWith('...') || item.name === '') continue;
      const existing = await prisma.homebrewContent.findFirst({
        where: { userId, name: item.name, type: 'item' },
      });
      if (existing) continue;
      await prisma.homebrewContent.create({
        data: {
          userId,
          type: 'item',
          name: item.name,
          data: { properties: item.properties ?? [], rarity_type: item.rarity_type ?? '', description: item.description ?? '' },
          tags: file.metadata?.tags ?? [],
          searchText: toSearchText(item.description ?? '', item.name, file.metadata?.tags ?? []),
          sourceType: 'manual',
        },
      });
      itemCount++;
    }
  }
  console.log(`Seeded ${itemCount} items for Tales from the Bonfire Keep`);

  // Homebrew content — monsters
  const monsterFile = readJson('bestiary_monsters.json');
  const monsters: any[] = monsterFile.data ?? [];
  let creatureCount = 0;

  for (const monster of monsters) {
    if (!monster.name || monster.name.startsWith('...') || monster.name === '') continue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, name: monster.name, type: 'creature' },
    });
    if (existing) continue;

    await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'creature',
        name: monster.name,
        data: {
          mechanics: monster.mechanics ?? {},
          traits: monster.traits ?? [],
          actions: monster.actions ?? [],
          ability_scores: monster.ability_scores ?? {},
          type_alignment: monster.type_alignment ?? '',
        },
        tags: monsterFile.metadata?.tags ?? [],
        searchText: toSearchText(
          monster.description ?? '',
          monster.name,
          monsterFile.metadata?.tags ?? []
        ),
        sourceType: 'manual',
      },
    });
    creatureCount++;
  }

  // Homebrew content — races
  const racesFile = readJson('mechanics_races.json');
  const races: any[] = racesFile.data ?? [];
  let raceCount = 0;

  for (const race of races) {
    if (!race.name || race.name.startsWith('...') || race.name === '') continue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, name: race.name, type: 'race' },
    });
    if (existing) continue;

    await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'race',
        name: race.name,
        data: {
          traits: race.traits ?? [],
          subraces: race.subraces ?? [],
        },
        tags: racesFile.metadata?.tags ?? [],
        searchText: toSearchText(race.description ?? '', race.name, racesFile.metadata?.tags ?? []),
        sourceType: 'manual',
      },
    });
    raceCount++;
  }

  console.log(`Seeded ${creatureCount} creatures, ${raceCount} races for Tales from the Bonfire Keep`);
```

- [ ] **Step 2: Run the test — homebrew assertion should now pass**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: `creates homebrew content (monsters + races)` PASS.

---

## Task 7: Add CampaignDocuments (factions, lore, locations)

**Files:**
- Modify: `prisma/seeds/hameria-ire.ts`

- [ ] **Step 1: Add the CampaignDocument seeder at the bottom of `seedHameriaIre`, before the final `}`**

```ts
  // Campaign documents — factions, lore, locations, timeline
  const documentSources: Array<{ file: string; type: string }> = [
    { file: 'factions_factions.json', type: 'faction' },
    { file: 'factions_solar-lie.json', type: 'faction' },
    { file: 'factions_tidal-adaptation.json', type: 'faction' },
    { file: 'factions_twelve-witnesses.json', type: 'faction' },
    { file: 'factions_verdant-burden.json', type: 'faction' },
    { file: 'world-lore_anchors-and-heartflame.json', type: 'lore' },
    { file: 'world-lore_campaign-timeline.json', type: 'timeline' },
    { file: 'world-lore_world-timeline.json', type: 'timeline' },
    { file: 'world-lore_locations.json', type: 'location' },
  ];

  let docCount = 0;
  for (const source of documentSources) {
    if (!fs.existsSync(path.join(JSON_DIR, source.file))) {
      console.warn(`[hameria-ire seed] Document file not found: ${source.file}`);
      continue;
    }
    const doc = readJson(source.file);
    const title = doc.metadata?.title ?? source.file.replace('.json', '');
    const slug = toSlug(title);
    const content = doc.content ?? '';
    const tags: string[] = doc.metadata?.tags ?? [];

    await prisma.campaignDocument.upsert({
      where: { campaignId_slug: { campaignId: campaign.id, slug } },
      update: {},
      create: {
        campaignId: campaign.id,
        title,
        slug,
        type: source.type,
        content,
        data: Array.isArray(doc.data) && doc.data.length > 0 ? doc.data : undefined,
        tags,
        sourceFile: doc.source ?? source.file,
        searchText: toSearchText(content, title, tags),
        brainIngestStatus: 'none',
      },
    });
    docCount++;
  }

  console.log(`Seeded ${docCount} campaign documents for Tales from the Bonfire Keep`);
```

- [ ] **Step 2: Run the test — documents assertion should now pass**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: `creates campaign documents` PASS.

---

## Task 8: Add players

**Files:**
- Modify: `prisma/seeds/hameria-ire.ts`

- [ ] **Step 1: Add the player seeder at the bottom of `seedHameriaIre`, before the final `}`**

```ts
  // Players (pregenerated characters)
  const playerFiles = [
    'Player Characters_Norm Alfella.json',
    'Player Characters_Oriyen Vale.json',
    'Player Characters_Skreek Swicschnout.json',
  ];

  let playerCount = 0;
  for (const file of playerFiles) {
    if (!fs.existsSync(path.join(JSON_DIR, file))) {
      console.warn(`[hameria-ire seed] Player file not found: ${file}`);
      continue;
    }
    const pc = readJson(file);
    // Title format: "Player Characters_Norm Alfella" — extract name after underscore
    const rawTitle: string = pc.metadata?.title ?? file.replace('.json', '');
    const characterName = rawTitle.includes('_') ? rawTitle.split('_').slice(1).join('_').trim() : rawTitle;

    if (!characterName) continue;

    const existing = await prisma.player.findFirst({
      where: { campaignId: campaign.id, characterName },
    });
    if (existing) continue;

    // Parse race/class/level from markdown content using simple regex
    const content: string = pc.content ?? '';
    const raceMatch = content.match(/\*\*Race[:\*]+\*+\s*([^\n*|]+)/i);
    const classMatch = content.match(/\*\*Class[:\*]+\*+\s*([^\n*|]+)/i);
    const levelMatch = content.match(/\*\*Level[:\*]+\*+\s*(\d+)/i);

    await prisma.player.create({
      data: {
        campaignId: campaign.id,
        name: 'Demo Player',
        characterName,
        characterRace: raceMatch ? raceMatch[1].trim() : null,
        characterClass: classMatch ? classMatch[1].trim() : null,
        level: levelMatch ? parseInt(levelMatch[1], 10) : 1,
        backstory: content.slice(0, 3000) || null,
      },
    });
    playerCount++;
  }

  console.log(`Seeded ${playerCount} players for Tales from the Bonfire Keep`);
```

- [ ] **Step 2: Run the full test suite — all assertions should pass**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: ALL 7 tests PASS including idempotency.

---

## Task 9: Wire hameria-ire into seed.ts and do a full run

**Files:**
- Modify: `prisma/seed.ts` (uncomment import + call if you commented it in Task 3)

- [ ] **Step 1: Ensure hameria-ire is imported and called in seed.ts**

Verify `prisma/seed.ts` has (this should already be the case from Task 3):

```ts
import { seedHameriaIre } from './seeds/hameria-ire';
// ...
await seedHameriaIre(prisma, dm.id);
```

- [ ] **Step 2: Run the full seed on a clean DB**

Reset the local DB and re-seed to verify end-to-end:

```bash
npx prisma migrate reset --force
```

Expected: runs all migrations, then calls `npx prisma db seed` automatically. Final line: `Seeding complete!`

- [ ] **Step 3: Verify record counts**

```bash
python C:/Users/mail/.claude/skills/agent-skills/skills/read-only-postgres/scripts/query.py --db quiverdm-local --query "SELECT (SELECT COUNT(*) FROM \"Campaign\") as campaigns, (SELECT COUNT(*) FROM \"NPC\") as npcs, (SELECT COUNT(*) FROM \"GameSession\") as sessions, (SELECT COUNT(*) FROM \"CampaignDocument\") as documents, (SELECT COUNT(*) FROM \"HomebrewContent\") as homebrew, (SELECT COUNT(*) FROM \"Player\") as players;"
```

Expected: campaigns=3, npcs>10, sessions>9, documents>5, homebrew>0, players=3.

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run tests/seed/hameria-ire-seed.test.ts
```

Expected: ALL 7 tests PASS.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit everything**

```bash
git add prisma/seeds/hameria-ire.ts tests/seed/hameria-ire-seed.test.ts prisma/seed.ts
git commit -m "feat: add Tales from the Bonfire Keep demo campaign seed"
```

- [ ] **Step 7: Push**

```bash
git push origin main
```
