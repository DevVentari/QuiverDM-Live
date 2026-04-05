import { describe, it, expect } from 'vitest';
import { applyMappingsToTranscriptData } from '../../../src/lib/recap/speaker-mapping-utils';

type SpeakerEntry = { id: string; name: string; segments: number };
type TimestampEntry = { start: number; end: number; text: string; speaker: string };

const speakers: SpeakerEntry[] = [
  { id: 'S0', name: 'Speaker 0', segments: 3 },
  { id: 'S1', name: 'Speaker 1', segments: 2 },
];

const timestamps: TimestampEntry[] = [
  { start: 0, end: 1000, text: 'Hello', speaker: 'Speaker 0' },
  { start: 1500, end: 2500, text: 'World', speaker: 'Speaker 1' },
  { start: 3000, end: 4000, text: 'Again', speaker: 'Speaker 0' },
];

describe('applyMappingsToTranscriptData', () => {
  it('replaces speaker labels in both speakers and timestamps arrays', () => {
    const lookup = new Map([
      ['Speaker 0', 'Aria Dawnbringer'],
      ['Speaker 1', 'Tharyn Ashveil'],
    ]);
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].name).toBe('Aria Dawnbringer');
    expect(result.speakers[1].name).toBe('Tharyn Ashveil');
    expect(result.timestamps[0].speaker).toBe('Aria Dawnbringer');
    expect(result.timestamps[1].speaker).toBe('Tharyn Ashveil');
    expect(result.timestamps[2].speaker).toBe('Aria Dawnbringer');
  });

  it('leaves unmapped labels unchanged', () => {
    const lookup = new Map<string, string>();
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].name).toBe('Speaker 0');
    expect(result.timestamps[1].speaker).toBe('Speaker 1');
  });

  it('partially maps when only some speakers have mappings', () => {
    const lookup = new Map([['Speaker 0', 'Aria Dawnbringer']]);
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].name).toBe('Aria Dawnbringer');
    expect(result.speakers[1].name).toBe('Speaker 1');
    expect(result.timestamps[0].speaker).toBe('Aria Dawnbringer');
    expect(result.timestamps[1].speaker).toBe('Speaker 1');
  });

  it('does not mutate input arrays', () => {
    const lookup = new Map([['Speaker 0', 'Aria Dawnbringer']]);
    applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(speakers[0].name).toBe('Speaker 0');
    expect(timestamps[0].speaker).toBe('Speaker 0');
  });

  it('preserves all other fields on entries', () => {
    const lookup = new Map([['Speaker 0', 'Aria Dawnbringer']]);
    const result = applyMappingsToTranscriptData(speakers, timestamps, lookup);
    expect(result.speakers[0].id).toBe('S0');
    expect(result.speakers[0].segments).toBe(3);
    expect(result.timestamps[0].start).toBe(0);
    expect(result.timestamps[0].text).toBe('Hello');
  });
});
