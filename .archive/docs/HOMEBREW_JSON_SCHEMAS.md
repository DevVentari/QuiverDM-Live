# Homebrew Content JSON Schemas

This document defines the JSON structure for the `data` field in the `HomebrewContent` model for each content type.

## Content Types

- [Magic Items](#magic-items)
- [Spells](#spells)
- [Creatures](#creatures)
- [Races](#races)
- [Classes](#classes)
- [Subclasses](#subclasses)
- [Backgrounds](#backgrounds)
- [Feats](#feats)
- [Characters](#characters)

---

## Magic Items

**Type:** `item`

```typescript
interface MagicItemData {
  // Basic info
  itemType: 'weapon' | 'armor' | 'potion' | 'scroll' | 'ring' | 'wand' | 'rod' | 'staff' | 'wondrous' | 'other';
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact';
  requiresAttunement: boolean;
  attunementRequirements?: string; // e.g., "by a spellcaster", "by a cleric"

  // Physical properties
  weight?: number; // in pounds
  cost?: string; // e.g., "50 gp", "Priceless"

  // Weapon-specific
  weaponType?: 'simple' | 'martial';
  weaponCategory?: 'melee' | 'ranged';
  damage?: string; // e.g., "1d8 slashing", "2d6 + 1d6 fire"
  damageType?: string; // e.g., "slashing", "fire"
  properties?: string[]; // e.g., ["Finesse", "Light", "Thrown (range 20/60)"]

  // Armor-specific
  armorType?: 'light' | 'medium' | 'heavy' | 'shield';
  baseAC?: number; // e.g., 11 for leather
  acBonus?: number; // magical AC bonus
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;

  // Magical properties
  charges?: {
    max: number;
    recharge: string; // e.g., "1d6 + 4 at dawn", "All charges at midnight"
    regainDescription?: string;
  };
  spells?: {
    spellName: string;
    chargesCost: number;
    saveDC?: number;
    attackBonus?: number;
  }[];

  // Description
  description: string; // Full item description (markdown supported)

  // Source info
  source?: string; // e.g., "DMG", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

**Example:**
```json
{
  "itemType": "weapon",
  "rarity": "Rare",
  "requiresAttunement": true,
  "attunementRequirements": "by a creature that can speak Draconic",
  "weaponType": "martial",
  "weaponCategory": "melee",
  "damage": "1d8 + 2 slashing",
  "damageType": "slashing",
  "properties": ["Finesse", "Versatile (1d10 + 2)"],
  "description": "This elegant longsword features a dragon-shaped crossguard...",
  "charges": {
    "max": 7,
    "recharge": "1d6 + 1 at dawn"
  },
  "spells": [
    {
      "spellName": "Burning Hands",
      "chargesCost": 1,
      "saveDC": 15
    }
  ]
}
```

---

## Spells

**Type:** `spell`

```typescript
interface SpellData {
  // Basic info
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // 0 = cantrip
  school: 'Abjuration' | 'Conjuration' | 'Divination' | 'Enchantment' | 'Evocation' | 'Illusion' | 'Necromancy' | 'Transmutation';

  // Casting info
  castingTime: string; // e.g., "1 action", "1 bonus action", "1 minute", "1 hour"
  ritual: boolean;

  // Range and targeting
  range: string; // e.g., "30 feet", "Self", "Touch", "Sight", "1 mile"
  areaOfEffect?: {
    type: 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder';
    size: number; // in feet
  };

  // Components
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialComponents?: string; // e.g., "a drop of water"
    materialCost?: number; // in gp, if consumed
    materialConsumed?: boolean;
  };

  // Duration
  duration: string; // e.g., "Instantaneous", "1 minute", "Concentration, up to 10 minutes"
  concentration: boolean;

  // Effects
  description: string; // Full spell description (markdown supported)
  higherLevels?: string; // Description when cast at higher levels

  // Damage/healing
  damage?: {
    diceCount: number;
    diceSize: number;
    damageType: string; // e.g., "fire", "cold", "radiant"
    scaling?: {
      type: 'character_level' | 'spell_level';
      progression: { [level: number]: string }; // e.g., { 5: "2d10", 11: "3d10" }
    };
  };
  healing?: {
    diceCount: number;
    diceSize: number;
    modifier?: number;
    scaling?: {
      dicePerLevel: number; // additional dice per spell level above base
    };
  };

  // Saving throws and attack rolls
  saveType?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  saveEffect?: string; // e.g., "half damage", "no effect"
  attackType?: 'melee' | 'ranged'; // for spell attack rolls

  // Class availability
  classes: string[]; // e.g., ["Wizard", "Sorcerer", "Warlock"]

  // Source info
  source?: string; // e.g., "PHB", "XGE", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

**Example:**
```json
{
  "level": 3,
  "school": "Evocation",
  "castingTime": "1 action",
  "ritual": false,
  "range": "150 feet",
  "areaOfEffect": {
    "type": "sphere",
    "size": 20
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": true,
    "materialComponents": "a tiny ball of bat guano and sulfur"
  },
  "duration": "Instantaneous",
  "concentration": false,
  "description": "A bright streak flashes from your pointing finger...",
  "higherLevels": "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
  "damage": {
    "diceCount": 8,
    "diceSize": 6,
    "damageType": "fire",
    "scaling": {
      "type": "spell_level",
      "progression": {
        4: "9d6",
        5: "10d6"
      }
    }
  },
  "saveType": "DEX",
  "saveEffect": "half damage",
  "classes": ["Wizard", "Sorcerer"]
}
```

---

## Creatures

**Type:** `creature`

```typescript
interface CreatureData {
  // Basic info
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string; // e.g., "humanoid (elf)", "dragon", "undead"
  alignment: string; // e.g., "lawful evil", "unaligned", "any alignment"

  // Armor and hit points
  ac: number;
  acType?: string; // e.g., "natural armor", "plate armor"
  hitPoints: {
    average: number;
    diceCount: number;
    diceSize: number;
    modifier: number;
  };

  // Speed
  speed: {
    walk?: number;
    fly?: number;
    swim?: number;
    burrow?: number;
    climb?: number;
    hover?: boolean; // for flying creatures
  };

  // Ability scores
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };

  // Saving throws (only include proficient saves)
  savingThrows?: {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
  };

  // Skills
  skills?: {
    [skillName: string]: number; // e.g., { "Perception": 5, "Stealth": 8 }
  };

  // Defenses
  damageVulnerabilities?: string[]; // e.g., ["fire"]
  damageResistances?: string[]; // e.g., ["cold", "bludgeoning from nonmagical attacks"]
  damageImmunities?: string[];
  conditionImmunities?: string[]; // e.g., ["charmed", "frightened"]

  // Senses
  senses: {
    darkvision?: number;
    blindsight?: number;
    truesight?: number;
    tremorsense?: number;
    passivePerception: number;
  };

  // Languages
  languages: string[]; // e.g., ["Common", "Draconic"]

  // Challenge rating
  challengeRating: number | string; // e.g., 5 or "1/4" or "1/8"
  experiencePoints: number;
  proficiencyBonus: number;

  // Special traits
  traits?: {
    name: string;
    description: string;
  }[];

  // Actions
  actions: {
    name: string;
    description: string;
    attackType?: 'melee' | 'ranged';
    attackBonus?: number;
    reach?: number; // in feet
    range?: string; // e.g., "30/120 ft."
    damage?: {
      diceCount: number;
      diceSize: number;
      modifier?: number;
      damageType: string;
    }[];
    saveDC?: number;
    saveType?: string;
    saveEffect?: string;
  }[];

  // Reactions (optional)
  reactions?: {
    name: string;
    description: string;
  }[];

  // Legendary actions (optional)
  legendaryActions?: {
    description: string; // Opening text, e.g., "The dragon can take 3 legendary actions..."
    actions: {
      name: string;
      cost: number; // 1, 2, or 3
      description: string;
    }[];
  };

  // Lair actions (optional)
  lairActions?: {
    description: string;
    initiative: number;
    actions: string[]; // Array of action descriptions
  };

  // Description and lore
  description?: string;
  lore?: string;

  // Source info
  source?: string; // e.g., "MM", "VGM", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

**Example (abbreviated):**
```json
{
  "size": "Large",
  "type": "dragon",
  "alignment": "chaotic evil",
  "ac": 18,
  "acType": "natural armor",
  "hitPoints": {
    "average": 136,
    "diceCount": 13,
    "diceSize": 10,
    "modifier": 52
  },
  "speed": {
    "walk": 40,
    "fly": 80
  },
  "abilities": {
    "str": 19,
    "dex": 10,
    "con": 17,
    "int": 12,
    "wis": 11,
    "cha": 15
  },
  "challengeRating": 8,
  "experiencePoints": 3900,
  "proficiencyBonus": 3
}
```

---

## Races

**Type:** `race`

```typescript
interface RaceData {
  // Basic info
  size: 'Small' | 'Medium';
  speed: number; // base walking speed in feet

  // Ability score increases
  abilityScoreIncrease: {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    choice?: {
      count: number; // e.g., "increase two abilities by 1"
      amount: number;
    };
  };

  // Age
  age: {
    maturity: number; // age of maturity
    lifespan: number; // typical maximum age
    description?: string;
  };

  // Languages
  languages: string[]; // e.g., ["Common", "Elvish"]
  additionalLanguageChoices?: number; // number of additional languages

  // Traits
  traits: {
    name: string;
    description: string;
  }[];

  // Proficiencies
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  toolProficiencies?: string[];
  skillProficiencies?: string[];
  skillChoices?: {
    count: number;
    options: string[];
  };

  // Subraces
  hasSubraces: boolean;
  subraceOptions?: string[]; // Names of available subraces

  // Description
  description: string; // Physical description and lore (markdown)

  // Source info
  source?: string; // e.g., "PHB", "VGM", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

---

## Classes

**Type:** `class`

```typescript
interface ClassData {
  // Basic info
  hitDice: 6 | 8 | 10 | 12; // d6, d8, d10, or d12
  hitPointsAtFirstLevel: number;
  hitPointsAtHigherLevels: string; // e.g., "1d8 (or 5) + your Constitution modifier per level"

  // Proficiencies
  armorProficiencies: string[]; // e.g., ["Light armor", "Medium armor"]
  weaponProficiencies: string[]; // e.g., ["Simple weapons", "Martial weapons"]
  toolProficiencies?: string[];
  savingThrowProficiencies: ('STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA')[];
  skillProficiencies: {
    count: number;
    options: string[];
  };

  // Starting equipment
  startingEquipment: string[]; // Array of equipment descriptions
  startingGold?: {
    diceCount: number;
    diceSize: number;
    multiplier: number; // e.g., 4d4 × 10 gp
  };

  // Spellcasting (if applicable)
  spellcasting?: {
    ability: 'INT' | 'WIS' | 'CHA';
    spellSlotsPerLevel: {
      [level: number]: number[]; // e.g., { 1: [2], 2: [3], 3: [4, 2] }
    };
    cantripsKnown?: number[];
    spellsKnown?: number[];
    preparedSpells?: string; // e.g., "Intelligence modifier + cleric level"
    ritual: boolean;
    spellcastingFocus?: string;
  };

  // Class features by level
  features: {
    level: number;
    name: string;
    description: string;
  }[];

  // Class table (for quick reference)
  classTable: {
    level: number;
    proficiencyBonus: number;
    features: string[]; // Feature names gained at this level
    [key: string]: any; // Class-specific columns (e.g., Rage Damage, Sneak Attack, etc.)
  }[];

  // Subclass info
  subclassLevel: number; // Level when you choose a subclass
  subclassName: string; // e.g., "Sacred Oath", "Martial Archetype"

  // Multiclassing (optional)
  multiclassing?: {
    prerequisites: {
      [ability: string]: number; // e.g., { "STR": 13 }
    };
    armorProficiencies?: string[];
    weaponProficiencies?: string[];
  };

  // Description
  description: string; // Class description and playstyle (markdown)

  // Source info
  source?: string; // e.g., "PHB", "XGE", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

---

## Subclasses

**Type:** `subclass`

```typescript
interface SubclassData {
  // Parent class
  parentClass: string; // e.g., "Fighter", "Cleric", "Wizard"

  // Subclass info
  subclassType: string; // e.g., "Martial Archetype", "Divine Domain"

  // Description
  description: string; // Subclass theme and description (markdown)

  // Subclass features by level
  features: {
    level: number;
    name: string;
    description: string;
  }[];

  // Spells (for subclasses that grant spells)
  spellsByLevel?: {
    [level: number]: string[]; // Spell names by character level
  };

  // Source info
  source?: string; // e.g., "PHB", "XGE", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

**Example:**
```json
{
  "parentClass": "Cleric",
  "subclassType": "Divine Domain",
  "description": "Gods of knowledge value learning and understanding above all...",
  "features": [
    {
      "level": 1,
      "name": "Blessings of Knowledge",
      "description": "You learn two languages of your choice..."
    },
    {
      "level": 2,
      "name": "Channel Divinity: Knowledge of the Ages",
      "description": "You can use your Channel Divinity to tap into a divine well of knowledge..."
    }
  ],
  "spellsByLevel": {
    1: ["Command", "Identify"],
    3: ["Augury", "Suggestion"],
    5: ["Nondetection", "Speak with Dead"]
  }
}
```

---

## Backgrounds

**Type:** `background`

```typescript
interface BackgroundData {
  // Proficiencies
  skillProficiencies: string[]; // e.g., ["Athletics", "Intimidation"]
  toolProficiencies?: string[];
  languages?: {
    count: number;
    specific?: string[]; // Specific languages, if any
  };

  // Starting equipment
  equipment: string[]; // Array of equipment descriptions
  startingGold?: number;

  // Feature
  feature: {
    name: string;
    description: string;
  };

  // Personality traits
  suggestedCharacteristics: {
    personalityTraits: string[];
    ideals: string[];
    bonds: string[];
    flaws: string[];
  };

  // Description
  description: string; // Background description and lore (markdown)

  // Variant (optional)
  variant?: {
    name: string;
    description: string;
    changes?: string; // What changes from the base background
  };

  // Source info
  source?: string; // e.g., "PHB", "SCAG", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

---

## Feats

**Type:** `feat`

```typescript
interface FeatData {
  // Prerequisites
  prerequisites?: {
    ability?: {
      [abilityScore: string]: number; // e.g., { "STR": 13 }
    };
    proficiency?: string[]; // e.g., ["Heavy armor proficiency"]
    spellcasting?: boolean;
    level?: number;
    other?: string; // Freeform text for other requirements
  };

  // Ability score increase (if applicable)
  abilityScoreIncrease?: {
    count: number; // e.g., 1 for "+1 to an ability score"
    max: number; // Usually 1, for feats that give +1
    choices: ('STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA')[];
  };

  // Benefits
  description: string; // Full feat description (markdown)

  // Repeatable?
  repeatable: boolean;

  // Source info
  source?: string; // e.g., "PHB", "XGE", "Homebrew"
  sourceBook?: string;
  sourcePage?: number;
}
```

**Example:**
```json
{
  "prerequisites": {
    "ability": {
      "STR": 13
    }
  },
  "description": "You've developed the skills necessary to hold your own in close-quarters grappling...",
  "repeatable": false,
  "source": "PHB"
}
```

---

## Characters

**Type:** `character`

```typescript
interface CharacterData {
  // Basic info
  race: string;
  class: string;
  level: number;
  background?: string;
  alignment?: string;

  // Ability scores
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };

  // Proficiencies
  proficiencyBonus: number;
  savingThrows: string[];
  skills: {
    [skillName: string]: {
      proficient: boolean;
      expertise?: boolean;
    };
  };

  // Combat stats
  armorClass: number;
  initiative: number;
  speed: number;
  hitPoints: {
    max: number;
    current: number;
    temporary?: number;
  };
  hitDice: {
    total: number;
    current: number;
    size: number;
  };
  deathSaves?: {
    successes: number;
    failures: number;
  };

  // Features and traits
  features: {
    name: string;
    source: string; // e.g., "Race: Elf", "Class: Fighter", "Feat: Alert"
    description: string;
  }[];

  // Equipment
  equipment?: {
    name: string;
    quantity: number;
    equipped?: boolean;
  }[];

  // Spellcasting (if applicable)
  spellcasting?: {
    ability: 'INT' | 'WIS' | 'CHA';
    spellSaveDC: number;
    spellAttackBonus: number;
    spellSlots?: {
      [level: number]: {
        max: number;
        used: number;
      };
    };
    spellsKnown?: string[];
    spellsPrepared?: string[];
    cantrips?: string[];
  };

  // Personality
  personality?: {
    traits?: string[];
    ideals?: string[];
    bonds?: string[];
    flaws?: string[];
  };

  // Backstory
  backstory?: string;

  // Appearance
  appearance?: {
    age?: number;
    height?: string;
    weight?: string;
    eyes?: string;
    skin?: string;
    hair?: string;
  };

  // Notes
  notes?: string;
}
```

---

## Validation Rules

When validating homebrew content, consider these rules:

1. **Required fields**: `name`, `description` (or equivalent) should always be present
2. **Ability scores**: Must be between 1 and 30
3. **Challenge Rating**: Valid options are 0, 1/8, 1/4, 1/2, 1-30
4. **Spell levels**: 0-9 only
5. **Damage dice**: Valid dice are d4, d6, d8, d10, d12, d20, d100
6. **Rarity**: Must match D&D 5e rarity tiers
7. **Classes**: Should reference official or homebrew class names
8. **Skills**: Should match D&D 5e skill list

## Extending Schemas

These schemas are flexible and can be extended with additional fields as needed. The `data` field is JSON, so new properties can be added without schema migrations.

When adding new fields:
1. Document them in this file
2. Update form validation logic
3. Update display components to show the new data
4. Consider backward compatibility with existing content
