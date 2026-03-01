// SRD 5.1 Creative Commons — Races, Classes, Backgrounds

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface SrdRace {
  id: string;
  name: string;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  speed: number;
  size: 'Small' | 'Medium';
  traits: string[];
}

export interface SrdClass {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility: string;
  savingThrows: AbilityKey[];
  description: string;
}

export interface SrdBackground {
  id: string;
  name: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  description: string;
}

export const SRD_RACES: SrdRace[] = [
  { id: 'dragonborn', name: 'Dragonborn', abilityBonuses: { str: 2, cha: 1 }, speed: 30, size: 'Medium', traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'] },
  { id: 'dwarf-hill', name: 'Dwarf (Hill)', abilityBonuses: { con: 2, wis: 1 }, speed: 25, size: 'Medium', traits: ['Darkvision', 'Dwarven Resilience', 'Stonecunning'] },
  { id: 'elf-high', name: 'Elf (High)', abilityBonuses: { dex: 2, int: 1 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Fey Ancestry', 'Trance', 'Keen Senses'] },
  { id: 'gnome-rock', name: 'Gnome (Rock)', abilityBonuses: { int: 2, con: 1 }, speed: 25, size: 'Small', traits: ['Darkvision', 'Gnome Cunning', "Artificer's Lore", 'Tinker'] },
  { id: 'half-elf', name: 'Half-Elf', abilityBonuses: { cha: 2 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility', '+1 to two ability scores of your choice'] },
  { id: 'half-orc', name: 'Half-Orc', abilityBonuses: { str: 2, con: 1 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'] },
  { id: 'halfling-lightfoot', name: 'Halfling (Lightfoot)', abilityBonuses: { dex: 2, cha: 1 }, speed: 25, size: 'Small', traits: ['Lucky', 'Brave', 'Halfling Nimbleness', 'Naturally Stealthy'] },
  { id: 'human', name: 'Human', abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, size: 'Medium', traits: ['Extra Language', '+1 to all ability scores'] },
  { id: 'tiefling', name: 'Tiefling', abilityBonuses: { cha: 2, int: 1 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'] },
];

export const SRD_CLASSES: SrdClass[] = [
  { id: 'barbarian', name: 'Barbarian', hitDie: 12, primaryAbility: 'STR', savingThrows: ['str', 'con'], description: 'A fierce warrior who can enter a battle rage.' },
  { id: 'bard', name: 'Bard', hitDie: 8, primaryAbility: 'CHA', savingThrows: ['dex', 'cha'], description: 'An inspiring magician whose power echoes the music of creation.' },
  { id: 'cleric', name: 'Cleric', hitDie: 8, primaryAbility: 'WIS', savingThrows: ['wis', 'cha'], description: 'A priestly champion who wields divine magic in service of a higher power.' },
  { id: 'druid', name: 'Druid', hitDie: 8, primaryAbility: 'WIS', savingThrows: ['int', 'wis'], description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.' },
  { id: 'fighter', name: 'Fighter', hitDie: 10, primaryAbility: 'STR or DEX', savingThrows: ['str', 'con'], description: 'A master of martial combat, skilled with a variety of weapons and armor.' },
  { id: 'monk', name: 'Monk', hitDie: 8, primaryAbility: 'DEX & WIS', savingThrows: ['str', 'dex'], description: 'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.' },
  { id: 'paladin', name: 'Paladin', hitDie: 10, primaryAbility: 'STR & CHA', savingThrows: ['wis', 'cha'], description: 'A holy warrior bound to a sacred oath.' },
  { id: 'ranger', name: 'Ranger', hitDie: 10, primaryAbility: 'DEX & WIS', savingThrows: ['str', 'dex'], description: 'A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization.' },
  { id: 'rogue', name: 'Rogue', hitDie: 8, primaryAbility: 'DEX', savingThrows: ['dex', 'int'], description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.' },
  { id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primaryAbility: 'CHA', savingThrows: ['con', 'cha'], description: 'A spellcaster who draws on inherent magic from a gift or bloodline.' },
  { id: 'warlock', name: 'Warlock', hitDie: 8, primaryAbility: 'CHA', savingThrows: ['wis', 'cha'], description: 'A wielder of magic derived from a bargain with an extraplanar entity.' },
  { id: 'wizard', name: 'Wizard', hitDie: 6, primaryAbility: 'INT', savingThrows: ['int', 'wis'], description: 'A scholarly magic-user capable of manipulating the structures of reality.' },
];

export const SRD_BACKGROUNDS: SrdBackground[] = [
  { id: 'acolyte', name: 'Acolyte', skillProficiencies: ['Insight', 'Religion'], toolProficiencies: ['Two languages'], description: 'You have spent your life in service to a temple.' },
  { id: 'charlatan', name: 'Charlatan', skillProficiencies: ['Deception', 'Sleight of Hand'], toolProficiencies: ['Disguise kit', 'Forgery kit'], description: 'You have always had a knack for making people believe what you tell them.' },
  { id: 'criminal', name: 'Criminal', skillProficiencies: ['Deception', 'Stealth'], toolProficiencies: ['Gaming set', "Thieves' tools"], description: 'You are an experienced criminal with a history of breaking the law.' },
  { id: 'entertainer', name: 'Entertainer', skillProficiencies: ['Acrobatics', 'Performance'], toolProficiencies: ['Disguise kit', 'Musical instrument'], description: 'You thrive in front of an audience.' },
  { id: 'folk-hero', name: 'Folk Hero', skillProficiencies: ['Animal Handling', 'Survival'], toolProficiencies: ["Artisan's tools", 'Vehicles (land)'], description: 'You come from a humble social rank, but you are destined for so much more.' },
  { id: 'guild-artisan', name: 'Guild Artisan', skillProficiencies: ['Insight', 'Persuasion'], toolProficiencies: ["Artisan's tools", 'One language'], description: 'You are a member of an artisan\'s guild.' },
  { id: 'hermit', name: 'Hermit', skillProficiencies: ['Medicine', 'Religion'], toolProficiencies: ['Herbalism kit', 'One language'], description: 'You lived in seclusion for a formative part of your life.' },
  { id: 'noble', name: 'Noble', skillProficiencies: ['History', 'Persuasion'], toolProficiencies: ['Gaming set', 'One language'], description: 'You understand wealth, power, and privilege.' },
  { id: 'outlander', name: 'Outlander', skillProficiencies: ['Athletics', 'Survival'], toolProficiencies: ['Musical instrument', 'One language'], description: 'You grew up in the wilds, far from civilization.' },
  { id: 'sage', name: 'Sage', skillProficiencies: ['Arcana', 'History'], toolProficiencies: ['Two languages'], description: 'You spent years learning the lore of the multiverse.' },
  { id: 'sailor', name: 'Sailor', skillProficiencies: ['Athletics', 'Perception'], toolProficiencies: ["Navigator's tools", 'Vehicles (water)'], description: 'You sailed on a seagoing vessel for years.' },
  { id: 'soldier', name: 'Soldier', skillProficiencies: ['Athletics', 'Intimidation'], toolProficiencies: ['Gaming set', 'Vehicles (land)'], description: 'War has been your life for as long as you care to remember.' },
  { id: 'urchin', name: 'Urchin', skillProficiencies: ['Sleight of Hand', 'Stealth'], toolProficiencies: ['Disguise kit', "Thieves' tools"], description: 'You grew up on the streets alone, orphaned, and poor.' },
];
