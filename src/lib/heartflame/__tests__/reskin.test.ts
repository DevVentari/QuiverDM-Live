import { describe, it, expect } from 'vitest';
import { isAcceptableReskin, reskinLine, reskinSurfaced, type LineRewriter } from '../reskin';
import type { SurfacedNudge } from '../delivery';

const ORIGINAL = 'The blade is cold. It could be otherwise.';

describe('isAcceptableReskin (guardrail)', () => {
  it('accepts a faithful, in-voice rewrite', () => {
    expect(isAcceptableReskin('The steel sleeps cold. It need not stay so.', ORIGINAL)).toBe(true);
  });

  it('rejects empty / whitespace', () => {
    expect(isAcceptableReskin('   ', ORIGINAL)).toBe(false);
  });

  it('rejects voice violations: em dash, exclamation, first-person "I"', () => {
    expect(isAcceptableReskin('The blade is cold — wake it.', ORIGINAL)).toBe(false);
    expect(isAcceptableReskin('The blade is cold!', ORIGINAL)).toBe(false);
    expect(isAcceptableReskin('I think the blade is cold.', ORIGINAL)).toBe(false);
  });

  it('rejects rambling (too long or more than two sentences)', () => {
    expect(isAcceptableReskin('A. B. C.', ORIGINAL)).toBe(false);
    expect(isAcceptableReskin('x'.repeat(300), ORIGINAL)).toBe(false);
  });
});

describe('reskinLine (fallback-safe)', () => {
  const good: LineRewriter = async () => '"The steel sleeps cold."';
  const drifting: LineRewriter = async () => 'The blade is cold — and I will wake it!';
  const throwing: LineRewriter = async () => {
    throw new Error('provider down');
  };

  it('returns the cleaned rewrite when acceptable (strips wrapping quotes)', async () => {
    expect(await reskinLine(ORIGINAL, {}, good)).toBe('The steel sleeps cold.');
  });

  it('falls back to the original when the rewrite drifts', async () => {
    expect(await reskinLine(ORIGINAL, {}, drifting)).toBe(ORIGINAL);
  });

  it('falls back to the original when the rewriter throws', async () => {
    expect(await reskinLine(ORIGINAL, {}, throwing)).toBe(ORIGINAL);
  });

  it('passes an empty line through untouched', async () => {
    expect(await reskinLine('', {}, good)).toBe('');
  });
});

describe('reskinSurfaced', () => {
  it('re-words only the line, preserving rule text + confidence + category', async () => {
    const nudge: SurfacedNudge = {
      ruleId: 'crimson-rite-available',
      actorId: 'a1',
      category: 'option-unused',
      line: ORIGINAL,
      rule: 'Activate Crimson Rite — bonus action.',
      confidence: 'hint',
    };
    const out = await reskinSurfaced(nudge, async () => 'The steel sleeps cold.');
    expect(out.line).toBe('The steel sleeps cold.');
    expect(out.rule).toBe(nudge.rule); // authoritative text untouched
    expect(out.confidence).toBe('hint');
    expect(out.category).toBe('option-unused');
  });
});
