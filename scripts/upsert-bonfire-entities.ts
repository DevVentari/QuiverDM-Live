/**
 * Upsert agent-extracted entities into the Tales from The Bonfire Keep sourcebook.
 *
 * Reads scripts/fixtures/bonfire-keep/extracted/*.json — each an array of chapter
 * blocks { chapterSlug, npcs[], locations[], items[], encounters[] } produced by the
 * extraction subagents — and upserts SourcebookEntity rows (NPC/LOCATION/ITEM/EVENT),
 * mirroring create-master-sourcebook.ts's mapping. Idempotent on (sourcebookId,type,name).
 *
 * Run: npx tsx scripts/upsert-bonfire-entities.ts
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

const SLUG = 'tales-bonfire-keep';
const EXTRACTED_DIR = join(__dirname, 'fixtures', 'bonfire-keep', 'extracted');
const SOURCE_TYPE = 'agent_extraction';

type Npc = { name: string; role?: string; description?: string; location?: string };
type Loc = { name: string; type?: string; description?: string; notable?: string };
type Item = { name: string; type?: string; rarity?: string; description?: string };
type Enc = { name: string; description?: string; monsters?: string[]; difficulty?: string };
type ChapterBlock = { chapterSlug?: string; npcs?: Npc[]; locations?: Loc[]; items?: Item[]; encounters?: Enc[] };

type Row = {
  type: 'NPC' | 'LOCATION' | 'ITEM' | 'EVENT';
  name: string;
  description: string;
  properties: Record<string, unknown>;
  chapterSlug?: string;
};

function blockToRows(b: ChapterBlock): Row[] {
  const rows: Row[] = [];
  for (const n of b.npcs ?? []) {
    if (!n?.name?.trim()) continue;
    rows.push({
      type: 'NPC',
      name: n.name.trim(),
      description: n.description ?? '',
      properties: { ...(n.role ? { role: n.role } : {}), ...(n.location ? { location: n.location } : {}) },
      chapterSlug: b.chapterSlug,
    });
  }
  for (const l of b.locations ?? []) {
    if (!l?.name?.trim()) continue;
    rows.push({
      type: 'LOCATION',
      name: l.name.trim(),
      description: l.description ?? '',
      properties: { ...(l.type ? { locationType: l.type } : {}), ...(l.notable ? { notable: l.notable } : {}) },
      chapterSlug: b.chapterSlug,
    });
  }
  for (const it of b.items ?? []) {
    if (!it?.name?.trim()) continue;
    rows.push({
      type: 'ITEM',
      name: it.name.trim(),
      description: it.description ?? '',
      properties: { ...(it.type ? { itemType: it.type } : {}), ...(it.rarity ? { rarity: it.rarity } : {}) },
      chapterSlug: b.chapterSlug,
    });
  }
  for (const e of b.encounters ?? []) {
    if (!e?.name?.trim()) continue;
    rows.push({
      type: 'EVENT',
      name: e.name.trim(),
      description: e.description ?? '',
      properties: {
        subtype: 'encounter',
        ...(e.monsters?.length ? { monsters: e.monsters } : {}),
        ...(e.difficulty ? { difficulty: e.difficulty } : {}),
      },
      chapterSlug: b.chapterSlug,
    });
  }
  return rows;
}

async function main() {
  const sb = await prisma.ddbSourcebook.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (!sb) throw new Error(`Sourcebook ${SLUG} not found — run seed-bonfire-keep-sourcebook.ts first`);

  const chapters = await prisma.ddbSourcebookChapter.findMany({
    where: { sourcebookId: sb.id },
    select: { id: true, slug: true },
  });
  const chapterIdBySlug = new Map(chapters.map((c) => [c.slug, c.id]));

  const files = readdirSync(EXTRACTED_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) throw new Error(`No extracted JSON in ${EXTRACTED_DIR}`);

  // Collect all rows, de-duping by (type|name) keeping the longest description.
  const best = new Map<string, Row>();
  let parsedBlocks = 0;
  for (const file of files) {
    const raw = readFileSync(join(EXTRACTED_DIR, file), 'utf8');
    let blocks: ChapterBlock[];
    try {
      const json = JSON.parse(raw);
      blocks = Array.isArray(json) ? json : [json];
    } catch (e) {
      console.warn(`  [skip] ${file}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    for (const block of blocks) {
      parsedBlocks++;
      for (const row of blockToRows(block)) {
        const key = `${row.type}|${row.name.toLowerCase()}`;
        const existing = best.get(key);
        if (!existing || row.description.length > existing.description.length) best.set(key, row);
      }
    }
  }

  let written = 0;
  const counts: Record<string, number> = { NPC: 0, LOCATION: 0, ITEM: 0, EVENT: 0 };
  for (const row of best.values()) {
    const chapterId = row.chapterSlug ? chapterIdBySlug.get(row.chapterSlug) ?? null : null;
    await prisma.sourcebookEntity.upsert({
      where: { sourcebookId_type_name: { sourcebookId: sb.id, type: row.type, name: row.name } },
      create: {
        sourcebookId: sb.id,
        chapterId,
        type: row.type,
        name: row.name,
        description: row.description,
        properties: row.properties as Prisma.InputJsonValue,
        sourceType: SOURCE_TYPE,
        confidence: 1,
      },
      update: {
        description: row.description,
        properties: row.properties as Prisma.InputJsonValue,
        ...(chapterId ? { chapterId } : {}),
      },
    });
    counts[row.type]++;
    written++;
  }

  console.log(`Files: ${files.length} (${files.join(', ')})`);
  console.log(`Chapter blocks parsed: ${parsedBlocks}`);
  console.log(`Entities upserted: ${written} (${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(', ')})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
