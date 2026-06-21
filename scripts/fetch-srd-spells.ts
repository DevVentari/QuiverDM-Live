/**
 * Fetch SRD spells from Open5e API and save to src/data/srd-spells.json
 * Run with: npx tsx scripts/fetch-srd-spells.ts
 *
 * Data is Creative Commons / OGL — safe to bundle (same provenance as srd-monsters.json).
 */

import * as fs from 'fs';
import * as path from 'path';

interface Open5eSpell {
  slug: string;
  name: string;
  desc: string;
  higher_level?: string;
  range: string;
  components: string;
  material?: string;
  ritual?: string; // "yes" | "no"
  duration: string;
  concentration?: string; // "yes" | "no"
  casting_time: string;
  level_int: number;
  school: string;
  dnd_class?: string;
}

interface Open5eResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Open5eSpell[];
}

async function fetchAll(): Promise<Open5eSpell[]> {
  const spells: Open5eSpell[] = [];
  let url: string | null =
    'https://api.open5e.com/v1/spells/?limit=300&document__slug__in=wotc-srd';
  while (url) {
    console.log(`Fetching: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data: Open5eResponse = await res.json();
    spells.push(...data.results);
    url = data.next;
    console.log(`  Got ${data.results.length} (total ${spells.length})`);
  }
  return spells;
}

function normalize(s: Open5eSpell) {
  return {
    slug: s.slug,
    name: s.name,
    level: s.level_int,
    school: s.school ?? '',
    castingTime: s.casting_time ?? '',
    range: s.range ?? '',
    components: s.components ?? '',
    material: s.material ?? '',
    duration: s.duration ?? '',
    concentration: s.concentration === 'yes',
    ritual: s.ritual === 'yes',
    classes: s.dnd_class ?? '',
    description: s.desc ?? '',
    higherLevel: s.higher_level ?? '',
  };
}

async function main() {
  const raw = await fetchAll();
  const normalized = raw.map(normalize);
  normalized.sort((a, b) => (a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name)));

  const outputPath = path.resolve(__dirname, '../src/data/srd-spells.json');
  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
  console.log(`\nSaved ${normalized.length} spells to ${outputPath}`);
}

main().catch((e) => {
  console.error('Failed to fetch spells:', e);
  process.exit(1);
});
