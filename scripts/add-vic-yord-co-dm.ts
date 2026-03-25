import { PrismaClient } from '@prisma/client';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });

async function main() {
  const vic = await p.user.findUnique({ where: { email: 'vic@test.local' }, select: { id: true } });
  if (!vic) { console.log('vic@test.local not found in DB'); return; }

  const campaign = await p.campaign.findUnique({ where: { slug: 'year-of-rogue-dragons' }, select: { id: true, name: true } });
  if (!campaign) { console.log('year-of-rogue-dragons campaign not found'); return; }

  console.log(`Campaign: ${campaign.name} (${campaign.id})`);
  console.log(`User: vic@test.local (${vic.id})`);

  const existing = await p.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: vic.id } },
  });

  if (existing) {
    console.log(`Already a member with role: ${existing.role}`);
    if (existing.role !== 'CO_DM' && existing.role !== 'OWNER') {
      await p.campaignMember.update({
        where: { campaignId_userId: { campaignId: campaign.id, userId: vic.id } },
        data: { role: 'CO_DM' },
      });
      console.log('Updated role to CO_DM');
    }
    return;
  }

  await p.campaignMember.create({
    data: { campaignId: campaign.id, userId: vic.id, role: 'CO_DM' },
  });
  console.log('Added vic@test.local as CO_DM to year-of-rogue-dragons');
}

main().catch(console.error).finally(() => p.$disconnect());
