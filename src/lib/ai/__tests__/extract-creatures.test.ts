import { describe, it, expect } from 'vitest';
import {
  creatureToHomebrewData,
  isSrdCreatureName,
  dedupeCreaturesByName,
  type ExtractedCreature,
} from '../extract-creatures';

const STRAHD: ExtractedCreature = {
  name: 'Strahd von Zarovich',
  size: 'Medium',
  type: 'undead',
  alignment: 'lawful evil',
  ac: 16,
  acNote: 'natural armor',
  hp: 144,
  hpDice: '17d8 + 68',
  speed: '30 ft.',
  abilities: { str: 18, dex: 18, con: 18, int: 20, wis: 15, cha: 18 },
  damageResistances: 'necrotic; bludgeoning, piercing, and slashing from nonmagical attacks',
  damageImmunities: '',
  conditionImmunities: '',
  senses: 'darkvision 120 ft., passive Perception 22',
  languages: 'Abyssal, Common, Draconic, Elvish, Giant, Infernal',
  cr: '15',
  xp: 13000,
  traits: [{ name: 'Shapechanger', desc: 'Strahd can use his action to polymorph...' }],
  actions: [{ name: 'Unarmed Strike', desc: 'Melee Weapon Attack: 9 (1d8 + 4) bludgeoning.' }],
  reactions: [],
  legendaryActions: [{ name: 'Move', desc: 'Strahd moves up to his speed without provoking.' }],
};

describe('creatureToHomebrewData', () => {
  it('maps into the data blob shape the Compendium statblock adapter reads', () => {
    const d = creatureToHomebrewData(STRAHD);
    expect(d.ac).toBe(16);
    expect(d.acNote).toBe('natural armor');
    expect(d.hp).toBe(144);
    expect(d.hpDice).toBe('17d8 + 68');
    expect(d.speed).toBe('30 ft.');
    expect(d.abilities).toEqual({ str: 18, dex: 18, con: 18, int: 20, wis: 15, cha: 18 });
    expect(d.size).toBe('Medium');
    expect(d.type).toBe('undead');
  });

  it('normalises CR to a number (handles fractional strings)', () => {
    expect(creatureToHomebrewData(STRAHD).cr).toBe(15);
    expect(creatureToHomebrewData({ ...STRAHD, cr: '1/4' }).cr).toBe(0.25);
  });

  it('maps actions desc -> description and keeps non-empty defences as arrays', () => {
    const d = creatureToHomebrewData(STRAHD) as Record<string, any>;
    expect(d.actions[0]).toEqual({ name: 'Unarmed Strike', description: 'Melee Weapon Attack: 9 (1d8 + 4) bludgeoning.' });
    expect(d.damageResistances).toEqual(['necrotic; bludgeoning, piercing, and slashing from nonmagical attacks']);
    expect(d.damageImmunities).toBeUndefined(); // empty string → omitted
  });
});

describe('isSrdCreatureName', () => {
  it('flags SRD creatures (so the extractor can skip them — Phase 1 covers SRD)', () => {
    expect(isSrdCreatureName('Goblin')).toBe(true);
    expect(isSrdCreatureName('goblin')).toBe(true);
  });
  it('does not flag book-unique creatures', () => {
    expect(isSrdCreatureName('Strahd von Zarovich')).toBe(false);
    expect(isSrdCreatureName('Rahadin')).toBe(false);
  });
});

describe('dedupeCreaturesByName', () => {
  it('dedupes case-insensitively, keeping the most complete stat block', () => {
    const sparse: ExtractedCreature = { name: 'Rahadin', actions: [], traits: [], reactions: [], legendaryActions: [] };
    const full: ExtractedCreature = { ...sparse, hp: 135, ac: 16, actions: [{ name: 'Scimitar', desc: 'hit' }] };
    const out = dedupeCreaturesByName([sparse, full]);
    expect(out).toHaveLength(1);
    expect(out[0].hp).toBe(135);
    expect(out[0].actions).toHaveLength(1);
  });
});
