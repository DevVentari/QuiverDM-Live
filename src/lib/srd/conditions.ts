/**
 * SRD 5e condition data helpers.
 * Data sourced from the System Reference Document 5.1 (CC-BY-4.0) — safe to bundle.
 *
 * This is the single source of truth for the 5e condition set. The combat
 * condition pickers (DM + player) and the encounter service import CONDITION_NAMES
 * from here instead of maintaining their own hard-coded arrays.
 */

import conditionsData from '@/data/srd-conditions.json';

export interface SrdCondition {
  slug: string;
  name: string;
  description: string;
}

export const ALL_CONDITIONS: SrdCondition[] = conditionsData as SrdCondition[];

/** Display names in canonical order — the list the combat pickers render. */
export const CONDITION_NAMES: string[] = ALL_CONDITIONS.map((c) => c.name);

export function getConditionBySlug(slug: string): SrdCondition | null {
  return ALL_CONDITIONS.find((c) => c.slug === slug) ?? null;
}

export function searchConditions(query: string): SrdCondition[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_CONDITIONS;
  return ALL_CONDITIONS.filter(
    (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  );
}
