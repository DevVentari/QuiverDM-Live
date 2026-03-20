import { describe, it, expect } from 'vitest';
import { getCompletedSections } from '@/components/session/prep-status-card';

describe('getCompletedSections', () => {
  it('returns empty set for null input', () => {
    expect(getCompletedSections(null).size).toBe(0);
  });

  it('returns empty set for empty prepData', () => {
    const data = { characterNotes: [], strongStart: '', scenes: [], secretsAndClues: [], npcs: [], monsters: [], rewards: [], looseThreads: [] };
    expect(getCompletedSections(data).size).toBe(0);
  });

  it('marks characters complete when any note has goals', () => {
    const data = { characterNotes: [{ goals: 'find the ring', notes: '' }] };
    expect(getCompletedSections(data).has('characters')).toBe(true);
  });

  it('marks characters complete when any note has notes', () => {
    const data = { characterNotes: [{ goals: '', notes: 'hates spiders' }] };
    expect(getCompletedSections(data).has('characters')).toBe(true);
  });

  it('does NOT mark characters complete when notes array is empty', () => {
    const data = { characterNotes: [] };
    expect(getCompletedSections(data).has('characters')).toBe(false);
  });

  it('marks strong-start complete when strongStart is non-empty', () => {
    const data = { strongStart: 'Ambush on the road' };
    expect(getCompletedSections(data).has('strong-start')).toBe(true);
  });

  it('does NOT mark strong-start complete when strongStart is empty string', () => {
    const data = { strongStart: '' };
    expect(getCompletedSections(data).has('strong-start')).toBe(false);
  });

  it('marks scenes complete when scenes array is non-empty', () => {
    const data = { scenes: [{ id: '1', title: 'Market fire' }] };
    expect(getCompletedSections(data).has('scenes')).toBe(true);
  });

  it('marks all 8 sections complete for fully-filled prepData', () => {
    const data = {
      characterNotes: [{ goals: 'x', notes: '' }],
      strongStart: 'x',
      scenes: [{ id: '1', title: 'x' }],
      secretsAndClues: [{ id: '1', text: 'x' }],
      npcs: [{ name: 'x' }],
      monsters: [{ name: 'x', source: 'srd' }],
      rewards: [{ name: 'x', source: 'custom' }],
      looseThreads: [{ id: '1', text: 'x' }],
    };
    const result = getCompletedSections(data);
    expect(result.size).toBe(8);
  });
});
