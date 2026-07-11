import { describe, it, expect } from 'vitest';
import { parseCraigFilename } from '@/lib/craig';

describe('parseCraigFilename', () => {
  it.each([
    ['1-alexdm.flac', 1, 'alexdm'],
    ['2-jules_0.flac', 2, 'jules'],
    ['03-dana_5049.wav', 3, 'dana'],
    ['craig-01-alex_dm.flac', 1, 'alex_dm'],
    ['6-Sam.ogg', 6, 'sam'],
  ])('%s → track %i / %s', (file, track, username) => {
    expect(parseCraigFilename(file)).toEqual({ trackNumber: track, username });
  });

  it('returns nulls for non-craig names', () => {
    expect(parseCraigFilename('session-recording.flac')).toEqual({ trackNumber: null, username: null });
    expect(parseCraigFilename('notes.txt')).toEqual({ trackNumber: null, username: null });
  });
});
