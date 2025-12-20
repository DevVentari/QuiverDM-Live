# Character Sheets

Characters are player-owned entities that can be used across multiple campaigns. Full D&D 5e character sheet support with D&D Beyond sync capability.

## Status: ✅ Phase 1 Backend Complete

The character management system is fully implemented in the backend. Frontend components are planned.

## Features

- **Player Ownership**: Players manage their own characters
- **Portable Characters**: Use the same character in multiple campaigns
- **D&D Beyond Sync**: Import and sync from D&D Beyond (structure ready)
- **Full Character Sheet**: Stats, features, inventory, spells
- **Campaign Integration**: Add characters to campaigns with DM approval
- **DM Notes**: Private notes visible only to DMs

## Database Schema

```prisma
enum CharacterStatus {
  PENDING   // Awaiting DM approval
  ACTIVE    // Currently playing
  RETIRED   // Voluntarily retired
  DECEASED  // Character died
  REMOVED   // Removed by DM
}

model Character {
  id              String    @id @default(cuid())

  // Ownership - Characters are owned by users (players)
  userId          String
  user            User      @relation(...)

  // Portability - Can this character be used in multiple campaigns?
  isPortable      Boolean   @default(true)

  // Core identity
  name            String
  race            String?
  class           String?
  subclass        String?
  level           Int       @default(1)
  background      String?

  // Visuals
  portraitUrl     String?

  // Core stats (structured for easy access)
  abilityScores   Json?     // { str: 10, dex: 14, con: 12, int: 8, wis: 15, cha: 13 }
  hitPoints       Json?     // { current: 25, max: 30, temp: 0 }
  armorClass      Int?
  speed           Int?      @default(30)
  proficiencyBonus Int?     @default(2)

  // Character details
  features        Json?     // Class/race features, abilities
  proficiencies   Json?     // Skills, tools, weapons, armor, saves
  inventory       Json?     // Equipment and items
  spellcasting    Json?     // Spellcasting info, prepared spells, slots
  currency        Json?     // { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 }

  // Backstory and notes
  backstory       String?   @db.Text
  personalityTraits String? @db.Text
  ideals          String?   @db.Text
  bonds           String?   @db.Text
  flaws           String?   @db.Text
  notes           String?   @db.Text  // Player's private notes

  // D&D Beyond sync
  dndBeyondId     String?   @unique
  dndBeyondUrl    String?
  lastSyncedAt    DateTime?

  // Full raw data (for complete D&D Beyond import preservation)
  rawData         Json?

  // Campaign associations
  campaignCharacters  CampaignCharacter[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model CampaignCharacter {
  id           String          @id @default(cuid())

  campaignId   String
  campaign     Campaign        @relation(...)

  characterId  String
  character    Character       @relation(...)

  // Status in this campaign
  status       CharacterStatus @default(PENDING)
  isActive     Boolean         @default(true)

  // DM-only notes (not visible to player)
  dmNotes      String?         @db.Text

  // Campaign-specific overrides (optional)
  campaignData Json?

  joinedAt     DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([campaignId, characterId])
}
```

## API Reference

### Characters Router (`trpc.characters.*`)

#### Queries

```typescript
// Get all characters owned by current user
const { data: characters } = trpc.characters.getMyCharacters.useQuery();
// Returns: characters with their campaign associations

// Get single character by ID (owner only)
const { data: character } = trpc.characters.getById.useQuery({ id: characterId });

// Get characters in a campaign (for party view)
const { data: partyMembers } = trpc.characters.getCampaignCharacters.useQuery({
  campaignId,
});
// Returns: active/pending characters with user info
// DM notes hidden from non-DMs
// Pending characters hidden from other players
```

#### Mutations

```typescript
// Create a new character
const character = await trpc.characters.create.mutateAsync({
  name: 'Gandalf the Grey',
  race: 'Human',
  class: 'Wizard',
  level: 5,
  background: 'Sage',
  isPortable: true,
  abilityScores: { str: 10, dex: 14, con: 12, int: 18, wis: 16, cha: 14 },
  hitPoints: { current: 28, max: 28, temp: 0 },
  armorClass: 12,
  speed: 30,
  backstory: 'A wandering wizard...',
  personalityTraits: 'Curious about everything',
  ideals: 'Knowledge is power',
  bonds: 'Protecting the free peoples',
  flaws: 'Sometimes too cryptic',
});

// Update character (owner only)
await trpc.characters.update.mutateAsync({
  id: characterId,
  level: 6,
  hitPoints: { current: 35, max: 35, temp: 0 },
  // ... any other fields
});

// Delete character (owner only)
await trpc.characters.delete.mutateAsync({ id: characterId });
```

### Campaign Character Management

```typescript
// Add character to a campaign (submits for DM approval)
await trpc.characters.addToCampaign.mutateAsync({
  characterId,
  campaignId,
});
// Creates CampaignCharacter with status: PENDING

// Approve character (DM only)
await trpc.characters.approveCharacter.mutateAsync({
  campaignId,
  campaignCharacterId,
});
// Changes status: PENDING -> ACTIVE

// Update character status in campaign (DM only)
await trpc.characters.updateCampaignStatus.mutateAsync({
  campaignId,
  campaignCharacterId,
  status: 'RETIRED', // or ACTIVE, DECEASED, REMOVED
  dmNotes: 'Retired after the Tomb of Horrors',
});

// Remove character from campaign (DM or character owner)
await trpc.characters.removeFromCampaign.mutateAsync({
  campaignCharacterId,
});

// Update DM notes (DM only)
await trpc.characters.updateDMNotes.mutateAsync({
  campaignId,
  campaignCharacterId,
  dmNotes: 'Secret: This character has been replaced by a doppelganger',
});
```

## Character Data Structures

### Ability Scores

```typescript
interface AbilityScores {
  str: number;  // 1-30
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}
```

### Hit Points

```typescript
interface HitPoints {
  current: number;
  max: number;
  temp: number;
}
```

### Currency

```typescript
interface Currency {
  cp: number;  // Copper pieces
  sp: number;  // Silver pieces
  ep: number;  // Electrum pieces
  gp: number;  // Gold pieces
  pp: number;  // Platinum pieces
}
```

### Features (JSON structure)

```typescript
interface Features {
  racial?: Feature[];
  class?: Feature[];
  subclass?: Feature[];
  feats?: Feature[];
  background?: Feature;
}

interface Feature {
  name: string;
  source: string;        // "Fighter 2", "Human", "Sentinel"
  description: string;
  usesPerRest?: 'short' | 'long';
  maxUses?: number;
  currentUses?: number;
}
```

### Proficiencies (JSON structure)

```typescript
interface Proficiencies {
  savingThrows: string[];  // ["strength", "constitution"]
  skills: string[];        // ["athletics", "perception"]
  languages: string[];
  tools: string[];
  weapons: string[];
  armor: string[];
}
```

### Spellcasting (JSON structure)

```typescript
interface Spellcasting {
  ability: string;           // "intelligence"
  spellSaveDC: number;
  spellAttackBonus: number;
  spellSlots: {
    [level: string]: {
      max: number;
      remaining: number;
    };
  };
  cantripsKnown: Spell[];
  spellsKnown: Spell[];
  preparedSpells: string[];  // IDs of prepared spells
}

interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  ritual: boolean;
  concentration: boolean;
  alwaysPrepared: boolean;
}
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Character and CampaignCharacter models |
| `src/server/routers/characters.ts` | Full character management API |
| `src/server/routers/campaigns.ts` | Campaign integration (includes characters) |

## Usage Flow

### Player Creates Character

```typescript
// 1. Create character
const character = await trpc.characters.create.mutateAsync({
  name: 'Thorin Ironforge',
  race: 'Dwarf',
  class: 'Fighter',
  level: 1,
});

// 2. Join a campaign (after receiving invite)
await trpc.members.acceptInvite.mutateAsync({ code: 'ABC123' });

// 3. Add character to campaign
await trpc.characters.addToCampaign.mutateAsync({
  characterId: character.id,
  campaignId,
});
// Character is now PENDING approval
```

### DM Manages Characters

```typescript
// View party including pending characters
const { data: party } = trpc.characters.getCampaignCharacters.useQuery({
  campaignId,
});

// Approve a pending character
await trpc.characters.approveCharacter.mutateAsync({
  campaignId,
  campaignCharacterId: pendingCharacter.id,
});

// Add private DM notes
await trpc.characters.updateDMNotes.mutateAsync({
  campaignId,
  campaignCharacterId,
  dmNotes: 'This player tends to be a murder hobo',
});

// Mark character as deceased
await trpc.characters.updateCampaignStatus.mutateAsync({
  campaignId,
  campaignCharacterId,
  status: 'DECEASED',
  dmNotes: 'Died fighting the dragon in session 15',
});
```

### Portable vs Locked Characters

```typescript
// Portable character (default) - can join multiple campaigns
const portableChar = await trpc.characters.create.mutateAsync({
  name: 'The Wanderer',
  isPortable: true,  // Can be in Campaign A and Campaign B
});

// Campaign-locked character
const lockedChar = await trpc.characters.create.mutateAsync({
  name: 'Sir Lancelot',
  isPortable: false,  // Can only be in one active campaign
});
```

## Party View Filtering

The `getCampaignCharacters` endpoint filters based on user role:

| User | Sees Active | Sees Pending | Sees DM Notes |
|------|-------------|--------------|---------------|
| OWNER | ✅ | ✅ | ✅ |
| CO_DM | ✅ | ✅ | ✅ |
| PLAYER (own char) | ✅ | ✅ (own only) | ❌ |
| PLAYER (other) | ✅ | ❌ | ❌ |
| SPECTATOR | ✅ | ❌ | ❌ |

## Character Statuses

| Status | Description | Who Can Set |
|--------|-------------|-------------|
| PENDING | Awaiting DM approval | Auto on join |
| ACTIVE | Currently playing | DM |
| RETIRED | Voluntarily retired | DM |
| DECEASED | Character died | DM |
| REMOVED | Removed by DM | DM |

## Future: D&D Beyond Integration

The schema supports D&D Beyond sync:

```typescript
// Fields ready for sync
character.dndBeyondId    // D&D Beyond character ID
character.dndBeyondUrl   // Public URL for reference
character.lastSyncedAt   // Last sync timestamp
character.rawData        // Full imported data preservation

// Future API (not yet implemented)
await trpc.characters.importFromDndBeyond.mutateAsync({
  dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345678',
});

await trpc.characters.syncDndBeyond.mutateAsync({
  characterId,
});
```

## Frontend Components (Planned)

| Component | Purpose | Status |
|-----------|---------|--------|
| CharacterList | My characters page | ❌ Planned |
| CharacterSheet | Full character view/edit | ❌ Planned |
| CharacterCard | Compact party member card | ❌ Planned |
| CharacterCreationForm | New character wizard | ❌ Planned |
| PartyView | Campaign party display | ❌ Planned |
| StatBlock | Ability scores display | ❌ Planned |
| SpellList | Spellbook management | ❌ Planned |
| InventoryManager | Equipment management | ❌ Planned |
