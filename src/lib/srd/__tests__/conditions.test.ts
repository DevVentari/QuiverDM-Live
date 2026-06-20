import { describe, it, expect } from 'vitest';
import {
  ALL_CONDITIONS,
  CONDITION_NAMES,
  getConditionBySlug,
  searchConditions,
} from '../conditions';

// The canonical 5e condition set the combat pickers used as a hard-coded list,
// in display order. CONDITION_NAMES must remain the single source of truth.
const LEGACY_COMBAT_LIST = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled',
  'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
  'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

describe('srd/conditions', () => {
  it('defines all 15 core 5e conditions', () => {
    expect(ALL_CONDITIONS).toHaveLength(15);
  });

  it('exposes CONDITION_NAMES matching the legacy combat picker list and order', () => {
    expect(CONDITION_NAMES).toEqual(LEGACY_COMBAT_LIST);
  });

  it('every condition has a non-empty slug, name, and description', () => {
    for (const c of ALL_CONDITIONS) {
      expect(c.slug).toMatch(/^[a-z][a-z-]*$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(20);
    }
  });

  it('getConditionBySlug returns a known condition and null for misses', () => {
    const prone = getConditionBySlug('prone');
    expect(prone?.name).toBe('Prone');
    expect(prone?.description.toLowerCase()).toContain('disadvantage');
    expect(getConditionBySlug('nonexistent')).toBeNull();
  });

  it('exhaustion documents its level table', () => {
    const ex = getConditionBySlug('exhaustion');
    expect(ex?.description.toLowerCase()).toContain('level');
  });

  it('searchConditions matches by name fragment, case-insensitive', () => {
    const hits = searchConditions('FRIGHT');
    expect(hits.map((c) => c.name)).toContain('Frightened');
    expect(searchConditions('')).toHaveLength(15);
  });
});
