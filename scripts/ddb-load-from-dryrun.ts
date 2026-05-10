/**
 * Load a captured dry-run output into a real campaign via the production
 * write path. Reuses PrismaWriteSink so we exercise the same code production
 * uses, but skips the expensive parts (DDB fetch, AI extraction) — those
 * results are already on disk in docs/test-results/ddb-imports/<slug>/.
 *
 * Usage:
 *   pnpm tsx scripts/ddb-load-from-dryrun.ts <sourcebook-slug> --user <email> --campaign <id-or-slug>
 *
 * Idempotent: re-running upserts (HomebrewContent by ddbChapterId+name,
 * WorldEntity by campaignId+name, EncounterPlan by ddbChapterId+name).
 *
 * RAG chunks are re-embedded via generateEmbedding (free on Ollama, ~$0.02
 * per LMoP-sized book on OpenAI fallback). Pass --skip-rag to skip embedding.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { prisma } from '@/lib/prisma';
import { PrismaWriteSink } from '@/lib/queue/ddb-write-sink';
import type { DdbMonsterData } from '@/lib/ddb-monster-parser';

interface CliArgs {
  sourcebookSlug: string;
  userEmail: string;
  campaignRef: string;
  skipRag: boolean;
  rootDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  if (positional.length === 0 || !flags.user || !flags.campaign) {
    console.error('Usage: pnpm tsx scripts/ddb-load-from-dryrun.ts <sourcebook-slug> --user <email> --campaign <id-or-slug> [--skip-rag] [--root <dir>]');
    process.exit(1);
  }
  return {
    sourcebookSlug: positional[0],
    userEmail: flags.user as string,
    campaignRef: flags.campaign as string,
    skipRag: flags['skip-rag'] === true,
    rootDir: typeof flags.root === 'string' ? flags.root : 'docs/test-results/ddb-imports',
  };
}

async function resolveUserAndCampaign(email: string, campaignRef: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`No user with email ${email}`);
  const campaign = await prisma.campaign.findFirst({
    where: {
      OR: [{ id: campaignRef }, { slug: campaignRef }],
      members: { some: { userId: user.id, role: 'OWNER' } },
    },
    select: { id: true, name: true, slug: true },
  });
  if (!campaign) throw new Error(`No campaign matching "${campaignRef}" owned by ${email}`);
  return { userId: user.id, campaign };
}

interface ChapterArtifacts {
  dirName: string;
  chapterIndex: number;
  chapterSlug: string;
  fetched: { chapterIndex: number; chapterSlug: string; contentHash: string; proseLength: number };
  monsters: Array<{ id: string; payload: DdbMonsterData & { sourceSlug: string } }>;
  items: Array<{ name: string; itemType?: string; rarity?: string; description: string }>;
  npcs: Array<{ name: string; role?: string; description: string; location?: string }>;
  locations: Array<{ name: string; locationType?: string; description: string; notable?: string }>;
  encounters: Array<{ areaName: string; description?: string; monsters?: string[]; difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly' }>;
  ragChunks: Array<{ text: string; index: number; charLength: number }>;
}

async function readChapterArtifacts(chapterDir: string): Promise<ChapterArtifacts> {
  const dirName = path.basename(chapterDir);
  const match = dirName.match(/^(\d+)-(.+)$/);
  if (!match) throw new Error(`Bad chapter dir name: ${dirName}`);
  const chapterIndex = parseInt(match[1], 10);
  const chapterSlug = match[2];

  async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      const text = await fs.readFile(path.join(chapterDir, file), 'utf8');
      return JSON.parse(text) as T;
    } catch {
      return fallback;
    }
  }

  const fetched = await readJson(`fetched.json`, { chapterIndex, chapterSlug, contentHash: '', proseLength: 0 });
  const monsters = await readJson<ChapterArtifacts['monsters']>(`monsters.json`, []);
  const items = await readJson<ChapterArtifacts['items']>(`items.json`, []);
  const we = await readJson<{ npcs: ChapterArtifacts['npcs']; locations: ChapterArtifacts['locations'] }>(`world-entities.json`, { npcs: [], locations: [] });
  const encounters = await readJson<ChapterArtifacts['encounters']>(`encounters.json`, []);
  const ragWrapper = await readJson<{ chunks: ChapterArtifacts['ragChunks'] }>(`rag-chunks.json`, { chunks: [] });

  return {
    dirName,
    chapterIndex,
    chapterSlug,
    fetched,
    monsters,
    items,
    npcs: we.npcs,
    locations: we.locations,
    encounters,
    ragChunks: ragWrapper.chunks,
  };
}

async function readSummary(rootDir: string): Promise<{ sourcebook: { slug: string; title?: string }; chapters: Array<{ slug: string; index: number }> }> {
  const text = await fs.readFile(path.join(rootDir, 'summary.json'), 'utf8');
  const summary = JSON.parse(text);
  return {
    sourcebook: summary.sourcebook,
    chapters: summary.chapters.map((c: { slug: string; index: number }) => ({ slug: c.slug, index: c.index })),
  };
}

async function ensureSourcebook(args: { userId: string; campaignId: string; slug: string; title: string }): Promise<string> {
  // Find or create DdbEntitlement (loader-synthetic if not present from a real listEntitlements run)
  let entitlement = await prisma.ddbEntitlement.findUnique({
    where: { userId_slug: { userId: args.userId, slug: args.slug } },
  });
  if (!entitlement) {
    entitlement = await prisma.ddbEntitlement.create({
      data: {
        userId: args.userId,
        slug: args.slug,
        title: args.title,
        accessType: 'owned',
        sourceUrl: `https://www.dndbeyond.com/sources/${args.slug}`,
      },
    });
  }

  // Find or create DdbSourcebook
  const existing = await prisma.ddbSourcebook.findFirst({
    where: { userId: args.userId, slug: args.slug },
  });
  if (existing) {
    if (!existing.campaignIds.includes(args.campaignId)) {
      const updated = await prisma.ddbSourcebook.update({
        where: { id: existing.id },
        data: { campaignIds: [...existing.campaignIds, args.campaignId] },
      });
      return updated.id;
    }
    return existing.id;
  }
  const created = await prisma.ddbSourcebook.create({
    data: {
      userId: args.userId,
      entitlementId: entitlement.id,
      slug: args.slug,
      title: args.title,
      campaignIds: [args.campaignId],
    },
  });
  return created.id;
}

async function ensureChapter(args: { sourcebookId: string; slug: string; title: string; chapterIndex: number; parentSlug?: string }): Promise<string> {
  const row = await prisma.ddbSourcebookChapter.upsert({
    where: { sourcebookId_slug: { sourcebookId: args.sourcebookId, slug: args.slug } },
    create: {
      sourcebookId: args.sourcebookId,
      slug: args.slug,
      title: args.title,
      chapterIndex: args.chapterIndex,
      parentSlug: args.parentSlug ?? null,
    },
    update: {
      title: args.title,
      chapterIndex: args.chapterIndex,
      parentSlug: args.parentSlug ?? null,
    },
  });
  return row.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(args.rootDir, args.sourcebookSlug);

  console.log(`[load] sourcebook=${args.sourcebookSlug} user=${args.userEmail} campaign=${args.campaignRef}`);
  console.log(`[load] reading from ${rootDir}`);

  const { userId, campaign } = await resolveUserAndCampaign(args.userEmail, args.campaignRef);
  console.log(`[load] target campaign: ${campaign.name} (${campaign.id})`);

  const summary = await readSummary(rootDir);
  const title = summary.sourcebook.title ?? args.sourcebookSlug;
  const sourcebookId = await ensureSourcebook({ userId, campaignId: campaign.id, slug: args.sourcebookSlug, title });
  console.log(`[load] DdbSourcebook id=${sourcebookId}`);

  // Load TOC info to get parentSlug for sub-pages. Read sequentially so we can
  // know each chapter's parent. We trust the captured fetched.json + summary order.
  const chaptersDir = path.join(rootDir, 'chapters');
  const dirNames = (await fs.readdir(chaptersDir)).sort();
  const sink = new PrismaWriteSink();

  const overallStart = performance.now();
  const totals = { monsters: 0, items: 0, npcs: 0, locations: 0, encounters: 0, ragChunks: 0, ragEmbedded: 0 };

  for (const dirName of dirNames) {
    const chStart = performance.now();
    const chapterDir = path.join(chaptersDir, dirName);
    const arts = await readChapterArtifacts(chapterDir);

    // For sub-pages, we'd need to reconstruct parentSlug — for now we leave it null
    // (the dry-run summary doesn't capture parentSlug). The real coordinator sets it.
    const chapterId = await ensureChapter({
      sourcebookId,
      slug: arts.chapterSlug,
      title: arts.chapterSlug.replace(/-/g, ' '),
      chapterIndex: arts.chapterIndex,
    });

    // Monsters → HomebrewContent (creature)
    for (const m of arts.monsters) {
      await sink.upsertMonster({
        userId,
        chapterId,
        sourceSlug: args.sourcebookSlug,
        monster: m.payload,
      });
      totals.monsters++;
    }

    // Items → HomebrewContent (item)
    for (const item of arts.items) {
      await sink.upsertItem({
        userId,
        chapterId,
        sourceSlug: args.sourcebookSlug,
        name: item.name,
        itemType: item.itemType,
        rarity: item.rarity,
        description: item.description,
      });
      totals.items++;
    }

    // NPCs → WorldEntity
    for (const npc of arts.npcs) {
      await sink.upsertWorldEntity({
        campaignId: campaign.id,
        chapterId,
        type: 'NPC',
        name: npc.name,
        description: npc.description,
        role: npc.role,
        location: npc.location,
      });
      totals.npcs++;
    }

    // Locations → WorldEntity
    for (const loc of arts.locations) {
      await sink.upsertWorldEntity({
        campaignId: campaign.id,
        chapterId,
        type: 'LOCATION',
        name: loc.name,
        description: loc.description,
        locationType: loc.locationType,
        notable: loc.notable,
      });
      totals.locations++;
    }

    // Encounters → EncounterPlan
    for (const enc of arts.encounters) {
      await sink.upsertEncounter({
        campaignId: campaign.id,
        chapterId,
        chapterSlug: arts.chapterSlug,
        areaName: enc.areaName,
        description: enc.description,
        monsters: enc.monsters,
        difficulty: enc.difficulty,
      });
      totals.encounters++;
    }

    // RAG chunks → Embedding (re-embeds via generateEmbedding)
    if (!args.skipRag && arts.ragChunks.length > 0) {
      const ragResult = await sink.ingestChapterProse({
        chapterId,
        chapterSlug: arts.chapterSlug,
        sourceSlug: args.sourcebookSlug,
        campaignIds: [campaign.id],
        chunks: arts.ragChunks.map(c => ({
          text: c.text,
          index: c.index,
          charLength: c.charLength,
          estimatedTokens: Math.ceil(c.charLength / 4),
        })),
      });
      totals.ragChunks += arts.ragChunks.length;
      totals.ragEmbedded += ragResult.embedded;
    }

    // Mark chapter as synced
    await prisma.ddbSourcebookChapter.update({
      where: { id: chapterId },
      data: {
        contentHash: arts.fetched.contentHash,
        syncStatus: 'idle',
        lastSyncedAt: new Date(),
      },
    });

    const ms = performance.now() - chStart;
    console.log(`[${(arts.chapterIndex + 1).toString().padStart(2)}/${dirNames.length}] ${arts.chapterSlug.padEnd(40)} ${(ms / 1000).toFixed(1)}s | mon=${arts.monsters.length} item=${arts.items.length} npc=${arts.npcs.length} loc=${arts.locations.length} enc=${arts.encounters.length} rag=${arts.ragChunks.length}`);
  }

  await prisma.ddbSourcebook.update({
    where: { id: sourcebookId },
    data: { syncStatus: 'idle', lastSyncedAt: new Date() },
  });

  const totalSec = (performance.now() - overallStart) / 1000;
  console.log('');
  console.log(`[load] DONE in ${totalSec.toFixed(1)}s`);
  console.log(`[load] Wrote: ${totals.monsters} monsters, ${totals.items} items, ${totals.npcs} npcs, ${totals.locations} locations, ${totals.encounters} encounters, ${totals.ragEmbedded}/${totals.ragChunks} RAG chunks`);
  console.log(`[load] Campaign "${campaign.name}" is now seeded with sourcebook "${title}"`);

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('[load] fatal:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
