/**
 * Import a sourcebook's creatures from the DDB monster pages its chapters link to
 * (the path CoS needs — its stat blocks aren't in the book text, only linked).
 *
 * Per chapter: parse /monsters/<id>-<slug> links → fetchMonsterData (full stat
 * block, your DDB entitlement) → map to the SAME creature blob the v3 Compendium
 * renders → write canonical `creature` HomebrewContent (dndbeyond_import,
 * ddbChapterId) + a THREAT SourcebookEntity (statBlockId). The existing seed/clone
 * path then surfaces them per campaign. SRD creatures are skipped (Phase 1 covers).
 *
 * Dry-run by default. Examples:
 *   npx tsx scripts/import-ddb-monsters.ts --slug cos                # list links + sample-fetch 3
 *   npx tsx scripts/import-ddb-monsters.ts --slug cos --write        # fetch + persist all
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { decrypt } from '../src/lib/encryption';
import {
  exchangeCobaltForJwt,
  fetchChapterContentWithCookie,
  fetchMonsterData,
  delay,
  type DdbMonsterData,
  type MonsterLink,
} from '../src/lib/ddb-sourcebook';
import { creatureToHomebrewData, isSrdCreatureName, type ExtractedCreature } from '../src/lib/ai/extract-creatures';

type Args = { slug: string; write: boolean; sampleFetch: number };
function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (f: string) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  const slug = get('--slug');
  if (!slug) throw new Error('Usage: --slug <sourcebook-slug> [--write]');
  return { slug, write: a.includes('--write'), sampleFetch: get('--sample') ? Number(get('--sample')) : 3 };
}

async function resolveCobalt(userId: string): Promise<string> {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { dndBeyondCobaltCookie: true } });
  if (s?.dndBeyondCobaltCookie) { try { return decrypt(s.dndBeyondCobaltCookie); } catch { /* env */ } }
  const env = process.env.DDB_COBALT_SESSION;
  if (!env) throw new Error('No Cobalt session (UserSettings or DDB_COBALT_SESSION)');
  return env;
}

function ddbToCreature(m: DdbMonsterData): ExtractedCreature {
  const feat = (f: { name: string; description: string }) => ({ name: f.name, desc: f.description });
  return {
    name: m.name,
    size: m.size,
    type: m.type,
    alignment: m.alignment,
    ac: m.ac,
    acNote: m.acDescription,
    hp: m.hp,
    hpDice: m.hpDice,
    speed: m.speed,
    abilities: {
      str: m.abilities.str.score, dex: m.abilities.dex.score, con: m.abilities.con.score,
      int: m.abilities.int.score, wis: m.abilities.wis.score, cha: m.abilities.cha.score,
    },
    savingThrows: m.savingThrows,
    skills: m.skills,
    damageVulnerabilities: m.damageVulnerabilities,
    damageResistances: m.damageResistances,
    damageImmunities: m.damageImmunities,
    conditionImmunities: m.conditionImmunities,
    senses: m.senses,
    languages: m.languages,
    cr: m.cr,
    xp: m.xp,
    traits: m.traits.map(feat),
    actions: [...m.actions, ...m.bonusActions].map(feat),
    reactions: m.reactions.map(feat),
    legendaryActions: m.legendaryActions.map(feat),
  };
}

async function main() {
  const args = parseArgs();
  console.log(`[ddb-monsters] slug=${args.slug} write=${args.write}`);

  const sb = await prisma.ddbSourcebook.findFirst({
    where: { slug: args.slug, syncStatus: 'verified' },
    select: { id: true, title: true, userId: true },
  });
  if (!sb?.userId) throw new Error(`verified sourcebook '${args.slug}' with userId not found`);

  const cobaltSession = await resolveCobalt(sb.userId);
  const cobaltJwt = await exchangeCobaltForJwt(cobaltSession).catch((e) => {
    throw new Error(`Cobalt→JWT exchange failed (session expired? run npm run ddb:login): ${e.message}`);
  });

  const chapters = await prisma.ddbSourcebookChapter.findMany({
    where: { sourcebookId: sb.id },
    select: { id: true, slug: true },
    orderBy: { chapterIndex: 'asc' },
  });

  // Collect monster links across chapters (dedup by ddbId; first chapter wins).
  const linkByDdbId = new Map<string, MonsterLink & { chapterId: string }>();
  for (const ch of chapters) {
    const content = await fetchChapterContentWithCookie(args.slug, ch.slug, cobaltSession);
    for (const link of content.monsterLinks) {
      if (!linkByDdbId.has(link.ddbId)) linkByDdbId.set(link.ddbId, { ...link, chapterId: ch.id });
    }
  }
  const links = [...linkByDdbId.values()].filter((l) => !isSrdCreatureName(l.name));
  const srdSkipped = linkByDdbId.size - links.length;
  console.log(`\nMonster links: ${linkByDdbId.size} total, ${srdSkipped} SRD-skipped → ${links.length} book-unique to import`);

  if (!args.write) {
    console.log('\nSample names:', links.slice(0, 30).map((l) => l.name).join(', '));
    console.log(`\n--- dry-run: sample-fetching ${Math.min(args.sampleFetch, links.length)} to validate auth/quality ---`);
    for (const l of links.slice(0, args.sampleFetch)) {
      await delay(500);
      const r = await fetchMonsterData(l.ddbId, l.slug, cobaltJwt, cobaltSession);
      if (!r.ok) { console.log(`   ✗ ${l.name}: ${r.reason}`); continue; }
      const m = r.data;
      console.log(`   ✓ ${m.name}: AC ${m.ac} HP ${m.hp} CR ${m.cr} · ${m.actions.length} actions, ${m.legendaryActions.length} legendary, ${m.traits.length} traits (via ${r.via})`);
    }
    console.log('\n(dry-run — no writes)');
    await prisma.$disconnect();
    return;
  }

  let written = 0, failed = 0;
  for (const l of links) {
    await delay(500);
    const r = await fetchMonsterData(l.ddbId, l.slug, cobaltJwt, cobaltSession);
    if (!r.ok) { failed++; console.log(`   ✗ ${l.name}: ${r.reason}`); continue; }
    const m = r.data;
    const data = creatureToHomebrewData(ddbToCreature(m)) as Prisma.InputJsonValue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId: sb.userId, ddbChapterId: l.chapterId, type: 'creature', name: m.name },
      select: { id: true },
    });
    let homebrewId: string;
    if (existing) {
      await prisma.homebrewContent.update({ where: { id: existing.id }, data: { data } });
      homebrewId = existing.id;
    } else {
      const created = await prisma.homebrewContent.create({
        data: {
          userId: sb.userId, type: 'creature', name: m.name, data,
          images: m.imageUrl ? [m.imageUrl] : [], tags: [args.slug, m.type].filter(Boolean),
          searchText: `${m.name} ${m.type} ${sb.title}`.trim(),
          sourceType: 'dndbeyond_import', ddbChapterId: l.chapterId, imageUrl: m.imageUrl,
        },
        select: { id: true },
      });
      homebrewId = created.id;
    }
    await prisma.sourcebookEntity.upsert({
      where: { sourcebookId_type_name: { sourcebookId: sb.id, type: 'THREAT', name: m.name } },
      create: {
        sourcebookId: sb.id, chapterId: l.chapterId, type: 'THREAT', name: m.name,
        description: (m.actions[0]?.description ?? m.description ?? '').slice(0, 280),
        properties: { cr: m.cr, creatureType: m.type } as Prisma.InputJsonValue,
        sourceType: 'ddb_monster_import', confidence: 1, statBlockId: homebrewId, imageUrl: m.imageUrl,
      },
      update: { chapterId: l.chapterId, statBlockId: homebrewId },
    });
    written++;
    if (written % 10 === 0) console.log(`   …${written} written`);
  }
  console.log(`\n=== ${args.slug}: ${written} creatures imported, ${failed} failed ===`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
