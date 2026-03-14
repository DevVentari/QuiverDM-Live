/**
 * Import D&D Beyond characters from dndbeyond-character-links.csv
 * Run: DATABASE_URL=<prod> NEXTAUTH_SECRET=<prod> npx tsx scripts/import-ddb-characters.ts
 */
import { PrismaClient } from '@prisma/client';
import { fetchCharacterFromDDB } from '../src/lib/dndbeyond-api';
import { mapDnDBeyondToCharacter } from '../src/lib/dndbeyond-character-mapper';
import { decrypt } from '../src/lib/encryption';

const prisma = new PrismaClient();

const USER_ID = 'cmmhnjt720001am5akp79kcx2';

// Characters from docs/dndbeyond-character-links.csv
// Profile-based URLs → extracted IDs (147782974, 147785189)
const CSV = {
  myChars: ['47998691', '108586204', '112917806', '138913536'],
  nextAdventure: ['140030204', '135676084', '155146167', '146445545', '140226250'],
  bonfire: ['140226250', '147782974', '147785189'],
};

async function getCobaltToken(): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: USER_ID },
    select: { dndBeyondCobaltCookie: true },
  });
  if (!settings?.dndBeyondCobaltCookie) throw new Error('No cobalt token in UserSettings');
  return decrypt(settings.dndBeyondCobaltCookie);
}

async function getOrCreateCampaign(name: string, slug: string): Promise<string> {
  const existing = await prisma.campaign.findFirst({ where: { userId: USER_ID, name } });
  if (existing) return existing.id;
  const created = await prisma.campaign.create({
    data: { name, slug, userId: USER_ID, description: '' },
  });
  console.log(`  Created campaign: ${name} (${created.id})`);
  return created.id;
}

async function importCharacter(
  characterId: string,
  cobaltToken: string,
  campaignId?: string
): Promise<string | null> {
  const ddbId = characterId;

  // Check if already imported in this run
  const existing = await prisma.character.findFirst({ where: { dndBeyondId: ddbId } });
  if (existing) {
    console.log(`  [skip-exists] ${ddbId} → ${existing.name}`);
    if (campaignId) await ensureCampaignLink(existing.id, campaignId);
    return existing.id;
  }

  const response = await fetchCharacterFromDDB(ddbId, cobaltToken);
  if (!response.success || !response.data) {
    console.error(`  [fail] ${ddbId}: ${response.message}`);
    return null;
  }

  const mapped = mapDnDBeyondToCharacter(response.data);
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
      abilityScores: mapped.abilityScores ?? undefined,
      hitPoints: mapped.hitPoints ?? undefined,
      armorClass: mapped.armorClass,
      speed: mapped.speed,
      proficiencyBonus: mapped.proficiencyBonus,
      features: mapped.features ?? undefined,
      proficiencies: mapped.proficiencies ?? undefined,
      inventory: mapped.inventory ?? undefined,
      spellcasting: mapped.spellcasting ?? undefined,
      currency: mapped.currency ?? undefined,
      backstory: mapped.backstory,
      personalityTraits: mapped.personalityTraits,
      ideals: mapped.ideals,
      bonds: mapped.bonds,
      flaws: mapped.flaws,
      languages: mapped.languages ?? undefined,
      senses: mapped.senses ?? undefined,
      resistances: mapped.resistances ?? undefined,
      hitDice: mapped.hitDice ?? undefined,
      savingThrows: mapped.savingThrows ?? undefined,
      classes: mapped.classes ?? undefined,
      appearance: mapped.appearance ?? undefined,
      dndBeyondId: mapped.dndBeyondId,
      dndBeyondUrl: mapped.dndBeyondUrl,
      rawData: mapped.rawData,
    },
  });

  console.log(`  [ok] ${ddbId} → ${character.name} (Lv${character.level} ${character.class})`);

  if (campaignId) await ensureCampaignLink(character.id, campaignId);
  return character.id;
}

async function ensureCampaignLink(characterId: string, campaignId: string) {
  await prisma.campaignCharacter.upsert({
    where: { campaignId_characterId: { campaignId, characterId } },
    update: {},
    create: { campaignId, characterId, status: 'ACTIVE' },
  });
}

async function main() {
  const cobaltToken = await getCobaltToken();
  console.log('Cobalt token resolved.');

  // Create campaigns
  const nextAdventureId = await getOrCreateCampaign('The Next Adventure', 'the-next-adventure');
  const bonfireId = await getOrCreateCampaign('Tales from The Bonfire Keep', 'tales-from-the-bonfire-keep');

  console.log('\nImporting "My Characters" (no campaign)...');
  for (const id of CSV.myChars) {
    await importCharacter(id, cobaltToken);
  }

  console.log('\nImporting "The Next Adventure" characters...');
  for (const id of CSV.nextAdventure) {
    await importCharacter(id, cobaltToken, nextAdventureId);
  }

  console.log('\nImporting "Tales from The Bonfire Keep" characters...');
  for (const id of CSV.bonfire) {
    await importCharacter(id, cobaltToken, bonfireId);
  }

  const total = await prisma.character.count();
  console.log(`\nDone. ${total} characters in prod.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
