import { describe, it, expect } from 'vitest';
import { detectGaps, type GapCandidate } from '../gap-detector';

function cand(over: Partial<GapCandidate> & { id: string; name: string }): GapCandidate {
  return {
    type: 'NPC', status: 'active', description: 'x'.repeat(80), confidence: 1,
    statBlockId: 'sb1', relationshipCount: 2, sessionsSinceLastSeen: 0, ...over,
  };
}

describe('detectGaps', () => {
  it('flags null, empty, and short descriptions but not a long one', () => {
    expect(detectGaps([cand({ id: 'a', name: 'A', description: null })])[0].findings.some(f => f.rule === 'missing_description')).toBe(true);
    expect(detectGaps([cand({ id: 'b', name: 'B', description: '   ' })])[0].findings.some(f => f.rule === 'missing_description')).toBe(true);
    expect(detectGaps([cand({ id: 'c', name: 'C', description: 'short' })])[0].findings.some(f => f.rule === 'missing_description')).toBe(true);
    expect(detectGaps([cand({ id: 'd', name: 'D', description: 'x'.repeat(50) })])).toEqual([]);
  });

  it('flags isolated entities only when relationshipCount is 0', () => {
    expect(detectGaps([cand({ id: 'a', name: 'A', relationshipCount: 0 })])[0].findings.some(f => f.rule === 'isolated')).toBe(true);
    expect(detectGaps([cand({ id: 'b', name: 'B', relationshipCount: 1 })])).toEqual([]);
  });

  it('flags missing stat block for NPC and THREAT, not LOCATION', () => {
    expect(detectGaps([cand({ id: 'a', name: 'A', type: 'NPC', statBlockId: null })])[0].findings.some(f => f.rule === 'no_stat_block')).toBe(true);
    expect(detectGaps([cand({ id: 'b', name: 'B', type: 'THREAT', statBlockId: null })])[0].findings.some(f => f.rule === 'no_stat_block')).toBe(true);
    expect(detectGaps([cand({ id: 'c', name: 'C', type: 'LOCATION', statBlockId: null })])).toEqual([]);
    expect(detectGaps([cand({ id: 'd', name: 'D', type: 'NPC', statBlockId: 'sb' })])).toEqual([]);
  });

  it('flags low confidence below 0.6 only', () => {
    expect(detectGaps([cand({ id: 'a', name: 'A', confidence: 0.5 })])[0].findings.some(f => f.rule === 'low_confidence')).toBe(true);
    expect(detectGaps([cand({ id: 'b', name: 'B', confidence: 0.6 })])).toEqual([]);
  });

  it('flags forgotten dormant entities (>=6 sessions or never seen) but not recent or active', () => {
    expect(detectGaps([cand({ id: 'a', name: 'A', status: 'dormant', sessionsSinceLastSeen: 6 })])[0].findings.some(f => f.rule === 'forgotten')).toBe(true);
    expect(detectGaps([cand({ id: 'b', name: 'B', status: 'dormant', sessionsSinceLastSeen: null })])[0].findings.some(f => f.rule === 'forgotten')).toBe(true);
    expect(detectGaps([cand({ id: 'c', name: 'C', status: 'dormant', sessionsSinceLastSeen: 2 })])).toEqual([]);
    expect(detectGaps([cand({ id: 'd', name: 'D', status: 'active', sessionsSinceLastSeen: 99 })])).toEqual([]);
  });

  it('excludes destroyed and resolved entities entirely', () => {
    expect(detectGaps([cand({ id: 'a', name: 'A', status: 'destroyed', description: null, relationshipCount: 0 })])).toEqual([]);
    expect(detectGaps([cand({ id: 'b', name: 'B', status: 'resolved', description: null, relationshipCount: 0 })])).toEqual([]);
  });

  it('sums weights and ranks multi-rule entities above single-rule, name as tiebreaker', () => {
    const two = cand({ id: 'two', name: 'Zeta', description: null, relationshipCount: 0 });
    const one = cand({ id: 'one', name: 'Alpha', confidence: 0.1 });
    const result = detectGaps([one, two]);
    expect(result[0].id).toBe('two');
    expect(result[0].score).toBe(6);
    expect(result[1].id).toBe('one');
    expect(result[1].score).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(detectGaps([])).toEqual([]);
  });
});
