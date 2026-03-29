# D&D 5e Creature Reference

## Stat Block Structure

```typescript
interface Creature {
  // Identity
  name: string;
  size: Size;
  type: CreatureType;
  subtype?: string;  // e.g., "goblinoid", "shapechanger"
  alignment: string;

  // Defenses
  ac: number;
  acType?: string;  // e.g., "natural armor", "leather armor"
  hp: number;
  hitDice: string;  // e.g., "4d8+12"
  speed: string;    // e.g., "30 ft., fly 60 ft., swim 30 ft."

  // Ability Scores
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;

  // Defenses & Senses
  savingThrows?: string;      // e.g., "Dex +5, Wis +3"
  skills?: string;            // e.g., "Perception +5, Stealth +7"
  damageVulnerabilities?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses: string;             // e.g., "darkvision 60 ft., passive Perception 15"
  languages: string;          // e.g., "Common, Draconic" or "—"

  // Challenge
  cr: string;                 // e.g., "1/4", "1", "15"
  xp: number;

  // Abilities
  traits?: NamedAbility[];
  actions?: NamedAbility[];
  bonusActions?: NamedAbility[];
  reactions?: NamedAbility[];
  legendaryActions?: NamedAbility[];
  lairActions?: NamedAbility[];
}

interface NamedAbility {
  name: string;
  description: string;
}
```

## Sizes

| Size | Space | Example |
|------|-------|---------|
| Tiny | 2.5 x 2.5 ft | Rat, sprite |
| Small | 5 x 5 ft | Goblin, halfling |
| Medium | 5 x 5 ft | Human, orc |
| Large | 10 x 10 ft | Ogre, horse |
| Huge | 15 x 15 ft | Giant, treant |
| Gargantuan | 20 x 20 ft+ | Dragon, kraken |

## Creature Types

| Type | Description |
|------|-------------|
| Aberration | Alien entities (beholders, mind flayers) |
| Beast | Natural animals |
| Celestial | Divine beings (angels, unicorns) |
| Construct | Created beings (golems, animated objects) |
| Dragon | True dragons and related |
| Elemental | Elemental planes beings |
| Fey | Feywild creatures (sprites, dryads) |
| Fiend | Lower planes beings (demons, devils) |
| Giant | Giant-kin |
| Humanoid | Human-like (elves, orcs, humans) |
| Monstrosity | Unnatural creatures (owlbears, mimics) |
| Ooze | Amorphous creatures |
| Plant | Plant creatures (treants, blights) |
| Undead | Animated dead (zombies, vampires) |

## Challenge Rating

### CR to XP Table
| CR | XP | Prof |
|----|-----|------|
| 0 | 0-10 | +2 |
| 1/8 | 25 | +2 |
| 1/4 | 50 | +2 |
| 1/2 | 100 | +2 |
| 1 | 200 | +2 |
| 2 | 450 | +2 |
| 3 | 700 | +2 |
| 4 | 1,100 | +2 |
| 5 | 1,800 | +3 |
| 6 | 2,300 | +3 |
| 7 | 2,900 | +3 |
| 8 | 3,900 | +3 |
| 9 | 5,000 | +4 |
| 10 | 5,900 | +4 |
| 11 | 7,200 | +4 |
| 12 | 8,400 | +4 |
| 13 | 10,000 | +5 |
| 14 | 11,500 | +5 |
| 15 | 13,000 | +5 |
| 16 | 15,000 | +5 |
| 17 | 18,000 | +6 |
| 18 | 20,000 | +6 |
| 19 | 22,000 | +6 |
| 20 | 25,000 | +6 |
| 21 | 33,000 | +7 |
| 22 | 41,000 | +7 |
| 23 | 50,000 | +7 |
| 24 | 62,000 | +7 |
| 25 | 75,000 | +8 |
| 26 | 90,000 | +8 |
| 27 | 105,000 | +8 |
| 28 | 120,000 | +8 |
| 29 | 135,000 | +9 |
| 30 | 155,000 | +9 |

### Calculating CR (Quick Reference)

**Defensive CR:**
1. Calculate effective HP (with resistances/immunities)
2. Find HP in table
3. Adjust for AC (every 2 above/below expected = +/- 1 CR)

**Offensive CR:**
1. Calculate average damage per round (3 rounds)
2. Find damage in table
3. Adjust for attack bonus/save DC

**Final CR = (Defensive CR + Offensive CR) / 2**

## Ability Score Modifiers

```typescript
function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
```

| Score | Modifier |
|-------|----------|
| 1 | -5 |
| 2-3 | -4 |
| 4-5 | -3 |
| 6-7 | -2 |
| 8-9 | -1 |
| 10-11 | +0 |
| 12-13 | +1 |
| 14-15 | +2 |
| 16-17 | +3 |
| 18-19 | +4 |
| 20-21 | +5 |
| 22-23 | +6 |
| 24-25 | +7 |
| 26-27 | +8 |
| 28-29 | +9 |
| 30 | +10 |

## Zod Schema for Extraction

```typescript
const CreatureSchema = z.object({
  name: z.string(),
  size: z.enum(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]),
  type: z.enum([
    "Aberration", "Beast", "Celestial", "Construct", "Dragon",
    "Elemental", "Fey", "Fiend", "Giant", "Humanoid",
    "Monstrosity", "Ooze", "Plant", "Undead"
  ]),
  subtype: z.string().optional(),
  alignment: z.string(),
  ac: z.number().int().min(1).max(30),
  acType: z.string().optional(),
  hp: z.number().int().min(1),
  hitDice: z.string(),
  speed: z.string(),
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
  savingThrows: z.string().optional(),
  skills: z.string().optional(),
  damageVulnerabilities: z.string().optional(),
  damageResistances: z.string().optional(),
  damageImmunities: z.string().optional(),
  conditionImmunities: z.string().optional(),
  senses: z.string(),
  languages: z.string(),
  cr: z.string(),
  xp: z.number().int(),
  traits: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  actions: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  reactions: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  legendaryActions: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
});
```
