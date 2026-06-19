// src/server/services/__tests__/session0-seeder.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLinkedEntityIds, tarokkaToNotes, tarokkaToSecrets } from '../session0-seeder.helpers';

const reading = {
  seed: 'c1',
  draws: [
    { slot: 'tome', label: 'Tome of Strahd', card: 'X', location: 'Argynvostholt' },
    { slot: 'ally', label: 'The Fortune-favoured ally', card: 'Y', location: "Ezmerelda d'Avenir" },
  ],
};

describe('resolveLinkedEntityIds', () => {
  const entities = [
    { id: 'e1', name: 'Ireena Kolyana' },
    { id: 'e2', name: 'Ismark' },
  ];
  it('matches names case-insensitively and de-dupes', () => {
    expect(resolveLinkedEntityIds(['ireena kolyana', 'ISMARK', 'Ismark'], entities)).toEqual(['e1', 'e2']);
  });
  it('ignores names with no matching entity', () => {
    expect(resolveLinkedEntityIds(['Strahd'], entities)).toEqual([]);
  });
  it('returns [] when names is undefined', () => {
    expect(resolveLinkedEntityIds(undefined, entities)).toEqual([]);
  });
});

describe('tarokkaToNotes', () => {
  it('makes one secret note per draw with label + location in the body', () => {
    const notes = tarokkaToNotes(reading);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ type: 'secret' });
    expect(notes[0]!.body).toContain('Tome of Strahd');
    expect(notes[0]!.body).toContain('Argynvostholt');
  });
});

describe('tarokkaToSecrets', () => {
  it('maps each draw to a PrepSecret name/content pair', () => {
    const secrets = tarokkaToSecrets(reading);
    expect(secrets[0]).toEqual({ name: 'Tome of Strahd', content: 'Argynvostholt' });
  });
});
