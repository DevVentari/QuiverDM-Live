import { describe, it, expect } from 'vitest';
import { selectRelevantEntities, type SelectableEntity, type SelectableRelationship } from '../brain-context-selector';

function ent(over: Partial<SelectableEntity> & { id: string; name: string }): SelectableEntity {
  return { aliases: [], description: null, lastSeenSessionId: null, ...over };
}

describe('selectRelevantEntities', () => {
  it('selects a query-matched entity even when alphabetically last', () => {
    const entities = [
      ...Array.from({ length: 45 }, (_, i) => ent({ id: `a${i}`, name: `Aaa Filler ${i}` })),
      ent({ id: 'zara', name: 'Zara the Betrayer', description: 'A traitorous spy' }),
    ];
    const { selected } = selectRelevantEntities('tell me about Zara', entities, [], { limit: 40 });
    expect(selected.map((e) => e.id)).toContain('zara');
  });

  it('pulls in a 1-hop neighbor via a strong edge with no text match', () => {
    const entities = [
      ent({ id: 'zara', name: 'Zara' }),
      ent({ id: 'cult', name: 'The Ashen Cult' }),
    ];
    const rels: SelectableRelationship[] = [
      { fromEntityId: 'zara', toEntityId: 'cult', strength: 0.9 },
    ];
    const { selected } = selectRelevantEntities('Zara', entities, rels);
    expect(selected.map((e) => e.id)).toEqual(expect.arrayContaining(['zara', 'cult']));
  });

  it('recency boost never outranks a direct lexical match', () => {
    const entities = [
      ent({ id: 'recent', name: 'Random Tavern', lastSeenSessionId: 's1' }),
      ent({ id: 'match', name: 'Dragon', description: 'big' }),
    ];
    const { selected } = selectRelevantEntities('dragon', entities, [], { limit: 1 });
    expect(selected[0].id).toBe('match');
  });

  it('falls back to top-strength + recent entities on a cold query', () => {
    const entities = [
      ent({ id: 'a', name: 'Alpha' }),
      ent({ id: 'b', name: 'Beta' }),
      ent({ id: 'c', name: 'Gamma', lastSeenSessionId: 's9' }),
    ];
    const rels: SelectableRelationship[] = [{ fromEntityId: 'a', toEntityId: 'b', strength: 0.8 }];
    const { selected } = selectRelevantEntities('what is happening?', entities, rels, { limit: 2 });
    expect(selected.length).toBe(2);
  });

  it('returns empty for an empty campaign without crashing', () => {
    const { selected, droppedCount } = selectRelevantEntities('anything', [], []);
    expect(selected).toEqual([]);
    expect(droppedCount).toBe(0);
  });

  it('reports droppedCount when candidates exceed the limit', () => {
    const entities = Array.from({ length: 5 }, (_, i) =>
      ent({ id: `e${i}`, name: `Goblin ${i}`, description: 'goblin' }),
    );
    const { selected, droppedCount } = selectRelevantEntities('goblin', entities, [], { limit: 2 });
    expect(selected.length).toBe(2);
    expect(droppedCount).toBe(3);
  });

  it('accumulates neighbor score across multiple seeds', () => {
    const entities = [
      ent({ id: 'zara', name: 'Zara', description: 'spy' }),
      ent({ id: 'borin', name: 'Borin', description: 'spy' }),
      ent({ id: 'cult', name: 'The Ashen Cult' }),
      ent({ id: 'lone', name: 'Lonely Hermit' }),
    ];
    const rels: SelectableRelationship[] = [
      { fromEntityId: 'zara', toEntityId: 'cult', strength: 0.4 },
      { fromEntityId: 'borin', toEntityId: 'cult', strength: 0.4 },
      { fromEntityId: 'borin', toEntityId: 'lone', strength: 0.4 },
    ];
    // Query matches both zara and borin (seeds). 'cult' is a neighbor of BOTH,
    // 'lone' a neighbor of one — so 'cult' must rank above 'lone'.
    const { selected } = selectRelevantEntities('spy', entities, rels);
    const cultIdx = selected.findIndex((e) => e.id === 'cult');
    const loneIdx = selected.findIndex((e) => e.id === 'lone');
    expect(cultIdx).toBeGreaterThanOrEqual(0);
    expect(loneIdx).toBeGreaterThanOrEqual(0);
    expect(cultIdx).toBeLessThan(loneIdx);
  });
});
