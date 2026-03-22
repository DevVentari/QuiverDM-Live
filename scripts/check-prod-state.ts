import { PrismaClient } from '@prisma/client';
const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });
(async () => {
  const users = await p.user.findMany({ select: { email: true, platformRole: true } });
  console.log('Users:', JSON.stringify(users));
  const counts = {
    campaigns: await p.campaign.count(),
    entities: await p.worldEntity.count(),
    homebrew: await p.homebrewContent.count(),
    chapters: await p.ddbSourcebookChapter.count(),
  };
  console.log('Counts:', JSON.stringify(counts));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
