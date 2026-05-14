import 'dotenv/config';
import { config } from 'dotenv';

config({ path: '.env.local', override: true });

import { performance } from 'perf_hooks';
import { Prisma } from '@prisma/client';
import { decrypt } from '../src/lib/encryption';
import {
  DdbAuthError,
  exchangeCobaltForJwt,
  fetchChapterContent,
  fetchSourcebookToc,
} from '../src/lib/ddb-sourcebook';
import { prisma } from '../src/lib/prisma';
import {
  dedupeByName,
  extractChapterEntities,
  mergeExtractions,
  type ChapterExtraction,
} from '../src/lib/ai/extract-chapter-entities';

type ChapterSection = { heading: string; text: string };

type CliArgs = {
  slug: string;
  url?: string;
  chapter?: string;
  skipCrawl: boolean;
  skipImages: boolean;
  dryRun: boolean;
  userEmail?: string;
};

type ChapterPlan = {
  id: string;
  slug: string;
  title: string;
  chapterIndex: number;
  parentSlug: string | null;
  bodySections: Array<{ heading: string | null; level: number; markdown: string }> | null;
};

type ImageRecord = {
  url: string;
  alt: string;
  sectionHeading: string;
  isHero: boolean;
};

type EntityCounts = {
  npcs: number;
  locations: number;
  items: number;
  encounters: number;
  spells: number;
  feats: number;
};

type ChapterRunResult = {
  chapter: ChapterPlan;
  merged: ChapterExtraction;
  counts: EntityCounts;
  providerCounts: {
    claude: EntityCounts | null;
    openai: EntityCounts | null;
  };
  imagesFound: number;
  durationMs: number;
};

const DEFAULT_SOURCE_URL = (slug: string) => `https://www.dndbeyond.com/sources/dnd/${slug}`;

function parseArgs(argv: string[]): CliArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  const slug = typeof flags.slug === 'string' ? flags.slug : positional[0];
  if (!slug) {
    console.error('Usage: npx tsx scripts/create-master-sourcebook.ts --slug <slug> [--url <url>] [--chapter <slug>] [--skip-crawl] [--skip-images] [--dry-run] [--user <email>]');
    process.exit(1);
  }

  return {
    slug,
    url: typeof flags.url === 'string' ? flags.url : undefined,
    chapter: typeof flags.chapter === 'string' ? flags.chapter : undefined,
    skipCrawl: flags['skip-crawl'] === true,
    skipImages: flags['skip-images'] === true,
    dryRun: flags['dry-run'] === true,
    userEmail: typeof flags.user === 'string' ? flags.user : undefined,
  };
}

function inferImageKind(url: string, alt?: string, section?: string): 'portrait' | 'map' | 'scene' | 'generic' {
  const haystack = `${url} ${alt ?? ''} ${section ?? ''}`.toLowerCase();
  if (/\b(map|floor.?plan|tactical)\b/.test(haystack)) return 'map';
  if (/\b(portrait|character|headshot)\b/.test(haystack)) return 'portrait';
  if (/\b(cover|splash|landscape|scene|spread)\b/.test(haystack)) return 'scene';
  return 'generic';
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function toChapterSections(bodySections: Array<{ heading: string | null; level: number; markdown: string }>): ChapterSection[] {
  return bodySections
    .map((section) => ({
      heading: section.heading?.trim() || '(intro)',
      text: section.markdown ?? '',
    }))
    .filter((section) => section.text.trim().length > 0);
}

async function resolveUserId(args: CliArgs): Promise<string> {
  if (args.userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: args.userEmail },
      select: { id: true },
    });
    if (!user) throw new Error(`No user found for email ${args.userEmail}`);
    return user.id;
  }

  if (process.env.DDB_USER_ID) return process.env.DDB_USER_ID;

  const settings = await prisma.userSettings.findFirst({
    where: { dndBeyondCobaltCookie: { not: null } },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  });
  if (settings?.userId) return settings.userId;

  throw new Error('Unable to resolve a user. Pass --user <email> or set DDB_USER_ID.');
}

async function resolveCobaltSession(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { dndBeyondCobaltCookie: true },
  });
  if (settings?.dndBeyondCobaltCookie) {
    const raw = decrypt(settings.dndBeyondCobaltCookie);
    if (raw) return raw;
  }

  const envSession = process.env.DDB_COBALT_SESSION;
  if (envSession) return envSession;

  throw new Error(`No CobaltSession available for user ${userId}`);
}

async function resolveSourcebook(args: CliArgs): Promise<{
  sourcebook: { id: string; userId: string; slug: string; title: string; entitlementId: string; syncStatus: string };
  sourceUrl: string;
  createdStub: boolean;
}> {
  const existing = await prisma.ddbSourcebook.findFirst({
    where: { slug: args.slug },
    select: {
      id: true,
      userId: true,
      slug: true,
      title: true,
      entitlementId: true,
      syncStatus: true,
    },
  });

  if (existing) {
    const entitlement = await prisma.ddbEntitlement.findUnique({
      where: { id: existing.entitlementId },
      select: { sourceUrl: true },
    });
    const sourceUrl = args.url ?? entitlement?.sourceUrl ?? DEFAULT_SOURCE_URL(args.slug);
    if (!args.dryRun) {
      await prisma.ddbSourcebook.update({
        where: { id: existing.id },
        data: { syncStatus: 'importing', lastSyncError: null },
      });
      if (args.url && entitlement && entitlement.sourceUrl !== args.url) {
        await prisma.ddbEntitlement.update({
          where: { id: existing.entitlementId },
          data: { sourceUrl: args.url },
        });
      }
    }
    return { sourcebook: existing, sourceUrl, createdStub: false };
  }

  const userId = await resolveUserId(args);
  const sourceUrl = args.url ?? DEFAULT_SOURCE_URL(args.slug);

  if (!args.dryRun) {
    const entitlement = await prisma.ddbEntitlement.upsert({
      where: { userId_slug: { userId, slug: args.slug } },
      create: {
        userId,
        slug: args.slug,
        title: args.slug,
        accessType: 'owned',
        sourceUrl,
      },
      update: {
        sourceUrl,
      },
    });

    const created = await prisma.ddbSourcebook.create({
      data: {
        userId,
        entitlementId: entitlement.id,
        slug: args.slug,
        title: args.slug,
        campaignIds: [],
        syncStatus: 'importing',
        lastSyncedAt: new Date(),
      },
    });

    return {
      sourcebook: {
        id: created.id,
        userId: created.userId,
        slug: created.slug,
        title: created.title,
        entitlementId: created.entitlementId,
        syncStatus: created.syncStatus,
      },
      sourceUrl,
      createdStub: true,
    };
  }

  return {
    sourcebook: {
      id: 'dry-run-sourcebook',
      userId,
      slug: args.slug,
      title: args.slug,
      entitlementId: 'dry-run-entitlement',
      syncStatus: 'importing',
    },
    sourceUrl,
    createdStub: true,
  };
}

async function resolveCobaltJwt(userId: string): Promise<string> {
  const raw = await resolveCobaltSession(userId);
  try {
    return await exchangeCobaltForJwt(raw);
  } catch (error) {
    if (error instanceof DdbAuthError) {
      throw new Error('CobaltSession invalid or expired. Refresh the stored cookie and try again.');
    }
    throw error;
  }
}

async function saveChapterImages(
  sourcebookId: string,
  chapterId: string,
  images: ImageRecord[],
  savedImages: ImageRecord[],
): Promise<number> {
  let saved = 0;
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    await prisma.sourcebookChapterImage.upsert({
      where: {
        sourcebookId_chapterId_url: {
          sourcebookId,
          chapterId,
          url: image.url,
        },
      },
      create: {
        sourcebookId,
        chapterId,
        url: image.url,
        alt: image.alt || null,
        sectionHeading: image.sectionHeading || null,
        isHero: image.isHero,
        position: i,
        kind: inferImageKind(image.url, image.alt, image.sectionHeading),
      },
      update: {
        alt: image.alt || null,
        sectionHeading: image.sectionHeading || null,
        isHero: image.isHero,
        position: i,
        kind: inferImageKind(image.url, image.alt, image.sectionHeading),
      },
    });
    savedImages.push(image);
    saved++;
  }
  return saved;
}

function buildCounts(extraction: ChapterExtraction) {
  return {
    npcs: extraction.npcs.length,
    locations: extraction.locations.length,
    items: extraction.items.length,
    encounters: extraction.encounters.length,
    spells: extraction.spells.length,
    feats: extraction.feats.length,
  };
}

function formatCounts(counts: ReturnType<typeof buildCounts>): string {
  return `${counts.npcs} NPC, ${counts.locations} LOCATION, ${counts.items} ITEM, ${counts.encounters} ENCOUNTER, ${counts.spells} SPELL, ${counts.feats} FEAT`;
}

async function upsertSourcebookEntities(
  sourcebookId: string,
  chapterId: string,
  entities: {
    npcs: ChapterExtraction['npcs'];
    locations: ChapterExtraction['locations'];
    items: ChapterExtraction['items'];
    encounters: ChapterExtraction['encounters'];
    spells: ChapterExtraction['spells'];
    feats: ChapterExtraction['feats'];
  },
): Promise<number> {
  let total = 0;

  const rows: Array<{
    type: 'NPC' | 'LOCATION' | 'ITEM' | 'ENCOUNTER' | 'SPELL' | 'FEAT';
    name: string;
    description: string;
    properties: Record<string, unknown>;
  }> = [
    ...entities.npcs.map((npc) => ({
      type: 'NPC' as const,
      name: npc.name,
      description: npc.description,
      properties: {
        ...(npc.role ? { role: npc.role } : {}),
        ...(npc.location ? { location: npc.location } : {}),
      },
    })),
    ...entities.locations.map((location) => ({
      type: 'LOCATION' as const,
      name: location.name,
      description: location.description,
      properties: {
        ...(location.type ? { locationType: location.type } : {}),
        ...(location.notable ? { notable: location.notable } : {}),
      },
    })),
    ...entities.items.map((item) => ({
      type: 'ITEM' as const,
      name: item.name,
      description: item.description,
      properties: {
        ...(item.type ? { itemType: item.type } : {}),
        ...(item.rarity ? { rarity: item.rarity } : {}),
      },
    })),
    ...entities.encounters.map((encounter) => ({
      type: 'ENCOUNTER' as const,
      name: encounter.name,
      description: encounter.description,
      properties: {
        ...(encounter.monsters?.length ? { monsters: encounter.monsters } : {}),
        ...(encounter.difficulty ? { difficulty: encounter.difficulty } : {}),
      },
    })),
    ...entities.spells.map((spell) => ({
      type: 'SPELL' as const,
      name: spell.name,
      description: spell.description,
      properties: {
        level: spell.level,
        school: spell.school,
        castingTime: spell.castingTime,
        range: spell.range,
        components: spell.components,
        duration: spell.duration,
        ...(spell.higherLevels ? { higherLevels: spell.higherLevels } : {}),
        ...(spell.classes?.length ? { classes: spell.classes } : {}),
      },
    })),
    ...entities.feats.map((feat) => ({
      type: 'FEAT' as const,
      name: feat.name,
      description: feat.description,
      properties: {
        ...(feat.prerequisite ? { prerequisite: feat.prerequisite } : {}),
        ...(feat.benefits?.length ? { benefits: feat.benefits } : {}),
      },
    })),
  ];

  for (const row of rows) {
    await prisma.sourcebookEntity.upsert({
      where: {
        sourcebookId_type_name: {
          sourcebookId,
          type: row.type,
          name: row.name,
        },
      },
      create: {
        sourcebookId,
        chapterId,
        type: row.type,
        name: row.name,
        description: row.description,
        properties: row.properties as Prisma.InputJsonValue,
        sourceType: 'dndbeyond_import',
        confidence: 1,
      },
      update: {
        chapterId,
        description: row.description,
        properties: row.properties as Prisma.InputJsonValue,
      },
    });
    total++;
  }

  return total;
}

function countImageKinds(images: ImageRecord[]): Record<'map' | 'portrait' | 'scene' | 'generic', number> {
  const counts = { map: 0, portrait: 0, scene: 0, generic: 0 };
  for (const image of images) {
    counts[inferImageKind(image.url, image.alt, image.sectionHeading)]++;
  }
  return counts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = performance.now();

  const { sourcebook, sourceUrl, createdStub } = await resolveSourcebook(args);
  console.log(`[master-sourcebook] slug=${args.slug} sourceUrl=${sourceUrl} dryRun=${args.dryRun} skipCrawl=${args.skipCrawl}`);
  const cobaltSession = args.skipCrawl ? null : await resolveCobaltSession(sourcebook.userId);
  const cobaltJwt = args.skipCrawl ? null : await resolveCobaltJwt(sourcebook.userId);

  let plannedChapters: ChapterPlan[] = [];
  if (args.skipCrawl) {
    const rows = await prisma.ddbSourcebookChapter.findMany({
      where: { sourcebookId: sourcebook.id },
      orderBy: { chapterIndex: 'asc' },
    });
    plannedChapters = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      chapterIndex: row.chapterIndex,
      parentSlug: row.parentSlug,
      bodySections: (row.bodySections as ChapterPlan['bodySections']) ?? null,
    }));
  } else {
    const toc = await fetchSourcebookToc(args.slug, cobaltSession as string);
    if (toc.length === 0) {
      throw new Error(`No chapters found for sourcebook ${args.slug}`);
    }

    plannedChapters = args.dryRun
      ? toc.map((chapter, index) => ({
          id: `dry-${args.slug}-${chapter.slug}`,
          slug: chapter.slug,
          title: chapter.title,
          chapterIndex: chapter.chapterIndex ?? index,
          parentSlug: chapter.parentSlug ?? null,
          bodySections: null,
        }))
      : await Promise.all(
          toc.map(async (chapter, index) => {
            const row = await prisma.ddbSourcebookChapter.upsert({
              where: {
                sourcebookId_slug: {
                  sourcebookId: sourcebook.id,
                  slug: chapter.slug,
                },
              },
              create: {
                sourcebookId: sourcebook.id,
                slug: chapter.slug,
                title: chapter.title,
                chapterIndex: chapter.chapterIndex ?? index,
                parentSlug: chapter.parentSlug ?? null,
              },
              update: {
                title: chapter.title,
                chapterIndex: chapter.chapterIndex ?? index,
                parentSlug: chapter.parentSlug ?? null,
              },
            });
            return {
              id: row.id,
              slug: row.slug,
              title: row.title,
              chapterIndex: row.chapterIndex,
              parentSlug: row.parentSlug,
              bodySections: (row.bodySections as ChapterPlan['bodySections']) ?? null,
            };
          }),
        );
  }

  if (args.chapter) {
    plannedChapters = plannedChapters.filter((chapter) => chapter.slug === args.chapter);
  }

  if (plannedChapters.length === 0) {
    throw new Error(args.chapter ? `Chapter ${args.chapter} was not found` : 'No chapters available to process');
  }

  const results: ChapterRunResult[] = [];
  const savedImages: ImageRecord[] = [];
  let entityWrites = 0;

  for (let index = 0; index < plannedChapters.length; index++) {
    const chapter = plannedChapters[index];
    const label = `[${String(index + 1).padStart(2, '0')}/${String(plannedChapters.length).padStart(2, '0')}] ${chapter.title}`;
    const chapterStarted = performance.now();

    try {
      const content = args.skipCrawl
        ? null
        : await fetchChapterContent(args.slug, chapter.slug, cobaltJwt as string);

      const sections = args.skipCrawl
        ? toChapterSections(chapter.bodySections ?? [])
        : (content?.sections ?? []).map((section) => ({
            heading: section.heading,
            text: section.text,
          }));

      if (sections.length === 0) {
        console.warn(`${label} skipped (no sections)`);
        continue;
      }

      if (!args.dryRun && content) {
        await prisma.ddbSourcebookChapter.update({
          where: { id: chapter.id },
          data: {
            bodySections: content.sections.map((section) => ({
              heading: section.heading === '(intro)' ? null : section.heading,
              level: section.heading === '(intro)' ? 1 : 2,
              markdown: section.text,
            })),
            bodySyncedAt: new Date(),
          },
        });
      }

      const [claudeResult, openaiResult] = await Promise.allSettled([
        extractChapterEntities(chapter.slug, sections, { provider: 'claude' }),
        extractChapterEntities(chapter.slug, sections, { provider: 'openai' }),
      ]);

      const claudeExtraction = claudeResult.status === 'fulfilled' ? claudeResult.value.merged : null;
      const openaiExtraction = openaiResult.status === 'fulfilled' ? openaiResult.value.merged : null;

      const merged = mergeExtractions([
        ...(claudeExtraction ? [claudeExtraction] : []),
        ...(openaiExtraction ? [openaiExtraction] : []),
      ]);

      const counts = buildCounts(merged);
      const providerCounts = {
        claude: claudeExtraction ? buildCounts(claudeExtraction) : null,
        openai: openaiExtraction ? buildCounts(openaiExtraction) : null,
      };

      let chapterImageCount = 0;
      if (!args.dryRun && !args.skipImages && content) {
        chapterImageCount = await saveChapterImages(
          sourcebook.id,
          chapter.id,
          content.images.map((image) => ({
            url: image.url,
            alt: image.alt,
            sectionHeading: image.sectionHeading,
            isHero: image.isHero,
          })),
          savedImages,
        );
      }

      if (!args.dryRun) {
        entityWrites += await upsertSourcebookEntities(sourcebook.id, chapter.id, {
          npcs: dedupeByName(merged.npcs),
          locations: dedupeByName(merged.locations),
          items: dedupeByName(merged.items),
          encounters: merged.encounters.filter((encounter) => encounter.name?.trim()),
          spells: dedupeByName(merged.spells),
          feats: dedupeByName(merged.feats),
        });
      }

      results.push({
        chapter,
        merged,
        counts,
        providerCounts,
        imagesFound: content?.images.length ?? 0,
        durationMs: performance.now() - chapterStarted,
      });

      const providerSummary = [
        providerCounts.claude ? `claude: ${formatCounts(providerCounts.claude)}` : 'claude: failed',
        providerCounts.openai ? `gpt4o: ${formatCounts(providerCounts.openai)}` : 'gpt4o: failed',
      ].join(', ');

      console.log(`${label} - ${formatCounts(counts)} (${providerSummary})${args.skipImages ? ' [images skipped]' : content ? `, images ${chapterImageCount}` : ''}`);
    } catch (error) {
      console.error(`${label} failed:`, error instanceof Error ? error.message : error);
    }
  }

  const allEntities = {
    npcs: dedupeByName(results.flatMap((result) => result.merged.npcs)),
    locations: dedupeByName(results.flatMap((result) => result.merged.locations)),
    items: dedupeByName(results.flatMap((result) => result.merged.items)),
    encounters: results.flatMap((result) => result.merged.encounters).filter((encounter) => encounter.name?.trim()),
    spells: dedupeByName(results.flatMap((result) => result.merged.spells)),
    feats: dedupeByName(results.flatMap((result) => result.merged.feats)),
  };

  if (!args.dryRun) {
    await prisma.ddbSourcebook.update({
      where: { id: sourcebook.id },
      data: {
        syncStatus: 'verified',
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
  }

  const totalDuration = performance.now() - started;
  const totalEntities =
    allEntities.npcs.length +
    allEntities.locations.length +
    allEntities.items.length +
    allEntities.encounters.length +
    allEntities.spells.length +
    allEntities.feats.length;
  const imageSummary = countImageKinds(savedImages);
  const totalImages = args.dryRun || args.skipImages ? 0 : savedImages.length;

  console.log('');
  console.log(`=== Master Sourcebook: ${sourcebook.title} ===`);
  console.log(`Chapters:  ${results.length}`);
  console.log(
    `Entities:  ${totalEntities} total (${allEntities.npcs.length} NPC, ${allEntities.locations.length} LOCATION, ${allEntities.items.length} ITEM, ${allEntities.encounters.length} ENCOUNTER, ${allEntities.spells.length} SPELL, ${allEntities.feats.length} FEAT)`
  );
  console.log(
    `Images:    ${totalImages} (${imageSummary.map} maps, ${imageSummary.scene} scenes, ${imageSummary.portrait} portraits, ${imageSummary.generic} generic)`
  );
  console.log(`Duration:  ${formatDuration(totalDuration)}`);
  console.log(`Status:    ${args.dryRun ? 'dry-run' : 'verified'}`);

  if (createdStub) {
    console.log(`Sourcebook row: ${args.dryRun ? '(would create)' : sourcebook.id}`);
  }

  console.log(`Entity writes: ${args.dryRun ? 0 : entityWrites}`);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
