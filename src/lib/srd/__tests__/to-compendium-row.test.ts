import { describe, it, expect } from 'vitest';
import { srdMonsterToRow, srdConditionToRow, srdRuleToRow } from '../to-compendium-row';
import type { SrdMonster } from '../monsters';

const GHOST: SrdMonster = {
  slug: 'ghost',
  name: 'Ghost',
  size: 'Medium',
  type: 'undead',
  subtype: '',
  alignment: 'any alignment',
  armorClass: 11,
  armorDesc: 'natural armor',
  hitPoints: 45,
  hitDice: '10d8',
  speed: { walk: 0, fly: 40, hover: true as unknown as number },
  abilityScores: { str: 7, dex: 13, con: 10, int: 10, wis: 12, cha: 17 },
  savingThrows: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
  skills: {},
  damageVulnerabilities: '',
  damageResistances: 'acid, fire, lightning, thunder; bludgeoning, piercing, and slashing from nonmagical attacks',
  damageImmunities: 'cold, necrotic, poison',
  conditionImmunities: 'charmed, exhaustion, frightened, grappled',
  senses: 'darkvision 60 ft., passive Perception 11',
  languages: 'any languages it knew in life',
  challengeRating: '4',
  cr: 4,
  xp: 1100,
  traits: [{ name: 'Ethereal Sight', desc: 'The ghost can see 60 feet into the Ethereal Plane.' }],
  actions: [{ name: 'Withering Touch', desc: 'Melee Weapon Attack: 17 (4d6 + 3) necrotic damage.' }],
  reactions: [],
  legendaryDesc: '',
  legendaryActions: [],
};

describe('srdMonsterToRow', () => {
  it('produces a creature row flagged as SRD with a namespaced id', () => {
    const row = srdMonsterToRow(GHOST);
    expect(row.type).toBe('creature');
    expect(row.isSrd).toBe(true);
    expect(row.id).toBe('srd:ghost');
    expect(row.name).toBe('Ghost');
  });

  it('maps into the data blob shape the statblock adapter reads', () => {
    const d = srdMonsterToRow(GHOST).data as Record<string, any>;
    expect(d.ac).toBe(11);
    expect(d.acNote).toBe('natural armor');
    expect(d.hp).toBe(45);
    expect(d.hpDice).toBe('10d8');
    expect(d.abilities).toEqual({ str: 7, dex: 13, con: 10, int: 10, wis: 12, cha: 17 });
    expect(d.cr).toBe(4);
    expect(d.xp).toBe(1100);
    expect(d.size).toBe('Medium');
    expect(d.type).toBe('undead');
    expect(d.alignment).toBe('any alignment');
  });

  it('renders the speed record as a readable string', () => {
    const d = srdMonsterToRow(GHOST).data as Record<string, any>;
    expect(typeof d.speed).toBe('string');
    expect(d.speed).toContain('fly 40 ft.');
  });

  it('carries defenses as arrays and maps actions (desc -> description)', () => {
    const d = srdMonsterToRow(GHOST).data as Record<string, any>;
    expect(Array.isArray(d.damageImmunities)).toBe(true);
    expect(d.damageImmunities).toContain('cold, necrotic, poison');
    expect(Array.isArray(d.conditionImmunities)).toBe(true);
    expect(d.actions[0]).toEqual({
      name: 'Withering Touch',
      description: 'Melee Weapon Attack: 17 (4d6 + 3) necrotic damage.',
    });
  });

  it('omits empty optional notes rather than emitting blanks', () => {
    const noArmorDesc = { ...GHOST, armorDesc: '', hitDice: '' };
    const d = srdMonsterToRow(noArmorDesc).data as Record<string, any>;
    expect(d.acNote).toBeUndefined();
    expect(d.hpDice).toBeUndefined();
  });
});

describe('srdConditionToRow', () => {
  it('produces an SRD condition row carrying its description', () => {
    const row = srdConditionToRow({ slug: 'prone', name: 'Prone', description: 'A prone creature...' });
    expect(row).toMatchObject({ id: 'srd-condition:prone', name: 'Prone', type: 'condition', isSrd: true });
    expect((row.data as { description: string }).description).toBe('A prone creature...');
  });
});

describe('srdRuleToRow', () => {
  it('produces an SRD rule row carrying description + category', () => {
    const row = srdRuleToRow({ slug: 'cover', name: 'Cover', category: 'Combat', description: 'Half cover...' });
    expect(row).toMatchObject({ id: 'srd-rule:cover', name: 'Cover', type: 'rule', isSrd: true });
    expect(row.tags).toEqual(['Combat']);
    const d = row.data as { description: string; category: string };
    expect(d.description).toBe('Half cover...');
    expect(d.category).toBe('Combat');
  });
});
