import { describe, it, expect } from 'vitest';
import { ALL_SPELLS, getSpellBySlug, searchSpells } from '../spells';

describe('srd/spells', () => {
  it('bundles the full SRD spell list', () => {
    expect(ALL_SPELLS.length).toBeGreaterThanOrEqual(300);
  });

  it('every spell has slug, name, numeric level, school, and a description', () => {
    for (const s of ALL_SPELLS) {
      expect(s.slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(typeof s.level).toBe('number');
      expect(s.level).toBeGreaterThanOrEqual(0);
      expect(s.school.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(10);
    }
  });

  it('getSpellBySlug resolves a known spell and null for misses', () => {
    const fb = getSpellBySlug('fireball');
    expect(fb?.name).toBe('Fireball');
    expect(fb?.level).toBe(3);
    expect(getSpellBySlug('nope')).toBeNull();
  });

  it('searchSpells matches by name fragment, case-insensitive', () => {
    const hits = searchSpells('FIRE');
    expect(hits.map((s) => s.name)).toContain('Fireball');
    expect(searchSpells('')).toHaveLength(ALL_SPELLS.length);
  });
});
