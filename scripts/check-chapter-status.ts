import { PrismaClient } from '@prisma/client';
const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });
(async () => {
  const chapters = await p.ddbSourcebookChapter.findMany({
    select: { slug: true, syncStatus: true, contentHash: true, sourcebook: { select: { slug: true } } },
    orderBy: [{ sourcebook: { slug: 'asc' } }, { chapterIndex: 'asc' }],
  });
  const byStatus: Record<string, number> = {};
  for (const c of chapters) {
    byStatus[c.syncStatus] = (byStatus[c.syncStatus] || 0) + 1;
  }
  console.log('By status:', JSON.stringify(byStatus));

  const nullHash = chapters.filter(c => !c.contentHash);
  console.log(`Null hash (not synced): ${nullHash.length}`);
  for (const c of nullHash) {
    console.log(`  [${c.sourcebook.slug}] ${c.slug} (${c.syncStatus})`);
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
