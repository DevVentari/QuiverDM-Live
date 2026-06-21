/**
 * Generic creature stat-block extraction for ANY sourcebook.
 *
 * Reads a sourcebook's crawled chapter bodySections, extracts book-UNIQUE creature
 * stat blocks (SRD creatures are skipped — Phase 1 surfaces those globally), and —
 * with --write — persists each as:
 *   • canonical HomebrewContent (type='creature', sourceType='dndbeyond_import',
 *     ddbChapterId set, userId = sourcebook owner) — so the existing campaign clone
 *     path picks it up, and
 *   • a THREAT SourcebookEntity with statBlockId → that homebrew — so seeding also
 *     materializes a WorldEntity linked to the stat block.
 * No clone/seed code changes are needed; this is data production only.
 *
 * Dry-run by default (no writes). Examples:
 *   npx tsx scripts/extract-sourcebook-creatures.ts --slug bgdia --chapter app-d-creatures
 *   npx tsx scripts/extract-sourcebook-creatures.ts --slug bgdia            # all chapters, dry-run
 *   npx tsx scripts/extract-sourcebook-creatures.ts --slug bgdia --write    # persist
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { extractCreaturesFromSections, creatureToHomebrewData } from '../src/lib/ai/extract-creatures';
import type { ChapterSection } from '../src/lib/ddb-sourcebook';

type Args = { slug: string; chapter?: string; write: boolean; provider?: string; limit?: number; delayMs?: number };

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const slug = get('--slug');
  if (!slug) throw new Error('Usage: --slug <sourcebook-slug> [--chapter <slug>] [--write] [--provider claude] [--limit N]');
  return {
    slug,
    chapter: get('--chapter'),
    write: a.includes('--write'),
    provider: get('--provider'),
    limit: get('--limit') ? Number(get('--limit')) : undefined,
    delayMs: get('--delay') ? Number(get('--delay')) : undefined,
  };
}

function toSections(bodySections: unknown): ChapterSection[] {
  if (!Array.isArray(bodySections)) return [];
  return bodySections
    .map((s) => {
      const sec = s as { heading?: string | null; markdown?: string };
      return { heading: sec.heading ?? 'Section', text: typeof sec.markdown === 'string' ? sec.markdown : '' };
    })
    .filter((s) => s.text.length > 0);
}

async function main() {
  const args = parseArgs();
  console.log(`[creatures] slug=${args.slug} chapter=${args.chapter ?? '(all)'} write=${args.write} provider=${args.provider ?? '(default order)'}`);

  const sb = await prisma.ddbSourcebook.findFirst({
    where: { slug: args.slug, syncStatus: 'verified' },
    select: { id: true, title: true, userId: true },
  });
  if (!sb) throw new Error(`verified sourcebook '${args.slug}' not found`);
  if (!sb.userId) throw new Error(`sourcebook '${args.slug}' has no userId — cannot own canonical homebrew`);

  let chapters = await prisma.ddbSourcebookChapter.findMany({
    where: { sourcebookId: sb.id, ...(args.chapter ? { slug: args.chapter } : {}) },
    select: { id: true, slug: true, title: true, bodySections: true },
    orderBy: { chapterIndex: 'asc' },
  });
  if (args.limit) chapters = chapters.slice(0, args.limit);
  if (chapters.length === 0) throw new Error('no matching chapters');

  let totalCreatures = 0;
  let totalWritten = 0;

  for (const ch of chapters) {
    const sections = toSections(ch.bodySections);
    if (sections.length === 0) continue;
    const totalChars = sections.reduce((n, s) => n + s.text.length, 0);
    process.stdout.write(`\n[${ch.slug}] "${ch.title}" (${totalChars} chars) … `);

    const { creatures, chunksProcessed, chunksFailed } = await extractCreaturesFromSections(ch.slug, sections, {
      provider: args.provider,
      delayMs: args.delayMs,
    });
    console.log(`chunks=${chunksProcessed} failed=${chunksFailed} → ${creatures.length} book-unique creatures`);
    for (const c of creatures) {
      const cr = c.cr !== undefined ? ` CR ${c.cr}` : '';
      const stats = [c.ac !== undefined ? `AC ${c.ac}` : null, c.hp !== undefined ? `${c.hp} hp` : null].filter(Boolean).join(' ');
      console.log(`     • ${c.name}${cr}  ${stats}  (${c.actions.length} actions, ${c.legendaryActions.length} legendary)`);
    }
    totalCreatures += creatures.length;

    if (args.write) {
      for (const c of creatures) {
        const data = creatureToHomebrewData(c) as Prisma.InputJsonValue;
        // Idempotent canonical creature homebrew on this chapter.
        const existing = await prisma.homebrewContent.findFirst({
          where: { userId: sb.userId, ddbChapterId: ch.id, type: 'creature', name: c.name },
          select: { id: true },
        });
        let homebrewId: string;
        if (existing) {
          await prisma.homebrewContent.update({ where: { id: existing.id }, data: { data } });
          homebrewId = existing.id;
        } else {
          const created = await prisma.homebrewContent.create({
            data: {
              userId: sb.userId,
              type: 'creature',
              name: c.name,
              data,
              images: [],
              tags: [args.slug, c.type ?? 'creature'].filter(Boolean),
              searchText: `${c.name} ${c.type ?? ''} ${sb.title}`.trim(),
              sourceType: 'dndbeyond_import',
              ddbChapterId: ch.id,
            },
            select: { id: true },
          });
          homebrewId = created.id;
        }

        // THREAT entity linked to the stat block.
        await prisma.sourcebookEntity.upsert({
          where: { sourcebookId_type_name: { sourcebookId: sb.id, type: 'THREAT', name: c.name } },
          create: {
            sourcebookId: sb.id,
            chapterId: ch.id,
            type: 'THREAT',
            name: c.name,
            description: (c.actions[0]?.desc ?? '').slice(0, 280),
            properties: { cr: c.cr ?? null, creatureType: c.type ?? null } as Prisma.InputJsonValue,
            sourceType: 'creature_extraction',
            confidence: 1,
            statBlockId: homebrewId,
          },
          update: { chapterId: ch.id, statBlockId: homebrewId },
        });
        totalWritten++;
      }
    }
  }

  console.log(`\n=== ${args.slug}: ${totalCreatures} book-unique creatures found${args.write ? `, ${totalWritten} written (THREAT + creature homebrew)` : ' (dry-run — no writes)'} ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
