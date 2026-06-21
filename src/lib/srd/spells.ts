/**
 * SRD 5e spell data helpers.
 * Data sourced from Open5e (Creative Commons / OGL) — safe to bundle.
 * Same provenance + pattern as src/lib/srd/monsters.ts.
 */

import spellsData from '@/data/srd-spells.json';

export interface SrdSpell {
  slug: string;
  name: string;
  /** 0 = cantrip. */
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  material: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string;
  description: string;
  higherLevel: string;
}

export const ALL_SPELLS: SrdSpell[] = spellsData as SrdSpell[];

export function getSpellBySlug(slug: string): SrdSpell | null {
  return ALL_SPELLS.find((s) => s.slug === slug) ?? null;
}

export function searchSpells(query: string): SrdSpell[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_SPELLS;
  return ALL_SPELLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.school.toLowerCase().includes(q) ||
      s.classes.toLowerCase().includes(q),
  );
}

/** Display label for a spell level: "Cantrip", "1st", "2nd"… */
export function spellLevelLabel(level: number): string {
  if (level === 0) return 'Cantrip';
  if (level === 1) return '1st';
  if (level === 2) return '2nd';
  if (level === 3) return '3rd';
  return `${level}th`;
}
