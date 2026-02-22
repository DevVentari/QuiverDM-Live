/**
 * Fetch SRD monsters from Open5e API and save to src/data/srd-monsters.json
 * Run with: npx tsx scripts/fetch-srd-monsters.ts
 *
 * Data is Creative Commons / OGL — safe to bundle.
 */

import * as fs from 'fs';
import * as path from 'path';

interface Open5eMonster {
  slug: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment?: string;
  armor_class: number;
  armor_desc?: string;
  hit_points: number;
  hit_dice: string;
  speed: Record<string, number | string>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  strength_save?: number;
  dexterity_save?: number;
  constitution_save?: number;
  intelligence_save?: number;
  wisdom_save?: number;
  charisma_save?: number;
  perception?: number;
  skills?: Record<string, number>;
  damage_vulnerabilities?: string;
  damage_resistances?: string;
  damage_immunities?: string;
  condition_immunities?: string;
  senses?: string;
  languages?: string;
  challenge_rating: string;
  cr: number;
  xp: number;
  special_abilities?: Array<{ name: string; desc: string }>;
  actions?: Array<{ name: string; desc: string; attack_bonus?: number; damage_dice?: string }>;
  reactions?: Array<{ name: string; desc: string }>;
  legendary_desc?: string;
  legendary_actions?: Array<{ name: string; desc: string }>;
  document__slug: string;
}

interface Open5eResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Open5eMonster[];
}

async function fetchAllMonsters(): Promise<Open5eMonster[]> {
  const monsters: Open5eMonster[] = [];
  let url: string | null =
    'https://api.open5e.com/v1/monsters/?limit=400&document__slug__in=wotc-srd';

  while (url) {
    console.log(`Fetching: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data: Open5eResponse = await res.json();
    monsters.push(...data.results);
    url = data.next;
    console.log(`  Got ${data.results.length} monsters (total so far: ${monsters.length})`);
  }

  return monsters;
}

function normalizeMonster(m: Open5eMonster) {
  return {
    slug: m.slug,
    name: m.name,
    size: m.size,
    type: m.type,
    subtype: m.subtype ?? '',
    alignment: m.alignment ?? 'unaligned',
    armorClass: m.armor_class,
    armorDesc: m.armor_desc ?? '',
    hitPoints: m.hit_points,
    hitDice: m.hit_dice,
    speed: m.speed,
    abilityScores: {
      str: m.strength,
      dex: m.dexterity,
      con: m.constitution,
      int: m.intelligence,
      wis: m.wisdom,
      cha: m.charisma,
    },
    savingThrows: {
      str: m.strength_save ?? null,
      dex: m.dexterity_save ?? null,
      con: m.constitution_save ?? null,
      int: m.intelligence_save ?? null,
      wis: m.wisdom_save ?? null,
      cha: m.charisma_save ?? null,
    },
    skills: m.skills ?? {},
    damageVulnerabilities: m.damage_vulnerabilities ?? '',
    damageResistances: m.damage_resistances ?? '',
    damageImmunities: m.damage_immunities ?? '',
    conditionImmunities: m.condition_immunities ?? '',
    senses: m.senses ?? '',
    languages: m.languages ?? '',
    challengeRating: m.challenge_rating,
    cr: m.cr,
    xp: m.xp,
    traits: (m.special_abilities ?? []).map((a) => ({ name: a.name, desc: a.desc })),
    actions: (m.actions ?? []).map((a) => ({
      name: a.name,
      desc: a.desc,
      attackBonus: a.attack_bonus,
      damageDice: a.damage_dice,
    })),
    reactions: (m.reactions ?? []).map((a) => ({ name: a.name, desc: a.desc })),
    legendaryDesc: m.legendary_desc ?? '',
    legendaryActions: (m.legendary_actions ?? []).map((a) => ({ name: a.name, desc: a.desc })),
  };
}

async function main() {
  try {
    const raw = await fetchAllMonsters();
    const normalized = raw.map(normalizeMonster);

    // Sort by CR then name
    normalized.sort((a, b) => {
      if (a.cr !== b.cr) return a.cr - b.cr;
      return a.name.localeCompare(b.name);
    });

    const outputPath = path.resolve(__dirname, '../src/data/srd-monsters.json');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
    console.log(`\nSaved ${normalized.length} monsters to ${outputPath}`);
  } catch (error) {
    console.error('Failed to fetch monsters:', error);
    process.exit(1);
  }
}

main();
