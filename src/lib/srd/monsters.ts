/**
 * SRD Monster data helpers
 * Data sourced from Open5e (Creative Commons / OGL)
 */

import monstersData from '@/data/srd-monsters.json';

export interface SrdMonsterAbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface SrdMonsterSavingThrows {
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
}

export interface SrdMonsterAction {
  name: string;
  desc: string;
  attackBonus?: number;
  damageDice?: string;
}

export interface SrdMonsterTrait {
  name: string;
  desc: string;
}

export interface SrdMonster {
  slug: string;
  name: string;
  size: string;
  type: string;
  subtype: string;
  alignment: string;
  armorClass: number;
  armorDesc: string;
  hitPoints: number;
  hitDice: string;
  speed: Record<string, number | string>;
  abilityScores: SrdMonsterAbilityScores;
  savingThrows: SrdMonsterSavingThrows;
  skills: Record<string, number>;
  damageVulnerabilities: string;
  damageResistances: string;
  damageImmunities: string;
  conditionImmunities: string;
  senses: string;
  languages: string;
  challengeRating: string;
  cr: number;
  xp: number;
  traits: SrdMonsterTrait[];
  actions: SrdMonsterAction[];
  reactions: SrdMonsterTrait[];
  legendaryDesc: string;
  legendaryActions: SrdMonsterTrait[];
}

const ALL_MONSTERS: SrdMonster[] = monstersData as unknown as SrdMonster[];

export interface MonsterFilters {
  crMin?: number;
  crMax?: number;
  type?: string;
  size?: string;
}

export function searchMonsters(query: string, filters?: MonsterFilters): SrdMonster[] {
  let results = ALL_MONSTERS;

  if (filters?.crMin !== undefined) {
    results = results.filter((m) => m.cr >= filters.crMin!);
  }
  if (filters?.crMax !== undefined) {
    results = results.filter((m) => m.cr <= filters.crMax!);
  }
  if (filters?.type) {
    const t = filters.type.toLowerCase();
    results = results.filter((m) => m.type.toLowerCase().includes(t));
  }
  if (filters?.size) {
    const s = filters.size.toLowerCase();
    results = results.filter((m) => m.size.toLowerCase() === s);
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    results = results.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.subtype.toLowerCase().includes(q)
    );
  }

  return results;
}

export function getMonsterBySlug(slug: string): SrdMonster | null {
  return ALL_MONSTERS.find((m) => m.slug === slug) ?? null;
}

export function getMonstersByCrRange(min: number, max: number): SrdMonster[] {
  return ALL_MONSTERS.filter((m) => m.cr >= min && m.cr <= max);
}

export function getAllMonsters(): SrdMonster[] {
  return ALL_MONSTERS;
}

/** Convert fractional CR string (e.g. "1/4", "1/2") to a number */
export function parseCr(cr: string): number {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

/** Format CR for display (e.g. 0.25 → "1/4") */
export function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return cr.toString();
}

/** Get unique monster types from the dataset */
export function getMonsterTypes(): string[] {
  const types = new Set(ALL_MONSTERS.map((m) => m.type));
  return Array.from(types).sort();
}
