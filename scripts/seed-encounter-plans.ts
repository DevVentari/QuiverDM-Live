/**
 * Seed Encounter Plans
 *
 * Inserts sample saved combat plans into the local database.
 * Run with: npx tsx scripts/seed-encounter-plans.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CAMPAIGN_SLUG = process.env.CAMPAIGN_SLUG ?? 'the-dragon-s-awakening';

const plans = [
  {
    name: 'Goblin Ambush on the Trade Road',
    difficulty: 'easy',
    partySize: 4,
    partyLevel: 2,
    totalXp: 400,
    adjustedXp: 600,
    xpBudget: 600,
    sceneDescription:
      'Narrow forest road, overhanging branches blocking moonlight. A felled tree blocks the path — classic goblin bait. Three goblins hide in the brush on either side; a hobgoblin sergeant crouches behind a boulder, waiting to charge once the party splits attention.',
    tacticalNotes:
      'Goblins use Nimble Escape every turn — Disengage or Hide as bonus action. Hobgoblin hits hard on its first turn (martial advantage). PCs should be able to win but will burn a couple spell slots. If the fight turns, the goblins scatter into the trees.',
    environmentalEffects:
      'Dim light in the trees (disadvantage on Perception), felled log is difficult terrain (10 ft to cross), rain starting next round (Concentration checks for wet casters).',
    creatures: [
      { name: 'Goblin', count: 3, cr: '1/4', xp: 50, sourceType: 'srd' },
      { name: 'Hobgoblin', count: 1, cr: '1/2', xp: 100, sourceType: 'srd' },
    ],
  },
  {
    name: 'Bandit Toll at Irongate Bridge',
    difficulty: 'medium',
    partySize: 4,
    partyLevel: 3,
    totalXp: 1050,
    adjustedXp: 1750,
    xpBudget: 1800,
    sceneDescription:
      'A stone bridge over a fast-moving river gorge — only 10 ft wide, no guardrails. Four bandits block the near end demanding coin; their captain stands mid-bridge with a hand crossbow trained on the lead PC. A fifth bandit hides under the bridge on a maintenance ledge with a rope ladder.',
    tacticalNotes:
      'Captain opens with a Cunning Action hide then sneak attack. Bandits try to grapple PCs and threaten to push them off (DC 14 Str save or go over the edge, 30 ft fall into rapids — Str DC 15 to swim out). The hidden bandit climbs up round 2 to flank.',
    environmentalEffects:
      'Bridge is difficult terrain (slippery stone). Falling into the river: 10d6 bludgeoning, then swimming DC 15 or swept downstream 60 ft per round. High wind howling through the gorge (ranged attacks at disadvantage beyond 30 ft).',
    creatures: [
      { name: 'Bandit', count: 4, cr: '1/8', xp: 25, sourceType: 'srd' },
      { name: 'Bandit Captain', count: 1, cr: '2', xp: 450, sourceType: 'srd' },
    ],
  },
  {
    name: 'Crypt of the Pale Warden',
    difficulty: 'hard',
    partySize: 4,
    partyLevel: 5,
    totalXp: 3900,
    adjustedXp: 7020,
    xpBudget: 7200,
    sceneDescription:
      'A flooded tomb antechamber — 6 inches of dark water across the floor. Crumbling pillars provide half cover. Four skeletons animate as the party enters; a wight emerges from the sarcophagus in round 2, treating the skeletons as shields for its Life Drain attacks. Necrotic energy crackles from wall sconces.',
    tacticalNotes:
      'Wight uses skeletons as meatshields, Life Drain targeting whoever looks wounded. Skeletons have resistance to piercing/slashing from non-magical weapons — could be a nasty surprise. Cleric Turn Undead is the key counter; without it, this gets very dangerous. The wight flees into a locked inner crypt at 10 HP, buying time.',
    environmentalEffects:
      'Difficult terrain (6 inches of water throughout). Necrotic sconces: 3 (1d8) necrotic damage to any creature that starts its turn within 5 ft. Dim candlelight — Darkvision required beyond 15 ft.',
    creatures: [
      { name: 'Skeleton', count: 4, cr: '1/4', xp: 50, sourceType: 'srd' },
      { name: 'Wight', count: 1, cr: '3', xp: 700, sourceType: 'srd' },
    ],
  },
  {
    name: 'The Thornwood Drake Pack',
    difficulty: 'hard',
    partySize: 5,
    partyLevel: 6,
    totalXp: 5400,
    adjustedXp: 9180,
    xpBudget: 9000,
    sceneDescription:
      'A forest clearing at dusk, the canopy closing overhead. Three guard drakes prowl the perimeter — juveniles of a young green dragon roosting nearby. They will defend the territory to the death. Round 3, the dragon makes a flyover, choosing to observe rather than intervene unless a drake dies — then it dives.',
    tacticalNotes:
      'Drakes use Pack Tactics — always try to flank. Open with the Multiattack + bite combo targeting the squishiest PC. If the dragon decides to intervene (DM call), it opens with a Poison Breath Weapon (60 ft cone, 12d6 poison, DC 14 Con) then lands to fight. This escalates to deadly if the dragon joins.',
    environmentalEffects:
      'Heavy undergrowth: difficult terrain, Stealth at advantage for drakes. Low light (dusk): disadvantage Perception beyond 60 ft. Dragon flyover at round 3 causes Frightened (Wisdom DC 13 or frightened 1 min) on a failed save.',
    creatures: [
      { name: 'Guard Drake', count: 3, cr: '2', xp: 450, sourceType: 'srd' },
      { name: 'Young Green Dragon', count: 1, cr: '8', xp: 3900, sourceType: 'srd' },
    ],
  },
  {
    name: "The Broken Compass Tavern Brawl",
    difficulty: 'easy',
    partySize: 4,
    partyLevel: 1,
    totalXp: 250,
    adjustedXp: 375,
    xpBudget: 300,
    sceneDescription:
      'A crowded inn common room after last call. A half-orc mercenary and two of his crew take offence at the party\'s presence — something about a contract. Bottles, chairs, and a flying roast chicken make this nonlethal but chaotic. The innkeeper is screaming for calm.',
    tacticalNotes:
      'All damage is nonlethal (fists and improvised weapons). Dropping a thug to 0 HP just knocks them out. The half-orc fights dirty — grapple attempts and shoves. Great intro combat for level 1s: low stakes, fun terrain interaction, teaches action economy. End with the innkeeper threatening everyone with the town guard.',
    environmentalEffects:
      'Crowded room: moving through occupied squares costs double movement. Improvised weapons everywhere (chair: 1d6+Str, bottle: 1d4). Tables as half cover if you go prone behind them. Spilled ale on floor (DC 10 Acrobatics or fall prone if you run).',
    creatures: [
      { name: 'Thug', count: 2, cr: '1/2', xp: 100, sourceType: 'srd' },
      { name: 'Half-Orc Mercenary', count: 1, cr: '1/4', xp: 50, sourceType: 'custom' },
    ],
  },
  {
    name: 'Vampire Spawn in the Bell Tower',
    difficulty: 'deadly',
    partySize: 4,
    partyLevel: 8,
    totalXp: 14400,
    adjustedXp: 21600,
    xpBudget: 20000,
    sceneDescription:
      'The village bell tower at midnight. Three vampire spawn are waiting in mist form near the rafters — they solidify once the party reaches the second-floor landing. The tower is four levels connected by narrow ladders; the massive bronze bell hangs above the top platform.',
    tacticalNotes:
      'Vampire Spawn use Spider Climb to cling to walls and ceilings, attacking from angles PCs can\'t easily reach. Bite attempts against grappled targets for Life Drain. If the party rings the bell (Action), the sound forces a DC 15 Con save or stunned 1 round — affects everyone, including spawn. At 40 HP, spawn reform as mist and try to retreat through cracks. Sunlight through the belfry windows is a hazard for spawn (but the party needs to improvise breaking a shutter).',
    environmentalEffects:
      'Dim light throughout. Narrow ladders: climbing costs double movement, can\'t use shield while climbing. Bell rope at top: can be cut (DC 12 Str) to drop the bell on everything below (6d10 bludgeoning, DC 16 Dex save for half). Platform edges: fall risk if shoved (30 ft = 3d6 bludgeoning).',
    creatures: [
      { name: 'Vampire Spawn', count: 3, cr: '5', xp: 1800, sourceType: 'srd' },
    ],
  },
];

async function seedEncounterPlans() {
  const campaign = await prisma.campaign.findFirstOrThrow({ where: { slug: CAMPAIGN_SLUG }, select: { id: true, name: true } });
  console.log(`Seeding encounter plans into: ${campaign.name}\n`);

  for (const plan of plans) {
    const { creatures, ...planData } = plan;

    const created = await prisma.encounterPlan.create({
      data: {
        ...planData,
        campaignId: campaign.id,
      },
    });

    for (const creature of creatures) {
      await prisma.encounterPlanCreature.create({
        data: {
          planId: created.id,
          ...creature,
        },
      });
    }

    console.log(`  Created: ${created.name} (${planData.difficulty})`);
  }

  console.log(`\nDone — ${plans.length} encounter plans seeded.`);
}

seedEncounterPlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
