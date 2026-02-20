/**
 * Save cobalt token to user settings and retry the private character import.
 * Run with: npx tsx scripts/save-cobalt-and-retry.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { mapDnDBeyondToCharacter } from '../src/lib/dndbeyond-character-mapper';
import { encrypt } from '../src/lib/encryption';

const prisma = new PrismaClient();

const USER_ID = 'cmlfsyvxw0001gqt4jid8a1m3';
const COBALT_TOKEN = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..7FWI8eKOw0I5FsUl6ur-Qw.nYvXOFXhL1iK8nWNSAcnzBjbuWLKTXdQ-jVFHcsI347s5Tdy1K4ztqGyCZCczxtF.JYBtTi-2FFKFhRvzJwFCjQ';
const PRIVATE_CHAR_ID = '155146167';
const NEXT_ADVENTURE_SLUG = 'the-next-adventure';

function jf(value: unknown) {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function main() {
  // 1. Save encrypted cobalt token to user settings
  console.log('🔐 Saving cobalt token to user settings...');
  await prisma.userSettings.upsert({
    where: { userId: USER_ID },
    create: { userId: USER_ID, dndBeyondCobaltCookie: encrypt(COBALT_TOKEN) },
    update: { dndBeyondCobaltCookie: encrypt(COBALT_TOKEN) },
  });
  console.log('  ✅  Cobalt token saved (encrypted)');

  // 2. Retry private character with cobalt token
  console.log(`\n⬇  Fetching private character ${PRIVATE_CHAR_ID}...`);
  const res = await fetch(
    `https://character-service.dndbeyond.com/character/v5/character/${PRIVATE_CHAR_ID}`,
    { headers: { Cookie: `CobaltSession=${COBALT_TOKEN}` } }
  );

  if (!res.ok) {
    throw new Error(`DDB API ${res.status} — token may be expired`);
  }

  const rawData = await res.json();
  const mapped = mapDnDBeyondToCharacter(rawData);

  // Check for existing
  const existing = await prisma.character.findUnique({ where: { dndBeyondId: PRIVATE_CHAR_ID } });
  let charDbId: string;

  if (existing) {
    console.log(`  ↩  Already imported as "${existing.name}" — skipping create`);
    charDbId = existing.id;
  } else {
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
    charDbId = character.id;
    console.log(`  ✅  Imported: ${character.name} (Lv${character.level} ${character.class ?? ''} ${character.race ?? ''})`);
  }

  // 3. Add to The Next Adventure
  const campaign = await prisma.campaign.findUnique({ where: { slug: NEXT_ADVENTURE_SLUG } });
  if (campaign) {
    await prisma.campaignCharacter.upsert({
      where: { campaignId_characterId: { campaignId: campaign.id, characterId: charDbId } },
      create: { campaignId: campaign.id, characterId: charDbId },
      update: {},
    });
    console.log('  → Added to The Next Adventure');
  }

  console.log('\n✨ Done!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
