import { cn } from '@/lib/utils';

export type DndIconName =
  // Ability scores
  | 'ability/charisma' | 'ability/constitution' | 'ability/dexterity'
  | 'ability/intelligence' | 'ability/strength' | 'ability/wisdom'
  // Attributes
  | 'attribute/ac' | 'attribute/attunement' | 'attribute/bonus' | 'attribute/light'
  | 'attribute/penalty' | 'attribute/range' | 'attribute/saving-throw'
  | 'attribute/skillcheck' | 'attribute/terrain' | 'attribute/test' | 'attribute/vision'
  // Campaigns
  | 'campaign/candlekeep' | 'campaign/curse-of-strahd' | 'campaign/descent-into-avernus'
  | 'campaign/elemental-evil' | 'campaign/hoard-of-the-dragon-queen'
  | 'campaign/light-of-xaryxis' | 'campaign/out-of-the-abyss'
  | 'campaign/rime-of-the-frostmaiden' | 'campaign/storm-kings-thunder'
  | 'campaign/tomb-of-annihilation' | 'campaign/waterdeep' | 'campaign/yawning-portal'
  // Classes
  | 'class/artificer' | 'class/barbarian' | 'class/bard' | 'class/cleric'
  | 'class/druid' | 'class/fighter' | 'class/monk' | 'class/paladin'
  | 'class/ranger' | 'class/rogue' | 'class/sorcerer' | 'class/warlock' | 'class/wizard'
  // Combat
  | 'combat/action' | 'combat/bonus-action' | 'combat/initiative' | 'combat/melee'
  | 'combat/ranged' | 'combat/reach' | 'combat/reaction' | 'combat/round' | 'combat/target'
  // Conditions
  | 'condition/blinded' | 'condition/charmed' | 'condition/deafened' | 'condition/exhaustion'
  | 'condition/frightened' | 'condition/grappled' | 'condition/incapacitated'
  | 'condition/invisible' | 'condition/paralyzed' | 'condition/petrified'
  | 'condition/poisoned' | 'condition/prone' | 'condition/restrained' | 'condition/stunned'
  | 'condition/suffocating' | 'condition/unconscious' | 'condition/concentrating'
  // D20 Tests
  | 'd20test/ability-check' | 'd20test/attack-roll' | 'd20test/saving-throw'
  // Damage types
  | 'damage/acid' | 'damage/bludgeoning' | 'damage/cold' | 'damage/fire' | 'damage/force'
  | 'damage/lightning' | 'damage/necrotic' | 'damage/piercing' | 'damage/poison'
  | 'damage/psychic' | 'damage/radiant' | 'damage/slashing' | 'damage/thunder'
  | 'damage/healing' | 'damage/temphp' | 'damage/generic'
  // Dice
  | 'dice/d4' | 'dice/d6' | 'dice/d8' | 'dice/d10' | 'dice/d12' | 'dice/d20' | 'dice/d100'
  | 'dice/coin' | 'dice/generic'
  // Entities
  | 'entity/beast' | 'entity/character' | 'entity/deity' | 'entity/dragon'
  | 'entity/elemental' | 'entity/faction' | 'entity/fey' | 'entity/fiend' | 'entity/giant'
  | 'entity/humanoid' | 'entity/item' | 'entity/location' | 'entity/monstrosity'
  | 'entity/npc' | 'entity/ooze' | 'entity/organization' | 'entity/party' | 'entity/pc'
  | 'entity/plant' | 'entity/quest' | 'entity/session' | 'entity/undead' | 'entity/vehicle'
  | 'entity/aberration' | 'entity/construct' | 'entity/celestial'
  // Game
  | 'game/adventure' | 'game/backstory' | 'game/campaign' | 'game/character-sheet'
  | 'game/combat' | 'game/encounter' | 'game/inspiration' | 'game/lore' | 'game/magic'
  | 'game/map' | 'game/npc' | 'game/quest' | 'game/rest' | 'game/reward'
  | 'game/roleplay' | 'game/session' | 'game/tavern' | 'game/treasure'
  // HP
  | 'hp/bloodied' | 'hp/dead' | 'hp/full' | 'hp/hurt' | 'hp/unconscious'
  // Locations
  | 'location/cave' | 'location/city' | 'location/dungeon' | 'location/forest'
  | 'location/mountain' | 'location/ocean' | 'location/plane' | 'location/ruins'
  | 'location/settlement' | 'location/swamp' | 'location/tower'
  // Logo
  | 'logo/dnd' | 'logo/dnd-one' | 'logo/dungeon-master' | 'logo/forgotten-realms'
  | 'logo/greyhawk' | 'logo/planescape' | 'logo/ravenloft' | 'logo/spelljammer'
  | 'logo/wildemount'
  // Monsters
  | 'monster/aberration' | 'monster/beast' | 'monster/celestial' | 'monster/construct'
  | 'monster/dragon' | 'monster/elemental' | 'monster/fey' | 'monster/fiend'
  | 'monster/giant' | 'monster/humanoid' | 'monster/monstrosity' | 'monster/ooze'
  | 'monster/plant' | 'monster/undead'
  // Movement
  | 'movement/burrow' | 'movement/climb' | 'movement/fly' | 'movement/speed' | 'movement/swim'
  // Proficiency
  | 'proficiency/expertise' | 'proficiency/half' | 'proficiency/none' | 'proficiency/proficient'
  // Skills
  | 'skill/acrobatics' | 'skill/animal-handling' | 'skill/arcana' | 'skill/athletics'
  | 'skill/deception' | 'skill/history' | 'skill/insight' | 'skill/intimidation'
  | 'skill/investigation' | 'skill/medicine' | 'skill/nature' | 'skill/perception'
  | 'skill/performance' | 'skill/persuasion' | 'skill/religion' | 'skill/sleight-of-hand'
  | 'skill/stealth' | 'skill/survival'
  // Slots
  | 'slot/level-1' | 'slot/level-2' | 'slot/level-3' | 'slot/level-4' | 'slot/level-5'
  | 'slot/level-6' | 'slot/level-7' | 'slot/level-8' | 'slot/level-9'
  | 'slot/pact-magic' | 'slot/cantrip' | 'slot/ritual' | 'slot/innate' | 'slot/generic'
  // Spells
  | 'spell/abjuration' | 'spell/concentration' | 'spell/conjuration' | 'spell/divination'
  | 'spell/enchantment' | 'spell/evocation' | 'spell/illusion' | 'spell/instantaneous'
  | 'spell/material' | 'spell/necromancy' | 'spell/octagon' | 'spell/ritual'
  | 'spell/somatic' | 'spell/transmutation' | 'spell/upcast' | 'spell/vocal'
  // Targets
  | 'target/circle' | 'target/cone' | 'target/cube' | 'target/cylinder'
  | 'target/emanation' | 'target/line' | 'target/self' | 'target/sphere'
  | 'target/square' | 'target/touch' | 'target/wall'
  // Utility
  | 'util/bubble' | 'util/build' | 'util/cog' | 'util/cross' | 'util/home'
  | 'util/not-applicable' | 'util/search' | 'util/star' | 'util/tick' | 'util/trade'
  // Weapons
  | 'weapon/arrow' | 'weapon/battleaxe' | 'weapon/bow' | 'weapon/club'
  | 'weapon/crossbow' | 'weapon/dagger' | 'weapon/flail' | 'weapon/glaive'
  | 'weapon/halberd' | 'weapon/hammer' | 'weapon/handaxe' | 'weapon/lance'
  | 'weapon/mace' | 'weapon/morningstar' | 'weapon/musket' | 'weapon/pike'
  | 'weapon/pistol' | 'weapon/rapier' | 'weapon/scimitar' | 'weapon/sickle'
  | 'weapon/sling' | 'weapon/spear' | 'weapon/staff' | 'weapon/strike'
  | 'weapon/sword' | 'weapon/trident' | 'weapon/whip';

interface DndIconProps {
  name: DndIconName;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function DndIcon({ name, className, style, alt = '' }: DndIconProps) {
  return (
    <img
      src={`/icons/dnd/${name}.svg`}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      className={cn('inline-block', className)}
      style={style}
    />
  );
}

// Convenience maps for common lookups
export const ABILITY_ICONS: Record<string, DndIconName> = {
  str: 'ability/strength',
  dex: 'ability/dexterity',
  con: 'ability/constitution',
  int: 'ability/intelligence',
  wis: 'ability/wisdom',
  cha: 'ability/charisma',
};

export const SKILL_ICONS: Record<string, DndIconName> = {
  Acrobatics: 'skill/acrobatics',
  'Animal Handling': 'skill/animal-handling',
  Arcana: 'skill/arcana',
  Athletics: 'skill/athletics',
  Deception: 'skill/deception',
  History: 'skill/history',
  Insight: 'skill/insight',
  Intimidation: 'skill/intimidation',
  Investigation: 'skill/investigation',
  Medicine: 'skill/medicine',
  Nature: 'skill/nature',
  Perception: 'skill/perception',
  Performance: 'skill/performance',
  Persuasion: 'skill/persuasion',
  Religion: 'skill/religion',
  'Sleight of Hand': 'skill/sleight-of-hand',
  Stealth: 'skill/stealth',
  Survival: 'skill/survival',
};

export const DAMAGE_ICONS: Record<string, DndIconName> = {
  acid: 'damage/acid',
  bludgeoning: 'damage/bludgeoning',
  cold: 'damage/cold',
  fire: 'damage/fire',
  force: 'damage/force',
  lightning: 'damage/lightning',
  necrotic: 'damage/necrotic',
  piercing: 'damage/piercing',
  poison: 'damage/poison',
  psychic: 'damage/psychic',
  radiant: 'damage/radiant',
  slashing: 'damage/slashing',
  thunder: 'damage/thunder',
};

export const CONDITION_ICONS: Record<string, DndIconName> = {
  blinded: 'condition/blinded',
  charmed: 'condition/charmed',
  deafened: 'condition/deafened',
  exhaustion: 'condition/exhaustion',
  frightened: 'condition/frightened',
  grappled: 'condition/grappled',
  incapacitated: 'condition/incapacitated',
  invisible: 'condition/invisible',
  paralyzed: 'condition/paralyzed',
  petrified: 'condition/petrified',
  poisoned: 'condition/poisoned',
  prone: 'condition/prone',
  restrained: 'condition/restrained',
  stunned: 'condition/stunned',
  unconscious: 'condition/unconscious',
};

export const CLASS_ICONS: Record<string, DndIconName> = {
  Artificer: 'class/artificer',
  Barbarian: 'class/barbarian',
  Bard: 'class/bard',
  Cleric: 'class/cleric',
  Druid: 'class/druid',
  Fighter: 'class/fighter',
  Monk: 'class/monk',
  Paladin: 'class/paladin',
  Ranger: 'class/ranger',
  Rogue: 'class/rogue',
  Sorcerer: 'class/sorcerer',
  Warlock: 'class/warlock',
  Wizard: 'class/wizard',
};
