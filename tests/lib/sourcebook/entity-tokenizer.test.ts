import { describe, it, expect } from 'vitest';
import { tokenizeEntities, type EntityIndexItem } from '@/lib/sourcebook/entity-tokenizer';

const entities: EntityIndexItem[] = [
  { id: 'e1', name: 'Sildar Hallwinter', aliases: [], type: 'NPC' },
  { id: 'e2', name: 'Sildar', aliases: [], type: 'NPC' },
  { id: 'e3', name: 'Phandalin', aliases: ['Phandalin Town'], type: 'LOCATION' },
];

describe('tokenizeEntities', () => {
  it('replaces longest name first', () => {
    const out = tokenizeEntities('Sildar Hallwinter and his men.', entities);
    expect(out).toBe('[[entity:e1|Sildar Hallwinter]] and his men.');
  });

  it('matches shorter name when longer is absent', () => {
    const out = tokenizeEntities('Then Sildar spoke.', entities);
    expect(out).toBe('Then [[entity:e2|Sildar]] spoke.');
  });

  it('matches aliases', () => {
    const out = tokenizeEntities('Welcome to Phandalin Town.', entities);
    expect(out).toBe('Welcome to [[entity:e3|Phandalin Town]].');
  });

  it('is case-insensitive but preserves display text', () => {
    const out = tokenizeEntities('we reached phandalin at dusk.', entities);
    expect(out).toBe('we reached [[entity:e3|phandalin]] at dusk.');
  });

  it('skips matches inside existing markdown links', () => {
    const out = tokenizeEntities('See [Sildar](http://x) for details.', entities);
    expect(out).toBe('See [Sildar](http://x) for details.');
  });

  it('skips matches inside fenced code blocks', () => {
    const md = '`\nSildar\n`\nThen Sildar arrived.';
    const out = tokenizeEntities(md, entities);
    expect(out).toBe('`\nSildar\n`\nThen [[entity:e2|Sildar]] arrived.');
  });

  it('respects word boundaries', () => {
    const out = tokenizeEntities('The Sildarian empire.', entities);
    expect(out).toBe('The Sildarian empire.');
  });

  it('returns input unchanged when index is empty', () => {
    expect(tokenizeEntities('Hello world.', [])).toBe('Hello world.');
  });
});
