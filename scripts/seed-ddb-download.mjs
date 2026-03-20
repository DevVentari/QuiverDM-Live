/**
 * Download D&D Beyond sourcebook content to local JSON files.
 * Inspect the output before deciding how to import into the app.
 *
 * Usage:
 *   node scripts/seed-ddb-download.mjs <sourcebook-slug> [cobalt-session]
 *
 * Examples:
 *   node scripts/seed-ddb-download.mjs veor
 *   node scripts/seed-ddb-download.mjs veor "eyJhbGci..."
 *
 * Output: scripts/ddb-seed/<slug>/
 *   toc.json              — chapter list
 *   chapters/<slug>.json  — monster links, encounter areas, prose per chapter
 *   monsters/<id>.json    — stat block data per unique monster
 *   summary.json          — counts + deduped monster/area lists
 *
 * Set DDB_COBALT_SESSION env var or pass as second arg.
 * If interrupted, re-run — already-downloaded files are skipped.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Args ─────────────────────────────────────────────────────────────────────

const slug = process.argv[2];
const cobaltSession = process.argv[3] ?? process.env.DDB_COBALT_SESSION;

if (!slug) {
  console.error('Usage: node scripts/seed-ddb-download.mjs <sourcebook-slug> [cobalt-session]');
  console.error('  e.g. node scripts/seed-ddb-download.mjs veor');
  process.exit(1);
}

if (!cobaltSession) {
  console.error('No CobaltSession. Pass as second arg or set DDB_COBALT_SESSION env var.');
  process.exit(1);
}

const OUT = path.join(__dirname, 'ddb-seed', slug);
fs.mkdirSync(path.join(OUT, 'chapters'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'monsters'), { recursive: true });

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ─── cheerio (dynamic import avoids CJS/ESM issues) ──────────────────────────

async function loadHtml(html) {
  const { load } = await import('cheerio');
  return load(html);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function exchangeCobaltForJwt(session) {
  console.log('Exchanging CobaltSession for JWT...');
  const res = await fetch('https://auth-service.dndbeyond.com/v1/cobalt-token', {
    method: 'GET',
    headers: { Cookie: `CobaltSession=${session}` },
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  if (typeof data?.token !== 'string') throw new Error('No token in auth response');
  console.log('  JWT obtained.\n');
  return data.token;
}

// ─── TOC ─────────────────────────────────────────────────────────────────────

async function fetchToc(session) {
  const tocFile = path.join(OUT, 'toc.json');
  if (fs.existsSync(tocFile)) {
    console.log('toc.json already exists — skipping fetch.');
    return JSON.parse(fs.readFileSync(tocFile, 'utf8'));
  }

  const urls = [
    `https://www.dndbeyond.com/sources/dnd/${slug}`,
    `https://www.dndbeyond.com/sources/${slug}`,
  ];

  for (const url of urls) {
    console.log(`Fetching TOC: ${url}`);
    const res = await fetch(url, { headers: { Cookie: `CobaltSession=${session}` } });
    if (!res.ok) { await delay(500); continue; }
    const html = await res.text();
    const $ = await loadHtml(html);
    const chapters = [];
    $('.compendium-toc-full-text h3 a').each((i, el) => {
      const href = $(el).attr('href') ?? '';
      const chSlug = href.split('/').pop() ?? '';
      if (chSlug && chSlug !== slug) {
        chapters.push({ slug: chSlug, title: $(el).text().trim(), chapterIndex: i });
      }
    });
    if (chapters.length > 0) {
      fs.writeFileSync(tocFile, JSON.stringify(chapters, null, 2));
      console.log(`  Found ${chapters.length} chapters. Saved toc.json.\n`);
      return chapters;
    }
    await delay(500);
  }

  throw new Error('Could not parse TOC — check the slug and session validity');
}

// ─── Chapter content ──────────────────────────────────────────────────────────

async function fetchChapter(chSlug, _jwt) {
  const outFile = path.join(OUT, 'chapters', `${chSlug}.json`);
  if (fs.existsSync(outFile)) {
    process.stdout.write(`  [skip] ${chSlug}\n`);
    return JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }

  const url = `https://www.dndbeyond.com/sources/dnd/${slug}/${chSlug}`;
  process.stdout.write(`  Fetching chapter: ${chSlug}...`);
  const res = await fetch(url, { headers: { Cookie: `CobaltSession=${cobaltSession}` } });
  if (!res.ok) {
    process.stdout.write(` FAILED (${res.status})\n`);
    return null;
  }
  const html = await res.text();
  const $ = await loadHtml(html);
  const content = $('.p-article-content');

  const monsterMap = new Map();
  content.find('a[href*="/monsters/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/\/monsters\/(\d+)-([^/?#]+)/);
    if (!m) return;
    const [, ddbId, monSlug] = m;
    if (monSlug === 'tooltip') return;
    if (!monsterMap.has(ddbId)) {
      monsterMap.set(ddbId, { ddbId, slug: monSlug, name: $(el).text().trim(), url: href });
    }
  });

  // Magic items
  const itemMap = new Map();
  content.find('a[href*="/magic-items/"], a[href*="/equipment/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/\/(magic-items|equipment)\/(\d+)-([^/?#]+)/);
    if (!m) return;
    const [, category, ddbId, itemSlug] = m;
    if (itemSlug === 'tooltip') return;
    if (!itemMap.has(ddbId)) {
      itemMap.set(ddbId, { ddbId, slug: itemSlug, name: $(el).text().trim(), category, url: href });
    }
  });

  // Spells
  const spellMap = new Map();
  content.find('a[href*="/spells/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/\/spells\/(\d+)-([^/?#]+)/);
    if (!m) return;
    const [, ddbId, spellSlug] = m;
    if (spellSlug === 'tooltip') return;
    if (!spellMap.has(ddbId)) {
      spellMap.set(ddbId, { ddbId, slug: spellSlug, name: $(el).text().trim(), url: href });
    }
  });

  // Named NPCs (character links)
  const npcMap = new Map();
  content.find('a[href*="/characters/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/\/characters\/([^/?#]+)/);
    if (!m) return;
    const key = m[1];
    if (!npcMap.has(key)) {
      npcMap.set(key, { slug: key, name: $(el).text().trim(), url: href });
    }
  });

  // H3 sub-locations (in addition to H2 encounter areas)
  const subLocations = [];
  content.find('h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text) subLocations.push(text);
  });

  const encounterAreas = [];
  content.find('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) encounterAreas.push(text);
  });

  const prose = content.text().replace(/\s+/g, ' ').trim();
  const contentHash = crypto.createHash('sha256').update(prose).digest('hex');

  // Collect all images in the chapter (prefer compendium-images CDN for art)
  const imageUrls = [];
  const seenImgUrls = new Set();
  content.find('img').each((_, el) => {
    const src = $(el).attr('src') ?? $(el).attr('data-src') ?? '';
    if (!src || src.includes('stat-block-header-bar') || src.includes('svg')) return;
    if (!seenImgUrls.has(src)) { seenImgUrls.add(src); imageUrls.push(src); }
  });

  const result = {
    slug: chSlug,
    monsterLinks: Array.from(monsterMap.values()),
    itemLinks: Array.from(itemMap.values()),
    spellLinks: Array.from(spellMap.values()),
    npcLinks: Array.from(npcMap.values()),
    encounterAreas,
    subLocations,
    imageUrls,
    prose,
    proseLength: prose.length,
    contentHash,
  };

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  process.stdout.write(` OK (${monsterMap.size} monsters, ${encounterAreas.length} areas)\n`);
  return result;
}

// ─── Monster stat blocks ──────────────────────────────────────────────────────

async function fetchMonster(ddbId, monSlug, jwt) {
  const outFile = path.join(OUT, 'monsters', `${ddbId}.json`);
  if (fs.existsSync(outFile)) return JSON.parse(fs.readFileSync(outFile, 'utf8'));

  const url = `https://www.dndbeyond.com/monsters/${ddbId}-${monSlug}`;
  process.stdout.write(`  Fetching monster ${ddbId} (${monSlug})...`);
  const res = await fetch(url, { headers: { Cookie: `CobaltSession=${cobaltSession}` } });
  if (!res.ok) { process.stdout.write(` FAILED (${res.status})\n`); return null; }
  const html = await res.text();
  const $ = await loadHtml(html);

  const name = $('.mon-stat-block__name-link, .mon-stat-block__name').first().text().trim();
  if (!name) { process.stdout.write(` no stat block found\n`); return null; }

  // Image — first thumbnail on page (1000x1000 variant)
  const imageUrl = $('img.monster-image').first().attr('src') ?? null;

  // Flavor text / lore description
  const flavorText = $('.mon-details__description-block-content').first().text().replace(/\s+/g, ' ').trim() || undefined;

  const meta = $('.mon-stat-block__meta').first().text().trim();
  const lastComma = meta.lastIndexOf(',');
  const type = lastComma >= 0 ? meta.slice(0, lastComma).trim() : meta;
  const alignment = lastComma >= 0 ? meta.slice(lastComma + 1).trim() : 'unaligned';

  function getAttr(label) {
    let val = '';
    $('.mon-stat-block__attribute').each((_, el) => {
      if ($(el).find('.mon-stat-block__attribute-label').text().trim() === label) {
        val = $(el).find('.mon-stat-block__attribute-data-value, .mon-stat-block__attribute-value').text().trim();
      }
    });
    return val;
  }

  function getTidbit(label) {
    let val = '';
    $('.mon-stat-block__tidbit').each((_, el) => {
      if ($(el).find('.mon-stat-block__tidbit-label').text().trim() === label) {
        val = $(el).find('.mon-stat-block__tidbit-data').text().replace(/\s+/g, ' ').trim();
      }
    });
    return val;
  }

  function getAbilityScore(stat) {
    const score = $(`.ability-block__stat--${stat} .ability-block__score`).text().trim();
    return parseInt(score, 10) || 10;
  }

  // All tidbits as a map
  const tidbits = {};
  $('.mon-stat-block__tidbit').each((_, el) => {
    const label = $(el).find('.mon-stat-block__tidbit-label').text().trim();
    const val = $(el).find('.mon-stat-block__tidbit-data').text().replace(/\s+/g, ' ').trim();
    if (label) tidbits[label] = val;
  });

  // Description blocks (Traits, Actions, Bonus Actions, Reactions, Legendary Actions, etc.)
  const descriptionBlocks = {};
  $('.mon-stat-block__description-block').each((_, el) => {
    const heading = $(el).find('.mon-stat-block__description-block-heading').text().trim();
    const content = $(el).find('.mon-stat-block__description-block-content').text().replace(/\s+/g, ' ').trim();
    if (heading) descriptionBlocks[heading] = content;
  });

  const crMatch = (tidbits['Challenge'] ?? '').match(/^([\d/]+)\s*\(([\d,]+)\s*XP\)/i);
  const result = {
    ddbId, slug: monSlug, name, type, alignment,
    imageUrl: imageUrl ?? undefined,
    flavorText,
    ac: parseInt(getAttr('Armor Class'), 10) || 10,
    acNote: $('.mon-stat-block__attribute-data-extra').first().text().replace(/\s+/g, ' ').trim() || undefined,
    hp: parseInt(getAttr('Hit Points'), 10) || 1,
    hpFormula: (() => {
      let f = '';
      $('.mon-stat-block__attribute').each((_, el) => {
        if ($(el).find('.mon-stat-block__attribute-label').text().trim() === 'Hit Points') {
          f = $(el).find('.mon-stat-block__attribute-data-extra').text().trim();
        }
      });
      return f.replace(/[()]/g, '').trim() || undefined;
    })(),
    speed: getAttr('Speed') || '30 ft.',
    str: getAbilityScore('str'),
    dex: getAbilityScore('dex'),
    con: getAbilityScore('con'),
    int: getAbilityScore('int'),
    wis: getAbilityScore('wis'),
    cha: getAbilityScore('cha'),
    savingThrows: tidbits['Saving Throws'] ?? undefined,
    skills: tidbits['Skills'] ?? undefined,
    damageVulnerabilities: tidbits['Damage Vulnerabilities'] ?? undefined,
    damageResistances: tidbits['Damage Resistances'] ?? undefined,
    damageImmunities: tidbits['Damage Immunities'] ?? undefined,
    conditionImmunities: tidbits['Condition Immunities'] ?? undefined,
    senses: tidbits['Senses'] ?? undefined,
    languages: tidbits['Languages'] ?? undefined,
    cr: crMatch?.[1] ?? '0',
    xp: parseInt((crMatch?.[2] ?? '0').replace(/,/g, ''), 10),
    proficiencyBonus: tidbits['Proficiency Bonus'] ?? undefined,
    traits: descriptionBlocks['Traits'] ?? undefined,
    actions: descriptionBlocks['Actions'] ?? undefined,
    bonusActions: descriptionBlocks['Bonus Actions'] ?? undefined,
    reactions: descriptionBlocks['Reactions'] ?? undefined,
    legendaryActions: descriptionBlocks['Legendary Actions'] ?? undefined,
    mythicActions: descriptionBlocks['Mythic Actions'] ?? undefined,
    lairActions: descriptionBlocks['Lair Actions'] ?? undefined,
    sourceUrl: url,
  };
  // Strip undefined keys
  Object.keys(result).forEach(k => result[k] === undefined && delete result[k]);

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  process.stdout.write(` OK (${name}, CR ${result.cr})\n`);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== DDB Sourcebook Downloader ===`);
  console.log(`Slug: ${slug}`);
  console.log(`Output: ${OUT}\n`);

  const jwt = await exchangeCobaltForJwt(cobaltSession);
  const chapters = await fetchToc(cobaltSession);

  // Fetch all chapters
  console.log(`\nFetching ${chapters.length} chapters:`);
  const chapterResults = [];
  for (const ch of chapters) {
    const result = await fetchChapter(ch.slug, jwt);
    if (result) chapterResults.push(result);
    await delay(600);
  }

  // Collect all unique monsters across all chapters
  const allMonsters = new Map();
  for (const ch of chapterResults) {
    for (const m of ch.monsterLinks) {
      allMonsters.set(m.ddbId, m);
    }
  }

  // Fetch monster stat blocks
  console.log(`\nFetching ${allMonsters.size} unique monsters:`);
  const monsterResults = [];
  for (const [ddbId, m] of allMonsters) {
    const result = await fetchMonster(ddbId, m.slug, jwt);
    if (result) monsterResults.push(result);
    await delay(600);
  }

  // Write summary
  const allAreas = [...new Set(chapterResults.flatMap(c => c.encounterAreas))];
  const summary = {
    slug,
    fetchedAt: new Date().toISOString(),
    chapterCount: chapterResults.length,
    uniqueMonsterCount: allMonsters.size,
    scrapedMonsterCount: monsterResults.length,
    totalEncounterAreas: allAreas.length,
    monsters: monsterResults.map(m => ({ ddbId: m.ddbId, name: m.name, cr: m.cr, type: m.type })),
    encounterAreas: allAreas,
    chaptersWithMonsters: chapterResults
      .filter(c => c.monsterLinks.length > 0)
      .map(c => ({ slug: c.slug, monsters: c.monsterLinks.map(m => m.name), areas: c.encounterAreas })),
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n=== Done ===`);
  console.log(`Chapters: ${chapterResults.length}`);
  console.log(`Monsters: ${monsterResults.length}/${allMonsters.size}`);
  console.log(`Encounter areas: ${allAreas.length}`);
  console.log(`\nReview output at: ${OUT}`);
  console.log(`Start with summary.json for an overview.`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
