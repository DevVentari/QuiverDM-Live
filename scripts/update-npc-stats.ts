import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎲 Updating NPC Stats for Bonfire Keep Campaign\n');

  const campaign = await prisma.campaign.findFirst({
    where: { name: 'Tales from The Bonfire Keep' },
    include: { npcs: { orderBy: { name: 'asc' } } },
  });

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`Found ${campaign.npcs.length} NPCs\n`);

  // Define stats for each NPC based on their role and description
  const npcStats: Record<string, any> = {
    'Ambric the Witness': {
      size: 'Medium',
      type: 'Humanoid (Human)',
      alignment: 'Lawful Good',
      ac: 12,
      acType: 'leather armor',
      hp: 27,
      hitDice: '6d8',
      speed: '30 ft.',
      str: 10,
      dex: 14,
      con: 11,
      int: 16,
      wis: 18,
      cha: 15,
      saves: 'Int +5, Wis +6',
      skills: 'History +5, Insight +6, Perception +6, Religion +5',
      senses: 'passive Perception 16',
      languages: 'Common, Aquan, Celestial',
      cr: '2',
      xp: 450,
    },
    'Faeren the Story-Bearer': {
      size: 'Medium',
      type: 'Humanoid (Wood Elf)',
      alignment: 'Neutral Good',
      ac: 15,
      acType: 'studded leather',
      hp: 44,
      hitDice: '8d8+8',
      speed: '35 ft.',
      str: 12,
      dex: 17,
      con: 13,
      int: 14,
      wis: 16,
      cha: 18,
      saves: 'Dex +5, Wis +5, Cha +6',
      skills: 'Deception +6, History +4, Nature +4, Performance +8, Persuasion +6',
      senses: 'darkvision 60 ft., passive Perception 13',
      languages: 'Common, Elvish, Sylvan, Druidic',
      cr: '3',
      xp: 700,
    },
    'Temmel of the Endless Vigil': {
      size: 'Medium',
      type: 'Humanoid (Dwarf)',
      alignment: 'Lawful Neutral',
      ac: 18,
      acType: 'plate armor',
      hp: 68,
      hitDice: '8d8+32',
      speed: '25 ft.',
      str: 18,
      dex: 10,
      con: 18,
      int: 12,
      wis: 15,
      cha: 14,
      saves: 'Str +7, Con +7',
      skills: 'Athletics +7, Intimidation +5, Perception +5',
      damageResistances: 'poison',
      senses: 'darkvision 60 ft., passive Perception 15',
      languages: 'Common, Dwarvish',
      cr: '5',
      xp: 1800,
    },
    'Emperor Aurelias Draconius': {
      size: 'Medium',
      type: 'Humanoid (Human)',
      alignment: 'Lawful Good',
      ac: 17,
      acType: 'half plate',
      hp: 102,
      hitDice: '12d8+48',
      speed: '30 ft.',
      str: 16,
      dex: 14,
      con: 18,
      int: 17,
      wis: 16,
      cha: 20,
      saves: 'Con +8, Wis +7, Cha +9',
      skills: 'History +7, Insight +7, Intimidation +9, Persuasion +9',
      conditionImmunities: 'charmed, frightened',
      senses: 'passive Perception 13',
      languages: 'Common, Draconic, Celestial, Infernal',
      cr: '8',
      xp: 3900,
    },
    'High Sage Lyria Sunweaver': {
      size: 'Medium',
      type: 'Humanoid (High Elf)',
      alignment: 'Neutral Good',
      ac: 15,
      acType: 'mage armor',
      hp: 66,
      hitDice: '12d8+12',
      speed: '30 ft.',
      str: 8,
      dex: 14,
      con: 13,
      int: 20,
      wis: 17,
      cha: 15,
      saves: 'Int +9, Wis +7',
      skills: 'Arcana +13, History +9, Insight +7, Investigation +9',
      damageResistances: 'radiant',
      senses: 'darkvision 60 ft., passive Perception 13',
      languages: 'Common, Elvish, Draconic, Celestial, Infernal, Abyssal',
      cr: '9',
      xp: 5000,
    },
    'Captain Helena Torres': {
      size: 'Medium',
      type: 'Humanoid (Human)',
      alignment: 'Lawful Good',
      ac: 18,
      acType: 'plate armor',
      hp: 84,
      hitDice: '11d8+33',
      speed: '30 ft.',
      str: 18,
      dex: 13,
      con: 16,
      int: 12,
      wis: 14,
      cha: 16,
      saves: 'Str +7, Con +6',
      skills: 'Athletics +7, Intimidation +6, Perception +5',
      senses: 'passive Perception 15',
      languages: 'Common',
      cr: '6',
      xp: 2300,
    },
    'Captain Marcus Draven': {
      size: 'Medium',
      type: 'Humanoid (Human)',
      alignment: 'Neutral Evil',
      ac: 17,
      acType: 'half plate',
      hp: 75,
      hitDice: '10d8+30',
      speed: '30 ft.',
      str: 17,
      dex: 14,
      con: 16,
      int: 13,
      wis: 11,
      cha: 15,
      saves: 'Str +6, Con +6',
      skills: 'Athletics +6, Deception +5, Intimidation +5',
      damageResistances: 'necrotic',
      senses: 'passive Perception 10',
      languages: 'Common, Infernal',
      cr: '5',
      xp: 1800,
    },
    'Current-Caller Nerida Tidereader': {
      size: 'Medium',
      type: 'Humanoid (Triton)',
      alignment: 'Lawful Neutral',
      ac: 13,
      acType: 'natural armor',
      hp: 52,
      hitDice: '8d8+16',
      speed: '30 ft., swim 40 ft.',
      str: 12,
      dex: 14,
      con: 15,
      int: 13,
      wis: 18,
      cha: 16,
      saves: 'Wis +7, Cha +6',
      skills: 'Insight +7, Nature +4, Perception +7, Religion +4',
      damageResistances: 'cold',
      senses: 'darkvision 60 ft., passive Perception 17',
      languages: 'Common, Aquan, Primordial',
      cr: '4',
      xp: 1100,
    },
    'Serenitas the Twilight Shepherd': {
      size: 'Medium',
      type: 'Celestial',
      alignment: 'Neutral Good',
      ac: 16,
      acType: 'natural armor',
      hp: 90,
      hitDice: '12d8+36',
      speed: '30 ft., fly 60 ft.',
      str: 14,
      dex: 18,
      con: 16,
      int: 17,
      wis: 20,
      cha: 19,
      saves: 'Wis +9, Cha +8',
      skills: 'Insight +9, Medicine +9, Perception +9, Persuasion +8',
      damageResistances: 'radiant, necrotic',
      conditionImmunities: 'charmed, exhaustion, frightened',
      senses: 'darkvision 120 ft., passive Perception 19',
      languages: 'all, telepathy 120 ft.',
      cr: '7',
      xp: 2900,
    },
  };

  // Update each NPC
  for (const npc of campaign.npcs) {
    const stats = npcStats[npc.name];
    if (stats) {
      await prisma.nPC.update({
        where: { id: npc.id },
        data: { stats },
      });
      console.log(`✅ Updated ${npc.name} with D&D 5e stats`);
    } else {
      console.log(`⚠️  No stats defined for ${npc.name}`);
    }
  }

  console.log('\n✨ All NPCs updated successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
