import { describe, it, expect } from 'vitest';
import {
  parseJsonFile,
  slugifyFilename,
  buildPreview,
} from '@/server/services/json-import.service';

const actorNpcFile = {
  metadata: { title: 'NPCs of Hameria', date: '2025-07-21T00:00:00+00:00', tags: ['npc'] },
  source: 'NPCs\\Town Guard.md',
  type: 'actor',
  data: [
    {
      name: 'Sergeant Voss',
      description: 'A grizzled veteran.',
      type_alignment: 'Lawful Neutral',
      mechanics: { ac: 16, hp: 45 },
    },
    {
      name: 'Introduction',
      description: '# Introduction',
      mechanics: {},
    },
  ],
};

const factionFile = {
  metadata: { title: 'Factions', date: '2025-07-21T00:00:00+00:00', tags: ['faction'] },
  source: 'Factions\\Iron Circle.md',
  type: 'faction',
  data: [
    { name: 'Iron Circle', description: 'A ruthless mercenary band.', mechanics: { reputation: 'feared' } },
  ],
};

const itemFile = {
  metadata: { title: 'Items', date: '2025-07-21T00:00:00+00:00', tags: ['item'] },
  source: 'Items\\Master Item List.md',
  type: 'item',
  data: [
    { name: 'Master Item List', description: '# Overview', mechanics: {} },
    { name: 'Sword of Dawn', description: 'A glowing blade.', mechanics: { damage: '1d8+2' } },
  ],
};

describe('slugifyFilename', () => {
  it('strips extension and slugifies', () => {
    expect(slugifyFilename('NPCs\\Town Guard.md')).toBe('town-guard');
  });
  it('handles nested paths', () => {
    expect(slugifyFilename('Player Characters\\Norm Alfella.md')).toBe('norm-alfella');
  });
});

describe('parseJsonFile', () => {
  it('returns a document record for every file', () => {
    const result = parseJsonFile('town-npcs.json', JSON.stringify(actorNpcFile));
    expect(result).not.toBeNull();
    expect(result!.document.title).toBe('NPCs of Hameria');
    expect(result!.document.type).toBe('npc-collection');
    expect(result!.document.slug).toBe('town-guard');
  });

  it('skips header entries (empty mechanics + heading description)', () => {
    const result = parseJsonFile('town-npcs.json', JSON.stringify(actorNpcFile));
    expect(result!.npcs.map((n) => n.name)).not.toContain('Introduction');
    expect(result!.npcs.map((n) => n.name)).toContain('Sergeant Voss');
  });

  it('extracts NPCs from actor+npc file', () => {
    const result = parseJsonFile('town-npcs.json', JSON.stringify(actorNpcFile));
    expect(result!.npcs).toHaveLength(1);
    expect(result!.npcs[0].name).toBe('Sergeant Voss');
    expect(result!.npcs[0].role).toBe('Lawful Neutral');
    expect(result!.entities[0].type).toBe('NPC');
  });

  it('extracts FACTION entity from faction file', () => {
    const result = parseJsonFile('factions.json', JSON.stringify(factionFile));
    expect(result!.npcs).toHaveLength(0);
    expect(result!.entities[0].type).toBe('FACTION');
    expect(result!.entities[0].name).toBe('Iron Circle');
  });

  it('extracts homebrew item and ITEM entity, skips header', () => {
    const result = parseJsonFile('items.json', JSON.stringify(itemFile));
    expect(result!.homebrew).toHaveLength(1);
    expect(result!.homebrew[0].name).toBe('Sword of Dawn');
    expect(result!.entities[0].type).toBe('ITEM');
  });

  it('returns empty arrays for unknown type (adventure)', () => {
    const adventureFile = { ...actorNpcFile, type: 'adventure', data: [{ name: 'Chapter 1', description: 'An intro.' }] };
    const result = parseJsonFile('adventure.json', JSON.stringify(adventureFile));
    expect(result!.npcs).toHaveLength(0);
    expect(result!.homebrew).toHaveLength(0);
    expect(result!.entities).toHaveLength(0);
  });

  it('returns null for malformed JSON', () => {
    const result = parseJsonFile('bad.json', '{ not valid json }');
    expect(result).toBeNull();
  });

  it('extracts NPCs from actor+minor file', () => {
    const minorActorFile = {
      metadata: { title: 'Minor NPCs', date: '2025-07-21T00:00:00+00:00', tags: ['minor'] },
      source: 'NPCs\\Minor.md',
      type: 'actor',
      data: [{ name: 'Town Crier', description: 'A loud fellow.', mechanics: { hp: 5 } }],
    };
    const result = parseJsonFile('minor-npcs.json', JSON.stringify(minorActorFile));
    expect(result!.npcs).toHaveLength(1);
    expect(result!.npcs[0].name).toBe('Town Crier');
    expect(result!.entities[0].type).toBe('NPC');
  });

  it('skips entry whose name is in SKIP_NAMES (overview)', () => {
    const fileWithOverview = {
      metadata: { title: 'Locations', date: '2025-07-21T00:00:00+00:00', tags: ['location'] },
      source: 'Locations\\Overview.md',
      type: 'location',
      data: [
        { name: 'Overview', description: 'This is the overview.', mechanics: {} },
        { name: 'Ironkeep', description: 'A sturdy fortress.', mechanics: { pop: 200 } },
      ],
    };
    const result = parseJsonFile('locations.json', JSON.stringify(fileWithOverview));
    expect(result!.entities.map((e) => e.name)).not.toContain('Overview');
    expect(result!.entities.map((e) => e.name)).toContain('Ironkeep');
  });
});

describe('buildPreview', () => {
  it('returns valid preview for valid file and invalid for malformed', () => {
    const files = [
      { filename: 'factions.json', content: JSON.stringify(factionFile) },
      { filename: 'bad.json', content: '{ not json }' },
    ];
    const previews = buildPreview(files);
    expect(previews).toHaveLength(2);
    expect(previews[0].valid).toBe(true);
    expect(previews[0].title).toBe('Factions');
    expect(previews[0].entityCount).toBe(1);
    expect(previews[1].valid).toBe(false);
  });
});
