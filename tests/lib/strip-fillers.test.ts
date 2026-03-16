import { describe, it, expect } from 'vitest';
import { stripFillers } from '@/lib/transcription/strip-fillers';

describe('stripFillers', () => {
  it('removes um and uh', () => {
    expect(stripFillers('we um went to the uh dungeon')).toBe('we went to the dungeon');
  });

  it('removes you know', () => {
    expect(stripFillers('it was, you know, dangerous')).toBe('it was, dangerous');
  });

  it('removes i mean', () => {
    expect(stripFillers('i mean we should go')).toBe('we should go');
  });

  it('handles repeated fillers', () => {
    expect(stripFillers('um um basically uh we went')).toBe('we went');
  });

  it('collapses double spaces', () => {
    expect(stripFillers('the  dungeon')).toBe('the dungeon');
  });

  it('preserves normal text', () => {
    expect(stripFillers('we entered the dungeon at midnight')).toBe(
      'we entered the dungeon at midnight'
    );
  });
});
