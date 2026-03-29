# D&D 5e Conditions Reference

## All Conditions

### Blinded
- Can't see
- Automatically fails ability checks requiring sight
- Attack rolls have disadvantage
- Attack rolls against creature have advantage

### Charmed
- Can't attack charmer or target charmer with harmful abilities/spells
- Charmer has advantage on social ability checks

### Deafened
- Can't hear
- Automatically fails ability checks requiring hearing

### Exhaustion
Cumulative levels (1-6):

| Level | Effect |
|-------|--------|
| 1 | Disadvantage on ability checks |
| 2 | Speed halved |
| 3 | Disadvantage on attacks and saves |
| 4 | HP maximum halved |
| 5 | Speed reduced to 0 |
| 6 | Death |

- Long rest removes 1 level (with food/water)
- Effects are cumulative

### Frightened
- Disadvantage on ability checks and attacks while source visible
- Can't willingly move closer to source

### Grappled
- Speed becomes 0
- Can't benefit from speed bonuses
- Ends if grappler incapacitated
- Ends if effect removes creature from grappler's reach

### Incapacitated
- Can't take actions or reactions

### Invisible
- Impossible to see without special senses/magic
- Heavily obscured for hiding
- Attack rolls against have disadvantage
- Attack rolls have advantage

### Paralyzed
- Incapacitated (no actions/reactions)
- Can't move or speak
- Automatically fails STR and DEX saves
- Attack rolls have advantage
- Hits from within 5 feet are automatic crits

### Petrified
- Transformed to inanimate substance
- Weight increases x10
- Stops aging
- Incapacitated, can't move/speak, unaware
- Attack rolls have advantage
- Automatically fails STR and DEX saves
- Resistance to all damage
- Immune to poison and disease (existing ones suspended)

### Poisoned
- Disadvantage on attack rolls
- Disadvantage on ability checks

### Prone
- Only movement: crawl (costs extra) or stand up
- Disadvantage on attack rolls
- Attack rolls within 5 feet have advantage
- Attack rolls beyond 5 feet have disadvantage

### Restrained
- Speed becomes 0
- Can't benefit from speed bonuses
- Attack rolls have disadvantage
- Attack rolls against have advantage
- Disadvantage on DEX saves

### Stunned
- Incapacitated (no actions/reactions)
- Can't move
- Can speak only falteringly
- Automatically fails STR and DEX saves
- Attack rolls have advantage

### Unconscious
- Incapacitated (no actions/reactions)
- Can't move or speak
- Unaware of surroundings
- Drops held items, falls prone
- Automatically fails STR and DEX saves
- Attack rolls have advantage
- Hits from within 5 feet are automatic crits

## Condition Immunities by Creature Type

Common immunities:

| Type | Common Immunities |
|------|-------------------|
| Construct | Charmed, Exhaustion, Frightened, Paralyzed, Petrified, Poisoned |
| Elemental | Exhaustion, Paralyzed, Petrified, Poisoned, Unconscious |
| Fiend | Poisoned (often) |
| Ooze | Blinded, Charmed, Deafened, Exhaustion, Frightened, Prone |
| Undead | Charmed, Exhaustion, Poisoned |

## TypeScript Condition Schema

```typescript
const ConditionSchema = z.enum([
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
]);
```

## Condition Interactions

### Ends Concentration
- Incapacitated
- Stunned
- Paralyzed
- Petrified
- Unconscious

### Prevents Movement
- Grappled (speed 0)
- Paralyzed
- Petrified
- Restrained (speed 0)
- Stunned
- Unconscious
- Exhaustion 5+ (speed 0)

### Grants Advantage on Attacks Against
- Blinded target
- Invisible attacker
- Paralyzed target
- Restrained target
- Stunned target
- Unconscious target
- Prone target (within 5 feet)
