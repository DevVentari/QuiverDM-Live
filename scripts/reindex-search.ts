/**
 * Re-index all existing data into MeiliSearch.
 *
 * Run this once after pointing MEILI_URL at a new (or wiped) instance:
 *   npx tsx scripts/reindex-search.ts
 *
 * Safe to re-run — MeiliSearch upserts on document id.
 */

import { PrismaClient } from '@prisma/client';
import {
  initSearchIndexes,
  HOMEBREW_INDEX,
  NPC_INDEX,
} from '../src/lib/search';
import { MeiliSearch } from 'meilisearch';

const prisma = new PrismaClient();

const client = new MeiliSearch({
  host: process.env.MEILI_URL ?? 'http://localhost:7701',
  apiKey: process.env.MEILI_MASTER_KEY,
});

const BATCH_SIZE = 500;

async function reindexHomebrew(): Promise<number> {
  let indexed = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.homebrewContent.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        userId: true,
        name: true,
        type: true,
        tags: true,
        searchText: true,
        sourceType: true,
      },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) break;

    const docs = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      type: r.type,
      tags: r.tags,
      searchText: r.searchText,
      sourceType: r.sourceType,
    }));

    await client.index(HOMEBREW_INDEX).addDocuments(docs);
    indexed += docs.length;
    cursor = rows[rows.length - 1].id;
    console.log(`  homebrew: ${indexed} indexed…`);

    if (rows.length < BATCH_SIZE) break;
  }

  return indexed;
}

async function reindexNpcs(): Promise<number> {
  let indexed = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.nPC.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        campaignId: true,
        name: true,
        description: true,
        faction: true,
        tags: true,
      },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) break;

    const docs = rows.map((r) => ({
      id: r.id,
      campaignId: r.campaignId,
      name: r.name,
      description: r.description,
      faction: r.faction,
      tags: r.tags,
    }));

    await client.index(NPC_INDEX).addDocuments(docs);
    indexed += docs.length;
    cursor = rows[rows.length - 1].id;
    console.log(`  npcs: ${indexed} indexed…`);

    if (rows.length < BATCH_SIZE) break;
  }

  return indexed;
}

async function main() {
  console.log(`MeiliSearch host: ${process.env.MEILI_URL ?? 'http://localhost:7701'}`);
  console.log('Configuring indexes…');
  await initSearchIndexes();

  console.log('Indexing homebrew content…');
  const homebrewCount = await reindexHomebrew();

  console.log('Indexing NPCs…');
  const npcCount = await reindexNpcs();

  console.log(`\nDone. ${homebrewCount} homebrew docs + ${npcCount} NPC docs indexed.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
