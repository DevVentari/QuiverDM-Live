import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, buildContentStrings } from '../../../src/lib/recap/context-extraction-utils';

describe('parseExtractionResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({
      keyEvents: ['The party entered Barovia'],
      npcsInvolved: ['Strahd'],
      decisions: ['Party decided to go to the church'],
      lootGained: ['Silver dagger'],
    });
    const result = parseExtractionResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.keyEvents).toEqual(['The party entered Barovia']);
    expect(result!.npcsInvolved).toEqual(['Strahd']);
    expect(result!.decisions).toEqual(['Party decided to go to the church']);
    expect(result!.lootGained).toEqual(['Silver dagger']);
  });

  it('strips markdown code block before parsing', () => {
    const raw = '```json\n{"keyEvents":["foo"],"npcsInvolved":[],"decisions":[],"lootGained":[]}\n```';
    const result = parseExtractionResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.keyEvents).toEqual(['foo']);
  });

  it('returns null for completely invalid JSON', () => {
    expect(parseExtractionResponse('not json at all')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseExtractionResponse('"just a string"')).toBeNull();
    expect(parseExtractionResponse('[1,2,3]')).toBeNull();
  });

  it('coerces missing fields to empty arrays', () => {
    const result = parseExtractionResponse('{}');
    expect(result).not.toBeNull();
    expect(result!.keyEvents).toEqual([]);
    expect(result!.lootGained).toEqual([]);
  });

  it('filters out non-string array entries', () => {
    const raw = JSON.stringify({ keyEvents: ['valid', 42, null, 'also valid'], npcsInvolved: [], decisions: [], lootGained: [] });
    const result = parseExtractionResponse(raw);
    expect(result!.keyEvents).toEqual(['valid', 'also valid']);
  });
});

describe('buildContentStrings', () => {
  it('flattens all four arrays into a single list', () => {
    const result = buildContentStrings({
      keyEvents: ['Event A'],
      npcsInvolved: ['NPC B'],
      decisions: ['Decision C'],
      lootGained: ['Loot D'],
    });
    expect(result).toEqual(['Event A', 'NPC B', 'Decision C', 'Loot D']);
  });

  it('truncates strings to 500 characters', () => {
    const long = 'x'.repeat(600);
    const result = buildContentStrings({ keyEvents: [long], npcsInvolved: [], decisions: [], lootGained: [] });
    expect(result[0].length).toBe(500);
  });

  it('filters out empty strings', () => {
    const result = buildContentStrings({ keyEvents: ['', '  ', 'valid'], npcsInvolved: [], decisions: [], lootGained: [] });
    expect(result).toEqual(['valid']);
  });
});
