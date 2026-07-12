import { describe, it, expect } from 'vitest';
import { applyMappingsToSegments } from '@/lib/recap/speaker-mapping-utils';

describe('applyMappingsToSegments', () => {
  it('remaps segment speakers via the lookup, leaving unmapped ones as-is', () => {
    const segs = [
      { start: 0, end: 10, text: 'hi', speaker: 'thechunk_' },
      { start: 10, end: 20, text: 'ho', speaker: 'ven_tari' },
      { start: 20, end: 30, text: 'unknown', speaker: 'stranger' },
    ];
    const lookup = new Map([['thechunk_', 'The DM'], ['ven_tari', 'The Beast of Snarlswood']]);
    const out = applyMappingsToSegments(segs, lookup);
    expect(out.map((s) => s.speaker)).toEqual(['The DM', 'The Beast of Snarlswood', 'stranger']);
    expect(out.map((s) => s.text)).toEqual(['hi', 'ho', 'unknown']); // text/timings untouched
  });
});
