// src/components/campaign/__tests__/forge-state.test.ts
import { describe, it, expect } from 'vitest';
import { deriveForgingState, BOOKS_WITH_TAROKKA, type ForgeInputs } from '../forge-state';

const scene = (blueprintKey: string, seededBy = 'session0') => ({ promptInput: { seededBy, blueprintKey } });

const base: ForgeInputs = { scenes: [], npcCount: 0, partyCount: 0, book: 'cos', capReached: false };

describe('deriveForgingState — sourcebook (cos) campaign', () => {
  it('expects session0 + tarokka + npcs + party (total 4) and starts all pending', () => {
    const s = deriveForgingState(base);
    expect(s.total).toBe(4);
    expect(s.ready).toBe(0);
    expect(s.surfaces).toEqual({ session0: 'pending', tarokka: 'pending', npcs: 'pending', party: 'empty' });
    expect(s.firstArtifactReady).toBe(false);
    expect(s.allSettled).toBe(false);
  });

  it('marks session0 ready when a seeded opening scene exists, and flips firstArtifactReady', () => {
    const s = deriveForgingState({ ...base, scenes: [scene('into-the-mists')] });
    expect(s.surfaces.session0).toBe('ready');
    expect(s.ready).toBe(1);
    expect(s.firstArtifactReady).toBe(true);
  });

  it('marks tarokka ready only from a tarokka-blueprint scene', () => {
    const s = deriveForgingState({ ...base, scenes: [scene('tarokka')] });
    expect(s.surfaces.tarokka).toBe('ready');
    expect(s.surfaces.session0).toBe('pending');
  });

  it('marks npcs ready when npcCount > 0 and party ready when partyCount > 0', () => {
    const s = deriveForgingState({ ...base, npcCount: 3, partyCount: 2 });
    expect(s.surfaces.npcs).toBe('ready');
    expect(s.surfaces.party).toBe('ready');
  });

  it('is allSettled when every seeded surface is ready (party is excluded from settling)', () => {
    const s = deriveForgingState({
      ...base, scenes: [scene('into-the-mists'), scene('tarokka')], npcCount: 1, partyCount: 0,
    });
    expect(s.allSettled).toBe(true);
    expect(s.surfaces.party).toBe('empty');
  });
});

describe('deriveForgingState — blank-slate campaign (no book)', () => {
  const blank: ForgeInputs = { scenes: [], npcCount: 0, partyCount: 0, book: undefined, capReached: false };
  it('expects only party (no tarokka, no npcs, session0 n/a), total 1', () => {
    const s = deriveForgingState(blank);
    expect(s.total).toBe(1);
    expect(s.surfaces).toEqual({ session0: 'n/a', tarokka: 'n/a', npcs: 'n/a', party: 'empty' });
    expect(s.allSettled).toBe(true);
  });
});

describe('deriveForgingState — non-tarokka book', () => {
  it('treats tarokka as n/a for a book not in BOOKS_WITH_TAROKKA', () => {
    expect(BOOKS_WITH_TAROKKA).toContain('cos');
    const s = deriveForgingState({ ...base, book: 'lmop' });
    expect(s.surfaces.tarokka).toBe('n/a');
    expect(s.total).toBe(3);
  });
});

describe('deriveForgingState — latency cap', () => {
  it('forces firstArtifactReady true once capReached even with no scenes', () => {
    const s = deriveForgingState({ ...base, capReached: true });
    expect(s.firstArtifactReady).toBe(true);
    expect(s.allSettled).toBe(false);
  });
});
