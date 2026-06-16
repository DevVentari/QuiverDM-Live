import { describe, it, expect } from 'vitest';
import { applyTurn, emptyTranscript, visibleTurns } from '../transcript-reducer';

describe('live transcript reducer', () => {
  it('shows a non-final turn as the interim, replacing the previous interim', () => {
    let s = emptyTranscript;
    s = applyTurn(s, { text: 'The goblin', isFinal: false });
    s = applyTurn(s, { text: 'The goblin lunges', isFinal: false });
    expect(s.finals).toHaveLength(0);
    expect(s.interim?.text).toBe('The goblin lunges');
    expect(visibleTurns(s).map((t) => t.text)).toEqual(['The goblin lunges']);
  });

  it('promotes a final turn into finals and clears the interim', () => {
    let s = emptyTranscript;
    s = applyTurn(s, { text: 'The goblin lunges', isFinal: false });
    s = applyTurn(s, { text: 'The goblin lunges at you.', isFinal: true });
    expect(s.interim).toBeNull();
    expect(s.finals.map((t) => t.text)).toEqual(['The goblin lunges at you.']);
  });

  it('accumulates multiple finals in order', () => {
    let s = emptyTranscript;
    s = applyTurn(s, { text: 'Roll initiative.', isFinal: true });
    s = applyTurn(s, { text: 'I got a nineteen.', isFinal: true, speaker: 'Mira' });
    expect(s.finals).toHaveLength(2);
    expect(visibleTurns(s).map((t) => t.text)).toEqual(['Roll initiative.', 'I got a nineteen.']);
    expect(s.finals[1].speaker).toBe('Mira');
  });

  it('ignores blank finals and trims text', () => {
    let s = emptyTranscript;
    s = applyTurn(s, { text: '  hello there  ', isFinal: false });
    expect(s.interim?.text).toBe('hello there');
    s = applyTurn(s, { text: '   ', isFinal: true });
    expect(s.finals).toHaveLength(0);
    expect(s.interim).toBeNull();
  });
});
