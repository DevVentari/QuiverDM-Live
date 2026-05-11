// Usage: npx tsx scripts/backfill-chapter-illustrations.ts <sourcebook-slug>
//
// Re-fetches each chapter's HTML for an already-synced sourcebook and persists
// every <img> tag into SourcebookChapterImage. Idempotent — re-running upserts.
// Requires the user's stored CobaltSession.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchChapterContentWithCookie } from '../src/lib/ddb-sourcebook';
import { decrypt } from '../src/lib/encryption';

const prisma = new PrismaClient();

function inferImageKind(url: string, alt?: string, section?: string): 'portrait' | 'map' | 'scene' | 'generic' {
  const h = `${url} ${alt ?? ''} ${section ?? ''}`.toLowerCase();
  if (/\b(map|floor|tactical|hideout|cave|cavern|dungeon)\b/.test(h)) return 'map';
  if (/\b(portrait|character|headshot)\b/.test(h)) return 'portrait';
  if (/\b(cover|splash|landscape|scene|spread)\b/.test(h)) return 'scene';
  return 'generic';
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npx tsx scripts/backfill-chapter-illustrations.ts <sourcebook-slug>');
    process.exit(1);
  }

  const sb = await prisma.ddbSourcebook.findFirst({
    where: { slug },
    include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
  });
  if (!sb) {
    console.error(`Sourcebook not found: ${slug}`);
    process.exit(1);
  }

  const settings = await prisma.userSettings.findFirst({
    where: { userId: sb.userId },
    select: { dndBeyondCobaltCookie: true },
  });
  if (!settings?.dndBeyondCobaltCookie) {
    console.error('No CobaltSession stored for the sourcebook owner.');
    process.exit(1);
  }
  const cobalt = decrypt(settings.dndBeyondCobaltCookie);

  console.log(`[backfill] ${sb.title} (${sb.chapters.length} chapters)`);

  let total = 0;
  for (const ch of sb.chapters) {
    try {
      const content = await fetchChapterContentWithCookie(sb.slug, ch.slug, cobalt);
      for (let i = 0; i < content.images.length; i++) {
        const img = content.images[i];
        await prisma.sourcebookChapterImage.upsert({
          where: {
            sourcebookId_chapterId_url: { sourcebookId: sb.id, chapterId: ch.id, url: img.url },
          },
          create: {
            sourcebookId: sb.id,
            chapterId: ch.id,
            url: img.url,
            alt: img.alt || null,
            sectionHeading: img.sectionHeading || null,
            isHero: img.isHero,
            position: i,
            kind: inferImageKind(img.url, img.alt, img.sectionHeading),
          },
          update: {},
        });
        total++;
      }
      console.log(`  [${ch.title}] ${content.images.length} images`);
    } catch (e) {
      console.warn(`  [${ch.title}] error:`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`[backfill] done. ${total} images stored.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
