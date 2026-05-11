// Usage: npx tsx scripts/seed-home-showcase.ts
//
// Idempotent. Creates a "Stonewardens" showcase campaign owned by Blake Wales
// with enough content to fill every slot on the V2 home page:
//   - hero (planning session with date + prep data)
//   - recent sessions (5 most recent)
//   - active campaign panel (sessionCount populated, etc.)
//   - world activity feed (mix of WorldEntity types in the last 7 days)
//   - prep reminders (3 items on the planning session)
//
// Re-running this script is safe — every write is an upsert keyed on a
// stable identifier (slug, sessionNumber, name+type, etc.).

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, WorldEntityType } from '@prisma/client';

const prisma = new PrismaClient();

const OWNER_EMAIL = 'dev@blakewales.au';
const SLUG = 'the-stonewardens';
const NAME = 'The Stonewardens';
const DESCRIPTION =
  'A campaign of broken oaths and ancient towers — the Stonewardens stand watch as the old powers stir.';

interface SessionSeed {
  number: number;
  title: string;
  recap: string;
  daysAgo: number; // negative = future
  status: 'completed' | 'planning';
}

const SESSIONS: SessionSeed[] = [
  { number: 18, title: 'The Shattered Spire',     recap: 'The party ascends the broken stair of an ancient tower to confront the force awakening beneath the ruins.', daysAgo: -1, status: 'planning' },
  { number: 17, title: 'Beneath the Black Hollow', recap: 'Explored the depths and uncovered ancient runes carved into the obsidian walls.', daysAgo: 7,  status: 'completed' },
  { number: 16, title: 'Whispers in the Dark',    recap: 'Tracked the cult of the Hollow Choir to its hidden sanctum in the ravine.',          daysAgo: 14, status: 'completed' },
  { number: 15, title: "The Guardian's Warning",  recap: 'Met the stone guardian of the High Pass and received a dire warning of southern storms.', daysAgo: 21, status: 'completed' },
  { number: 14, title: 'Into the Stonewood',      recap: 'Entered the cursed forest of pale birches and faced its veiled perils.',           daysAgo: 28, status: 'completed' },
  { number: 13, title: 'Echoes of the Past',      recap: 'Discovered ancient parchments hinting at the prophecy of the Three Wardens.',     daysAgo: 35, status: 'completed' },
  { number: 12, title: 'The Forgewright Pact',    recap: 'Brokered passage with the Forgewright clan in exchange for a tithe of moonsilver.', daysAgo: 42, status: 'completed' },
  { number: 11, title: 'Storm Over Ashreach',     recap: 'Defended the riverside hamlet from the lightning-touched warband.',               daysAgo: 49, status: 'completed' },
  { number: 10, title: 'The Drowned Library',     recap: 'Recovered three of the Stonewardens chronicles from the flooded archives.',     daysAgo: 56, status: 'completed' },
  { number:  9, title: 'Crown of Ravens',         recap: 'Crowned the rightful heir of Ashreach and broke the corvid curse.',                daysAgo: 63, status: 'completed' },
  { number:  8, title: 'Smoke on the Heath',      recap: 'Tracked a giant boar of unnatural cunning across the burning heath.',              daysAgo: 70, status: 'completed' },
  { number:  7, title: 'The Salt-Veil Trial',     recap: 'Survived the salt mages trial and earned passage to the Inner Spire.',           daysAgo: 77, status: 'completed' },
  { number:  6, title: 'Beneath the Bell',        recap: 'Discovered an ancient bell still answering the prayers of a dead order.',         daysAgo: 84, status: 'completed' },
  { number:  5, title: 'The Hollow Choir',        recap: 'Encountered the singers of the Hollow Choir and lost a member to their song.',  daysAgo: 91, status: 'completed' },
  { number:  4, title: 'A Banner Unfurled',       recap: 'The Stonewardens raised their banner over Ashreach for the first time in a generation.', daysAgo: 98, status: 'completed' },
  { number:  3, title: 'The Reaver of Coldfen',   recap: 'Drove the reaver from Coldfen and freed the last hostages of the southern raid.', daysAgo: 105, status: 'completed' },
  { number:  2, title: 'Stones in the Dark',      recap: 'Activated the first of the warden-stones, awakening the path eastward.',          daysAgo: 112, status: 'completed' },
  { number:  1, title: 'The First Signal',        recap: 'A flare in the night summoned the heroes to Ashreach Keep.',                       daysAgo: 119, status: 'completed' },
];

interface NpcSeed { name: string; role: string; faction: string; description: string; }
const NPCS: NpcSeed[] = [
  { name: 'Eldric Thornmoon',   role: 'Loremaster',         faction: 'Stonewardens',  description: 'A weathered scholar who carries the chronicles of three generations.' },
  { name: 'Seraphine Dusk',     role: 'Court Spy',          faction: 'Ashreach Court',description: 'Dresses in muted blacks and is never quite where she was a moment ago.' },
  { name: 'Captain Bren Holt',  role: 'Garrison Captain',   faction: 'Stonewardens',  description: 'Twenty winters in the keep and not one battle lost on her watch.' },
  { name: 'Old Marrow',         role: 'Hedge-witch',        faction: 'Independent',   description: 'Lives at the edge of the Stonewood, trades in dried herbs and worse.' },
  { name: 'Lord Cassian Vale',  role: 'Regent of Ashreach', faction: 'Ashreach Court',description: 'A practical ruler with a private dread of the omens piling at his gates.' },
  { name: 'Brother Iven',       role: 'Wandering priest',   faction: 'Order of the Last Bell', description: 'Hears the dead bell ringing and refuses to sleep within walls.' },
  { name: 'Ferra of the Hollow',role: 'Cult informant',     faction: 'Hollow Choir',  description: 'Spared by the party in exchange for whispered names and meeting places.' },
  { name: 'Kestrel Ashe',       role: 'Cartographer',       faction: 'Stonewardens',  description: 'Maps the borderlands one tooth-rattling pony ride at a time.' },
  { name: 'Veska Forgewright',  role: 'Smith and elder',    faction: 'Forgewright Clan', description: 'Her hammer falls only when she has decided who deserves the gift of steel.' },
  { name: 'The Gaunt Man',      role: 'Unknown',            faction: 'Unknown',       description: 'Glimpsed at three crossroads in three weeks. Speaks to no one.' },
  { name: 'Yorvel Thresh',      role: 'River trader',       faction: 'Independent',   description: 'Trades news upriver from the southern principalities.' },
  { name: 'Anwen Stonepriest',  role: 'Druid of the Stones',faction: 'Stonewardens',  description: 'Speaks for the warden-stones and translates their slow refusals.' },
];

interface EntitySeed { name: string; type: WorldEntityType; description: string; hoursAgo: number; }
const ENTITIES: EntitySeed[] = [
  // Recent (last week) — these populate the World Activity feed in this order
  { name: 'The Frostpeak Orcs',        type: 'FACTION',  description: 'A warband of frost-touched orcs descending from the high passes.',     hoursAgo: 1   },
  { name: 'Silverpine Village',        type: 'LOCATION', description: 'A logging settlement at the edge of the Stonewood, recently fortified.', hoursAgo: 25  },
  { name: 'The Moonlit Key',           type: 'ITEM',     description: 'An old silver key that hums faintly under moonlight.',                  hoursAgo: 49  },
  { name: 'Tower of the Obsidian Eye', type: 'LOCATION', description: 'A ruined watchtower whose central chamber holds an unblinking gaze.',   hoursAgo: 73  },
  { name: 'The Hollow Choir',          type: 'THREAT',   description: 'A cult of singers whose hymns hollow out the listener.',                hoursAgo: 97  },
  // Older entries — fill the campaign brain
  { name: 'Ashreach Keep',             type: 'LOCATION', description: 'The seat of the Stonewardens, perched above the river fork.',          hoursAgo: 14 * 24 },
  { name: 'Coldfen Marsh',             type: 'LOCATION', description: 'A salt-marsh where the river loses its name.',                          hoursAgo: 21 * 24 },
  { name: 'The Forgewright Clan',      type: 'FACTION',  description: 'Mountain smiths whose loyalties shift with the moon.',                  hoursAgo: 28 * 24 },
  { name: 'The Stonewood',             type: 'LOCATION', description: 'A pale forest that remembers more than the people who walk it.',        hoursAgo: 35 * 24 },
  { name: 'Order of the Last Bell',    type: 'FACTION',  description: 'Wandering priests who answer a bell no one alive has rung.',            hoursAgo: 42 * 24 },
  { name: 'The Warden-Stones',         type: 'CUSTOM',   description: 'Seven standing stones bound to the Stonewardens by ancient oath.',     hoursAgo: 49 * 24 },
  { name: 'The Salt-Veil Trial',       type: 'EVENT',    description: 'The annual salt-mage rite that tests the worthiness of supplicants.', hoursAgo: 56 * 24 },
];

const PREP_REMINDERS = [
  { id: 'r1', title: 'Review Tower of the Obsidian Eye', description: 'Notes, traps, and encounters', completed: false },
  { id: 'r2', title: 'Prepare NPC: Seraphine Dusk',      description: 'Motivations and secrets',      completed: false },
  { id: 'r3', title: 'Random Encounter Table',           description: 'Create for Shattered Spire',   completed: false },
];

function dateOffsetDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(19, 0, 0, 0); // clean 7:00 PM session time
  return d;
}

function dateOffsetHours(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function main() {
  const owner = await prisma.user.findFirst({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    throw new Error(`No User row matches ${OWNER_EMAIL} — sign in to dev.quiverdm.com once first.`);
  }
  console.log(`[seed] Owner: ${owner.name ?? owner.email} (${owner.id})`);

  const campaign = await prisma.campaign.upsert({
    where: { slug: SLUG },
    create: {
      name: NAME,
      slug: SLUG,
      description: DESCRIPTION,
      userId: owner.id,
      status: 'active',
      members: { create: { userId: owner.id, role: 'OWNER' } },
    },
    update: { name: NAME, description: DESCRIPTION },
    select: { id: true, name: true },
  });
  console.log(`[seed] Campaign: ${campaign.name} (${campaign.id})`);

  // Make sure the OWNER membership exists (upsert above only creates on insert)
  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: owner.id } },
    create: { userId: owner.id, campaignId: campaign.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });

  // --- Sessions -----------------------------------------------------------
  for (const s of SESSIONS) {
    const date = dateOffsetDays(s.daysAgo);
    const planningPrep = s.status === 'planning' ? { reminders: PREP_REMINDERS } : undefined;
    await prisma.gameSession.upsert({
      where: {
        campaignId_sessionNumber: {
          campaignId: campaign.id,
          sessionNumber: s.number,
        },
      },
      create: {
        campaignId: campaign.id,
        sessionNumber: s.number,
        title: s.title,
        recap: s.recap,
        quickNotes: s.recap,
        date,
        status: s.status,
        prepData: planningPrep ?? undefined,
        prepStatus: planningPrep ? 'draft' : 'none',
      },
      update: {
        title: s.title,
        recap: s.recap,
        quickNotes: s.recap,
        date,
        status: s.status,
        prepData: planningPrep ?? undefined,
        prepStatus: planningPrep ? 'draft' : 'none',
      },
    });
  }
  console.log(`[seed] Sessions upserted: ${SESSIONS.length}`);

  // --- NPCs ---------------------------------------------------------------
  for (const n of NPCS) {
    const existing = await prisma.nPC.findFirst({
      where: { campaignId: campaign.id, name: n.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.nPC.update({
        where: { id: existing.id },
        data: { description: n.description, role: n.role, faction: n.faction },
      });
    } else {
      await prisma.nPC.create({
        data: {
          campaignId: campaign.id,
          name: n.name,
          description: n.description,
          role: n.role,
          faction: n.faction,
        },
      });
    }
  }
  console.log(`[seed] NPCs upserted: ${NPCS.length}`);

  // --- WorldEntities ------------------------------------------------------
  // World Activity feed ranks by updatedAt — entity updatedAt MUST stay newer
  // than NPC updatedAt for the intended thumbnails to surface.
  for (const e of ENTITIES) {
    const date = dateOffsetHours(e.hoursAgo);
    const existing = await prisma.worldEntity.findFirst({
      where: { campaignId: campaign.id, name: e.name, type: e.type },
      select: { id: true },
    });
    if (existing) {
      await prisma.worldEntity.update({
        where: { id: existing.id },
        data: { description: e.description, updatedAt: date },
      });
    } else {
      await prisma.worldEntity.create({
        data: {
          campaignId: campaign.id,
          type: e.type,
          name: e.name,
          description: e.description,
          createdAt: date,
          updatedAt: date,
        },
      });
    }
  }
  console.log(`[seed] WorldEntities upserted: ${ENTITIES.length}`);

  // Push NPC updatedAt into the past so WorldEntities take the top slots
  // in the World Activity feed (matches the intended demo ordering).
  await prisma.nPC.updateMany({
    where: { campaignId: campaign.id },
    data: { updatedAt: dateOffsetHours(7 * 24 + 1) },
  });

  // --- Touch the campaign so it sorts to the top of getDashboardCampaigns
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { updatedAt: new Date() },
  });

  console.log('[seed] Done. Refresh https://dev.quiverdm.com to see the home page filled.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
