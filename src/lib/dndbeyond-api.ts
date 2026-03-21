/**
 * D&D Beyond API Integration using Cobalt Authentication
 * Similar to FoundryVTT's dndimporter module
 */

interface DDBCharacterResponse {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Fetch character data from D&D Beyond API using Cobalt token
 * @param characterId - The character ID from the D&D Beyond URL
 * @param cobaltToken - The CobaltSession cookie value
 */
export async function fetchCharacterFromDDB(
  characterId: string,
  cobaltToken: string
): Promise<DDBCharacterResponse> {
  try {
    const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}?includeCustomItems=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.dndbeyond.com',
        'Referer': 'https://www.dndbeyond.com/',
        'Cookie': `CobaltSession=${cobaltToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          message: 'Invalid or expired Cobalt token. Please get a fresh token from D&D Beyond.',
        };
      }
      return {
        success: false,
        message: `Failed to fetch character: ${response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error fetching character: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Parse D&D Beyond character data into our format
 */
export function parseCharacterData(ddbData: any) {
  const character = ddbData.data;

  // Extract ability scores
  const stats = character.stats || [];
  const abilityScores: any = {};
  const abilityMap: { [key: number]: string } = {
    1: 'strength',
    2: 'dexterity',
    3: 'constitution',
    4: 'intelligence',
    5: 'wisdom',
    6: 'charisma',
  };

  stats.forEach((stat: any) => {
    if (stat.id in abilityMap) {
      abilityScores[abilityMap[stat.id]] = stat.value || 10;
    }
  });

  // Extract saving throws with proficiencies
  const savingThrows: any = {};
  const savingThrowProficiencies = new Set<number>();

  // Get saving throw proficiencies from class modifiers
  (character.modifiers?.class || []).forEach((m: any) => {
    if (m.type === 'saving-throws' && m.statId) {
      savingThrowProficiencies.add(m.statId);
    }
  });

  // Build saving throws object
  [1, 2, 3, 4, 5, 6].forEach((statId) => {
    const abilityName = abilityMap[statId];
    savingThrows[abilityName] = {
      proficient: savingThrowProficiencies.has(statId),
    };
  });

  // Extract class information
  const classes = character.classes || [];
  const className = classes.map((c: any) => c.definition?.name || 'Unknown').join(' / ');
  const totalLevel = classes.reduce((sum: number, c: any) => sum + (c.level || 0), 0);

  // Extract race
  const race = character.race?.fullName || character.race?.baseName || 'Unknown';

  // Extract background
  const background = character.background?.definition?.name || character.background?.customName || null;

  // Extract skills with proficiency
  const skillProficiencies = new Set<string>();
  const skillExpertise = new Set<string>();

  // Get skill proficiencies and expertise
  [...(character.modifiers?.class || []), ...(character.modifiers?.race || []), ...(character.modifiers?.background || [])].forEach((m: any) => {
    if (m.type === 'proficiency' && m.subType === 'skill') {
      const skillName = m.friendlySubtypeName || '';
      if (m.isExpertise) {
        skillExpertise.add(skillName);
      } else {
        skillProficiencies.add(skillName);
      }
    }
  });

  // All D&D 5e skills with their associated ability
  const allSkills = [
    { name: 'Acrobatics', ability: 'dexterity' },
    { name: 'Animal Handling', ability: 'wisdom' },
    { name: 'Arcana', ability: 'intelligence' },
    { name: 'Athletics', ability: 'strength' },
    { name: 'Deception', ability: 'charisma' },
    { name: 'History', ability: 'intelligence' },
    { name: 'Insight', ability: 'wisdom' },
    { name: 'Intimidation', ability: 'charisma' },
    { name: 'Investigation', ability: 'intelligence' },
    { name: 'Medicine', ability: 'wisdom' },
    { name: 'Nature', ability: 'intelligence' },
    { name: 'Perception', ability: 'wisdom' },
    { name: 'Performance', ability: 'charisma' },
    { name: 'Persuasion', ability: 'charisma' },
    { name: 'Religion', ability: 'intelligence' },
    { name: 'Sleight of Hand', ability: 'dexterity' },
    { name: 'Stealth', ability: 'dexterity' },
    { name: 'Survival', ability: 'wisdom' },
  ];

  const profBonus = character.proficiencyBonus || 2;

  const skills = allSkills.map((skill) => {
    const abilityScore = abilityScores[skill.ability] || 10;
    const abilityMod = Math.floor((abilityScore - 10) / 2);
    const isProficient = skillProficiencies.has(skill.name);
    const isExpert = skillExpertise.has(skill.name);

    let bonus = abilityMod;
    if (isExpert) {
      bonus += profBonus * 2; // Expertise = double proficiency
    } else if (isProficient) {
      bonus += profBonus;
    }

    return {
      name: skill.name,
      ability: skill.ability,
      modifier: bonus >= 0 ? `+${bonus}` : `${bonus}`,
      proficient: isProficient,
      expertise: isExpert,
    };
  });

  // Extract proficiencies
  const proficiencies: string[] = [];
  (character.modifiers?.race || []).forEach((m: any) => {
    if (m.type === 'proficiency') {
      proficiencies.push(m.friendlySubtypeName || 'Unknown');
    }
  });
  (character.modifiers?.class || []).forEach((m: any) => {
    if (m.type === 'proficiency') {
      proficiencies.push(m.friendlySubtypeName || 'Unknown');
    }
  });

  // Extract features
  const features: any[] = [];
  classes.forEach((cls: any) => {
    (cls.classFeatures || []).forEach((feature: any) => {
      const def = feature.definition || {};
      features.push({
        name: def.name || 'Unknown Feature',
        description: def.description || def.snippet || '',
      });
    });
  });

  // Extract racial traits
  (character.race?.racialTraits || []).forEach((trait: any) => {
    const def = trait.definition || {};
    features.push({
      name: def.name || 'Unknown Trait',
      description: def.description || def.snippet || '',
    });
  });

  // Extract feats
  const feats = (character.feats || []).map((feat: any) => {
    const def = feat.definition || {};
    return {
      name: def.name || 'Unknown Feat',
      description: def.description || def.snippet || '',
    };
  });

  // Extract equipment
  const equipment = (character.inventory || []).map((item: any) => {
    const def = item.definition || {};
    return {
      name: def.name || 'Unknown Item',
      quantity: item.quantity || 1,
    };
  });

  // Extract spells
  const spells: any[] = [];
  const spellSlots: any = {};

  // Get spells from class spells
  (character.classSpells || []).forEach((classSpell: any) => {
    (classSpell.spells || []).forEach((spell: any) => {
      const def = spell.definition || {};
      spells.push({
        name: def.name || 'Unknown Spell',
        level: def.level || 0,
        school: def.school?.name || '',
      });
    });
  });

  // Get spell slots
  (character.spellSlots || []).forEach((slot: any) => {
    spellSlots[`level${slot.level}`] = {
      total: slot.available || 0,
      used: slot.used || 0,
    };
  });

  // Extract avatar
  let imageUrl = character.decorations?.avatarUrl || character.avatarUrl;
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `https://www.dndbeyond.com${imageUrl}`;
  }

  // Build character data
  return {
    characterName: character.name || 'Unknown Character',
    playerName: character.username || null,
    race,
    class: className,
    level: totalLevel,
    background,
    imageUrl,
    backstory: character.notes?.backstory || character.backstory || null,
    abilityScores,
    savingThrows,
    skills,
    proficiencies: [...new Set(proficiencies)], // Remove duplicates
    proficiencyBonus: character.proficiencyBonus ? `+${character.proficiencyBonus}` : '+2',
    armorClass: character.armorClass || 10,
    hitPoints: {
      current: character.currentHitPoints || 0,
      max: character.baseHitPoints || 0,
      temp: character.temporaryHitPoints || 0,
    },
    speed: `${character.speed || 30} ft.`,
    features,
    feats,
    equipment,
    spells,
    spellSlots,
  };
}

export interface DDBCampaignCharacterRef {
  characterId: string;
  isPublic: boolean;
}

export async function fetchDDBCampaignCharacters(
  campaignUrl: string,
  cobaltToken: string
): Promise<{ success: boolean; characters?: DDBCampaignCharacterRef[]; message?: string }> {
  try {
    const match = campaignUrl.match(/\/campaigns\/(\d+)/);
    if (!match) {
      return { success: false, message: 'Could not parse campaign ID from URL.' };
    }
    const campaignId = match[1];

    const response = await fetch(
      `https://www.dndbeyond.com/api/campaign/${campaignId}/characters`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://www.dndbeyond.com',
          'Referer': 'https://www.dndbeyond.com/',
          Cookie: `CobaltSession=${cobaltToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid or expired Cobalt token.' };
      }
      return { success: false, message: `DDB returned ${response.status}` };
    }

    const json = await response.json();
    const rawChars: any[] = json?.data?.characters ?? json?.data ?? [];
    const characters: DDBCampaignCharacterRef[] = rawChars.map((c: any) => ({
      characterId: String(c.id ?? c.characterId),
      isPublic: !!c.shareable,
    }));

    return { success: true, characters };
  } catch (error) {
    return {
      success: false,
      message: `Error fetching campaign characters: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
