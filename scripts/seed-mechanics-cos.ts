// Usage: npx tsx scripts/seed-mechanics-cos.ts <campaign-slug>
// Idempotent. Upserts the 14 Tarokka card × 5 divination position matrix as
// 70 CampaignMechanic rows. Each row's interpretation field is the DM-chosen
// reading for THIS campaign — the seed populates "unread" placeholders that
// the DM edits during session zero fortune-telling.

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Position = 'history' | 'ally' | 'enemy' | 'item' | 'final-battle-location';
const POSITIONS: Position[] = ['history', 'ally', 'enemy', 'item', 'final-battle-location'];

const HIGH_DECK = [
  'Artifact', 'Beast', 'Broken One', 'Darklord', 'Donjon',
  'Executioner', 'Ghost', 'Horseman', 'Innocent', 'Marionette',
  'Mists', 'Raven', 'Tempter', 'Traitor',
] as const;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const slugArg = process.argv[2];
  if (!slugArg) {
    console.error('Usage: npx tsx scripts/seed-mechanics-cos.ts <campaign-slug>');
    process.exit(1);
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug: slugArg }, select: { id: true, name: true } });
  if (!campaign) {
    console.error(`No campaign found with slug "${slugArg}"`);
    process.exit(1);
  }

  console.log(`[seed-cos] Seeding ${HIGH_DECK.length * POSITIONS.length} Tarokka entries into "${campaign.name}" (${campaign.id})`);

  let created = 0, updated = 0;
  for (const cardName of HIGH_DECK) {
    for (const position of POSITIONS) {
      const externalKey = `cos.tarokka.${slug(cardName)}.${position}`;
      const existing = await prisma.campaignMechanic.findUnique({
        where: { campaignId_kind_externalKey: { campaignId: campaign.id, kind: 'tarot', externalKey } },
        select: { id: true },
      });
      const content: Prisma.JsonObject = {
        cardName,
        suit: 'high',
        divinationPosition: position,
        interpretation: '',
      };
      const name = `${cardName} · ${position.replace(/-/g, ' ')}`;
      if (existing) {
        await prisma.campaignMechanic.update({
          where: { id: existing.id },
          data: { name },
        });
        updated++;
      } else {
        await prisma.campaignMechanic.create({
          data: {
            campaignId: campaign.id,
            kind: 'tarot',
            sourcebook: 'cos',
            externalKey,
            name,
            content,
          },
        });
        created++;
      }
    }
  }

  console.log(`[seed-cos] Done. created=${created} updated=${updated}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
