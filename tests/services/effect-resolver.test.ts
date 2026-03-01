import { describe, it, expect } from 'vitest';
import { resolveEffects } from '@/server/services/effect-resolver';
import type { RawEffectSource } from '@/server/services/effect-resolver';

describe('resolveEffects', () => {
  it('stacks multiple ac_bonus effects', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'item-1', sourceName: 'Ring of Protection', sourceType: 'item',
        active: true,
        effects: [{ name: 'AC', description: '+1 AC', mechanic: { type: 'ac_bonus', value: 1, activation: 'passive' } }],
      },
      {
        sourceId: 'item-2', sourceName: 'Shield +1', sourceType: 'item',
        active: true,
        effects: [{ name: 'AC', description: '+1 AC', mechanic: { type: 'ac_bonus', value: 1, activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.acBonus).toBe(2);
    expect(result.acBonusBreakdown).toHaveLength(2);
  });

  it('ignores inactive sources', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'spell-1', sourceName: 'Bless', sourceType: 'spell',
        active: false,
        effects: [{ name: 'Attack', description: '+1d4', mechanic: { type: 'attack_bonus', value: '1d4', activation: 'concentration' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.attackBonusBreakdown).toHaveLength(0);
  });

  it('collects resistances from multiple sources', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'item-1', sourceName: 'Cloak of Fire Resistance', sourceType: 'item',
        active: true,
        effects: [{ name: 'Fire Resistance', description: 'Resistant to fire', mechanic: { type: 'resistance', target: 'fire', activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.resistances).toContain('fire');
  });

  it('does not duplicate resistances from the same damage type', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'item-1', sourceName: 'Fire Cloak', sourceType: 'item',
        active: true,
        effects: [{ name: 'Fire Resistance', description: '', mechanic: { type: 'resistance', target: 'fire', activation: 'passive' } }],
      },
      {
        sourceId: 'item-2', sourceName: 'Fire Ring', sourceType: 'item',
        active: true,
        effects: [{ name: 'Fire Resistance 2', description: '', mechanic: { type: 'resistance', target: 'fire', activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.resistances.filter((r) => r === 'fire')).toHaveLength(1);
  });

  it('sums numeric bonuses for initiative', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'feat-1', sourceName: 'Alert', sourceType: 'feat',
        active: true,
        effects: [{ name: 'Initiative', description: '+5', mechanic: { type: 'initiative_bonus', value: 5, activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.initiativeBonus).toBe(5);
  });

  it('sets concentration_advantage flag', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'feat-1', sourceName: 'War Caster', sourceType: 'feat',
        active: true,
        effects: [{ name: 'Concentration', description: 'Adv on concentration', mechanic: { type: 'concentration_advantage', activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.hasConcentrationAdvantage).toBe(true);
  });

  it('returns empty defaults when no sources', () => {
    const result = resolveEffects([]);
    expect(result.acBonus).toBe(0);
    expect(result.resistances).toHaveLength(0);
    expect(result.hasConcentrationAdvantage).toBe(false);
  });

  it('stores dice expression as string in breakdown, does not add to numeric aggregate', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'spell-1', sourceName: 'Bless', sourceType: 'spell',
        active: true,
        effects: [{ name: 'Attack', description: '+1d4', mechanic: { type: 'attack_bonus', value: '1d4', activation: 'concentration' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.attackBonusBreakdown).toHaveLength(1);
    expect(result.attackBonusBreakdown[0].value).toBe('1d4');
  });

  it('deduplicates advantageOn entries from multiple sources', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'item-1', sourceName: 'Helm of Clarity', sourceType: 'item',
        active: true,
        effects: [{ name: 'Perception Advantage', description: '', mechanic: { type: 'advantage', target: 'perception', activation: 'passive' } }],
      },
      {
        sourceId: 'item-2', sourceName: 'Eyes of the Eagle', sourceType: 'item',
        active: true,
        effects: [{ name: 'Perception Advantage', description: '', mechanic: { type: 'advantage', target: 'perception', activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.advantageOn.filter((a) => a === 'perception')).toHaveLength(1);
  });
});
