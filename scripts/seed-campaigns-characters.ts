/**
 * Seed: Campaigns + D&D Beyond Character Import
 *
 * Creates campaigns and imports characters from D&D Beyond public API.
 * Run with: npx tsx scripts/seed-campaigns-characters.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { mapDnDBeyondToCharacter } from '../src/lib/dndbeyond-character-mapper';

const prisma = new PrismaClient();

const USER_ID = 'cmlfsyvxw0001gqt4jid8a1m3';

// ─── Campaigns ────────────────────────────────────────────────────────────────

const CAMPAIGNS = [
  {
    slug: 'tales-from-the-bonfire-keep',
    name: 'Tales From The Bonfire Keep',
    description: 'A long-running campaign centered around the mysterious Bonfire Keep and the adventurers who call it home.',
    status: 'active',
  },
  {
    slug: 'the-next-adventure',
    name: 'The Next Adventure',
    description: 'A new campaign just getting underway — where the story goes is anyone\'s guess.',
    status: 'active',
  },
  {
    slug: 'curse-of-strahd',
    name: 'Curse of Strahd',
    description: 'Gothic horror in the mist-shrouded land of Barovia. Survive Strahd von Zarovich.',
    status: 'planning',
  },
  {
    slug: 'waterdeep-dragon-heist',
    name: 'Waterdeep: Dragon Heist',
    description: 'A city-based heist adventure in the greatest metropolis of the Forgotten Realms.',
    status: 'planning',
  },
  {
    slug: 'lost-mines-of-phandelver',
    name: 'Lost Mines of Phandelver',
    description: 'A classic starter adventure — goblins, bandits, and a dragon lurking in the dark.',
    status: 'completed',
  },
];

// ─── Characters ───────────────────────────────────────────────────────────────

const MY_CHARACTERS = [
  { id: '47998691' },
  { id: '108586204' },
  { id: '112917806' },
  { id: '138913536' },
];

const NEXT_ADVENTURE_CHARACTERS = [
  { id: '140030204' },
  { id: '135676084' },
  { id: '155146167' },
  { id: '146445545' },
  { id: '140226250' }, // also in Bonfire Keep
];

const BONFIRE_KEEP_CHARACTERS = [
  { id: '140226250' }, // shared with Next Adventure
  { id: '147782974' },
  { id: '147785189' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jf(value: unknown) {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function fetchDDBCharacter(characterId: string) {
  const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DDB API ${res.status} for character ${characterId}`);
  return res.json();
}

async function importCharacter(characterId: string): Promise<string> {
  // Check if already imported
  const existing = await prisma.character.findUnique({ where: { dndBeyondId: characterId } });
  if (existing) {
    console.log(`  ↩  ${characterId} already imported as "${existing.name}" (${existing.id})`);
    return existing.id;
  }

  console.log(`  ⬇  Fetching ${characterId} from D&D Beyond...`);
  const rawData = await fetchDDBCharacter(characterId);
  const mapped = mapDnDBeyondToCharacter(rawData);

  const character = await prisma.character.create({
    data: {
      userId: USER_ID,
      name: mapped.name,
      race: mapped.race,
      class: mapped.class,
      subclass: mapped.subclass,
      level: mapped.level,
      background: mapped.background,
      portraitUrl: mapped.portraitUrl,
      isPortable: true,
      abilityScores: jf(mapped.abilityScores),
      hitPoints: jf(mapped.hitPoints),
      armorClass: mapped.armorClass,
      speed: mapped.speed,
      proficiencyBonus: mapped.proficiencyBonus,
      features: jf(mapped.features),
      proficiencies: jf(mapped.proficiencies),
      inventory: jf(mapped.inventory),
      spellcasting: jf(mapped.spellcasting),
      currency: jf(mapped.currency),
      backstory: mapped.backstory,
      personalityTraits: mapped.personalityTraits,
      ideals: mapped.ideals,
      bonds: mapped.bonds,
      flaws: mapped.flaws,
      languages: jf(mapped.languages),
      senses: jf(mapped.senses),
      resistances: jf(mapped.resistances),
      hitDice: jf(mapped.hitDice),
      savingThrows: jf(mapped.savingThrows),
      classes: jf(mapped.classes),
      appearance: jf(mapped.appearance),
      dndBeyondId: mapped.dndBeyondId,
      dndBeyondUrl: mapped.dndBeyondUrl,
      lastSyncedAt: new Date(),
      rawData: jf(mapped.rawData),
    },
  });

  console.log(`  ✅  Imported: ${character.name} (Lv${character.level} ${character.class ?? ''} ${character.race ?? ''})`);
  return character.id;
}

async function addToCampaign(characterId: string, campaignId: string) {
  await prisma.campaignCharacter.upsert({
    where: { campaignId_characterId: { campaignId, characterId } },
    create: { campaignId, characterId },
    update: {},
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎲 QuiverDM Seed — Campaigns + Characters\n');

  // 1. Create campaigns
  console.log('📋 Creating campaigns...');
  const campaignMap: Record<string, string> = {};
  for (const c of CAMPAIGNS) {
    const existing = await prisma.campaign.findUnique({ where: { slug: c.slug } });
    if (existing) {
      console.log(`  ↩  "${c.name}" already exists`);
      campaignMap[c.slug] = existing.id;
      continue;
    }
    const campaign = await prisma.campaign.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        status: c.status,
        userId: USER_ID,
        members: {
          create: { userId: USER_ID, role: 'OWNER' },
        },
      },
    });
    campaignMap[c.slug] = campaign.id;
    console.log(`  ✅  Created: ${c.name} (${campaign.id})`);
  }

  // 2. Import personal characters (no campaign)
  console.log('\n👤 Importing personal characters...');
  for (const c of MY_CHARACTERS) {
    try {
      await importCharacter(c.id);
    } catch (e) {
      console.warn(`  ⚠  Failed ${c.id}: ${(e as Error).message}`);
    }
  }

  // 3. Import The Next Adventure characters
  const nextAdventureId = campaignMap['the-next-adventure'];
  console.log('\n🗺  Importing The Next Adventure characters...');
  for (const c of NEXT_ADVENTURE_CHARACTERS) {
    try {
      const charId = await importCharacter(c.id);
      await addToCampaign(charId, nextAdventureId);
      console.log(`     → Added to The Next Adventure`);
    } catch (e) {
      console.warn(`  ⚠  Failed ${c.id}: ${(e as Error).message}`);
    }
  }

  // 4. Import Tales From The Bonfire Keep characters
  const bonfireKeepId = campaignMap['tales-from-the-bonfire-keep'];
  console.log('\n🔥 Importing Tales From The Bonfire Keep characters...');
  for (const c of BONFIRE_KEEP_CHARACTERS) {
    try {
      const charId = await importCharacter(c.id);
      await addToCampaign(charId, bonfireKeepId);
      console.log(`     → Added to Tales From The Bonfire Keep`);
    } catch (e) {
      console.warn(`  ⚠  Failed ${c.id}: ${(e as Error).message}`);
    }
  }

  console.log('\n✨ Done!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
