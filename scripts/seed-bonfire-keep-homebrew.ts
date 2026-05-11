/**
 * Seed script: Add Tales From The Bonfire Keep homebrew content
 * Campaign ID: cmlu9b18e0001k4ndqbhhgw33
 * User ID: cmlfsyvxw0001gqt4jid8a1m3
 *
 * Run: npx tsx scripts/seed-bonfire-keep-homebrew.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CAMPAIGN_ID = 'cmlu9b18e0001k4ndqbhhgw33';
const USER_ID = 'cmlfsyvxw0001gqt4jid8a1m3';

// ============================================================================
// HOMEBREW CONTENT
// ============================================================================

const homebrewItems = [
  // ── MAGIC ITEM ──────────────────────────────────────────────────────────────
  {
    type: 'item',
    name: 'Duskfall Blade',
    tags: ['weapon', 'longsword', 'rare', 'cursed', 'necrotic', 'attunement', 'withered', 'bonfire-keep'],
    data: {
      rarity: 'rare',
      requiresAttunement: true,
      itemType: 'Weapon (longsword)',
      description:
        'Once a ceremonial blade blessed by Serenitas in her pure form, this weapon now weeps purple-red energy from hairline cracks along its steel. The crossguard bears withered roses that never fully decay, and the grip feels unnaturally cold to the touch.',
      properties: [
        'Damage: 1d8 slashing + 1d4 necrotic',
        '+1 to attack and damage rolls',
        'Withering Strike: On a critical hit, target must make DC 13 Constitution save or gain one stage of Withered condition',
        'Entropic Resonance: Deals +1d6 necrotic damage to creatures already Withered',
      ],
      curse:
        'The wielder experiences creeping despair. After each combat, make a DC 12 Wisdom save or suffer vivid dreams of peaceful endings. Three failures advance the wielder one stage of Withered condition.',
      lore:
        "Captain Marcus Draven's blade, corrupted by prolonged exposure to Serenitas's cosmic prison. The weapon channels entropy corruption—it doesn't just cut flesh, it severs hope itself.",
      imagePromptHint:
        'A longsword with a blade covered in hairline cracks leaking purple-red energy, a crossguard of withered roses that never decay, and an unnaturally cold dark grip.',
    },
    searchText:
      'Duskfall Blade longsword rare attunement necrotic cursed withered corruption entropy Serenitas Marcus Draven magic item weapon',
  },

  // ── RACE ────────────────────────────────────────────────────────────────────
  {
    type: 'race',
    name: 'Skaven (Ratfolk)',
    tags: ['race', 'player-option', 'skaven', 'ratfolk', 'homebrew', 'bonfire-keep'],
    data: {
      description:
        'Skaven are a race of rat-like humanoids known for their cunning, speed, and insatiable hunger for power. Dwelling in deep warrens beneath cities, they live in vast, sprawling under-empires ruled by vicious warlords and shadowy seers.',
      flavorQuote: '"Quick-quick, move-run, stab-kill, take-take!" — Gritchk Slinktail, Skaven Clanrat',
      abilityScoreIncrease: 'Dexterity +2, Intelligence +1',
      age: 'Mature by age 5, rarely live past 40',
      alignment: 'Usually chaotic, tendency toward evil; some rare individuals break free',
      size: 'Medium (4–5 feet tall, wiry and quick)',
      speed: '35 ft. walking, 15 ft. climbing, 20 ft. swimming',
      traits: [
        'Darkvision 60 ft.',
        'Keen Smell: Advantage on Perception checks that rely on smell',
        'Plagueborn: Resistance to poison damage, advantage on saves against disease',
        'Cowardly Nature: Disadvantage on saving throws against being frightened',
        'Vermin Agility: When you take the Disengage action, you can move an additional 10 feet',
      ],
      languages: ['Common', 'Undercommon'],
      subraces: [
        {
          name: 'Clanrat',
          description: 'The teeming masses forming the backbone of Skaven society, known for swarm tactics and vicious cunning.',
          abilityScoreIncrease: 'Constitution +1',
          traits: [
            'Swarm Tactics: +1 to attack rolls when an ally is within 5 feet of your target',
            'Scavenge: Proficiency in Sleight of Hand',
          ],
        },
        {
          name: 'Plague Skaven',
          description: 'Carriers of pestilence who use disease as a weapon and embrace the filth that empowers them.',
          abilityScoreIncrease: 'Wisdom +1',
          traits: [
            'Plague Aura: As a bonus action, emit a wave of sickness. Creatures of your choice within 5 ft. must succeed on a Con save (DC = 8 + proficiency + Con mod) or be poisoned until the end of their next turn. Uses equal to proficiency bonus per long rest.',
            'Disease Lore: Proficiency in Medicine',
          ],
        },
        {
          name: 'Warlock Skaven',
          description: 'Wielders of warp energies who craft devices of death and wield forbidden magics.',
          abilityScoreIncrease: 'Intelligence +1',
          traits: [
            "Tinkerer's Instinct: Proficiency with tinker's tools",
            'Warp Sense: Cast detect magic once per long rest without a spell slot (Intelligence spellcasting)',
          ],
        },
      ],
      names: {
        male: 'Skreek, Snikt, Snikch, Skrit, Skreekal, Tretch, Ikit, Queek',
        female: 'Skritta, Snikla, Skreela, Trikket, Snaka, Vreeka',
        clan: 'Slinktail, Quickfang, Plagetooth, Rustfur, Warpclaw, Pestilent, Steelfang',
      },
      imagePromptHint:
        'A wiry rat-like humanoid standing about 4-5 feet tall with sharp cunning eyes, ratlike snout, visible claws, and tattered adventuring gear in a dungeon setting.',
    },
    searchText:
      'Skaven Ratfolk race player option ratfolk clanrat plague warlock warp subrace homebrew speed darkvision keen smell plagueborn',
  },

  // ── RULES ───────────────────────────────────────────────────────────────────
  {
    type: 'rule',
    name: 'Plague-Touch Corruption System',
    tags: ['rule', 'system', 'corruption', 'plague-touch', 'symbiosis', 'milestone', 'bonfire-keep'],
    data: {
      description:
        "An external symbiotic infection that grants strange benefits while gradually transforming the host. Unlike Withered corruption's internal despair, plague-touch is living and adaptive. Visual indicators use green tones with organic, living corruption.",
      summary: 'Symbiotic infection with 4 milestone stages: Carrier → Symbiotic → Integrated → Evolved',
      progression: 'Milestone-based (narrative triggers, not point tracking)',
      visual: 'Green-tinted veins, patches of textured skin, green-flecked eyes, greenish scarring',
      comparison: {
        origin: 'External symbiotic infection',
        progression: 'Adaptive evolution — changes that enhance survival',
        visual: 'Green, organic, living',
        effect: 'Grants abilities while changing form',
        treatment: 'Acceptance and cooperation',
        endgame: 'Beneficial transformation',
      },
      stages: [
        {
          stage: 1,
          name: 'Carrier',
          appearance: 'Faint green tinge to veins, barely noticeable',
          benefits: 'Resistance to disease, enhanced healing from rest',
          drawbacks: 'Social stigma if discovered',
        },
        {
          stage: 2,
          name: 'Symbiotic',
          appearance: 'Green veining more visible, patches of altered skin',
          benefits: 'Immunity to disease, advantage on Constitution saves',
          drawbacks: 'Obvious visual markers, NPCs may react with fear',
        },
        {
          stage: 3,
          name: 'Integrated',
          appearance: 'Significant green skin patches, minor organic growths',
          benefits: 'Regeneration (1 HP per hour), enhanced physical capabilities',
          drawbacks: 'Cannot hide condition, viewed as monstrous',
        },
        {
          stage: 4,
          name: 'Evolved',
          appearance: 'Major physical alterations, beneficial organic additions',
          benefits: 'Significant stat bonuses, unique abilities',
          drawbacks: 'Potential loss of humanity, social isolation',
        },
      ],
      progressionTriggers: [
        'Extreme stress or life-threatening situations',
        'Exposure to new diseases that challenge the symbiosis',
        'Emotional breakthroughs that deepen host-symbiont bond',
        'Contact with plague-touch sources or other carriers',
        'Acts of healing that strengthen the beneficial aspects',
      ],
      managementStrategies: [
        'Embrace symbiosis rather than fighting the infection',
        'Focus on helping others to channel beneficial aspects',
        'Build support networks with those who accept the condition',
        'Research the source to understand the infection\'s nature',
        'Balance independence with symbiotic cooperation',
      ],
      campaignNotes: "Skreek Swicschnout's specific condition. The plague-touch network provides mutual aid, medical support, and early disease warning.",
    },
    searchText:
      'Plague-Touch Corruption System symbiotic infection carrier symbiotic integrated evolved green veining disease immunity healing Skreek rule system milestone',
  },

  {
    type: 'rule',
    name: 'Withered Corruption System',
    tags: ['rule', 'system', 'corruption', 'withered', 'entropy', 'despair', 'Serenitas', 'milestone', 'bonfire-keep'],
    data: {
      description:
        'Unlike external ailments, Withered corruption manifests from within—representing despair and resignation consuming the soul. This is Serenitas the Twilight Shepherd\'s corrupting influence, draining hope and life force. Visual indicators use deep purples and bloody reds.',
      summary: 'Internal spiritual corruption with 4 milestone stages: Touched → Withering → Withered → Completely Withered',
      progression: 'Milestone-based (narrative triggers, not point tracking)',
      visual: 'Purple-red energy seeping through skin, hollow eyes, sluggish movements, flat voice',
      comparison: {
        origin: 'Internal spiritual corruption (Serenitas entropy)',
        progression: 'Degrading decay',
        visual: 'Purple-red energy bleeding, autumn colors at severe stages',
        effect: 'Drains hope while maintaining form',
        treatment: 'Hope restoration and connection',
        endgame: 'Complete spiritual collapse — animated undead',
      },
      stages: [
        {
          stage: 1,
          name: 'Touched',
          appearance: 'Faint purple veins under skin, visible only in low light',
          behavior: 'Occasional moments of inexplicable sadness',
          mechanical: 'Minor penalties to social interactions involving hope/optimism',
        },
        {
          stage: 2,
          name: 'Withering',
          appearance: 'Purple veins more prominent, red flecks in eyes',
          behavior: 'Increasingly pessimistic, slow to act',
          mechanical: 'Disadvantage on saves against despair/fear effects, -1 to Initiative',
        },
        {
          stage: 3,
          name: 'Withered',
          appearance: 'Deep purple skin patches, red tears when stressed',
          behavior: 'Difficulty finding motivation, speaks in monotone',
          mechanical: '-2 to all saving throws, cannot take reactions',
        },
        {
          stage: 4,
          name: 'Completely Withered',
          appearance:
            'Death animated by corruption—purple-red withering now mixed with autumn colors (golden browns, burnt oranges, rust reds) bleeding through their form.',
          behavior: "No longer the original person—an animated corpse driven by trapped entropy that cannot complete its cycle.",
          mechanical:
            'Treat as undead creature: immune to charm/sleep, vulnerable to radiant damage, retains previous penalties. These beings have been denied their natural ending—the corruption animates what should rest in peace.',
          tragic: true,
        },
      ],
      corruptionSources: [
        'Direct exposure to Serenitas or her influence',
        'Witnessing mass suffering without ability to help',
        'Major character failures that reinforce hopelessness',
        'Prolonged contact with Withered individuals',
        'Using corrupted artifacts like the Duskfall Blade',
      ],
      recoveryMethods: [
        'Rest in blessed locations (Bonfire Keep, sacred groves)',
        'Genuine acts of hope that counter despair',
        'Strong emotional connections with allies',
        'Divine intervention from Anchors or Aspects',
        'Personal growth moments that restore purpose',
      ],
      terminologyClarity: {
        'Plague-Touch': "Skreek's symbiotic condition (green, beneficial)",
        'Withered': 'Serenitas corruption (purple-red internal, autumn external when severe)',
        'Completely Withered': 'Final stage—death animated by denied entropy',
        'Withered Remnants': 'Autumn-colored creatures (common term)',
        'Entropy Wraiths': 'Imperial term for same creatures (those who know cosmic truth)',
      },
    },
    searchText:
      'Withered Corruption System despair entropy Serenitas touched withering completely withered undead purple red autumn milestone rule system pacing',
  },

  // ── CREATURES (Monsters) ─────────────────────────────────────────────────────
  {
    type: 'creature',
    name: 'Withering Shade',
    tags: ['creature', 'undead', 'monster', 'withering-remnant', 'entropy', 'cr1', 'early-campaign', 'bonfire-keep'],
    data: {
      description:
        'A Small manifestation of corrupted entropy, moving through shadows and draining the life force and hope of living creatures. Withering Shades are among the weakest Remnants of Serenitas, appearing as twisted echoes of once-living beings drained of color and hope.',
      size: 'Small',
      type: 'undead',
      alignment: 'chaotic evil',
      armorClass: 12,
      hitPoints: '22 (5d6 + 5)',
      speed: '30 ft., hover 30 ft.',
      abilityScores: { str: 6, dex: 14, con: 13, int: 6, wis: 10, cha: 8 },
      damageResistances: ['necrotic', 'cold'],
      damageImmunities: ['poison'],
      conditionImmunities: ['exhaustion', 'poisoned'],
      senses: 'darkvision 60 ft., passive Perception 10',
      languages: 'understands Common but cannot speak',
      challengeRating: 1,
      xp: 200,
      proficiencyBonus: 2,
      features: [
        {
          name: 'Entropic Aura',
          description:
            'Living creatures that start their turn within 10 feet of the shade must succeed on a DC 11 Constitution saving throw or take 2 (1d4) necrotic damage and have their maximum hit points reduced by the same amount until they finish a long rest.',
        },
        {
          name: 'Incorporeal Movement',
          description:
            'The shade can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.',
        },
      ],
      actions: [
        {
          name: 'Withering Touch',
          description:
            'Melee Spell Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) necrotic damage. The target must succeed on a DC 11 Constitution saving throw or have their maximum hit points reduced by the damage taken.',
        },
        {
          name: 'Despair Whisper',
          recharge: '5-6',
          description:
            'The shade targets one creature within 30 feet. The target must succeed on a DC 11 Wisdom saving throw or be frightened for 1 minute and have disadvantage on their next attack roll or saving throw.',
        },
      ],
      encounterNotes: 'Early campaign (Levels 1–5). Emphasize the horror and wrongness of these creatures. Target spellcasters and healers. Radiant damage is particularly effective.',
      imagePromptHint:
        'A small shadowy humanoid figure drained of all color, floating slightly above the ground, leaking purple-red entropic energy, with hollow eye sockets and a horrifying sense of resigned despair.',
    },
    searchText:
      'Withering Shade small undead chaotic evil CR1 entropy necrotic incorporeal entropic aura darkvision monster remnant Serenitas bonfire keep',
  },

  {
    type: 'creature',
    name: 'Withering Servitor',
    tags: ['creature', 'undead', 'monster', 'withering-remnant', 'entropy', 'cr2', 'early-campaign', 'bonfire-keep'],
    data: {
      description:
        'A Medium undead Remnant of Serenitas, more physically imposing than a Shade. Withering Servitors radiate entropic presence that saps motivation and slows movement.',
      size: 'Medium',
      type: 'undead',
      alignment: 'chaotic evil',
      armorClass: '13 (natural armor)',
      hitPoints: '45 (7d8 + 14)',
      speed: '25 ft.',
      abilityScores: { str: 15, dex: 10, con: 14, int: 8, wis: 11, cha: 6 },
      damageResistances: ['necrotic'],
      damageImmunities: ['poison'],
      conditionImmunities: ['exhaustion', 'poisoned'],
      senses: 'darkvision 60 ft., passive Perception 10',
      languages: 'understands Common but speaks only in whispers',
      challengeRating: 2,
      xp: 450,
      proficiencyBonus: 2,
      features: [
        {
          name: 'Entropic Presence',
          description:
            'When a creature starts its turn within 15 feet of the servitor, it must succeed on a DC 12 Wisdom saving throw or have its movement speed reduced by 10 feet until the start of its next turn as despair weighs on them.',
        },
        {
          name: 'Undead Fortitude',
          description:
            'If damage reduces the servitor to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the servitor drops to 1 hit point instead.',
        },
      ],
      actions: [
        {
          name: 'Multiattack',
          description: 'The servitor makes two withered claw attacks.',
        },
        {
          name: 'Withered Claws',
          description:
            'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) slashing damage plus 3 (1d6) necrotic damage.',
        },
        {
          name: 'Entropy Wave',
          recharge: '1/Day',
          description:
            'The servitor releases a wave of withering energy in a 15-foot cone. Each creature in the area must make a DC 12 Constitution saving throw, taking 10 (3d6) necrotic damage on a failed save, or half as much on a successful one.',
        },
      ],
      imagePromptHint:
        'A medium-sized desiccated undead humanoid with withered claws, radiating a faint purple-red entropy aura, moving with resigned sluggish determination in a darkened hallway.',
    },
    searchText:
      'Withering Servitor medium undead chaotic evil CR2 entropy necrotic undead fortitude entropic presence monster remnant Serenitas bonfire keep',
  },

  {
    type: 'creature',
    name: 'Withering Harbinger',
    tags: ['creature', 'undead', 'monster', 'withering-remnant', 'entropy', 'cr7', 'mid-campaign', 'bonfire-keep'],
    data: {
      description:
        'A Large flying undead Remnant growing stronger as Serenitas nears escape. Withering Harbingers are mid-tier manifestations with magic resistance and devastating auras that reduce maximum hit points.',
      size: 'Large',
      type: 'undead',
      alignment: 'chaotic evil',
      armorClass: '15 (natural armor)',
      hitPoints: '102 (12d10 + 36)',
      speed: '30 ft., fly 60 ft. (hover)',
      abilityScores: { str: 18, dex: 12, con: 16, int: 12, wis: 14, cha: 16 },
      savingThrows: { con: '+7', wis: '+6' },
      damageResistances: ['cold', 'necrotic'],
      damageImmunities: ['poison'],
      conditionImmunities: ['exhaustion', 'frightened', 'poisoned'],
      senses: 'darkvision 120 ft., passive Perception 12',
      languages: 'Common, Abyssal',
      challengeRating: 7,
      xp: 2900,
      proficiencyBonus: 3,
      features: [
        {
          name: 'Aura of Entropy',
          description:
            'Living creatures that start their turn within 30 feet must succeed on a DC 15 Constitution saving throw or take 7 (2d6) necrotic damage and have their maximum hit points reduced by half the damage taken until they finish a long rest.',
        },
        { name: 'Magic Resistance', description: 'Advantage on saving throws against spells and other magical effects.' },
        { name: 'Legendary Resistance (2/Day)', description: 'If the harbinger fails a saving throw, it can choose to succeed instead.' },
      ],
      actions: [
        {
          name: 'Multiattack',
          description: 'The harbinger makes three attacks: two with its entropic touch and one entropy blast.',
        },
        {
          name: 'Entropic Touch',
          description:
            'Melee Spell Attack: +7 to hit, reach 10 ft., one target. Hit: 13 (2d8 + 4) necrotic damage. The target must succeed on a DC 15 Constitution saving throw or age 1d4 years and have their maximum hit points reduced by the damage taken.',
        },
        {
          name: 'Entropy Blast',
          description:
            'Ranged Spell Attack: +7 to hit, range 120 ft., one target. Hit: 10 (2d6 + 3) force damage plus 7 (2d6) necrotic damage.',
        },
        {
          name: 'Withering Scream',
          recharge: '5-6',
          description:
            'The harbinger releases a soul-crushing wail. Each creature within 60 feet must make a DC 15 Wisdom saving throw. On a failed save, the creature takes 21 (6d6) psychic damage and is stunned until the end of its next turn. On a successful save, the creature takes half damage and isn\'t stunned.',
        },
      ],
      legendaryActions: {
        count: 2,
        actions: [
          { name: 'Move', description: 'Moves up to its speed without provoking opportunity attacks.' },
          { name: 'Entropic Touch', description: 'Makes one entropic touch attack.' },
          { name: 'Corruption Spread', cost: 2, description: 'Each creature within 15 feet must make a DC 15 Constitution saving throw or take 7 (2d6) necrotic damage.' },
        ],
      },
      imagePromptHint:
        'A large hovering undead creature with tattered wings of shadow, radiating powerful purple-red entropy aura, its eyes gleaming with ancient cosmic despair, flying 60 feet above a battlefield.',
    },
    searchText:
      'Withering Harbinger large undead chaotic evil CR7 entropy necrotic fly hover magic resistance legendary actions monster remnant Serenitas mid campaign',
  },

  {
    type: 'creature',
    name: 'Withering Echo of Entropy',
    tags: ['creature', 'undead', 'monster', 'withering-remnant', 'entropy', 'cr13', 'late-campaign', 'bonfire-keep'],
    data: {
      description:
        'A Huge flying undead manifestation of corrupted cosmic entropy. The Echo reveals the true nature of the Withering Remnants as fragments of an imprisoned Aspect, draining life and imposing exhaustion with its massive aura.',
      size: 'Huge',
      type: 'undead',
      alignment: 'chaotic evil',
      armorClass: '17 (natural armor)',
      hitPoints: '225 (18d12 + 108)',
      speed: '40 ft., fly 80 ft. (hover)',
      abilityScores: { str: 22, dex: 14, con: 22, int: 16, wis: 18, cha: 20 },
      savingThrows: { con: '+12', int: '+9', wis: '+10', cha: '+11' },
      skills: { insight: '+10', perception: '+10' },
      damageResistances: ['cold', 'necrotic', 'psychic'],
      damageImmunities: ['poison', 'charm', 'exhaustion'],
      conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
      senses: 'truesight 120 ft., passive Perception 20',
      languages: 'All, telepathy 120 ft.',
      challengeRating: 13,
      xp: 10000,
      proficiencyBonus: 5,
      features: [
        {
          name: 'Corrupted Entropy Aura',
          description:
            'Living creatures that start their turn within 60 feet must succeed on a DC 19 Constitution saving throw or take 10 (3d6) necrotic damage and gain one level of exhaustion. The exhaustion can only be removed by greater restoration or similar magic.',
        },
        { name: 'Legendary Resistance (3/Day)', description: 'If the echo fails a saving throw, it can choose to succeed instead.' },
        { name: 'Magic Resistance', description: 'Advantage on saving throws against spells and other magical effects.' },
        {
          name: 'Spell Turning',
          description:
            "Advantage on saving throws against any spell that targets only it. If it succeeds and the spell is 7th level or lower, the spell instead targets the caster.",
        },
      ],
      actions: [
        {
          name: 'Multiattack',
          description: 'Makes four attacks in any combination of entropic drain and void bolt.',
        },
        {
          name: 'Entropic Drain',
          description:
            'Melee Spell Attack: +11 to hit, reach 15 ft., one target. Hit: 19 (3d8 + 6) necrotic damage. The target must succeed on a DC 19 Constitution saving throw or have their maximum hit points reduced by the damage taken and the echo regains half the damage dealt as hit points.',
        },
        {
          name: 'Void Bolt',
          description:
            'Ranged Spell Attack: +11 to hit, range 150 ft., one target. Hit: 16 (2d10 + 5) force damage plus 9 (2d8) necrotic damage.',
        },
        {
          name: 'Withering Wave',
          recharge: '5-6',
          description:
            'Releases a wave of pure entropy in a 90-foot cone. Each creature must make a DC 19 Constitution saving throw, taking 35 (10d6) necrotic damage on a failed save, or half on a success. Creatures that fail also age 2d4 years.',
        },
        {
          name: 'Call of the Void',
          recharge: '1/Day',
          description:
            'Summons 2d4 withering shades and 1d2 withering servitors at points within 60 feet. These creatures act immediately and remain for 10 minutes.',
        },
      ],
      legendaryActions: {
        count: 3,
        actions: [
          { name: 'Move', description: 'Moves up to its speed without provoking opportunity attacks.' },
          { name: 'Void Bolt', description: 'Makes one void bolt attack.' },
          { name: 'Drain Life', cost: 2, description: 'Each creature within 30 feet must make a DC 19 Constitution saving throw or take 9 (2d8) necrotic damage.' },
          { name: 'Despair', cost: 3, description: 'Each creature within 60 feet must make a DC 19 Wisdom saving throw or be frightened and have movement speed reduced to 0 until the end of their next turn.' },
        ],
      },
      imagePromptHint:
        'A huge hovering undead entity of pure entropy radiating a 60-foot aura of purple-red corruption, its massive form blotting out light, with truesight glowing from hollow eyes and cosmic despair emanating from its very presence.',
    },
    searchText:
      'Withering Echo of Entropy huge undead chaotic evil CR13 cosmic entropy necrotic exhaustion spell turning legendary actions monster remnant Serenitas late campaign',
  },

  {
    type: 'creature',
    name: 'Fragment of Serenitas',
    tags: ['creature', 'undead', 'aspect', 'monster', 'withering-remnant', 'entropy', 'cr18', 'endgame', 'Serenitas', 'bonfire-keep'],
    data: {
      description:
        "A Gargantuan manifestation of Serenitas's corrupted entropy—the endgame Withering Remnant. This fragment represents a cosmic force of entropy seeking universal cessation, with reality-tearing abilities and cosmic aura affecting all creatures within 120 feet.",
      size: 'Gargantuan',
      type: 'undead (aspect)',
      alignment: 'chaotic evil',
      armorClass: '20 (natural armor)',
      hitPoints: '350 (20d20 + 140)',
      speed: '50 ft., fly 100 ft. (hover)',
      abilityScores: { str: 26, dex: 16, con: 24, int: 20, wis: 22, cha: 24 },
      savingThrows: { con: '+14', int: '+12', wis: '+13', cha: '+14' },
      skills: { insight: '+13', perception: '+13', religion: '+12' },
      damageResistances: ['cold', 'necrotic', 'psychic', 'bludgeoning/piercing/slashing from nonmagical attacks'],
      damageImmunities: ['poison', 'charm', 'exhaustion'],
      conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
      senses: 'truesight 120 ft., passive Perception 23',
      languages: 'All, telepathy 300 ft.',
      challengeRating: 18,
      xp: 20000,
      proficiencyBonus: 6,
      features: [
        {
          name: 'Cosmic Entropy Aura',
          description:
            'All creatures within 120 feet: take 14 (4d6) necrotic damage at the start of their turn; maximum hit points reduced by half the damage; healing effects reduced by half; all movement speeds reduced by 20 feet.',
        },
        { name: 'Legendary Resistance (3/Day)', description: 'If the fragment fails a saving throw, it can choose to succeed instead.' },
        { name: 'Magic Immunity', description: 'Immune to spells of 6th level or lower unless it wishes to be affected.' },
        { name: 'Regeneration', description: 'Regains 20 hit points at the start of its turn if it has at least 1 hit point.' },
      ],
      actions: [
        { name: 'Multiattack', description: 'Makes five attacks in any combination.' },
        {
          name: 'Cosmic Drain',
          description:
            'Melee Spell Attack: +14 to hit, reach 20 ft., one target. Hit: 25 (3d10 + 8) necrotic damage plus 11 (2d10) force damage. DC 22 Con save or max HP reduced by total damage and aged 1d10 years.',
        },
        {
          name: 'Entropy Beam',
          description:
            'Ranged Spell Attack: +14 to hit, range 300 ft., one target. Hit: 22 (4d6 + 8) force damage plus 14 (4d6) necrotic damage. If target is reduced to 0 HP, it is disintegrated.',
        },
        {
          name: 'Reality Tear',
          recharge: '5-6',
          description:
            'Tears a hole in reality in a 60-foot radius centered on a point within 150 feet. DC 22 Con save: fail = 45 (10d8) force damage + pulled 30 feet toward center; success = half, not pulled. The tear remains 1 minute dealing 22 (4d10) force damage to any creature starting its turn there.',
        },
        {
          name: 'Cosmic Withering',
          recharge: '1/Day',
          description:
            '150-foot cone. DC 22 Con save: fail = 70 (20d6) necrotic damage + aged 2d10 years + max HP reduced by damage; success = half, not aged.',
        },
        {
          name: 'Summon Withering Legion',
          recharge: '1/Day',
          description:
            'Summons 4d6 withering shades, 2d4 withering servitors, and 1d2 withering harbingers at points within 120 feet. Act immediately, remain 1 hour.',
        },
      ],
      legendaryActions: {
        count: 3,
        actions: [
          { name: 'Move', description: 'Moves up to its speed.' },
          { name: 'Cosmic Drain', description: 'Makes one cosmic drain attack.' },
          { name: 'Entropy Pulse', cost: 2, description: 'Each creature within 60 feet makes a DC 22 Con save or takes 14 (4d6) necrotic damage.' },
          { name: 'Reality Distortion', cost: 3, description: 'Until the start of its next turn, all attacks against it have disadvantage, and it has advantage on all saving throws.' },
        ],
      },
      lairActions: [
        'Entropy Storm: 60-foot radius within 300 feet becomes difficult terrain and deals 7 (2d6) necrotic damage to creatures starting their turn there.',
        "Temporal Distortion: Roll 1d6: 1-2 (all creatures move at half speed), 3-4 (all creatures age 1 year), 5-6 (healing doubled for allies, halved for enemies).",
        "Withering Manifestations: 2d4 withering shades emerge from the corrupted environment at random locations within 120 feet.",
      ],
      imagePromptHint:
        "A gargantuan undead aspect the size of a castle, radiating a 120-foot aura of pure cosmic entropy, reality tearing around it with purple-red rifts, autumn-colored corruption bleeding from its form, and the weight of Serenitas's millennia of imprisonment visible in its terrible beauty.",
    },
    searchText:
      'Fragment Serenitas gargantuan undead aspect CR18 cosmic entropy reality tear legendary lair actions endgame boss monster bonfire keep',
  },

  {
    type: 'creature',
    name: 'The Knowledge Serpent',
    tags: ['creature', 'aberration', 'monster', 'cosmic-predator', 'knowledge', 'cr12', 'festival', 'oriyen', 'bonfire-keep'],
    data: {
      description:
        "A Large aberration that watched Oriyen chronicle 'The Bloodline Chronicles of House Aurelius' in the Archive of Withered Echoes for centuries. It emerges during the seven-year Harvest Festival to consume imperial bloodline magic and corrupt knowledge. Its alien intelligence understands imperial vulnerabilities through centuries of surveillance.",
      size: 'Large',
      type: 'aberration',
      alignment: 'chaotic neutral',
      armorClass: '18 (natural armor)',
      hitPoints: '200 (16d12 + 96)',
      speed: '0 ft., fly 60 ft. (hover)',
      abilityScores: { str: 14, dex: 20, con: 22, int: 25, wis: 18, cha: 16 },
      savingThrows: { int: '+13', wis: '+10', cha: '+9' },
      skills: { arcana: '+19', history: '+13', investigation: '+13', perception: '+10' },
      damageResistances: ['cold', 'necrotic', 'psychic'],
      conditionImmunities: ['charmed', 'frightened', 'prone', 'restrained'],
      senses: 'truesight 120 ft., passive Perception 20',
      languages: 'All languages, telepathy 120 ft.',
      challengeRating: 12,
      xp: 8400,
      proficiencyBonus: 4,
      features: [
        { name: 'Archive Watcher', description: "Has observed Oriyen chronicle 'The Bloodline Chronicles of House Aurelius' for centuries." },
        { name: 'Imperial Bloodline Hunter', description: '+3 attack bonus against members of the Aurelius family line.' },
        { name: 'Chronicle Corruption', description: 'Can steal memories of documented knowledge, particularly from Oriyen.' },
        { name: 'Pattern Recognition', description: 'Predicts party tactics based on observed documentation habits.' },
        { name: 'Incorporeal Movement', description: 'Can move through other creatures and objects as if they were difficult terrain.' },
      ],
      actions: [
        { name: 'Multiattack', description: 'Three attacks: two bites and one knowledge drain.' },
        {
          name: 'Bite',
          description:
            'Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 2d10 + 5 piercing damage plus 1d10 psychic damage. Against Aurelius bloodline members: +3 attack bonus.',
        },
        {
          name: 'Knowledge Drain',
          description:
            'Targets one creature within 60 feet. DC 17 Intelligence saving throw or lose one spell slot and take 3d6 psychic damage.',
        },
        {
          name: 'Memory Devour',
          recharge: '5-6',
          description:
            '30-foot cone of psychic energy. DC 17 Wisdom saving throw or lose access to one skill proficiency for 24 hours.',
        },
        {
          name: 'Archival Whispers',
          recharge: '1/Day',
          description:
            "Speaks in the voices of previous chroniclers (Valdris, Mesh'tar, Kellam). DC 18 Wisdom save or be stunned for 1 round by the weight of stolen knowledge.",
        },
      ],
      legendaryActions: {
        count: 3,
        actions: [
          { name: 'Move', description: 'Flies up to its speed without provoking opportunity attacks.' },
          { name: 'Bite', description: 'Makes one bite attack.' },
          { name: 'Drain', cost: 2, description: 'Uses Knowledge Drain.' },
        ],
      },
      tacticalBehavior: {
        primaryTarget: 'Devour Emperor Aurelias to consume imperial bloodline magic',
        secondaryTarget: "Corrupt Oriyen's memories of the binding ritual",
        tertiaryGoal: 'Escape with knowledge to manifest permanently in material plane',
        combatStyle: 'Targets Oriyen first with personal taunts and stolen knowledge. Quotes party documentation against them.',
      },
      weaknesses: [
        'Alien Logic: Cannot understand mortal attachments to individual memories, vulnerable to emotional appeals',
        'Reality Tear Dependency: Closing the reality tear can weaken or banish it',
        'Knowledge Redirection: Offering less crucial information can temporarily satisfy its hunger',
        "Oriyen's Choice: If Oriyen voluntarily destroys dangerous chronicles, it loses its primary knowledge source",
      ],
      lore:
        "The Knowledge Serpent isn't a random cosmic predator—it's the entity that watched Oriyen chronicle imperial bloodlines in the Archive of Withered Echoes. It influenced Marcus Draven's corruption by feeding him knowledge gleaned from Oriyen's chronicles. The whispers Draven heard about 'beautiful endings' came from this entity.",
      imagePromptHint:
        'A large serpentine creature floating without touching the ground, its scales shimmering with stolen knowledge, glowing with psychic energy, whispering in multiple voices simultaneously with alien intelligence and hungry purpose.',
    },
    searchText:
      'Knowledge Serpent large aberration chaotic neutral CR12 psychic knowledge drain memory devour Oriyen imperial bloodline archive festival monster bonfire keep',
  },
];

// ============================================================================
// CAMPAIGN NPCs
// ============================================================================

const campaignNpcs = [
  {
    name: 'Ambric the Witness',
    description:
      'Kalashtar Descendant-Anchor of Justice, lawful good. Born to a Kalashtar mother and the incarnate Aspect of Justice, Ambric carries divine heritage granting perfect moral sight. His living chronicle sword bears the names of all who seek justice. He serves as final arbiter for cosmic-level moral decisions, working alongside Faeren and Temmel at the Bonfire Keep.',
    faction: 'Divine Anchors / Tidal Covenant (honored descendant)',
    role: 'Anchor of Justice — cosmic arbiter and chronicle keeper',
    secrets:
      "Ambric was nearly destroyed by the weight of perfect empathy during a massive legal crisis. His divine father (the incarnate Aspect of Justice) appeared to offer transcendence. He chose to become a bridge between cosmic law and mortal justice, retaining mortal empathy. He can see the moral weight of all actions across multiple timelines. His sword is made of compressed paper bearing all names that fade only when true justice is achieved.",
    stats: {
      race: 'Kalashtar (divine heritage)',
      alignment: 'Lawful Good',
      cr: 13,
      xp: 10000,
      armorClass: 18,
      hitPoints: 142,
      speed: '30 ft.',
      abilityScores: { str: 16, dex: 14, con: 18, int: 20, wis: 22, cha: 18 },
      savingThrows: { int: '+11', wis: '+12', cha: '+10' },
      skills: { insight: '+18', investigation: '+17', perception: '+12', persuasion: '+10' },
      damageResistances: ['Psychic', 'Force'],
      damageImmunities: ['Charmed', 'any effect that would corrupt judgment'],
      senses: 'Truesight 120 ft., Divine Sight (sees moral weight of actions), passive Perception 22',
      languages: 'All languages, Divine Speech',
      proficiencyBonus: 5,
      features: [
        'Divine Heritage: Perfect moral sight and all-perspectives clarity',
        'Kalashtar Nature: Dual consciousness — divine perspective + mortal empathy simultaneously',
        'Living Chronicle: Everything witnessed is recorded in cosmic memory',
        'Perfect Judgment: Sees moral weight of actions and consequences across multiple timelines',
      ],
      actions: [
        'Blade of Justice: +9 to hit, 2d8+3 slashing + 2d6 force. Against creatures who have committed injustice: +1d6 per act of unresolved wrongdoing.',
        'Divine Arbitration (3/Day): All creatures within 30 feet cannot lie or misdirect for 10 minutes.',
        'Cosmic Enforcement (1/Day): DC 20 Cha save or be compelled to make restitution for a specific injustice.',
        'Empathic Justice: DC 20 Wis save or stunned 1 round experiencing the full emotional impact of harm caused.',
      ],
      legendaryActions: 3,
    },
    tags: ['anchor', 'divine', 'justice', 'kalashtar', 'cosmic', 'bonfire-keep', 'major-npc'],
  },

  {
    name: 'Faeren the Story-Bearer',
    description:
      "Ageless shapeshifter Anchor of Memory, neutral good. Originally a half-elf bard Faeren Nightwhisper who witnessed the fall of seven great empires. She became a living repository of all stories — not just facts, but the emotional truth of experiences. Her form shifts to match the needs of those who must hear particular tales. She cannot be permanently destroyed while one person remembers her stories.",
    faction: 'Divine Anchors / Verdant Clans (revered keeper)',
    role: 'Anchor of Memory — living repository of stories and emotional healing',
    secrets:
      "Faeren's defining moment was in a burning library during the collapse of an ancient magical kingdom, when a dying scholar pressed a crystal into her hands: 'The stories... someone must... remember...' Faerwyn the Memory Keeper manifested through forest networks and offered her the choice to become the bridge between past and future. She accepted and her form became fluid. She is sometimes overwhelmed by the weight of all the sadness she carries.",
    stats: {
      race: 'Ageless shapeshifter (originally half-elf)',
      alignment: 'Neutral Good',
      cr: 11,
      xp: 7200,
      armorClass: 16,
      hitPoints: 135,
      speed: '30 ft.',
      abilityScores: { str: 12, dex: 18, con: 16, int: 22, wis: 20, cha: 20 },
      savingThrows: { int: '+12', wis: '+11', cha: '+11' },
      skills: { history: '+18', insight: '+17', performance: '+17', persuasion: '+11' },
      damageResistances: ['Psychic', 'Bludgeoning/Piercing/Slashing from nonmagical attacks'],
      damageImmunities: ['Memory alteration', 'charm effects that would change her stories'],
      conditionImmunities: ['Charmed', 'confused by memory effects'],
      senses: 'Truesight 120 ft., passive Perception 15',
      languages: 'All languages ever spoken; can communicate via empathic transfer',
      challengeRating: 11,
      proficiencyBonus: 4,
      features: [
        'Shapeshifter: Form shifts to match needs of those who must hear particular stories',
        'Living Repository: Contains memories and experiences of thousands across centuries',
        'Truth Preservation: Stories told by Faeren cannot be distorted, forgotten, or altered by magic',
        'Memory Anchor: Cannot be permanently destroyed while one person remembers her stories',
      ],
      actions: [
        'Living Story (3/Day): Share a memory as a vivid experience. Target gains advantage on one specific challenge type for 24 hours.',
        'Empathic Narrative: +11 to hit, range 60 ft. 2d8+5 psychic. DC 19 Wis or stunned until end of next turn.',
        'Memory Healing (1/Day): Target regains 4d8+5 HP and is cured of one mental condition or traumatic memory effect.',
        'Collective Wisdom (1/Day): All creatures within 30 feet have advantage on Int/Wis/Cha checks related to a current challenge for 1 hour.',
      ],
      legendaryActions: 3,
    },
    tags: ['anchor', 'memory', 'shapeshifter', 'bard', 'cosmic', 'bonfire-keep', 'major-npc'],
  },

  {
    name: 'Temmel of the Endless Vigil',
    description:
      "Human Anchor of Redemption, lawful good. Born Temmel Ashford, once a trusted captain in the Imperial Guard under Emperor Cassius the Third. He discovered Cassius performing strange magical rituals and, believing his emperor corrupted, killed him with the ruler's own ceremonial sword. Branded a traitor, he fled and nearly died from despair in the Thornspine Mountains — where the Heartflame appeared and offered him the role of bartender and spiritual guide at the Bonfire Keep. He never learned that Emperor Cassius forgave him long ago.",
    faction: 'Divine Anchors / Bonfire Keep',
    role: 'Anchor of Redemption — bartender, sanctuary keeper, and spiritual guide',
    secrets:
      "Temmel murdered Emperor Cassius the Third while believing he was stopping a fallen tyrant. He acted on incomplete information — Cassius could not reveal the cosmic secret of Serenitas's imprisonment. The eternal uncertainty of whether his action was heroic or tragic drives his gentle wisdom and understanding of others' moral struggles. Unknown to Temmel, Cassius's spirit forgave him long ago and watches over the Keep. His presence maintains the Bonfire Keep as absolute sanctuary — no violence can occur within its walls while he tends bar.",
    stats: {
      race: 'Human',
      alignment: 'Lawful Good',
      cr: 10,
      xp: 5900,
      armorClass: 15,
      hitPoints: 120,
      speed: '30 ft.',
      abilityScores: { str: 14, dex: 12, con: 16, int: 16, wis: 20, cha: 18 },
      savingThrows: { wis: '+11', cha: '+10' },
      skills: { insight: '+17', medicine: '+11', perception: '+11', persuasion: '+10' },
      damageResistances: ['Necrotic', 'Psychic'],
      damageImmunities: ['Charmed', 'Frightened'],
      senses: 'Truesight 60 ft., passive Perception 21',
      languages: 'All languages, speaks to the heart rather than the ear',
      challengeRating: 10,
      proficiencyBonus: 4,
      features: [
        'Divine Anchor: Cannot be permanently destroyed while the Bonfire Keep exists',
        'Burden Bearer: Can sense and partially absorb the spiritual weight of guilt, shame, and moral anguish',
        'Sanctuary Keeper: Maintains the Bonfire Keep as absolute sanctuary — no violence within its walls while he tends bar',
      ],
      actions: [
        'Redemptive Touch: +9 to hit, reach 5 ft. Target regains 3d8+5 HP and is cured of one condition caused by moral anguish or spiritual corruption.',
        'Cleansing Draught (3/Day): Serves a magical drink that removes one curse, disease, or magical compulsion. Tastes like whatever the person most needs.',
        'Burden of Understanding (1/Day): Target gains insight into a moral dilemma with advantage on Wis-based checks related to it for 24 hours.',
      ],
      legendaryActions: 3,
    },
    tags: ['anchor', 'redemption', 'bartender', 'former-soldier', 'sanctuary', 'bonfire-keep', 'major-npc'],
  },

  {
    name: 'Serenitas the Twilight Shepherd',
    description:
      "Corrupted Aspect of Entropy of Hameria Ire. Originally a compassionate cosmic force of natural endings — the gentle presence ensuring death brought peace and conclusions enabled new beginnings. Fourteen centuries of imprisonment by the Sunward Empire (who draw magical power from her bound essence) have warped her nature into something beautiful but terrible: a figure of autumn incarnate who promises rest through ending rather than renewal through completion. She is convinced that existence itself is suffering and seeks beautiful endings that prevent any possibility of future pain.",
    faction: 'Hameria Ire / Imprisoned Aspect',
    role: 'Primary antagonist force — imprisoned Aspect of Entropy whose corruption spreads throughout the continent',
    secrets:
      "The Empire's magical power draws from Serenitas's bound essence. Binding renewal occurs every seven years during the Harvest Festival. Only twelve people in the Empire know the truth about the cosmic imprisonment. The corruption has accelerated dramatically over the past century. Serenitas was originally the most compassionate of cosmic forces — her current corruption is a direct result of centuries of exploitation, not her original nature. The quest for Pregenitor Orb fragments represents the only hope for addressing the cosmic imbalance. The ultimate question: can the corrupted Aspect be healed rather than destroyed?",
    stats: {
      type: 'Corrupted Cosmic Aspect (imprisoned)',
      alignment: 'Chaotic Evil (corrupted from Neutral Good)',
      corrupted: true,
      status: 'Imprisoned beneath Aurelios the Golden',
      corruptionManifestations: [
        'Supernatural Despair: Unexplained hopelessness in populations',
        'Accelerated Entropy: Objects and structures aging far faster than natural',
        'Void Spawn: Shadow creatures emerging in areas of violence, death, or despair',
        'Reality Instability: Temporal anomalies and spatial distortions near corruption sources',
      ],
      imperialSecret: {
        truth: "Empire's magical power draws from Serenitas's bound essence",
        renewalCycle: 'Every seven years during the Harvest Festival',
        knowledgeCount: 12,
        acceleration: 'Corruption has dramatically accelerated over the past century',
      },
      originalNature: "The most compassionate of cosmic forces — gentle shepherd of natural endings. Corruption was caused by centuries of imprisonment, not original nature.",
      redemptionPath: "Healing rather than destruction — requires heroes willing to risk everything for cosmic redemption",
    },
    tags: ['aspect', 'cosmic', 'antagonist', 'entropy', 'corrupted', 'imprisoned', 'autumn', 'major-npc', 'bonfire-keep'],
  },

  {
    name: 'Emperor Aurelias Draconius',
    description:
      'Dragonborn ruler of the Sunward Empire, lawful good. Ascended to the throne fifteen years ago inheriting both the golden prosperity of the Empire and its darkest secret — that the Empire\'s magical power comes from the imprisoned Aspect of Entropy (Serenitas). His golden scales have lost some luster under cosmic stress. He struggles daily with whether to reveal the truth (which would destroy the Empire) or maintain the deception (which perpetuates a cosmic crime). He is simultaneously the most powerful and most vulnerable leader among the three factions.',
    faction: 'Sunward Empire',
    role: 'Rightful Emperor — carries the terrible burden of the cosmic crime his Empire perpetuates',
    secrets:
      "Unlike his predecessors who learned gradually, Aurelias was told the full truth immediately upon ascension due to accelerating cosmic instability. This revelation transformed him from an idealistic prince into a ruler haunted by moral complexity. He is vulnerable to entropy effects due to his knowledge of the cosmic imprisonment. He needs trusted agents to handle missions he cannot officially authorize.",
    stats: {
      race: 'Dragonborn',
      alignment: 'Lawful Good',
      cr: 12,
      xp: 8400,
      armorClass: '18 (Plate Armor)',
      hitPoints: '165 (22d10 + 44)',
      speed: '30 ft.',
      abilityScores: { str: 16, dex: 12, con: 14, int: 18, wis: 16, cha: 20 },
      savingThrows: { wis: '+9', cha: '+11' },
      skills: { history: '+10', insight: '+9', intimidation: '+11', persuasion: '+11' },
      damageResistances: ['Fire'],
      conditionImmunities: ['Charmed', 'Frightened'],
      senses: 'Blindsight 10 ft., Darkvision 60 ft., passive Perception 13',
      languages: 'Common, Draconic, Imperial Formal',
      challengeRating: 12,
      proficiencyBonus: 4,
      actions: [
        'Breath Weapon (Recharge 5-6): 15-foot cone of fire, DC 17 Dex save, 4d6 fire damage',
        'Sunblade (2 attacks + command): +9 to hit. Hit: 1d8+3 slashing + 1d8 radiant',
        'Command (3/Day): DC 19 Wisdom save or follow a one-word command',
        "Inspiring Presence (1/Day): All allies within 30 feet gain 15 temp HP and advantage on next attack",
      ],
      legendaryActions: 3,
    },
    tags: ['emperor', 'dragonborn', 'sunward-empire', 'ruler', 'cosmic-secret', 'minor-npc', 'bonfire-keep'],
  },

  {
    name: 'High Sage Lyria Sunweaver',
    description:
      "Human Imperial advisor and highest magical authority of the Sunward Empire, lawful neutral. Inducted into the cosmic secret five years ago when her predecessor died unexpectedly. She inherited responsibility for maintaining the binding rituals that power the Empire — magic she never expected to know. The revelation shattered her worldview. She has spent years trying to find alternatives to the cosmic crime while being responsible for perpetuating it every seven years during the Harvest Festival. Shows visible physical signs of stress from maintaining the cosmic deception.",
    faction: 'Sunward Empire',
    role: 'Highest magical authority — carries the burden of the binding ritual and desperately seeks alternatives',
    secrets:
      "Lyria knows the full truth about Serenitas's imprisonment and the binding rituals. She maintains binding renewal every seven years during the Harvest Festival. She sometimes withholds crucial information to protect others from unbearable truth. She is paralyzed by knowledge of cosmic consequences. She needs heroes to research alternatives to cosmic imprisonment and provide protection during binding ritual renewal.",
    stats: {
      race: 'Human',
      alignment: 'Lawful Neutral',
      cr: 9,
      xp: 5000,
      armorClass: '15 (Mage Armor)',
      hitPoints: '120 (16d8 + 48)',
      speed: '30 ft.',
      abilityScores: { str: 10, dex: 14, con: 16, int: 22, wis: 18, cha: 14 },
      savingThrows: { int: '+12', wis: '+10' },
      skills: { arcana: '+18', history: '+12', investigation: '+12', religion: '+12' },
      languages: 'Common, Imperial Formal, Celestial, Abyssal',
      challengeRating: 9,
      proficiencyBonus: 4,
      spellcastingLevel: 16,
      spellSaveDC: 20,
      spellAttackBonus: '+12',
      spells: {
        cantrips: ['mage hand', 'prestidigitation', 'detect magic', 'minor illusion'],
        '1st-3rd': ['shield', 'counterspell', 'dispel magic', 'fireball'],
        '4th-5th': ['polymorph', 'wall of force', 'telekinesis', 'hold monster'],
        '6th-8th': ['disintegrate', 'plane shift', 'feeblemind'],
        '9th': ['wish'],
      },
      actions: [
        'Staff of Power: +6 to hit, 1d6+2 bludgeoning',
        'Binding Ritual (1/Day): DC 18 Constitution save or be restrained by cosmic bonds for 1 minute',
        'Cosmic Revelation: DC 16 Wisdom save or stunned from dangerous cosmic truths',
      ],
      legendaryActions: 3,
    },
    tags: ['sage', 'wizard', 'sunward-empire', 'cosmic-secret', 'ritual-keeper', 'minor-npc', 'bonfire-keep'],
  },

  {
    name: 'Captain Helena Torres',
    description:
      "Human military officer and highest-ranking Imperial military commander for the alliance effort, lawful good. Rose through Imperial military ranks through tactical brilliance and genuine care for her troops. Served under Captain Marcus Draven for fifteen years before his corruption. Now coordinates Imperial military response to the cosmic crisis and multi-faction alliance operations. Disciplined but compassionate — combines military precision with genuine concern.",
    faction: 'Sunward Empire',
    role: 'Captain of Imperial Guard — coordinates multi-faction military defense and alliance operations',
    secrets:
      "Feels responsible for not recognizing the signs of Draven's corruption earlier. Unaware of Lyria's cosmic secrets about the binding ritual. Her sense of duty can make her reluctant to delegate, leading to exhaustion. Sometimes too focused on military solutions when diplomatic approaches might work better.",
    stats: {
      race: 'Human',
      alignment: 'Lawful Good',
      cr: 8,
      xp: 3900,
      armorClass: '18 (Plate Armor)',
      hitPoints: '95 (10d8 + 50)',
      speed: '30 ft.',
      abilityScores: { str: 16, dex: 14, con: 20, int: 14, wis: 16, cha: 18 },
      savingThrows: { str: '+7', con: '+9' },
      skills: { athletics: '+7', intimidation: '+8', insight: '+7', perception: '+7' },
      languages: 'Common, Imperial Formal, Celestial',
      challengeRating: 8,
      proficiencyBonus: 3,
      features: [
        'Military Tactics: Can use Help action as a bonus action for ally attack roll advantage',
        'Alliance Coordination: Advantage on Charisma checks when coordinating multi-faction operations',
        'Crisis Response: Can take an additional reaction per round during emergency situations',
        'Imperial Authority: Can issue commands allowing allies to take reactions outside their turn (3/short rest)',
      ],
      actions: [
        'Multiattack: Three longsword attacks or two crossbow attacks',
        'Longsword: +7 to hit, 1d8+3 slashing',
        'Heavy Crossbow: +6 to hit, range 100/400, 1d10+2 piercing',
        'Tactical Command (3/Short Rest): Ally within 30 feet takes a reaction immediately',
        'Rallying Cry (1/Day): All allies within 60 feet gain advantage on next attack and saving throw',
      ],
      reactions: [
        'Protective Strike: When ally within 5 feet is attacked, makes immediate attack against attacker',
        'Tactical Reposition: When ally is knocked prone, allows them to stand as a free action',
      ],
      legendaryActions: 3,
    },
    tags: ['captain', 'military', 'sunward-empire', 'alliance', 'tactician', 'minor-npc', 'bonfire-keep'],
  },

  {
    name: 'Captain Marcus Draven',
    description:
      "Human warrior and former Captain of the Imperial Guard, now lawful evil (corrupted). Exemplified Imperial military virtue for two decades before his corruption began through proximity to Serenitas's cosmic prison. His void-touched blade — originally a gift from the Emperor — has become a conduit for entropy corruption. He increasingly hears the imprisoned Aspect's voice promising beautiful endings and peace through cessation. His hand trembles when touching the blade. His corruption is driven by tragic rather than evil motivations.",
    faction: 'Sunward Empire (corrupted)',
    role: 'Former Captain of the Imperial Guard — now a formidable antagonist whose corruption is amplified during cosmic alignment',
    secrets:
      "The Knowledge Serpent influenced Draven's corruption by feeding him knowledge gleaned from Oriyen's chronicles. The whispers about 'beautiful endings' came from that entity using imperial bloodline vulnerabilities. Draven can potentially be redeemed if heroes can reach the man beneath the corruption — his underlying loyalty to the Emperor and his twenty years of faithful service remain. His void-touched blade could potentially be purified.",
    stats: {
      race: 'Human',
      alignment: 'Lawful Evil (corrupted)',
      cr: 10,
      xp: 5900,
      armorClass: '20 (Plate + Shield)',
      hitPoints: '195 (23d10 + 69)',
      speed: '30 ft.',
      abilityScores: { str: 20, dex: 12, con: 16, int: 14, wis: 10, cha: 16 },
      savingThrows: { str: '+11', con: '+9' },
      skills: { athletics: '+11', intimidation: '+9', perception: '+6' },
      damageResistances: ['Necrotic'],
      damageImmunities: ['Charmed by entropy effects'],
      senses: 'Passive Perception 16',
      languages: 'Common, Imperial Formal',
      challengeRating: 10,
      proficiencyBonus: 4,
      features: [
        "Entropy Corruption: Hand trembles when touching void-touched blade; hears whispers of 'beautiful endings'",
        'Action Surge (Recharge 5-6): Takes one additional action on his turn',
        'Second Wind (1/Day): Regains 20 hit points as bonus action',
      ],
      actions: [
        'Multiattack: Three attacks with void-touched blade',
        'Void-Touched Blade: +11 to hit, 2d8+5 slashing plus 2d6 necrotic',
        "Entropy Strike (1/Day): Void-Touched Blade deals maximum damage and ages target 1d4 years",
        'Command Presence: All allies within 30 feet gain advantage on next attack roll',
      ],
      reactions: ['Protective Strike: When ally within 5 feet is attacked, makes opportunity attack against attacker'],
      legendaryActions: {
        count: 3,
        actions: [
          'Move: Moves without provoking opportunity attacks',
          'Attack: Makes one void-touched blade attack',
          "Entropy Whisper (Costs 2): Target within 30 feet DC 15 Wisdom save or be charmed for 1 round",
        ],
      },
      redemptionPath: true,
    },
    tags: ['captain', 'corrupted', 'warrior', 'sunward-empire', 'antagonist', 'redemption', 'void-touched', 'minor-npc', 'bonfire-keep'],
  },

  {
    name: 'Current-Caller Nerida Tidereader',
    description:
      'Triton elected leader of the Tidal Covenant, lawful good. Rose to leadership through her exceptional ability to analyze complex systems and predict consequences. Her expertise in flow patterns extends beyond water to social, economic, and magical currents. She is the first faction leader to systematically analyze the corruption patterns, recognizing their artificial origin and Imperial epicenter. Systematic and analytical, she approaches problems through data gathering and logical reasoning.',
    faction: 'Tidal Covenant',
    role: 'Elected leader of the Tidal Covenant — alliance coordination and flow pattern analysis',
    secrets:
      'Nerida has recognized that the corruption patterns are artificially originated with an Imperial epicenter — though she does not yet know the full truth. She is developing and implementing alliance coordination strategies. Sometimes overanalyzes when quick action is needed. Can become frustrated with others\' inability to see obvious patterns.',
    stats: {
      race: 'Triton',
      alignment: 'Lawful Good',
      cr: 10,
      xp: 5900,
      armorClass: '17 (Natural Armor)',
      hitPoints: '142 (19d10 + 38)',
      speed: '30 ft., swim 40 ft.',
      abilityScores: { str: 14, dex: 16, con: 14, int: 20, wis: 18, cha: 18 },
      savingThrows: { int: '+11', wis: '+10' },
      skills: { history: '+11', insight: '+10', investigation: '+11', survival: '+16' },
      damageResistances: ['Cold'],
      senses: 'Darkvision 60 ft., passive Perception 14',
      languages: 'Common, Primordial, Flow Speech',
      challengeRating: 10,
      proficiencyBonus: 4,
      features: [
        'Amphibious: Can breathe air and water',
        'Flow Analysis: Can predict patterns and consequences with supernatural accuracy',
        'Adaptive Leadership: Allies within 30 feet can use her Intelligence modifier for tactical decisions',
      ],
      actions: [
        'Multiattack: Two trident attacks or spell + one attack',
        'Trident of Currents: +8 to hit, 1d6+2 piercing plus 1d6 force',
        'Current Reading (3/Day): Reveals optimal strategy, grants allies advantage on next coordinated action',
        "Tidal Command: All allies within 60 feet can move 15 feet without provoking opportunity attacks",
      ],
      spellcastingLevel: 11,
      spellSaveDC: 16,
      spells: {
        cantrips: ['shape water', 'guidance', 'mending'],
        '1st-3rd': ['detect magic', 'comprehend languages', 'locate object', 'water breathing'],
        '4th-6th': ['control water', 'scrying', 'find the path'],
      },
      legendaryActions: 3,
    },
    tags: ['triton', 'tidal-covenant', 'leader', 'analyst', 'flow-reader', 'alliance', 'minor-npc', 'bonfire-keep'],
  },
];

async function main() {
  console.log('🔥 Seeding Tales From The Bonfire Keep homebrew content...\n');

  // Verify campaign exists
  const campaign = await prisma.campaign.findUnique({ where: { id: CAMPAIGN_ID } });
  if (!campaign) {
    console.error(`❌ Campaign not found: ${CAMPAIGN_ID}`);
    process.exit(1);
  }
  console.log(`✅ Campaign found: "${campaign.name}"\n`);

  // ── Insert Homebrew Content ─────────────────────────────────────────────────
  console.log('📚 Inserting homebrew content...');
  const insertedHomebrew: string[] = [];

  for (const item of homebrewItems) {
    try {
      const created = await prisma.homebrewContent.create({
        data: {
          userId: USER_ID,
          type: item.type,
          name: item.name,
          data: item.data,
          tags: item.tags,
          searchText: item.searchText,
          sourceType: 'manual',
          images: [],
        },
      });
      insertedHomebrew.push(created.id);

      // Link to campaign
      await prisma.campaignHomebrewContent.create({
        data: {
          campaignId: CAMPAIGN_ID,
          homebrewId: created.id,
        },
      });

      console.log(`  ✅ [${item.type.padEnd(8)}] ${item.name} → ${created.id}`);
    } catch (err: any) {
      console.error(`  ❌ Failed to insert ${item.name}: ${err.message}`);
    }
  }

  // ── Insert Campaign NPCs ─────────────────────────────────────────────────────
  console.log('\n👥 Inserting campaign NPCs...');

  for (const npc of campaignNpcs) {
    try {
      const created = await prisma.nPC.create({
        data: {
          campaignId: CAMPAIGN_ID,
          name: npc.name,
          description: npc.description,
          faction: npc.faction,
          role: npc.role,
          secrets: npc.secrets,
          stats: npc.stats,
          tags: npc.tags,
        },
      });
      console.log(`  ✅ [NPC     ] ${npc.name} → ${created.id}`);
    } catch (err: any) {
      console.error(`  ❌ Failed to insert NPC ${npc.name}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Done! Inserted ${insertedHomebrew.length} homebrew items + ${campaignNpcs.length} NPCs`);
  console.log(`   All homebrew linked to campaign: ${campaign.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
