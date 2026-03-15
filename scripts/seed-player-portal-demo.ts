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
