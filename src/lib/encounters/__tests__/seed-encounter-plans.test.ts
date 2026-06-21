import { describe, it, expect } from 'vitest';
import { buildEncounterPlanSpecs, type EventEntity } from '../seed-encounter-plans';
import { makeMonsterResolver } from '../resolve-monster';

const resolve = makeMonsterResolver([
  { name: 'Strahd von Zarovich', id: 'hb-strahd', cr: 15, xp: 13000, statBlock: { hp: 144, ac: 16 } },
]);

const events: EventEntity[] = [
  {
    name: 'Final Battle',
    description: 'The confrontation in the heart of Castle Ravenloft.',
    ddbChapterId: 'ch-castle',
    properties: { subtype: 'encounter', difficulty: 'deadly', monsters: ['Strahd von Zarovich', 'Dire Wolf', 'Dire Wolf'] },
  },
  { name: 'Just Scenery', description: 'A quiet road.', ddbChapterId: null, properties: { subtype: 'encounter' } },
  { name: 'Not An Encounter', description: '', ddbChapterId: null, properties: { subtype: 'lore', monsters: ['Dire Wolf'] } },
];

describe('buildEncounterPlanSpecs', () => {
  const specs = buildEncounterPlanSpecs(events, resolve);

  it('builds a plan only for encounter events that list monsters', () => {
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe('Final Battle');
  });

  it('carries scene description, difficulty, and chapter link', () => {
    expect(specs[0].sceneDescription).toContain('Castle Ravenloft');
    expect(specs[0].difficulty).toBe('deadly');
    expect(specs[0].ddbChapterId).toBe('ch-castle');
  });

  it('groups repeated monsters into a count and links resolved sources', () => {
    const { creatures } = specs[0];
    const strahd = creatures.find((c) => c.sourceId === 'hb-strahd');
    expect(strahd?.sourceType).toBe('homebrew');
    expect(strahd?.count).toBe(1);
    const direWolf = creatures.find((c) => c.name === 'Dire Wolf');
    expect(direWolf?.sourceType).toBe('srd');
    expect(direWolf?.count).toBe(2);
  });

  it('sums total XP across creatures (xp × count)', () => {
    // Strahd 13000 ×1 + Dire Wolf 200 ×2 = 13400
    expect(specs[0].totalXp).toBe(13000 + 200 * 2);
  });
});
