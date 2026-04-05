import { describe, it, expect } from 'vitest';
import { mergeTranscripts, segmentsToText } from '@/lib/recap/transcript-merger';

describe('mergeTranscripts', () => {
  it('returns empty array for empty input', () => {
    expect(mergeTranscripts([])).toEqual([]);
    expect(mergeTranscripts([{ words: [], speakerTag: 'A' }])).toEqual([]);
  });

  it('single track produces one segment per gap', () => {
    const result = mergeTranscripts([{
      speakerTag: 'Kira',
      words: [
        { text: 'Hello', start: 0, end: 500 },
        { text: 'world', start: 600, end: 1000 },
        // gap > 500ms:
        { text: 'okay', start: 2000, end: 2400 },
      ],
    }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ speaker: 'Kira', text: 'Hello world' });
    expect(result[1]).toMatchObject({ speaker: 'Kira', text: 'okay' });
  });

  it('interleaves words from two tracks by timestamp', () => {
    const result = mergeTranscripts([
      {
        speakerTag: 'DM',
        words: [
          { text: 'You', start: 0, end: 300 },
          { text: 'enter', start: 400, end: 700 },
        ],
      },
      {
        speakerTag: 'Kira',
        words: [
          { text: 'Wait', start: 1000, end: 1300 },
        ],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ speaker: 'DM', text: 'You enter' });
    expect(result[1]).toMatchObject({ speaker: 'Kira', text: 'Wait' });
  });

  it('speaker change creates new segment even within gap', () => {
    const result = mergeTranscripts([
      { speakerTag: 'A', words: [{ text: 'hello', start: 0, end: 400 }] },
      { speakerTag: 'B', words: [{ text: 'hi', start: 450, end: 800 }] },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].speaker).toBe('A');
    expect(result[1].speaker).toBe('B');
  });
});

describe('segmentsToText', () => {
  it('formats segments as speaker: text', () => {
    const text = segmentsToText([
      { start: 0, end: 500, text: 'Hello', speaker: 'DM' },
      { start: 600, end: 900, text: 'Hi', speaker: 'Kira' },
    ]);
    expect(text).toBe('DM: Hello\n\nKira: Hi');
  });
});
