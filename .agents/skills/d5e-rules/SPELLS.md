# D&D 5e Spell Reference

## Spell Structure

Every spell has these components:

```typescript
interface Spell {
  name: string;
  level: number;           // 0 for cantrips, 1-9 for leveled spells
  school: SpellSchool;
  castingTime: string;
  range: string;
  components: string[];    // V, S, M
  material?: string;       // Material component description
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  description: string;
  higherLevels?: string;   // "At Higher Levels" text
}

type SpellSchool =
  | "Abjuration"      // Protection, banishment
  | "Conjuration"     // Summoning, teleportation
  | "Divination"      // Knowledge, detection
  | "Enchantment"     // Mind-affecting
  | "Evocation"       // Energy, damage
  | "Illusion"        // Deception, phantasms
  | "Necromancy"      // Death, undead
  | "Transmutation";  // Transformation
```

## Casting Times

| Value | Examples |
|-------|----------|
| 1 action | Most combat spells |
| 1 bonus action | Healing Word, Misty Step |
| 1 reaction | Shield, Counterspell |
| 1 minute | Detect Magic (ritual) |
| 10 minutes | Identify (ritual) |
| 1 hour | Find Familiar (ritual) |
| 8 hours | Clone, Simulacrum |
| 24 hours | Hallow |

## Ranges

| Value | Meaning |
|-------|---------|
| Self | Caster only |
| Touch | Physical contact |
| 30 feet | Common short range |
| 60 feet | Standard medium range |
| 120 feet | Long range |
| 150 feet | Extended range |
| 1 mile | Very long range |
| Sight | Line of sight |
| Unlimited | Anywhere on same plane |
| Self (X-foot radius) | AoE centered on caster |
| Self (X-foot cone) | Cone from caster |
| Self (X-foot line) | Line from caster |

## Durations

| Value | Meaning |
|-------|---------|
| Instantaneous | Effect happens once |
| 1 round | Until start of next turn |
| 1 minute | 10 rounds of combat |
| 10 minutes | Short exploration |
| 1 hour | Extended activity |
| 8 hours | Rest period |
| 24 hours | Full day |
| Until dispelled | Permanent until removed |
| Special | See spell description |

## Concentration Rules

- Only one concentration spell at a time
- Taking damage requires CON save (DC = 10 or half damage, whichever higher)
- Incapacitated = concentration ends
- Maximum duration still applies

## Spell Slot Usage

| Spell Level | Slot Required |
|-------------|---------------|
| Cantrip | None (unlimited) |
| 1st-9th | Matching or higher slot |

### Upcasting
Many spells gain benefits when cast at higher levels:
- Extra damage dice
- Additional targets
- Extended duration
- Increased area

## Ritual Casting

- Takes 10 minutes longer than normal
- Does not consume spell slot
- Must have spell prepared (or in spellbook for Wizards)
- Only spells with "ritual" tag

## Common Validation Rules

```typescript
// Zod schema for spell extraction
const SpellSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(0).max(9),
  school: z.enum([
    "Abjuration", "Conjuration", "Divination", "Enchantment",
    "Evocation", "Illusion", "Necromancy", "Transmutation"
  ]),
  castingTime: z.string(),
  range: z.string(),
  components: z.array(z.enum(["V", "S", "M"])),
  material: z.string().optional(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean().default(false),
  classes: z.array(z.string()),
  description: z.string(),
  higherLevels: z.string().optional(),
});
```

## Spell Damage Scaling

### Cantrips (by character level)
| Level | Dice |
|-------|------|
| 1-4 | 1d |
| 5-10 | 2d |
| 11-16 | 3d |
| 17+ | 4d |

### Leveled Spells (by slot level)
Typically +1d per slot level above minimum.
Example: Fireball (3rd level) = 8d6, at 4th = 9d6, at 5th = 10d6
