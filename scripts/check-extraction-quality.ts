import { PrismaClient } from '@prisma/client';
const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });
(async () => {
  // Check chapter content hashes — e3b0c442 = empty string
  const chapters = await p.ddbSourcebookChapter.findMany({
    select: { slug: true, contentHash: true, sourcebook: { select: { slug: true } } },
    orderBy: { chapterIndex: 'asc' },
  });
  const empty = chapters.filter(c => c.contentHash === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const good = chapters.filter(c => c.contentHash && c.contentHash !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  console.log(`Chapters: ${chapters.length} total, ${good.length} with content, ${empty.length} empty`);

  if (good.length > 0) {
    console.log('\nSample good chapters:');
    for (const c of good.slice(0, 3)) {
      console.log(`  [${c.sourcebook.slug}] ${c.slug}: ${c.contentHash?.slice(0,8)}`);
    }
  }
  if (empty.length > 0) {
    console.log('\nEmpty chapters:');
    for (const c of empty.slice(0, 5)) {
      console.log(`  [${c.sourcebook.slug}] ${c.slug}`);
    }
  }

  // Homebrew content
  const homebrew = await p.homebrewContent.groupBy({
    by: ['type'],
    _count: true,
  });
  console.log('\nHomebrew by type:', JSON.stringify(homebrew.map(h => `${h.type}:${h._count}`)));

  // Sample homebrew name
  const samples = await p.homebrewContent.findMany({ take: 5, select: { name: true, type: true } });
  console.log('Sample homebrew:', samples.map(s => `${s.type}:${s.name}`).join(', '));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
