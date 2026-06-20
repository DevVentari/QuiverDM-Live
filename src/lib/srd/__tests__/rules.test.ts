import { describe, it, expect } from 'vitest';
import { ALL_RULES, RULE_CATEGORIES, getRuleBySlug, searchRules } from '../rules';

describe('srd/rules', () => {
  it('bundles a usable glossary of common rulings', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(25);
  });

  it('every rule has slug, name, category, and a real description', () => {
    for (const r of ALL_RULES) {
      expect(r.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.category.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(20);
    }
  });

  it('slugs are unique', () => {
    const slugs = ALL_RULES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('covers the core categories DMs reach for at the table', () => {
    expect(RULE_CATEGORIES).toEqual(expect.arrayContaining(['Combat', 'Movement', 'Resting']));
  });

  it('getRuleBySlug resolves a known ruling and null for misses', () => {
    const cover = getRuleBySlug('cover');
    expect(cover?.name.toLowerCase()).toContain('cover');
    expect(getRuleBySlug('nope')).toBeNull();
  });

  it('searchRules matches name and description, case-insensitive', () => {
    const hits = searchRules('GRAPPLE');
    expect(hits.length).toBeGreaterThan(0);
    expect(searchRules('')).toHaveLength(ALL_RULES.length);
  });
});
