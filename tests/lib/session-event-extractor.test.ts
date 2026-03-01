import { describe, it, expect } from 'vitest';
import { parseEventExtractionResponse } from '@/lib/ai/session-event-extractor';

describe('parseEventExtractionResponse', () => {
  it('parses a damage event', () => {
    const raw = JSON.stringify([
      { eventType: 'damage', characterName: 'Aeryn', eventData: { amount: 14, damageType: 'slashing' }, confidence: 0.95 }
    ]);
    const events = parseEventExtractionResponse(raw);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('damage');
    expect(events[0].characterName).toBe('Aeryn');
    expect(events[0].confidence).toBe(0.95);
  });

  it('returns empty array on malformed JSON', () => {
    const events = parseEventExtractionResponse('not json');
    expect(events).toEqual([]);
  });

  it('filters out events with unknown eventType', () => {
    const raw = JSON.stringify([
      { eventType: 'made_up_type', characterName: 'Bram', eventData: {}, confidence: 0.9 }
    ]);
    const events = parseEventExtractionResponse(raw);
    expect(events).toEqual([]);
  });

  it('strips code fences from AI response', () => {
    const raw = '```json\n[{"eventType":"healing","characterName":"Kira","eventData":{"amount":8},"confidence":0.92}]\n```';
    const events = parseEventExtractionResponse(raw);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('healing');
  });

  it('returns empty array when input is not an array', () => {
    const raw = JSON.stringify({ eventType: 'damage' });
    const events = parseEventExtractionResponse(raw);
    expect(events).toEqual([]);
  });
});
