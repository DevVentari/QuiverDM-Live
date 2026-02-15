/**
 * D&D Beyond Character Mapper
 *
 * Pure transformation functions that map DDB API character JSON
 * to the Prisma Character model shape. No side effects.
 */

// =============================================================================
// Types
// =============================================================================

/** The result of mapping a DDB character, shaped for Prisma Character create/update */
export interface MappedCharacterData {
  name: string;
  race: string | null;
  class: string | null;
  subclass: string | null;
  level: number;
  background: string | null;
  portraitUrl: string | null;
  abilityScores: Record<string, number> | null;
  hitPoints: { current: number; max: number; temp: number } | null;
  armorClass: number | null;
  speed: number | null;
  proficiencyBonus: number;
  features: any[] | null;
  proficiencies: {
    skills: SkillProficiency[];
    tools: string[];
    weapons: string[];
    armor: string[];
  } | null;
  inventory: MappedItem[] | null;
  spellcasting: {
    spells: MappedSpell[];
    slots: Record<string, { total: number; used: number }>;
    ability: string | null;
  } | null;
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number } | null;
  backstory: string | null;
  personalityTraits: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  // New JSON fields
  languages: string[] | null;
  senses: Record<string, number> | null;
  resistances: { damage: string[]; conditions: string[] } | null;
  hitDice: { die: string; total: number; used: number }[] | null;
  savingThrows: Record<string, { proficient: boolean }> | null;
  classes: { name: string; subclass: string | null; level: number }[] | null;
  appearance: Record<string, string | null> | null;
  // DDB link fields
  dndBeyondId: string;
  dndBeyondUrl: string;
  rawData: any;
}

export interface SkillProficiency {
  name: string;
  ability: string;
  proficient: boolean;
  expertise: boolean;
}

export interface MappedSpell {
  name: string;
  level: number;
  school: string | null;
  prepared: boolean;
  alwaysPrepared: boolean;
  castingTime: string | null;
  range: string | null;
  components: string[];
  duration: string | null;
  concentration: boolean;
  ritual: boolean;
  isHomebrew: boolean;
  dndBeyondId: number | null;
}

export interface MappedItem {
  name: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  type: string | null;
  rarity: string | null;
  description: string | null;
  weight: number | null;
  isHomebrew: boolean;
  dndBeyondId: number | null;
}

export interface HomebrewDetection {
  items: { name: string; dndBeyondId: number | null; data: any }[];
  spells: { name: string; dndBeyondId: number | null; data: any }[];
  feats: { name: string; dndBeyondId: number | null; data: any }[];
}

// =============================================================================
// Constants
// =============================================================================

const ABILITY_MAP: Record<number, string> = {
  1: 'str',
  2: 'dex',
  3: 'con',
  4: 'int',
  5: 'wis',
  6: 'cha',
};

const ABILITY_FULL_MAP: Record<number, string> = {
  1: 'strength',
  2: 'dexterity',
  3: 'constitution',
  4: 'intelligence',
  5: 'wisdom',
  6: 'charisma',
};

const ALL_SKILLS: { name: string; ability: string }[] = [
  { name: 'Acrobatics', ability: 'dex' },
  { name: 'Animal Handling', ability: 'wis' },
  { name: 'Arcana', ability: 'int' },
  { name: 'Athletics', ability: 'str' },
  { name: 'Deception', ability: 'cha' },
  { name: 'History', ability: 'int' },
  { name: 'Insight', ability: 'wis' },
  { name: 'Intimidation', ability: 'cha' },
  { name: 'Investigation', ability: 'int' },
  { name: 'Medicine', ability: 'wis' },
  { name: 'Nature', ability: 'int' },
  { name: 'Perception', ability: 'wis' },
  { name: 'Performance', ability: 'cha' },
  { name: 'Persuasion', ability: 'cha' },
  { name: 'Religion', ability: 'int' },
  { name: 'Sleight of Hand', ability: 'dex' },
  { name: 'Stealth', ability: 'dex' },
  { name: 'Survival', ability: 'wis' },
];

// =============================================================================
// URL Helpers
// =============================================================================

/**
 * Extract the numeric character ID from a D&D Beyond character URL.
 * Supports formats like:
 *   https://www.dndbeyond.com/characters/12345678
 *   https://www.dndbeyond.com/characters/12345678/builder
 *   dndbeyond.com/characters/12345678
 */
export function extractCharacterIdFromUrl(url: string): string | null {
  const match = url.match(/(?:dndbeyond\.com\/characters\/)(\d+)/);
  return match ? match[1] : null;
}

// =============================================================================
// Main Mapper
// =============================================================================

/**
 * Map a D&D Beyond API character response to our Character model fields.
 * The input is the full API response (with .data wrapper).
 */
export function mapDnDBeyondToCharacter(ddbResponse: any): MappedCharacterData {
  const char = ddbResponse.data;
  const characterId = String(char.id);

  const abilityScores = extractAbilityScores(char);
  const classesData = extractClasses(char);
  const totalLevel = classesData.reduce((sum, c) => sum + c.level, 0);
  const profBonus = Math.floor((totalLevel - 1) / 4) + 2;
  const allModifiers = gatherModifiers(char);

  return {
    name: char.name || 'Unknown Character',
    race: char.race?.fullName || char.race?.baseName || null,
    class: classesData.map((c) => c.name).join(' / ') || null,
    subclass: classesData.length === 1 ? classesData[0].subclass : null,
    level: totalLevel || 1,
    background:
      char.background?.definition?.name ||
      char.background?.customBackground?.name ||
      null,
    portraitUrl: extractPortraitUrl(char),
    abilityScores,
    hitPoints: extractHitPoints(char),
    armorClass: char.armorClass ?? null,
    speed: extractSpeed(char),
    proficiencyBonus: profBonus,
    features: extractFeatures(char),
    proficiencies: extractProficiencies(allModifiers),
    inventory: extractInventory(char),
    spellcasting: extractSpellcasting(char),
    currency: extractCurrency(char),
    backstory: char.notes?.backstory || char.backstory || null,
    personalityTraits: extractTraitText(char, 'personalityTraits'),
    ideals: extractTraitText(char, 'ideals'),
    bonds: extractTraitText(char, 'bonds'),
    flaws: extractTraitText(char, 'flaws'),
    // New fields
    languages: extractLanguages(allModifiers),
    senses: extractSenses(char, allModifiers, abilityScores, profBonus),
    resistances: extractResistances(allModifiers),
    hitDice: extractHitDice(char),
    savingThrows: extractSavingThrows(allModifiers),
    classes: classesData,
    appearance: extractAppearance(char),
    // Link fields
    dndBeyondId: characterId,
    dndBeyondUrl: `https://www.dndbeyond.com/characters/${characterId}`,
    rawData: ddbResponse,
  };
}

/**
 * Detect homebrew content within a DDB character response.
 * Returns items, spells, and feats flagged as homebrew.
 */
export function detectHomebrew(ddbResponse: any): HomebrewDetection {
  const char = ddbResponse.data;
  const result: HomebrewDetection = { items: [], spells: [], feats: [] };

  // Homebrew items
  for (const item of char.inventory || []) {
    const def = item.definition;
    if (def?.isHomebrew) {
      result.items.push({
        name: def.name || 'Unknown Item',
        dndBeyondId: def.id ?? null,
        data: def,
      });
    }
  }

  // Homebrew spells
  for (const classSpell of char.classSpells || []) {
    for (const spell of classSpell.spells || []) {
      const def = spell.definition;
      if (def?.isHomebrew) {
        result.spells.push({
          name: def.name || 'Unknown Spell',
          dndBeyondId: def.id ?? null,
          data: def,
        });
      }
    }
  }

  // Homebrew feats
  for (const feat of char.feats || []) {
    const def = feat.definition;
    if (def?.isHomebrew) {
      result.feats.push({
        name: def.name || 'Unknown Feat',
        dndBeyondId: def.id ?? null,
        data: def,
      });
    }
  }

  return result;
}

// =============================================================================
// Extraction Helpers
// =============================================================================

function extractAbilityScores(char: any): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const stat of char.stats || []) {
    const key = ABILITY_MAP[stat.id];
    if (key) {
      // Base value + racial/other bonuses from modifiers
      let value = stat.value ?? 10;

      // Add bonus stats (racial bonuses etc. stored separately in some DDB versions)
      const bonusStat = (char.bonusStats || []).find((b: any) => b.id === stat.id);
      if (bonusStat?.value) {
        value += bonusStat.value;
      }

      // Add override stats
      const overrideStat = (char.overrideStats || []).find((o: any) => o.id === stat.id);
      if (overrideStat?.value != null) {
        value = overrideStat.value;
      }

      scores[key] = value;
    }
  }
  return scores;
}

function extractClasses(char: any): { name: string; subclass: string | null; level: number }[] {
  return (char.classes || []).map((cls: any) => ({
    name: cls.definition?.name || 'Unknown',
    subclass: cls.subclassDefinition?.name || null,
    level: cls.level || 1,
  }));
}

function gatherModifiers(char: any): any[] {
  const mods = char.modifiers || {};
  return [
    ...(mods.race || []),
    ...(mods.class || []),
    ...(mods.background || []),
    ...(mods.item || []),
    ...(mods.feat || []),
    ...(mods.condition || []),
  ];
}

function extractPortraitUrl(char: any): string | null {
  let url =
    char.decorations?.avatarUrl ||
    char.avatarUrl ||
    null;

  if (url && !url.startsWith('http')) {
    url = `https://www.dndbeyond.com${url}`;
  }
  return url;
}

function extractHitPoints(char: any): { current: number; max: number; temp: number } {
  const baseHp = char.baseHitPoints ?? 0;
  const bonusHp = char.bonusHitPoints ?? 0;
  const removedHp = char.removedHitPoints ?? 0;
  const tempHp = char.temporaryHitPoints ?? 0;

  return {
    max: baseHp + bonusHp,
    current: baseHp + bonusHp - removedHp,
    temp: tempHp,
  };
}

function extractSpeed(char: any): number {
  // DDB stores speed as walking speed in race/modifiers
  if (typeof char.speed === 'number') return char.speed;
  if (char.race?.weightSpeeds?.normal?.walk) return char.race.weightSpeeds.normal.walk;
  return 30;
}

function extractFeatures(char: any): any[] {
  const features: any[] = [];

  // Class features
  for (const cls of char.classes || []) {
    for (const feature of cls.classFeatures || []) {
      const def = feature.definition || {};
      if (def.name) {
        features.push({
          name: def.name,
          source: cls.definition?.name || 'Class',
          description: def.description || def.snippet || '',
        });
      }
    }
  }

  // Racial traits
  for (const trait of char.race?.racialTraits || []) {
    const def = trait.definition || {};
    if (def.name) {
      features.push({
        name: def.name,
        source: char.race?.fullName || 'Race',
        description: def.description || def.snippet || '',
      });
    }
  }

  // Feats
  for (const feat of char.feats || []) {
    const def = feat.definition || {};
    if (def.name) {
      features.push({
        name: def.name,
        source: 'Feat',
        description: def.description || def.snippet || '',
      });
    }
  }

  return features;
}

function extractProficiencies(modifiers: any[]): {
  skills: SkillProficiency[];
  tools: string[];
  weapons: string[];
  armor: string[];
} {
  const skillProfs = new Set<string>();
  const skillExpertise = new Set<string>();
  const tools: string[] = [];
  const weapons: string[] = [];
  const armor: string[] = [];

  for (const mod of modifiers) {
    if (mod.type === 'proficiency') {
      const subType = (mod.subType || '').toLowerCase();
      const name = mod.friendlySubtypeName || mod.subType || '';

      if (subType.includes('skill')) {
        // Skill proficiency — the friendlySubtypeName is the skill name
        // (e.g., "Athletics", "Perception")
      }

      if (mod.entityTypeId === 1958004211) {
        // Skill proficiency entity type in DDB
        if (mod.isExpertise) {
          skillExpertise.add(name);
        } else {
          skillProfs.add(name);
        }
      } else if (subType.includes('tool') || subType.includes('kit') || subType.includes('supplies') || subType.includes('instrument')) {
        tools.push(name);
      } else if (subType.includes('weapon') || subType.includes('sword') || subType.includes('bow') || subType.includes('crossbow')) {
        weapons.push(name);
      } else if (subType.includes('armor') || subType.includes('shield')) {
        armor.push(name);
      }
    }

    // Also check expertise type modifier
    if (mod.type === 'expertise') {
      const name = mod.friendlySubtypeName || '';
      skillExpertise.add(name);
    }
  }

  // Also gather skill profs from the more common pattern
  for (const mod of modifiers) {
    if (mod.type === 'proficiency' && mod.subType?.startsWith('skill')) {
      const name = mod.friendlySubtypeName || '';
      if (name && !skillExpertise.has(name)) {
        skillProfs.add(name);
      }
    }
  }

  const skills: SkillProficiency[] = ALL_SKILLS.map((skill) => ({
    name: skill.name,
    ability: skill.ability,
    proficient: skillProfs.has(skill.name) || skillExpertise.has(skill.name),
    expertise: skillExpertise.has(skill.name),
  }));

  return {
    skills,
    tools: [...new Set(tools)],
    weapons: [...new Set(weapons)],
    armor: [...new Set(armor)],
  };
}

function extractInventory(char: any): MappedItem[] {
  return (char.inventory || []).map((item: any) => {
    const def = item.definition || {};
    return {
      name: def.name || 'Unknown Item',
      quantity: item.quantity ?? 1,
      equipped: item.equipped ?? false,
      attuned: item.isAttuned ?? false,
      type: def.type || def.filterType || null,
      rarity: def.rarity || null,
      description: def.description || null,
      weight: def.weight ?? null,
      isHomebrew: def.isHomebrew ?? false,
      dndBeyondId: def.id ?? null,
    };
  });
}

function extractSpellcasting(char: any): {
  spells: MappedSpell[];
  slots: Record<string, { total: number; used: number }>;
  ability: string | null;
} | null {
  const classSpells = char.classSpells || [];
  if (classSpells.length === 0 && !(char.spellSlots || []).length) {
    return null;
  }

  const spells: MappedSpell[] = [];
  let castingAbility: string | null = null;

  for (const classSpell of classSpells) {
    // Capture casting ability from the class
    if (classSpell.spellCastingAbilityId) {
      castingAbility = ABILITY_FULL_MAP[classSpell.spellCastingAbilityId] || null;
    }

    for (const spell of classSpell.spells || []) {
      const def = spell.definition || {};
      spells.push({
        name: def.name || 'Unknown Spell',
        level: def.level ?? 0,
        school: def.school?.name || null,
        prepared: spell.prepared ?? false,
        alwaysPrepared: spell.alwaysPrepared ?? false,
        castingTime: def.activation
          ? `${def.activation.activationTime} ${def.activation.activationType === 1 ? 'action' : def.activation.activationType === 3 ? 'bonus action' : 'reaction'}`
          : null,
        range: def.range
          ? def.range.origin === 'Self'
            ? 'Self'
            : `${def.range.rangeValue || 0} feet`
          : null,
        components: extractSpellComponents(def),
        duration: def.duration
          ? def.duration.durationType === 'Instantaneous'
            ? 'Instantaneous'
            : `${def.duration.durationInterval || ''} ${def.duration.durationType || ''}`.trim()
          : null,
        concentration: def.concentration ?? false,
        ritual: def.ritual ?? false,
        isHomebrew: def.isHomebrew ?? false,
        dndBeyondId: def.id ?? null,
      });
    }
  }

  // Spell slots
  const slots: Record<string, { total: number; used: number }> = {};
  for (const slot of char.spellSlots || []) {
    if (slot.level > 0) {
      slots[`level${slot.level}`] = {
        total: slot.available ?? 0,
        used: slot.used ?? 0,
      };
    }
  }

  return { spells, slots, ability: castingAbility };
}

function extractSpellComponents(def: any): string[] {
  const components: string[] = [];
  if (def.componentsDescription) {
    // Parse from DDB component flags
    if (def.components?.includes(1)) components.push('V');
    if (def.components?.includes(2)) components.push('S');
    if (def.components?.includes(3)) components.push('M');
  }
  return components;
}

function extractCurrency(char: any): { cp: number; sp: number; ep: number; gp: number; pp: number } {
  const c = char.currencies || {};
  return {
    cp: c.cp ?? 0,
    sp: c.sp ?? 0,
    ep: c.ep ?? 0,
    gp: c.gp ?? 0,
    pp: c.pp ?? 0,
  };
}

function extractTraitText(char: any, trait: string): string | null {
  // DDB stores traits in char.traits
  const traits = char.traits || {};
  if (traits[trait]) return traits[trait];

  // Also check notes
  const notes = char.notes || {};
  if (notes[trait]) return notes[trait];

  return null;
}

function extractLanguages(modifiers: any[]): string[] {
  const languages = new Set<string>();

  for (const mod of modifiers) {
    if (mod.type === 'language') {
      const name = mod.friendlySubtypeName || mod.subType || '';
      if (name) languages.add(name);
    }
  }

  return [...languages];
}

function extractSenses(
  char: any,
  modifiers: any[],
  abilityScores: Record<string, number>,
  profBonus: number
): Record<string, number> {
  const senses: Record<string, number> = {};

  // Darkvision and other senses from modifiers
  for (const mod of modifiers) {
    if (mod.type === 'set-base' && mod.subType === 'darkvision') {
      senses.darkvision = Math.max(senses.darkvision || 0, mod.value || 60);
    }
    if (mod.type === 'sense' && mod.subType) {
      const name = mod.subType.replace(/-/g, '');
      senses[name] = mod.value || 0;
    }
  }

  // Passive Perception
  const wisScore = abilityScores.wis ?? 10;
  const wisMod = Math.floor((wisScore - 10) / 2);
  senses.passivePerception = 10 + wisMod;

  return senses;
}

function extractResistances(modifiers: any[]): { damage: string[]; conditions: string[] } {
  const damage = new Set<string>();
  const conditions = new Set<string>();

  for (const mod of modifiers) {
    if (mod.type === 'resistance') {
      const name = mod.friendlySubtypeName || mod.subType || '';
      if (name) damage.add(name);
    }
    if (mod.type === 'immunity') {
      const name = mod.friendlySubtypeName || mod.subType || '';
      if (name) {
        // DDB uses immunity for both damage and conditions
        if (['Charmed', 'Frightened', 'Poisoned', 'Paralyzed', 'Stunned', 'Sleep'].some(
          (c) => name.toLowerCase().includes(c.toLowerCase())
        )) {
          conditions.add(name);
        } else {
          damage.add(name);
        }
      }
    }
  }

  return {
    damage: [...damage],
    conditions: [...conditions],
  };
}

function extractHitDice(char: any): { die: string; total: number; used: number }[] {
  return (char.classes || []).map((cls: any) => {
    const hitDie = cls.definition?.hitDice ?? 8;
    return {
      die: `d${hitDie}`,
      total: cls.level || 1,
      used: 0, // DDB doesn't always expose used hit dice
    };
  });
}

function extractSavingThrows(modifiers: any[]): Record<string, { proficient: boolean }> {
  const proficientSaves = new Set<number>();

  for (const mod of modifiers) {
    if (mod.type === 'proficiency' && mod.subType === 'saving-throws' && mod.statId) {
      proficientSaves.add(mod.statId);
    }
  }

  const result: Record<string, { proficient: boolean }> = {};
  for (const [statId, abilityKey] of Object.entries(ABILITY_MAP)) {
    result[abilityKey] = {
      proficient: proficientSaves.has(Number(statId)),
    };
  }
  return result;
}

function extractAppearance(char: any): Record<string, string | null> {
  const traits = char.traits || {};
  const decorations = char.decorations || {};

  return {
    height: traits.height || null,
    weight: traits.weight || null,
    eyes: traits.eyes || null,
    skin: traits.skin || null,
    hair: traits.hair || null,
    age: traits.age || null,
    gender: char.gender || null,
    faith: char.faith || null,
    backdrop: decorations.backdropAvatarUrl || null,
  };
}
