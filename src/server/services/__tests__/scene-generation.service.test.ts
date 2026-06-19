import { describe, it, expect } from 'vitest';
import { primaryReadAloud } from '../scene-generation.service';

describe('primaryReadAloud', () => {
  it('returns the lowest-orderIndex read_aloud body, ties by createdAt', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-02T00:00:00Z');
    const notes = [
      { type: 'tactic', body: 'T', orderIndex: 0, createdAt: t0 },
      { type: 'read_aloud', body: 'second', orderIndex: 2, createdAt: t0 },
      { type: 'read_aloud', body: 'first', orderIndex: 1, createdAt: t1 },
    ];
    expect(primaryReadAloud(notes)).toBe('first');
  });
  it('returns null when there is no read_aloud', () => {
    expect(primaryReadAloud([{ type: 'tactic', body: 'x', orderIndex: 0, createdAt: new Date(0) }])).toBeNull();
  });
});
