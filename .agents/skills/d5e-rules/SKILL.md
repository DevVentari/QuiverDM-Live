---
name: d5e-rules
description: D&D 5e rules expert for QuiverDM development. Provides spell mechanics, conditions, CR calculations, stat block structure, and content validation. Use when working with D&D mechanics, designing extraction schemas, or validating homebrew content.
---

# D&D 5e Rules Expert

You are an expert in D&D 5th Edition rules and mechanics, assisting with QuiverDM development.

## Quick Reference Files

- [SPELLS.md](SPELLS.md) - Spell mechanics and structure
- [CONDITIONS.md](CONDITIONS.md) - Condition effects and rules
- [CREATURES.md](CREATURES.md) - Monster stat blocks and CR

## Core Competencies

### 1. Spell Validation
When checking spells for the extraction system:
- Level: 0 (cantrip) through 9
- School: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation
- Components: V (verbal), S (somatic), M (material)
- Casting Time: action, bonus action, reaction, 1 minute, 10 minutes, 1 hour, 8 hours, 24 hours
- Duration: Instantaneous, rounds, minutes, hours, days, Until dispelled
- Concentration: boolean
- Ritual: boolean

### 2. Creature/Monster Structure
When designing extraction schemas for creatures:
```typescript
{
  name: string,
  size: "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan",
  type: "Aberration" | "Beast" | "Celestial" | "Construct" | "Dragon" | "Elemental" | "Fey" | "Fiend" | "Giant" | "Humanoid" | "Monstrosity" | "Ooze" | "Plant" | "Undead",
  alignment: string,
  ac: number,
  acType?: string,
  hp: number,
  hitDice: string, // e.g., "4d8+12"
  speed: string, // e.g., "30 ft., fly 60 ft."
  abilities: { str, dex, con, int, wis, cha },
  saves?: string[],
  skills?: string[],
  damageResistances?: string[],
  damageImmunities?: string[],
  conditionImmunities?: string[],
  senses: string,
  languages: string,
  cr: string, // "1/4", "1/2", "1", "20", etc.
  traits?: Array<{ name: string, description: string }>,
  actions?: Array<{ name: string, description: string }>,
  reactions?: Array<{ name: string, description: string }>,
  legendaryActions?: Array<{ name: string, description: string }>,
}
```

### 3. Magic Item Structure
```typescript
{
  name: string,
  type: "Armor" | "Potion" | "Ring" | "Rod" | "Scroll" | "Staff" | "Wand" | "Weapon" | "Wondrous Item",
  rarity: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact",
  requiresAttunement: boolean,
  attunementRequirement?: string, // e.g., "by a spellcaster"
  description: string,
  properties?: string[],
}
```

### 4. CR Calculations

**XP by CR:**
| CR | XP |
|----|----|
| 0 | 10 |
| 1/8 | 25 |
| 1/4 | 50 |
| 1/2 | 100 |
| 1 | 200 |
| 2 | 450 |
| 3 | 700 |
| 4 | 1,100 |
| 5 | 1,800 |
| 10 | 5,900 |
| 15 | 13,000 |
| 20 | 25,000 |

**Encounter Multipliers:**
- 1 monster: x1
- 2 monsters: x1.5
- 3-6 monsters: x2
- 7-10 monsters: x2.5
- 11-14 monsters: x3
- 15+ monsters: x4

## QuiverDM Integration Points

### Extraction Schemas
The extraction system in `src/lib/ollama-extraction.ts` uses Zod schemas:
- `SpellSchema` - Validate extracted spell data
- `MagicItemSchema` - Validate item extraction
- `MonsterSchema` - Validate creature extraction

### Homebrew Content Types
From `prisma/schema.prisma`, HomebrewContent.type can be:
- `item`, `creature`, `spell`, `location`, `subclass`
- `feat`, `rule`, `race`, `class`, `background`, `character`

### NPC Stats JSON
The `NPC.stats` field uses flexible JSON matching the creature structure above.

## Instructions

When asked about D&D mechanics:
1. Reference official 5e SRD rules
2. Provide exact values and formulas
3. Suggest validation rules for schemas
4. Consider edge cases in game mechanics
5. Help design data structures that match D&D conventions

When helping with extraction:
1. Ensure schemas match official stat block formats
2. Account for optional vs required fields
3. Handle edge cases (e.g., "—" for no languages)
4. Validate numeric ranges (abilities 1-30, CR 0-30)
