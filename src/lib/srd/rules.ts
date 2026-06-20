/**
 * SRD 5e rules glossary helpers.
 * Data sourced from the System Reference Document 5.1 (CC-BY-4.0) — safe to bundle.
 *
 * A focused set of the rulings DMs reach for at the table (combat, movement,
 * resting, spellcasting, death & dying, environment). Distinct from the RAG-based
 * `rules.lookup` router, which searches uploaded PDFs; this is the bundled
 * reference the v3 Compendium "Rules" tab renders.
 */

import rulesData from '@/data/srd-rules.json';

export interface SrdRule {
  slug: string;
  name: string;
  category: string;
  description: string;
}

export const ALL_RULES: SrdRule[] = rulesData as SrdRule[];

/** Distinct categories, in first-seen order. */
export const RULE_CATEGORIES: string[] = [...new Set(ALL_RULES.map((r) => r.category))];

export function getRuleBySlug(slug: string): SrdRule | null {
  return ALL_RULES.find((r) => r.slug === slug) ?? null;
}

export function searchRules(query: string): SrdRule[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_RULES;
  return ALL_RULES.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q),
  );
}
