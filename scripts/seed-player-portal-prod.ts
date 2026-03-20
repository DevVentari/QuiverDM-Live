/**
 * Prod seed: player portal demo data for mail@blakewales.au
 * Run: DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/seed-player-portal-prod.ts
 *
 * Prod facts (queried 2026-03-15):
 *   user:     cmmqlqy1o0001co5m5wf4efj7
 *   campaign: cmmq9g7fn0004va8b8w81fh1g  (Tales From The Bonfire Keep 2, slug: tales-from-the-bonfire-keep-2)
 *   session:  cmmql1rwq0005ocgjc69g1nz3  (Session 1, status: planning)
 */

import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const CAMPAIGN_ID = 'cmmq9g7fn0004va8b8w81fh1g';
const SESSION1_ID = 'cmmql1rwq0005ocgjc69g1nz3';
const USER_ID = 'cmmqlqy1o0001co5m5wf4efj7';

async function main() {
  console.log('Seeding prod player portal data...');

  // 1. Update Session 1 — make it visible with a summary
  await p.gameSession.update({
    where: { id: SESSION1_ID },
    data: {
      status: 'completed',
      playerVisibility: 'public',
      sessionNumber: 1,
      date: new Date('2026-01-18T19:00:00Z'),
      aiSummary: `The party gathered at the Broken Antler Inn in the village of Ashford, drawn together by a shared bounty notice pinned to the village board. Eldara Nyx, a tiefling warlock, arrived first and immediately made enemies with the barkeep over a spilled drink. Tormund Greaves, the party's dwarf fighter, accepted the job on behalf of the group before anyone else could read the fine print.

The bounty: retrieve a stolen merchant shipment from a bandit camp in Thornwood Forest, two days' march east. The merchant, one Silas Breckett, was offering fifty gold pieces per head — but only if the goods arrived undamaged.

Travel was uneventful until dusk, when the party discovered a roadside shrine to Tyr that had been desecrated. Bloodstains, a cracked holy symbol, and fresh cart tracks heading off the road into the trees. They followed.

The bandit camp was larger than expected: twelve men, a makeshift palisade, and a caged owlbear the bandits were using as a guard dog. Notably, the bandits wore matching red cloaks — a guild marking none of the party recognised.

The session ended mid-combat, with Tormund pinned under a collapsed tent and Eldara negotiating (poorly) with the bandit lieutenant from across a campfire.`,
      aiSummaryStatus: 'done',
    },
  });
  console.log('✓ Session 1 updated');

  // 2. Create Session 2
  await p.gameSession.upsert({
    where: { campaignId_sessionNumber: { campaignId: CAMPAIGN_ID, sessionNumber: 2 } },
    update: {
      playerVisibility: 'public',
      aiSummary: `The battle at the bandit camp concluded with the party victorious, though Eldara burned down one of the supply carts in the process (docking fifteen gold from the reward). The surviving bandit lieutenant, a nervous young man named Cob, revealed under questioning that the Red Cloaks were not common thieves — they were agents of the Merchant Guild of Vorn, tasked with redirecting shipments from independent traders to Guild-approved routes.

The party returned the goods to Silas Breckett, who paid them (minus the fire damage) and begged them not to speak of the Guild involvement. He was clearly afraid. Back in Ashford, they discovered two more Red Cloak operatives watching the village from the inn upper floor. A tense confrontation in the common room ended with both operatives fleeing into the night — but not before one dropped a sealed letter addressed to someone called the Weaver.

Tormund kept the letter. No one has opened it yet.

The session closed with the party accepting a new contract from a halfling courier named Pip: escort her to the city of Vorn Gate, where she claims to have information someone powerful wants buried.`,
      aiSummaryStatus: 'done',
    },
    create: {
      campaignId: CAMPAIGN_ID,
      title: 'The Red Cloak Conspiracy',
      status: 'completed',
      playerVisibility: 'public',
      sessionNumber: 2,
      date: new Date('2026-01-25T19:00:00Z'),
      aiSummary: `The battle at the bandit camp concluded with the party victorious, though Eldara burned down one of the supply carts in the process (docking fifteen gold from the reward). The surviving bandit lieutenant, a nervous young man named Cob, revealed under questioning that the Red Cloaks were not common thieves — they were agents of the Merchant Guild of Vorn, tasked with redirecting shipments from independent traders to Guild-approved routes.

The party returned the goods to Silas Breckett, who paid them (minus the fire damage) and begged them not to speak of the Guild involvement. He was clearly afraid. Back in Ashford, they discovered two more Red Cloak operatives watching the village from the inn upper floor. A tense confrontation in the common room ended with both operatives fleeing into the night — but not before one dropped a sealed letter addressed to someone called the Weaver.

Tormund kept the letter. No one has opened it yet.

The session closed with the party accepting a new contract from a halfling courier named Pip: escort her to the city of Vorn Gate, where she claims to have information someone powerful wants buried.`,
      aiSummaryStatus: 'done',
    },
  });
  console.log('✓ Session 2 created');

  // 3. Create Session 3 (in progress / live)
  await p.gameSession.upsert({
    where: { campaignId_sessionNumber: { campaignId: CAMPAIGN_ID, sessionNumber: 3 } },
    update: { playerVisibility: 'public' },
    create: {
      campaignId: CAMPAIGN_ID,
      title: "Road to Vorn's Gate",
      status: 'active',
      playerVisibility: 'public',
      sessionNumber: 3,
      date: new Date('2026-02-01T19:00:00Z'),
    },
  });
  console.log('✓ Session 3 created');

  // 4. Create NPCs
  const npcs = [
    {
      id: 'prod-npc-cob',
      name: 'Cob',
      role: 'Red Cloak Lieutenant (captured)',
      faction: 'Merchant Guild of Vorn',
      description: 'A nervous, wiry young man in his early twenties. Clearly in over his head. Revealed the Guild\'s operation under minimal pressure and seems genuinely relieved to be out of it. May be an ally if the party gives him a way out.',
      playerVisible: true,
    },
    {
      id: 'prod-npc-silas',
      name: 'Silas Breckett',
      role: 'Independent Merchant',
      faction: null,
      description: 'A stout, ruddy-faced man who trades in dried goods and cloth between Ashford and the coast. Clearly terrified of the Merchant Guild. Paid the party but urged silence — he has a family in Ashford and fears reprisal. Possible quest giver for uncovering the Guild.',
      playerVisible: true,
    },
    {
      id: 'prod-npc-pip',
      name: 'Pip Underfoot',
      role: 'Halfling Courier',
      faction: null,
      description: 'A cheerful, fast-talking halfling courier who claims to carry information "someone powerful wants buried." She\'s evasive about the details but pays well. Moves with unusual confidence for someone supposedly just a messenger — she knows more than she lets on.',
      playerVisible: true,
    },
    {
      id: 'prod-npc-weaver',
      name: 'The Weaver',
      role: 'Unknown',
      faction: 'Merchant Guild of Vorn (?)',
      description: 'Named only in a dropped letter. No one in the party knows who this is. The letter was addressed to them by Cob\'s superior.',
      playerVisible: true,
    },
  ];

  for (const npc of npcs) {
    await p.nPC.upsert({
      where: { id: npc.id },
      update: {
        playerVisible: npc.playerVisible,
        description: npc.description,
      },
      create: {
        ...npc,
        campaignId: CAMPAIGN_ID,
      },
    });
  }
  console.log('✓ NPCs created/updated');

  // 5. Upsert a character for Blake + link to campaign
  const char = await p.character.upsert({
    where: { id: 'prod-char-blake-mira' },
    update: {},
    create: {
      id: 'prod-char-blake-mira',
      userId: USER_ID,
      name: 'Mira Stonehaven',
      class: 'Cleric',
      subclass: 'Life Domain',
      race: 'Half-Elf',
      level: 3,
      backstory: "A former temple acolyte who left the Order of the Silver Flame after questioning the church's silence on the Merchant Guild's stranglehold over the region's poorest communities. She carries a cracked holy symbol she refuses to repair — a reminder of the day she walked out.",
    },
  });
  await p.campaignCharacter.upsert({
    where: {
      campaignId_characterId: { campaignId: CAMPAIGN_ID, characterId: char.id },
    },
    update: {},
    create: {
      campaignId: CAMPAIGN_ID,
      characterId: char.id,
      status: 'ACTIVE',
      isActive: true,
    },
  });
  console.log('✓ Character upserted:', char.name);

  // 6. Mark existing NPCs in campaign as playerVisible if any
  const updated = await p.nPC.updateMany({
    where: {
      campaignId: CAMPAIGN_ID,
      playerVisible: false,
    },
    data: { playerVisible: true },
  });
  if (updated.count > 0) {
    console.log(`✓ Marked ${updated.count} existing NPCs as player-visible`);
  }

  console.log('\nDone! Player portal data seeded for prod.');
  console.log('Campaign slug: tales-from-the-bonfire-keep-2');
  console.log('Visit: https://quiverdm.com/play/tales-from-the-bonfire-keep-2');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
