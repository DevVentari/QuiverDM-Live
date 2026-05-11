import { describe, it, expect } from 'vitest';
import { SpellSchema, ChapterExtractionSchema } from '../extract-chapter-entities';

describe('SpellSchema', () => {
  it('accepts a complete spell extract', () => {
    const result = SpellSchema.parse({
      name: 'Fireball',
      level: 3,
      school: 'evocation',
      castingTime: '1 action',
      range: '150 feet',
      components: 'V, S, M',
      duration: 'Instantaneous',
      description: 'A bright streak flashes from your pointing finger...',
      classes: ['sorcerer', 'wizard'],
    });
    expect(result.name).toBe('Fireball');
    expect(result.level).toBe(3);
  });

  it('defaults description to empty string', () => {
    const result = SpellSchema.parse({ name: 'Mage Hand', level: 0, school: 'conjuration', castingTime: '1 action', range: '30 feet', components: 'V, S', duration: '1 minute' });
    expect(result.description).toBe('');
  });

  it('ChapterExtractionSchema includes spells array', () => {
    const result = ChapterExtractionSchema.parse({});
    expect(result.spells).toEqual([]);
  });
});
