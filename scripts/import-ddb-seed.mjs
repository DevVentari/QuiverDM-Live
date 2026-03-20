/**
 * Import Vecna: Eve of Ruin seed data into QuiverDM database.
 *
 * Usage:
 *   node scripts/import-ddb-seed.mjs --userId <id> [--campaignId <id>] [--dry-run]
 *
 * Imports:
 *   - Monsters → HomebrewContent (type: 'creature') owned by --userId
 *   - Chapters → HomebrewContent (type: 'location') with full prose + links
 *   - Encounter areas (H2) per chapter → EncounterPlan per --campaignId
 *   - Character dossier entries → WorldEntity (type: NPC) per --campaignId
 *
 * Runs against local DATABASE_URL by default. Pass --prod to use prod.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, 'ddb-seed', 'veor');
const SOURCE_SLUG = 'veor';
const SOURCE_NAME = 'Vecna: Eve of Ruin';

// ─── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const userId = getArg('--userId');
const campaignId = getArg('--campaignId');
const dryRun = args.includes('--dry-run');
const prodMode = args.includes('--prod');

if (!userId) {
  console.error('Usage: node scripts/import-ddb-seed.mjs --userId <id> [--campaignId <id>] [--dry-run] [--prod]');
  process.exit(1);
}

if (prodMode) {
  process.env.DATABASE_URL = process.env.QUIVERDM_DATABASE_URL_PROD;
  console.log('Using PROD database');
} else {
  process.env.DATABASE_URL = process.env.QUIVERDM_DATABASE_URL_LOCAL ?? 'postgresql://quiverdm:localdev@localhost:5433/quiverdm';
  console.log('Using LOCAL database');
}

if (dryRun) console.log('[DRY RUN] — no writes will occur\n');

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readMonsters() {
  const dir = path.join(SEED_DIR, 'monsters');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(dir, f)));
}

function readChapters() {
  const dir = path.join(SEED_DIR, 'chapters');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ ...readJson(path.join(dir, f)), _filename: f }));
}

function buildSearchText(m) {
  const parts = [m.name, m.type, m.alignment, `CR ${m.cr}`, m.flavorText ?? ''];
  if (m.traits) parts.push(m.traits);
  if (m.actions) parts.push(m.actions);
  if (m.legendaryActions) parts.push(m.legendaryActions);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function buildMonsterData(m) {
  return {
    ddbId: m.ddbId,
    slug: m.slug,
    type: m.type,
    alignment: m.alignment,
    flavorText: m.flavorText ?? null,
    ac: m.ac,
    acNote: m.acNote ?? null,
    hp: m.hp,
    hpFormula: m.hpFormula ?? null,
    speed: m.speed,
    str: m.str,
    dex: m.dex,
    con: m.con,
    int: m.int,
    wis: m.wis,
    cha: m.cha,
    savingThrows: m.savingThrows ?? null,
    skills: m.skills ?? null,
    damageVulnerabilities: m.damageVulnerabilities ?? null,
    damageResistances: m.damageResistances ?? null,
    damageImmunities: m.damageImmunities ?? null,
    conditionImmunities: m.conditionImmunities ?? null,
    senses: m.senses ?? null,
    languages: m.languages ?? null,
    cr: m.cr,
    xp: m.xp,
    proficiencyBonus: m.proficiencyBonus ?? null,
    traits: m.traits ?? null,
    actions: m.actions ?? null,
    bonusActions: m.bonusActions ?? null,
    reactions: m.reactions ?? null,
    legendaryActions: m.legendaryActions ?? null,
    mythicActions: m.mythicActions ?? null,
    lairActions: m.lairActions ?? null,
    sourceSlug: SOURCE_SLUG,
    sourceName: SOURCE_NAME,
  };
}

function crToNumber(cr) {
  if (!cr || cr === '0') return 0;
  if (cr.includes('/')) {
    const [n, d] = cr.split('/').map(Number);
    return n / d;
  }
  return Number(cr) || 0;
}

// ─── Import: Monsters → HomebrewContent ──────────────────────────────────

async function importMonsters(monsters) {
  console.log(`\nImporting ${monsters.length} monsters → HomebrewContent...`);
  let created = 0, updated = 0, skipped = 0;

  for (const m of monsters) {
    const data = buildMonsterData(m);
    const searchText = buildSearchText(m);
    const images = m.imageUrl ? [m.imageUrl] : [];

    const payload = {
      userId,
      type: 'creature',
      name: m.name,
      data,
      images,
      tags: [SOURCE_SLUG, `cr-${m.cr}`, m.type.split(' ').pop().toLowerCase()],
      searchText,
      dndBeyondId: m.ddbId,
      dndBeyondUrl: m.sourceUrl,
      ddbChapterId: SOURCE_SLUG,
      sourceType: 'dndbeyond_import',
      imageUrl: m.imageUrl ?? null,
    };

    if (dryRun) {
      console.log(`  [dry] upsert creature: ${m.name} (${m.ddbId})`);
      created++;
      continue;
    }

    const existing = await prisma.homebrewContent.findFirst({
      where: { dndBeyondId: m.ddbId, userId },
      select: { id: true },
    });

    if (existing) {
      await prisma.homebrewContent.update({
        where: { id: existing.id },
        data: payload,
      });
      updated++;
    } else {
      await prisma.homebrewContent.create({ data: payload });
      created++;
    }
  }

  console.log(`  Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

// ─── Import: Chapters → HomebrewContent (location) ───────────────────────

async function importChapterContent(chapters) {
  const skipSlugs = ['credits', 'secrets-tracker'];
  const importable = chapters.filter(c => !skipSlugs.includes(c.slug));

  console.log(`\nImporting ${importable.length} chapters → HomebrewContent (location)...`);
  let created = 0, updated = 0;

  for (const chapter of importable) {
    const ddbId = `veor-${chapter.slug}`;
    const name = chapter.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const data = {
      sourceSlug: SOURCE_SLUG,
      sourceName: SOURCE_NAME,
      chapterSlug: chapter.slug,
      prose: chapter.prose ?? '',
      proseLength: chapter.proseLength ?? 0,
      encounterAreas: chapter.encounterAreas ?? [],
      subLocations: chapter.subLocations ?? [],
      monsterLinks: chapter.monsterLinks ?? [],
      itemLinks: chapter.itemLinks ?? [],
      spellLinks: chapter.spellLinks ?? [],
      npcLinks: chapter.npcLinks ?? [],
      imageUrls: chapter.imageUrls ?? [],
      contentHash: chapter.contentHash ?? null,
    };

    const searchText = [
      name,
      SOURCE_NAME,
      (chapter.encounterAreas ?? []).join(' '),
      (chapter.subLocations ?? []).join(' '),
      (chapter.prose ?? '').slice(0, 2000),
    ].join(' ').replace(/\s+/g, ' ').trim();

    const images = (chapter.imageUrls ?? []).slice(0, 10); // cap at 10 per chapter
    const tags = [SOURCE_SLUG, 'chapter', chapter.slug];

    const payload = {
      userId,
      type: 'location',
      name: `${SOURCE_NAME}: ${name}`,
      data,
      images,
      tags,
      searchText,
      dndBeyondId: ddbId,
      dndBeyondUrl: `https://www.dndbeyond.com/sources/dnd/${SOURCE_SLUG}/${chapter.slug}`,
      ddbChapterId: ddbId,
      sourceType: 'dndbeyond_import',
      imageUrl: images[0] ?? null,
    };

    if (dryRun) {
      console.log(`  [dry] upsert location: ${payload.name} (prose: ${chapter.proseLength ?? 0} chars, ${(chapter.encounterAreas ?? []).length} areas)`);
      created++;
      continue;
    }

    const existing = await prisma.homebrewContent.findFirst({
      where: { dndBeyondId: ddbId, userId },
      select: { id: true },
    });

    if (existing) {
      await prisma.homebrewContent.update({ where: { id: existing.id }, data: payload });
      updated++;
    } else {
      await prisma.homebrewContent.create({ data: payload });
      created++;
    }
  }

  console.log(`  Created: ${created}, Updated: ${updated}`);
}

// ─── Import: Chapters → EncounterPlan ────────────────────────────────────

async function importEncounterPlans(chapters) {
  if (!campaignId) {
    console.log('\nSkipping EncounterPlan import — no --campaignId provided');
    return;
  }

  const adventureChapters = chapters.filter(c =>
    !['bestiary', 'character-dossier', 'credits', 'secrets-tracker'].includes(c.slug)
  );

  let planCount = 0;

  console.log(`\nImporting encounter plans for ${adventureChapters.length} chapters...`);

  for (const chapter of adventureChapters) {
    const areas = chapter.encounterAreas ?? [];
    // Only import H2 areas that look like actual encounter locations (not meta sections)
    const locationAreas = areas.filter(a =>
      !['Running This Chapter', 'Running the Adventure', 'Character Creation',
        "What's Next?", 'Next Steps', 'Character Advancement', 'After Neverdeath'].includes(a)
    );

    if (locationAreas.length === 0) continue;

    const chapterDdbId = `veor-${chapter.slug}`;

    for (const area of locationAreas) {
      if (dryRun) {
        console.log(`  [dry] plan: "${area}" (chapter: ${chapter.slug})`);
        planCount++;
        continue;
      }

      // Upsert by campaign + name + ddbChapterId
      const existing = await prisma.encounterPlan.findFirst({
        where: { campaignId, name: area, ddbChapterId: chapterDdbId },
        select: { id: true },
      });

      if (!existing) {
        await prisma.encounterPlan.create({
          data: {
            campaignId,
            name: area,
            sceneDescription: `${area} — ${SOURCE_NAME}, chapter: ${chapter.slug.replace(/-/g, ' ')}`,
            ddbChapterId: chapterDdbId,
            difficulty: 'medium',
          },
        });
        planCount++;
      }
    }
  }

  console.log(`  Plans created: ${planCount}`);
}

// ─── Import: Character Dossier → WorldEntity ──────────────────────────────

async function importCharacterDossier(chapters) {
  if (!campaignId) {
    console.log('\nSkipping WorldEntity import — no --campaignId provided');
    return;
  }

  const dossier = chapters.find(c => c.slug === 'character-dossier');
  if (!dossier) {
    console.log('\nNo character-dossier chapter found');
    return;
  }

  const characters = dossier.encounterAreas ?? []; // H2 headings = major characters
  console.log(`\nImporting ${characters.length} character dossier entries → WorldEntity...`);

  let created = 0, skipped = 0;

  for (const name of characters) {
    if (dryRun) {
      console.log(`  [dry] entity NPC: ${name}`);
      created++;
      continue;
    }

    try {
      await prisma.worldEntity.upsert({
        where: { campaignId_name_type: { campaignId, name, type: 'NPC' } },
        create: {
          campaignId,
          type: 'NPC',
          name,
          aliases: [],
          description: `Major character from ${SOURCE_NAME}`,
          properties: { sourcebook: SOURCE_SLUG, sourceName: SOURCE_NAME },
          sourceType: 'dndbeyond_import',
          sourceId: SOURCE_SLUG,
          ddbChapterId: 'veor-character-dossier',
          confidence: 1.0,
        },
        update: {
          sourceType: 'dndbeyond_import',
          ddbChapterId: 'veor-character-dossier',
        },
      });
      created++;
    } catch (e) {
      console.warn(`  WARN: failed to upsert ${name}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`  Created/updated: ${created}, Skipped: ${skipped}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== VEoR Seed Import ===`);
  console.log(`userId: ${userId}`);
  console.log(`campaignId: ${campaignId ?? 'none (monsters-only mode)'}`);

  const monsters = readMonsters();
  const chapters = readChapters();

  // Build index by ddbId for fast lookup
  const monsterIndex = new Map(monsters.map(m => [m.ddbId, m]));

  await importMonsters(monsters);
  await importChapterContent(chapters);
  await importEncounterPlans(chapters);
  await importCharacterDossier(chapters);

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
