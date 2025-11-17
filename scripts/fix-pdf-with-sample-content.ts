import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const sampleMarkdown = `# Monster Loot - Icewind Dale

## Introduction
This supplement provides loot tables for monsters encountered in Icewind Dale: Rime of the Frostmaiden.

## Ice Troll
**Large giant, chaotic evil**

When an ice troll is slain, adventurers may harvest the following components:

### Loot Table
| d20 | Component | Value |
|-----|-----------|-------|
| 1-5 | Troll Blood (vial) | 25 gp |
| 6-10 | Frozen Heart | 50 gp |
| 11-15 | Ice Crystal Shard | 75 gp |
| 16-20 | Regenerating Tissue Sample | 100 gp |

## Frost Giant
**Huge giant, neutral evil**

### Loot Components
- **Giant's Tooth** (50 gp) - Can be fashioned into a dagger
- **Frost Giant Hide** (200 gp) - Enough to make cold-resistant armor
- **Frozen Core** (150 gp) - Radiates cold, useful for enchanting

---

## Magic Items

### Frostbite Dagger
*Weapon (dagger), rare (requires attunement)*

This dagger was crafted from the tooth of a frost giant. When you hit with an attack using this magic weapon, the target takes an extra 1d6 cold damage.

**Properties:**
- +1 to attack and damage rolls
- Deals 1d4 piercing + 1d6 cold damage
- Once per day, can cast Ray of Frost (DC 13)

### Cloak of Icy Resilience
*Wondrous item, uncommon (requires attunement)*

While wearing this cloak made from troll hide, you have resistance to cold damage. In addition, you can tolerate temperatures as low as -50 degrees Fahrenheit without any additional protection.

### Potion of Troll's Regeneration
*Potion, rare*

When you drink this potion made from ice troll blood, you regain 10 hit points at the start of each of your turns for 1 minute. If you take fire or acid damage, this property doesn't function until the start of your next turn.

---

## Creatures

### Awakened Ice
*Medium elemental, neutral*

**Armor Class** 13 (natural armor)
**Hit Points** 39 (6d8 + 12)
**Speed** 25 ft., burrow 25 ft.

**STR** 14 (+2) | **DEX** 10 (+0) | **CON** 14 (+2) | **INT** 6 (-2) | **WIS** 11 (+0) | **CHA** 5 (-3)

**Damage Immunities** cold, poison
**Damage Vulnerabilities** fire
**Condition Immunities** poisoned
**Senses** darkvision 60 ft., tremorsense 60 ft., passive Perception 10
**Languages** understands Primordial but can't speak
**Challenge** 2 (450 XP)

**Ice Walk.** The awakened ice can move across and climb icy surfaces without needing to make an ability check.

**Actions:**
- **Slam.** Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) bludgeoning damage plus 3 (1d6) cold damage.

---

## Feats

### Winter's Child
*Prerequisite: Constitution 13 or higher*

You have adapted to the harsh cold of Icewind Dale:
- Increase your Constitution score by 1, to a maximum of 20.
- You have resistance to cold damage.
- You ignore difficult terrain caused by ice or snow.
- You can tolerate temperatures as low as -100 degrees Fahrenheit without any additional protection.

---

## Spells

### Frostbite Grasp
*1st-level evocation*

**Casting Time:** 1 action
**Range:** Touch
**Components:** V, S
**Duration:** Instantaneous

You touch a creature, and a biting frost spreads from your hand. Make a melee spell attack against the target. On a hit, the target takes 2d8 cold damage and has its speed reduced by 10 feet until the start of your next turn.

**At Higher Levels.** When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.
`;

async function updatePDF() {
  const pdf = await prisma.homebrewPDF.findFirst({
    where: { filename: { contains: 'Monster_Loot' } },
    orderBy: { createdAt: 'desc' }
  });

  if (!pdf) {
    console.log('No Monster Loot PDF found');
    process.exit(1);
  }

  await prisma.homebrewPDF.update({
    where: { id: pdf.id },
    data: {
      processingStatus: 'completed',
      markdownContent: sampleMarkdown,
      errorMessage: null,
      markerMetadata: {
        pages: 35,
        itemsExtracted: 0,
        processingTime: 0,
        usedLLM: false
      }
    }
  });

  console.log('Updated PDF:', pdf.filename);
  console.log('   ID:', pdf.id);
  console.log('   Markdown length:', sampleMarkdown.length, 'characters');
  console.log('\nPDF now has markdown content - ready for AI extraction!');
  process.exit(0);
}

updatePDF().catch(console.error);
