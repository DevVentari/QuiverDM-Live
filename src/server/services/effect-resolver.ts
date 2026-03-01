import type { ItemEffect } from '@/lib/dnd-schemas';

export interface RawEffectSource {
  sourceId: string;
  sourceName: string;
  sourceType: 'item' | 'spell' | 'feat';
  active: boolean;
  effects: ItemEffect[];
}

export interface EffectBreakdownEntry {
  source: string;
  sourceId: string;
  value: number | string;
}

export interface ResolvedEffects {
  acBonus: number;
  acBonusBreakdown: EffectBreakdownEntry[];
  attackBonusBreakdown: EffectBreakdownEntry[];
  damageBonusBreakdown: EffectBreakdownEntry[];
  savingThrowBonuses: Record<string, EffectBreakdownEntry[]>;
  skillBonuses: Record<string, EffectBreakdownEntry[]>;
  abilityBonuses: Record<string, EffectBreakdownEntry[]>;
  initiativeBonus: number;
  speedBonus: number;
  maxHpBonus: number;
  spellAttackBonus: number;
  saveDcBonus: number;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  hasConcentrationAdvantage: boolean;
  hasDeathSaveAdvantage: boolean;
  advantageOn: string[];
  disadvantageOn: string[];
}

export function resolveEffects(sources: RawEffectSource[]): ResolvedEffects {
  const result: ResolvedEffects = {
    acBonus: 0,
    acBonusBreakdown: [],
    attackBonusBreakdown: [],
    damageBonusBreakdown: [],
    savingThrowBonuses: {},
    skillBonuses: {},
    abilityBonuses: {},
    initiativeBonus: 0,
    speedBonus: 0,
    maxHpBonus: 0,
    spellAttackBonus: 0,
    saveDcBonus: 0,
    resistances: [],
    immunities: [],
    vulnerabilities: [],
    hasConcentrationAdvantage: false,
    hasDeathSaveAdvantage: false,
    advantageOn: [],
    disadvantageOn: [],
  };

  for (const source of sources) {
    if (!source.active) continue;
    for (const effect of source.effects) {
      const m = effect.mechanic;
      if (!m) continue;
      const numVal = typeof m.value === 'number' ? m.value : 0;
      const entry: EffectBreakdownEntry = {
        source: source.sourceName,
        sourceId: source.sourceId,
        value: m.value ?? 0,
      };

      switch (m.type) {
        case 'ac_bonus':
          result.acBonus += numVal;
          result.acBonusBreakdown.push(entry);
          break;
        case 'attack_bonus':
          result.attackBonusBreakdown.push(entry);
          break;
        case 'damage_bonus':
          result.damageBonusBreakdown.push(entry);
          break;
        case 'saving_throw_bonus': {
          const key = (m.target ?? 'all').toLowerCase();
          (result.savingThrowBonuses[key] ??= []).push(entry);
          break;
        }
        case 'skill_bonus': {
          const key = (m.target ?? 'all').toLowerCase();
          (result.skillBonuses[key] ??= []).push(entry);
          break;
        }
        case 'ability_bonus': {
          const key = (m.target ?? 'all').toLowerCase();
          (result.abilityBonuses[key] ??= []).push(entry);
          break;
        }
        case 'initiative_bonus':
          result.initiativeBonus += numVal;
          break;
        case 'speed_bonus':
          result.speedBonus += numVal;
          break;
        case 'max_hp_bonus':
          result.maxHpBonus += numVal;
          break;
        case 'spell_attack_bonus':
          result.spellAttackBonus += numVal;
          break;
        case 'save_dc_bonus':
          result.saveDcBonus += numVal;
          break;
        case 'resistance':
          if (m.target && !result.resistances.includes(m.target)) result.resistances.push(m.target);
          break;
        case 'immunity':
          if (m.target && !result.immunities.includes(m.target)) result.immunities.push(m.target);
          break;
        case 'vulnerability':
          if (m.target && !result.vulnerabilities.includes(m.target)) result.vulnerabilities.push(m.target);
          break;
        case 'concentration_advantage':
          result.hasConcentrationAdvantage = true;
          break;
        case 'death_save_advantage':
          result.hasDeathSaveAdvantage = true;
          break;
        case 'advantage':
          if (m.target) result.advantageOn.push(m.target);
          break;
        case 'disadvantage':
          if (m.target) result.disadvantageOn.push(m.target);
          break;
      }
    }
  }

  return result;
}
