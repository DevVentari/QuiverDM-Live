import { describe, it, expect } from 'vitest';
import { stripHiddenContent } from '@/lib/mechanics-content';

describe('stripHiddenContent', () => {
  it('returns full content for DM viewer', () => {
    const content = { flavorText: 'You are a spy', hiddenTruth: 'You serve Asmodeus' };
    expect(stripHiddenContent('secret', content, true)).toEqual(content);
  });

  it('strips hiddenTruth for non-DM viewer', () => {
    const content = { flavorText: 'You are a spy', hiddenTruth: 'You serve Asmodeus' };
    const result = stripHiddenContent('secret', content, false) as Record<string, unknown>;
    expect(result.flavorText).toBe('You are a spy');
    expect(result.hiddenTruth).toBeUndefined();
  });

  it('passes tarot content through unchanged for non-DM (no hidden fields)', () => {
    const content = {
      cardName: 'The Tower',
      suit: 'high',
      divinationPosition: 'final-battle-location',
      interpretation: 'Castle Ravenloft',
    };
    expect(stripHiddenContent('tarot', content, false)).toEqual(content);
  });
});
