// src/lib/sourcebook-openings/__tests__/index.test.ts
import { describe, it, expect } from 'vitest';
import { resolveOpeningConfig } from '../index';

describe('resolveOpeningConfig', () => {
  it('returns the CoS config (with tarokka) for slug "cos"', () => {
    const cfg = resolveOpeningConfig('cos');
    expect(cfg.slug).toBe('cos');
    expect(cfg.sceneBlueprints).toHaveLength(3);
    expect(cfg.tarokka).toBeDefined();
  });

  it('matches slug case-insensitively', () => {
    expect(resolveOpeningConfig('COS').sceneBlueprints).toHaveLength(3);
  });

  it('falls back to a generic single-scene config for unknown slugs', () => {
    const cfg = resolveOpeningConfig('some-homebrew-book');
    expect(cfg.slug).toBe('some-homebrew-book');
    expect(cfg.sceneBlueprints).toHaveLength(1);
    expect(cfg.tarokka).toBeUndefined();
  });
});
