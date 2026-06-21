import { describe, it, expect } from 'vitest';
import { makeMonsterResolver, type CreatureSource } from '../resolve-monster';

const BOOK: CreatureSource[] = [
  { name: 'Strahd von Zarovich', id: 'hb-strahd', cr: 15, xp: 13000, statBlock: { hp: 144, ac: 16, type: 'undead' } },
  { name: 'Kiril Stoyanovich', id: 'hb-kiril', cr: 5, statBlock: { hp: 90, ac: 12 } },
  { name: 'Rahadin', id: 'hb-rahadin', cr: 10, statBlock: { hp: 135, ac: 16 } },
];

describe('makeMonsterResolver', () => {
  const resolve = makeMonsterResolver(BOOK);

  it('resolves an exact book-unique creature to homebrew with a launch-ready stat block', () => {
    const r = resolve('Strahd von Zarovich');
    expect(r.sourceType).toBe('homebrew');
    expect(r.sourceId).toBe('hb-strahd');
    expect(r.cr).toBe('15');
    expect((r.statBlock as any).hitPoints).toBe(144); // mapped from hp for launchToTracker
    expect((r.statBlock as any).armorClass).toBe(16);
  });

  it('resolves a plain SRD creature to srd with an SRD stat block', () => {
    const r = resolve('Dire Wolf');
    expect(r.sourceType).toBe('srd');
    expect(r.name).toBe('Dire Wolf');
    expect(typeof (r.statBlock as any).hitPoints).toBe('number');
    expect(r.cr).toBeTruthy();
  });

  it('strips a qualifier prefix to hit SRD ("human zombie" -> Zombie)', () => {
    const r = resolve('human zombie');
    expect(r.sourceType).toBe('srd');
    expect(r.name.toLowerCase()).toBe('zombie');
  });

  it('uses the parenthetical name when it identifies a specific book creature', () => {
    const r = resolve('Werewolf (Kiril Stoyanovich)');
    expect(r.sourceType).toBe('homebrew');
    expect(r.sourceId).toBe('hb-kiril');
  });

  it('falls back to the outer name when the parenthetical is just a type hint', () => {
    const r = resolve('Rahadin (dusk elf)');
    expect(r.sourceType).toBe('homebrew');
    expect(r.sourceId).toBe('hb-rahadin');
  });

  it('matches case-insensitively and ignores articles', () => {
    expect(resolve('the dire wolf').sourceType).toBe('srd');
  });

  it('returns custom for unresolvable names, preserving the label', () => {
    const r = resolve('Glorptron the Unknowable');
    expect(r.sourceType).toBe('custom');
    expect(r.name).toBe('Glorptron the Unknowable');
    expect(r.sourceId).toBeUndefined();
  });
});
