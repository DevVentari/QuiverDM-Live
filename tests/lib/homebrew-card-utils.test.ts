import { describe, it, expect } from 'vitest';
import {
  getRarityVars,
  getSchoolVars,
  parseBoldDescription,
  formatAbilityMod,
  normalizeRarity,
} from '@/lib/homebrew-card-utils';

describe('getRarityVars', () => {
  it('returns correct colour vars for uncommon', () => {
    const vars = getRarityVars('uncommon');
    expect(vars['--rc']).toBe('hsl(120,40%,46%)');
    expect(vars['--rb']).toBe('hsl(120,25%,12%)');
    expect(vars['--rg']).toBeUndefined();
  });

  it('returns glow var for legendary', () => {
    const vars = getRarityVars('legendary');
    expect(vars['--rc']).toBe('hsl(38,90%,58%)');
    expect(vars['--rg']).toBe('0 0 12px hsl(38 90% 50% / 0.2)');
  });

  it('returns double glow for artifact', () => {
    const vars = getRarityVars('artifact');
    expect(vars['--rg']).toContain('0 0 40px');
  });

  it('handles very-rare (hyphenated) rarity', () => {
    const vars = getRarityVars('very-rare');
    expect(vars['--rc']).toBe('hsl(270,55%,62%)');
  });
});

describe('getSchoolVars', () => {
  it('returns red for evocation', () => {
    const vars = getSchoolVars('evocation');
    expect(vars['--school-color']).toBe('hsl(0,65%,55%)');
  });

  it('returns purple for illusion', () => {
    const vars = getSchoolVars('illusion');
    expect(vars['--school-color']).toBe('hsl(260,55%,62%)');
  });
});

describe('parseBoldDescription', () => {
  it('parses plain text as single text segment', () => {
    const result = parseBoldDescription('just text');
    expect(result).toEqual([{ type: 'text', content: 'just text' }]);
  });

  it('parses **bold** into bold segment', () => {
    const result = parseBoldDescription('deals **8d6** fire damage');
    expect(result).toEqual([
      { type: 'text', content: 'deals ' },
      { type: 'bold', content: '8d6' },
      { type: 'text', content: ' fire damage' },
    ]);
  });

  it('handles multiple bold segments', () => {
    const result = parseBoldDescription('**+3** to hit, **2d6** damage');
    expect(result[0]).toEqual({ type: 'bold', content: '+3' });
    expect(result[2]).toEqual({ type: 'bold', content: '2d6' });
  });

  it('returns empty text segment for empty string', () => {
    const result = parseBoldDescription('');
    expect(result).toEqual([{ type: 'text', content: '' }]);
  });
});

describe('normalizeRarity', () => {
  it('maps "very rare" (space) to "very-rare" (hyphen)', () => {
    expect(normalizeRarity('very rare')).toBe('very-rare');
  });

  it('passes through already-hyphenated values unchanged', () => {
    expect(normalizeRarity('legendary')).toBe('legendary');
  });

  it('falls back to common for unknown values', () => {
    expect(normalizeRarity('godlike')).toBe('common');
  });

  it('trims leading/trailing whitespace before normalizing', () => {
    expect(normalizeRarity(' rare ')).toBe('rare');
  });
});

describe('formatAbilityMod', () => {
  it('formats positive modifier with + prefix', () => {
    expect(formatAbilityMod(19)).toBe('+4');
    expect(formatAbilityMod(10)).toBe('+0');
  });

  it('formats negative modifier with minus sign (U+2212)', () => {
    expect(formatAbilityMod(8)).toBe('\u22121');
    expect(formatAbilityMod(3)).toBe('\u22124');
  });

  it('calculates modifier correctly for edge cases', () => {
    expect(formatAbilityMod(1)).toBe('\u22125');
    expect(formatAbilityMod(30)).toBe('+10');
  });
});
