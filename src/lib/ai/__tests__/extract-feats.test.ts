import { describe, it, expect } from 'vitest';
import { FeatSchema, ChapterExtractionSchema } from '../extract-chapter-entities';

describe('FeatSchema', () => {
  it('accepts a complete feat extract', () => {
    const result = FeatSchema.parse({
      name: 'Alert',
      prerequisite: 'None',
      description: 'Always on the lookout for danger.',
      benefits: ['+5 initiative', 'Not surprised while conscious'],
    });
    expect(result.benefits).toHaveLength(2);
  });

  it('benefits defaults to empty array', () => {
    const result = FeatSchema.parse({ name: 'Tough', description: 'Your hit point maximum increases.' });
    expect(result.benefits).toEqual([]);
  });

  it('ChapterExtractionSchema includes feats array', () => {
    const result = ChapterExtractionSchema.parse({});
    expect(result.feats).toEqual([]);
  });
});
