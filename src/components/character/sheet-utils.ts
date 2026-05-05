export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];

export interface CharHp { current: number; max: number; temp?: number }
export interface CharSkill { name: string; ability: string; proficient: boolean; expertise: boolean }
export interface CharInventoryItem {
  name: string;
  quantity?: number;
  equipped?: boolean;
  damage?: string;
  damageType?: string;
  attackType?: string;
  properties?: string[];
  magicBonus?: number;
}
export interface CharSpell {
  name: string;
  level: number;
  damage?: string;
  school?: string;
  concentration?: boolean;
  description?: string;
}
export interface CharSpellcasting {
  ability?: string;
  spells?: CharSpell[];
  slots?: Record<string, { total: number; used: number }>;
}
export interface CharFeature { name: string; description?: string }

export interface CharacterSheetData {
  id: string;
  name: string;
  race: string | null;
  class: string | null;
  subclass: string | null;
  level: number | null;
  background: string | null;
  portraitUrl: string | null;
  armorClass: number | null;
  speed: number | null;
  proficiencyBonus: number | null;
  abilityScores: Record<AbilityKey, number> | null;
  hitPoints: CharHp | null;
  savingThrows: Record<AbilityKey, { proficient: boolean }> | null;
  proficiencies: { skills?: CharSkill[] } | null;
  senses: Record<string, unknown> | null;
  languages: string[] | null;
  resistances: { damage?: string[]; conditions?: string[] } | null;
  inventory: CharInventoryItem[] | null;
  spellcasting: CharSpellcasting | null;
  features: CharFeature[] | null;
  backstory: string | null;
  user?: { name?: string | null; displayName?: string | null } | null;
}

export function computeWeaponAttacks(
  inventory: CharInventoryItem[] | null,
  abilities: Record<AbilityKey, number> | null,
  profBonus: number
) {
  return (inventory ?? [])
    .filter((item) => item.equipped && item.damage)
    .map((item) => {
      const strMod = abilities ? abilityMod(abilities.str ?? 10) : 0;
      const dexMod = abilities ? abilityMod(abilities.dex ?? 10) : 0;
      const isRanged = item.attackType === 'Ranged';
      const isFinesse = (item.properties ?? []).some((p) => p.toLowerCase() === 'finesse');
      const abilityModVal = isRanged ? dexMod : isFinesse ? Math.max(strMod, dexMod) : strMod;
      const magic = item.magicBonus ?? 0;
      const attackBonus = abilityModVal + profBonus + magic;
      const damageBonus = abilityModVal + magic;
      return {
        name: item.name,
        attackBonus,
        damage:
          item.damage +
          (damageBonus !== 0 ? (damageBonus >= 0 ? `+${damageBonus}` : `${damageBonus}`) : ''),
        damageType: item.damageType ?? '',
      };
    });
}

export function computeSpellStats(
  spellcasting: CharSpellcasting | null,
  abilities: Record<AbilityKey, number> | null,
  profBonus: number
): { spellSaveDC: number | null; spellAttackBonus: number | null } {
  const spellAbility = spellcasting?.ability as AbilityKey | undefined;
  const spellAbilityMod =
    spellAbility && abilities ? abilityMod(abilities[spellAbility] ?? 10) : null;
  return {
    spellSaveDC: spellAbilityMod != null ? 8 + profBonus + spellAbilityMod : null,
    spellAttackBonus: spellAbilityMod != null ? profBonus + spellAbilityMod : null,
  };
}

export function computeSkillMod(
  skillName: string,
  skills: CharSkill[] | undefined,
  abilities: Record<AbilityKey, number> | null,
  profBonus: number
): number {
  const skill = skills?.find((s) => s.name === skillName);
  if (!skill || !abilities) return 0;
  const score = abilities[skill.ability as AbilityKey] ?? 10;
  let mod = abilityMod(score);
  if (skill.proficient) mod += profBonus;
  if (skill.expertise) mod += profBonus;
  return mod;
}
