/**
 * Create QuiverDM campaigns for the two DDB campaigns and import characters.
 *
 * DDB 6021147 → "The Next Adventure"
 * DDB 6811442 → "Tales from The Bonfire Keep"
 *
 * Usage: npx tsx scripts/ddb-campaign-import.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { fetchDDBCampaignCharacters } from '@/lib/dndbeyond-api';
import { charactersDndbeyondService } from '@/server/services/characters-dndbeyond.service';

const prisma = new PrismaClient();

const COBALT = process.env.DDB_COBALT_SESSION;
if (!COBALT) {
  console.error('DDB_COBALT_SESSION not set');
  process.exit(1);
}

const CAMPAIGNS = [
  { ddbId: '6021147', name: 'The Next Adventure',       slug: 'the-next-adventure',        url: 'https://www.dndbeyond.com/campaigns/6021147' },
  { ddbId: '6811442', name: 'Tales from The Bonfire Keep', slug: 'tales-from-bonfire-keep', url: 'https://www.dndbeyond.com/campaigns/6811442' },
];

async function getOrCreateCampaign(dmUserId: string, def: typeof CAMPAIGNS[number]) {
  const existing = await prisma.campaign.findFirst({ where: { slug: def.slug } });
  if (existing) {
    console.log(`  Using existing campaign: ${existing.name} (${existing.id})`);
    // Ensure the DDB URL is set
    await prisma.campaign.update({
      where: { id: existing.id },
      data: { dndBeyondCampaignUrl: def.url },
    });
    return existing;
  }

  console.log(`  Creating campaign: ${def.name}`);
  const campaign = await prisma.campaign.create({
    data: {
      name: def.name,
      slug: def.slug,
      dndBeyondCampaignUrl: def.url,
      userId: dmUserId,
      members: {
        create: { userId: dmUserId, role: 'OWNER' },
      },
    },
  });
  return campaign;
}

async function main() {
  // Find the DM user (Blake)
  const dmUser = await prisma.user.findFirst({
    where: { email: { in: ['blake.wales.au@gmail.com', 'admin@quiverdm.com', 'dev@blakewales.au'] } },
    orderBy: { createdAt: 'asc' },
  });

  if (!dmUser) {
    console.error('Could not find DM user. Check email addresses.');
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true }, take: 10 });
    console.log('Existing users:', users);
    process.exit(1);
  }

  console.log(`DM user: ${dmUser.name} (${dmUser.email}) [${dmUser.id}]`);

  for (const def of CAMPAIGNS) {
    console.log(`\n=== ${def.name} (DDB ${def.ddbId}) ===`);

    const campaign = await getOrCreateCampaign(dmUser.id, def);

    console.log(`  Fetching characters from DDB campaign ${def.ddbId}...`);
    const result = await fetchDDBCampaignCharacters(def.url, COBALT!);

    if (!result.success || !result.characters?.length) {
      console.warn(`  Failed to fetch characters: ${result.message}`);
      continue;
    }

    console.log(`  Found ${result.characters.length} character(s)`);

    let imported = 0;
    let failed = 0;
    for (const ref of result.characters) {
      try {
        await charactersDndbeyondService.importCharacter(dmUser.id, {
          characterId: ref.characterId,
          campaignId: campaign.id,
        });
        console.log(`  ✓ Imported character ${ref.characterId}`);
        imported++;
      } catch (err: any) {
        console.warn(`  ✗ Failed ${ref.characterId}: ${err.message}`);
        failed++;
      }
    }

    console.log(`  Done — ${imported} imported, ${failed} failed`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
