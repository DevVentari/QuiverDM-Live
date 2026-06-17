import { describe, it, expect } from 'vitest';
import { mapWhisperLiveSegments, type WhisperLiveSegment } from '../local-realtime';

describe('WhisperLive segment mapping', () => {
  it('emits the trailing in-progress segment as an interim turn', () => {
    const seen = new Set<string>();
    const turns = mapWhisperLiveSegments(
      [{ start: 0, end: 1.2, text: 'the goblin lunges', completed: false }],
      seen
    );
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ text: 'the goblin lunges', isFinal: false });
    expect(seen.size).toBe(0); // interims are never recorded as finalized
  });

  it('emits a completed segment as a final turn exactly once across re-sent windows', () => {
    const seen = new Set<string>();
    const window: WhisperLiveSegment[] = [
      { start: 0, end: 1.5, text: 'roll initiative', completed: true },
      { start: 1.5, end: 2.0, text: 'I got a', completed: false },
    ];

    const first = mapWhisperLiveSegments(window, seen);
    expect(first.filter((t) => t.isFinal).map((t) => t.text)).toEqual(['roll initiative']);
    expect(first.filter((t) => !t.isFinal).map((t) => t.text)).toEqual(['I got a']);

    // WhisperLive re-sends the same window on the next update — the final must NOT repeat.
    const second = mapWhisperLiveSegments(window, seen);
    expect(second.filter((t) => t.isFinal)).toHaveLength(0);
    expect(second.filter((t) => !t.isFinal).map((t) => t.text)).toEqual(['I got a']);
  });

  it('infers final for non-last segments when `completed` is absent (older WhisperLive)', () => {
    const seen = new Set<string>();
    const turns = mapWhisperLiveSegments(
      [
        { start: 0, end: 1.0, text: 'a torch sputters' },
        { start: 1.0, end: 2.0, text: 'and then' },
      ],
      seen
    );
    expect(turns.filter((t) => t.isFinal).map((t) => t.text)).toEqual(['a torch sputters']);
    expect(turns.filter((t) => !t.isFinal).map((t) => t.text)).toEqual(['and then']);
  });

  it('skips empty/whitespace-only segments', () => {
    const seen = new Set<string>();
    const turns = mapWhisperLiveSegments(
      [
        { start: 0, end: 0.5, text: '   ', completed: true },
        { start: 0.5, end: 1.0, text: '', completed: false },
      ],
      seen
    );
    expect(turns).toHaveLength(0);
  });

  it('dedups finals by start+text so a corrected re-finalization still emits', () => {
    const seen = new Set<string>();
    // Same start, different text (server revised the segment) → treated as new final.
    mapWhisperLiveSegments([{ start: 0, end: 1, text: 'the keep', completed: true }], seen);
    const revised = mapWhisperLiveSegments(
      [{ start: 0, end: 1, text: 'the Keep felt colder', completed: true }],
      seen
    );
    expect(revised.map((t) => t.text)).toEqual(['the Keep felt colder']);
  });
});
