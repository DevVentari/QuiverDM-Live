# Encounter Builder

Build balanced combat encounters with automatic difficulty calculation, monster search, and session integration.

## Features

- **CR Calculator**: Automatic difficulty rating (Easy/Medium/Hard/Deadly)
- **Monster Search**: Search SRD monsters and homebrew creatures
- **Party Tracking**: Use actual campaign characters for calculations
- **Session Linking**: Attach encounters to specific sessions
- **Initiative Tracker**: Run encounters during sessions

## Difficulty Calculation

Uses standard D&D 5e encounter building rules:

1. Calculate party XP thresholds by level
2. Sum monster XP
3. Apply encounter multiplier for multiple monsters
4. Compare adjusted XP to party thresholds

### XP Thresholds by Level

| Level | Easy | Medium | Hard | Deadly |
|-------|------|--------|------|--------|
| 1 | 25 | 50 | 75 | 100 |
| 2 | 50 | 100 | 150 | 200 |
| 3 | 75 | 150 | 225 | 400 |
| 4 | 125 | 250 | 375 | 500 |
| 5 | 250 | 500 | 750 | 1100 |
| ... | ... | ... | ... | ... |

### Encounter Multiplier

| # of Monsters | Multiplier |
|---------------|------------|
| 1 | ×1 |
| 2 | ×1.5 |
| 3-6 | ×2 |
| 7-10 | ×2.5 |
| 11-14 | ×3 |
| 15+ | ×4 |

## Database Schema

```prisma
model Encounter {
  id           String    @id @default(cuid())
  campaignId   String
  campaign     Campaign  @relation(...)
  sessionId    String?   // Optional link to session
  session      GameSession? @relation(...)

  name         String
  description  String?   @db.Text
  environment  String?   // forest, dungeon, urban, etc.

  // Calculated fields
  difficulty   String?   // easy, medium, hard, deadly
  totalXp      Int?
  adjustedXp   Int?

  // Monsters
  monsters     EncounterMonster[]

  // State for running encounters
  isActive     Boolean   @default(false)
  currentRound Int?
  currentTurn  Int?

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([campaignId])
  @@index([sessionId])
}

model EncounterMonster {
  id           String    @id @default(cuid())
  encounterId  String
  encounter    Encounter @relation(...)

  // Monster reference (one of these)
  homebrewId   String?   // Link to HomebrewContent (creature)
  homebrew     HomebrewContent? @relation(...)
  srdMonster   String?   // SRD monster name (e.g., "Goblin")

  // Instance data
  quantity     Int       @default(1)
  notes        String?   // "Hidden behind altar"

  // Combat state (when encounter is active)
  instances    MonsterInstance[]

  @@index([encounterId])
}

model MonsterInstance {
  id              String          @id @default(cuid())
  encounterMonsterId String
  encounterMonster EncounterMonster @relation(...)

  instanceNumber  Int             // 1, 2, 3...
  currentHp       Int?
  maxHp           Int?
  initiative      Int?
  conditions      String[]        // stunned, prone, etc.
  notes           String?

  @@unique([encounterMonsterId, instanceNumber])
}
```

## API Reference

### Encounters Router

```typescript
// List encounters for campaign
trpc.encounters.getAll.useQuery({ campaignId });

// Get single encounter
trpc.encounters.getById.useQuery({ id: encounterId });

// Create encounter
trpc.encounters.create.useMutation();

// Update encounter
trpc.encounters.update.useMutation();

// Delete encounter
trpc.encounters.delete.useMutation();

// Calculate difficulty
trpc.encounters.calculateDifficulty.useQuery({
  encounterId,
  partyLevels: [5, 5, 4, 5], // Or use campaign characters
});
```

### Monster Management

```typescript
// Add monster to encounter
trpc.encounters.addMonster.useMutation();

// Update monster (quantity, notes)
trpc.encounters.updateMonster.useMutation();

// Remove monster
trpc.encounters.removeMonster.useMutation();

// Search SRD monsters
trpc.monsters.searchSRD.useQuery({ query: 'goblin' });

// Search homebrew creatures
trpc.homebrew.search.useQuery({
  campaignId,
  type: 'creature',
  query: 'dragon',
});
```

### Running Encounters

```typescript
// Start encounter (roll initiative)
trpc.encounters.start.useMutation();

// Next turn
trpc.encounters.nextTurn.useMutation();

// Update monster HP
trpc.encounters.updateMonsterHp.useMutation();

// Add condition
trpc.encounters.addCondition.useMutation();

// End encounter
trpc.encounters.end.useMutation();
```

## Creating an Encounter

### Step 1: Create Encounter

```typescript
const encounter = await trpc.encounters.create.mutate({
  campaignId,
  name: 'Goblin Ambush',
  description: 'A band of goblins attacks from the treeline',
  environment: 'forest',
  sessionId: optionalSessionId,
});
```

### Step 2: Add Monsters

```typescript
// Add SRD monster
await trpc.encounters.addMonster.mutate({
  encounterId: encounter.id,
  srdMonster: 'Goblin',
  quantity: 4,
  notes: 'In the trees',
});

// Add homebrew creature
await trpc.encounters.addMonster.mutate({
  encounterId: encounter.id,
  homebrewId: 'goblin_shaman_id',
  quantity: 1,
  notes: 'Leader, in back',
});
```

### Step 3: Check Difficulty

```typescript
const difficulty = await trpc.encounters.calculateDifficulty.query({
  encounterId: encounter.id,
});

// Returns:
// {
//   difficulty: 'medium',
//   totalXp: 200,
//   adjustedXp: 400,
//   partyThresholds: { easy: 500, medium: 1000, hard: 1500, deadly: 2200 },
//   recommendation: 'Good challenge for the party'
// }
```

## Running an Encounter

### Start Combat

```typescript
await trpc.encounters.start.mutate({
  encounterId,
  characterInitiatives: {
    'char_1': 18,
    'char_2': 12,
    'char_3': 15,
  },
  monsterInitiatives: {
    'monster_1_1': 14, // First goblin
    'monster_1_2': 14, // Second goblin (same roll)
    'monster_2_1': 8,  // Shaman
  },
});
```

### Track Combat

```typescript
// Damage a monster
await trpc.encounters.updateMonsterHp.mutate({
  instanceId: 'monster_1_1',
  currentHp: 4, // From 7
});

// Add condition
await trpc.encounters.addCondition.mutate({
  instanceId: 'monster_2_1',
  condition: 'prone',
});

// Advance turn
await trpc.encounters.nextTurn.mutate({ encounterId });
```

### Real-Time Sync

With WebSocket, all party members see updates:

```typescript
// Subscribe to encounter updates
trpc.encounters.subscribe({ encounterId }).subscribe({
  onData: (update) => {
    // Update local state
  },
});
```

## Components

### EncounterBuilder

Full encounter creation UI:

```tsx
<EncounterBuilder
  campaignId={campaignId}
  onSave={handleSave}
/>
```

### MonsterSearch

Search and add monsters:

```tsx
<MonsterSearch
  campaignId={campaignId}
  onSelect={(monster) => addToEncounter(monster)}
/>
```

### DifficultyMeter

Visual difficulty indicator:

```tsx
<DifficultyMeter
  difficulty={encounter.difficulty}
  xp={encounter.adjustedXp}
  thresholds={partyThresholds}
/>
```

### EncounterCard

Encounter preview:

```tsx
<EncounterCard
  encounter={encounter}
  onEdit={() => openEditor(encounter.id)}
  onRun={() => startCombat(encounter.id)}
/>
```

### InitiativeTracker

Live combat tracker:

```tsx
<InitiativeTracker
  encounterId={encounterId}
  isRealTime={true}
/>
```

### MonsterStatBlock

Display monster stats:

```tsx
<MonsterStatBlock
  monster={monster}
  showHp={isDM}
  currentHp={instance.currentHp}
  conditions={instance.conditions}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/encounters.ts` | Encounter CRUD + combat |
| `src/lib/encounter-math.ts` | CR calculations |
| `src/lib/srd-monsters.ts` | SRD monster data |
| `src/app/campaigns/[id]/encounters/page.tsx` | Encounter list |
| `src/app/campaigns/[id]/encounters/new/page.tsx` | Encounter builder |
| `src/app/campaigns/[id]/encounters/[id]/page.tsx` | Encounter detail |
| `src/app/campaigns/[id]/encounters/[id]/run/page.tsx` | Combat tracker |
| `src/components/encounter/` | UI components |

## SRD Monster Data

We include all SRD monsters with stats:

```typescript
interface SRDMonster {
  name: string;
  size: string;
  type: string;
  alignment: string;
  cr: number;
  xp: number;
  ac: number;
  hp: number;
  hpFormula: string;
  speed: string;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills?: Record<string, number>;
  senses: string;
  languages: string;
  traits?: { name: string; description: string }[];
  actions?: { name: string; description: string }[];
  reactions?: { name: string; description: string }[];
  legendaryActions?: { name: string; description: string }[];
}
```

## Homebrew Creature Integration

Homebrew creatures (type: 'creature') can be used in encounters:

```typescript
// Homebrew creature data structure
interface HomebrewCreature {
  name: string;
  cr: number;         // Required for encounter math
  xp: number;         // Required for encounter math
  hp: number;
  ac: number;
  // ... other stats
}
```

When adding homebrew to an encounter:

```typescript
await trpc.encounters.addMonster.mutate({
  encounterId,
  homebrewId: 'dragon_turtle_variant_id',
  quantity: 1,
});
```

## Quick Encounter Templates

Pre-built encounters for common scenarios:

```typescript
const templates = await trpc.encounters.getTemplates.query({
  partyLevel: 5,
  partySize: 4,
  difficulty: 'medium',
});

// Returns encounters like:
// - Goblin Patrol (4 goblins, 1 hobgoblin)
// - Undead Ambush (6 skeletons, 2 zombies)
// - Owlbear Den (2 owlbears)

await trpc.encounters.createFromTemplate.mutate({
  campaignId,
  templateId: 'goblin_patrol',
});
```

## Player View

During combat, players can see (if DM enables):

- Initiative order (whose turn it is)
- Monster names (not HP unless DM reveals)
- Conditions on monsters
- Their own character's turn

Players do NOT see:
- Monster HP (unless revealed)
- Monster stats
- DM notes on monsters
