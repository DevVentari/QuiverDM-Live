---
name: homebrew-schema
description: Use when designing AI extraction schemas for D&D homebrew content in QuiverDM — spell fields, monster stat blocks, item properties, rules sections, or validating extracted homebrew data.
---

# Homebrew Extraction Schema

AI-extracted homebrew data structures for QuiverDM. Used by the PDF extraction pipeline and DnD Beyond importer.

## Content Types & Key Fields

### Spells
```typescript
{
  name: string;
  level: number;            // 0 = cantrip, 1-9
  school: string;           // Evocation, Abjuration, etc.
  castingTime: string;      // "1 action", "1 bonus action", "1 minute"
  range: string;            // "60 feet", "Self", "Touch"
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDesc?: string;
  };
  duration: string;         // "Instantaneous", "Concentration, up to 1 minute"
  concentration: boolean;
  ritual: boolean;
  classes: string[];        // ['Wizard', 'Sorcerer']
  description: string;      // Full spell text
  higherLevels?: string;    // "At Higher Levels..." text
}
```

### Monsters / Creatures
```typescript
{
  name: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string;             // "Beast", "Undead", "Humanoid (elf)"
  alignment: string;        // "Chaotic Evil", "Any alignment"
  armorClass: number;
  armorType?: string;       // "natural armor", "chain mail"
  hitPoints: number;
  hitDice: string;          // "10d8+30"
  speed: Record<string, string>; // { walk: "30 ft.", fly: "60 ft." }
  abilities: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  savingThrows?: Record<string, number>;
  skills?: Record<string, number>;
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses: string;           // "darkvision 60 ft., passive Perception 15"
  languages: string;
  challengeRating: string;  // "1/4", "5", "20"
  xp: number;
  traits?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string }>;
  bonusActions?: Array<{ name: string; description: string }>;
  reactions?: Array<{ name: string; description: string }>;
  legendaryActions?: Array<{ name: string; description: string }>;
}
```

### Magic Items
```typescript
{
  name: string;
  type: string;             // "Weapon", "Armor", "Wondrous Item", "Ring"
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact';
  requiresAttunement: boolean;
  attunementBy?: string;    // "by a spellcaster", "by a paladin"
  description: string;
  properties?: string[];    // weapon properties: ["Finesse", "Light"]
}
```

### Rules / Sections
```typescript
{
  title: string;
  content: string;          // Full markdown text
  subsections?: Array<{ title: string; content: string }>;
  tags?: string[];
}
```

## Validation Rules

- **Spell level**: 0–9 only. Level 0 = cantrip — never store as `null`
- **CR**: store as string ("1/4", "1/2") not float
- **XP from CR**: 0→10, 1/8→25, 1/4→50, 1/2→100, 1→200, 2→450... use SRD table
- **Hit dice**: format `NdX+Y` — derive expected HP from it
- **Ability scores**: 1–30 range. Modifier = `Math.floor((score - 10) / 2)`
- **Duration**: if contains "Concentration", `concentration: true`

## Pipeline Files

| File | Role |
|---|---|
| `src/server/routers/homebrew-extraction.ts` | Router: trigger extraction, get results |
| `src/server/routers/homebrew-pdf.ts` | Router: PDF upload, Docling conversion |
| `src/server/routers/homebrew-dndbeyond.ts` | Router: DnD Beyond import |
| `src/lib/ai/` | Multi-provider AI extraction (Ollama / Gemini / OpenAI) |

## Common Mistakes

- Storing CR as a float (`0.25`) — use string `"1/4"` everywhere
- Missing `concentration: true` when duration includes "Concentration"
- Assuming spell school is always capitalized — normalize on extract
- Using `null` for optional numeric fields — use `undefined` in TypeScript types
