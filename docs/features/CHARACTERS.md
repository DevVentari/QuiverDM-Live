# Character Sheets

Characters are player-owned entities that can be used across multiple campaigns. Full D&D 5e character sheet support with D&D Beyond sync.

## Features

- **Player Ownership**: Players manage their own characters
- **Portable Characters**: Use the same character in multiple campaigns
- **D&D Beyond Sync**: Import and sync from D&D Beyond
- **Full Character Sheet**: Stats, features, inventory, spells
- **Mobile-First**: Optimized for phone use at the table

## Character Ownership Model

Characters can be:
- **Player-Owned**: Linked to a user account, portable across campaigns
- **DM-Controlled**: No user link, managed by DM (for NPCs or unclaimed characters)

```typescript
// Player owns character
character.userId = 'user_123';
character.isPortable = true; // Can join multiple campaigns

// DM controls character (NPC or unassigned)
character.userId = null;
character.isPortable = false; // Locked to one campaign
```

## Character Data Structure

### Core Identity

```typescript
interface Character {
  id: string;
  userId?: string;          // Owner (null = DM-controlled)
  isPortable: boolean;      // Can be in multiple campaigns

  // Identity
  name: string;
  race?: string;
  class?: string;
  subclass?: string;
  level: number;
  background?: string;

  // Visuals
  portraitUrl?: string;
}
```

### Stats (JSON Field)

```typescript
interface CharacterStats {
  // Ability Scores
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;

  // Derived Stats
  proficiencyBonus: number;
  armorClass: number;
  initiative: number;
  speed: number;

  // Health
  maxHitPoints: number;
  currentHitPoints: number;
  temporaryHitPoints: number;
  hitDice: string;          // "8d10"
  hitDiceRemaining: number;

  // Combat
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;

  // Proficiencies
  savingThrows: string[];   // ["strength", "constitution"]
  skills: string[];         // ["athletics", "perception"]
  languages: string[];
  tools: string[];
  weapons: string[];
  armor: string[];
}
```

### Features (JSON Field)

```typescript
interface CharacterFeatures {
  racialTraits: Feature[];
  classFeatures: Feature[];
  subclassFeatures: Feature[];
  feats: Feature[];
  backgroundFeature?: Feature;
}

interface Feature {
  name: string;
  source: string;           // "Fighter 2", "Human", "Sentinel"
  description: string;
  usesPerRest?: 'short' | 'long';
  maxUses?: number;
  currentUses?: number;
}
```

### Inventory (JSON Field)

```typescript
interface CharacterInventory {
  currency: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  items: InventoryItem[];
  carryingCapacity: number;
  currentWeight: number;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weight?: number;
  equipped: boolean;
  attuned: boolean;
  description?: string;
  homebrewId?: string;      // Link to homebrew item
}
```

### Spellbook (JSON Field)

```typescript
interface CharacterSpellbook {
  spellcastingAbility: string;  // "intelligence"
  spellSaveDC: number;
  spellAttackBonus: number;

  spellSlots: {
    [level: string]: {
      max: number;
      remaining: number;
    };
  };

  cantrips: Spell[];
  spells: {
    [level: string]: Spell[];
  };
}

interface Spell {
  id: string;
  name: string;
  prepared: boolean;
  alwaysPrepared: boolean;    // Domain spells, etc.
  ritual: boolean;
  concentration: boolean;
  homebrewId?: string;        // Link to homebrew spell
}
```

## Database Schema

```prisma
model Character {
  id              String    @id @default(cuid())

  // Ownership
  userId          String?
  user            User?     @relation(...)
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

  // Character data (flexible JSON)
  stats           Json?
  features        Json?
  inventory       Json?
  spellbook       Json?
  backstory       String?   @db.Text
  notes           String?   @db.Text

  // D&D Beyond sync
  dndBeyondId     String?   @unique
  dndBeyondUrl    String?
  lastSyncedAt    DateTime?

  // Campaign associations
  campaignCharacters  CampaignCharacter[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
  @@index([dndBeyondId])
}

model CampaignCharacter {
  id           String    @id @default(cuid())
  campaignId   String
  campaign     Campaign  @relation(...)
  characterId  String
  character    Character @relation(...)

  // Campaign-specific state
  isActive     Boolean   @default(true)
  status       String    @default("active")  // active, retired, deceased
  joinedSession Int?
  leftSession  Int?

  // DM notes (not visible to player)
  dmNotes      String?   @db.Text

  @@unique([campaignId, characterId])
}
```

## API Reference

### Characters Router

```typescript
// Get user's characters
trpc.characters.getAll.useQuery();

// Get single character
trpc.characters.getById.useQuery({ id: characterId });

// Create character
trpc.characters.create.useMutation();

// Update character
trpc.characters.update.useMutation();

// Delete character
trpc.characters.delete.useMutation();

// Sync from D&D Beyond
trpc.characters.syncDndBeyond.useMutation();
```

### Campaign Characters

```typescript
// Add character to campaign
trpc.characters.joinCampaign.useMutation({
  characterId,
  campaignId,
});

// Leave campaign
trpc.characters.leaveCampaign.useMutation({
  characterId,
  campaignId,
});

// Get characters in campaign
trpc.campaigns.characters.list.useQuery({ campaignId });

// Update character status in campaign
trpc.campaigns.characters.updateStatus.useMutation({
  campaignId,
  characterId,
  status: 'retired',
});
```

## D&D Beyond Sync

### Initial Import

```typescript
await trpc.characters.importFromDndBeyond.mutate({
  dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345678',
});
```

### Sync Existing Character

```typescript
await trpc.characters.syncDndBeyond.mutate({
  characterId,
});

// Returns updated character data
```

### What Syncs

| Data | Synced | Notes |
|------|--------|-------|
| Name, Race, Class | ✅ | Core identity |
| Level, Background | ✅ | |
| Ability Scores | ✅ | |
| HP, AC, Speed | ✅ | |
| Features | ✅ | Class, race, feats |
| Spells | ✅ | Known/prepared |
| Equipment | ✅ | With quantities |
| Portrait | ✅ | Avatar image |
| Notes | ❌ | D&D Beyond notes stay separate |

## Components

### CharacterSheet

Full character sheet component:

```tsx
<CharacterSheet
  character={character}
  editable={isOwner}
  onUpdate={handleUpdate}
/>
```

### CharacterCard

Compact character display:

```tsx
<CharacterCard
  character={character}
  campaign={campaign}
  status={campaignCharacter.status}
  onSelect={() => openSheet(character.id)}
/>
```

### StatBlock

Ability scores display:

```tsx
<StatBlock
  stats={character.stats}
  editable={isOwner}
  onChange={handleStatsChange}
/>
```

### SpellList

Spellbook management:

```tsx
<SpellList
  spellbook={character.spellbook}
  onPrepare={handlePrepare}
  onCast={handleCast}
/>
```

### InventoryManager

Equipment management:

```tsx
<InventoryManager
  inventory={character.inventory}
  onEquip={handleEquip}
  onAdd={handleAddItem}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/characters.ts` | Character CRUD + D&D Beyond |
| `src/lib/dndbeyond-sync.ts` | D&D Beyond API integration |
| `src/app/characters/page.tsx` | Character list |
| `src/app/characters/[id]/page.tsx` | Character sheet |
| `src/app/characters/new/page.tsx` | Character creation |
| `src/components/character/` | UI components |

## Mobile Optimization

Character sheets are the primary mobile view. Key optimizations:

- **Tabbed Interface**: Stats | Features | Spells | Inventory | Notes
- **Quick Actions**: HP adjust, spell slot tracking, dice rolls
- **Swipe Navigation**: Between tabs
- **Offline Support**: Cache character data for table use
- **Large Touch Targets**: Easy to use during combat

```tsx
// Mobile character sheet structure
<MobileCharacterSheet>
  <CharacterHeader name={name} class={class} level={level} />

  <Tabs defaultValue="stats">
    <TabsList>
      <Tab value="stats">Stats</Tab>
      <Tab value="features">Features</Tab>
      <Tab value="spells">Spells</Tab>
      <Tab value="inventory">Items</Tab>
    </TabsList>

    <TabContent value="stats">
      <QuickHP current={hp} max={maxHp} onChange={updateHP} />
      <StatBlock stats={stats} />
      <SavingThrows stats={stats} proficiencies={saves} />
      <Skills stats={stats} proficiencies={skills} />
    </TabContent>

    {/* Other tabs... */}
  </Tabs>

  <FloatingDiceButton onRoll={handleRoll} />
</MobileCharacterSheet>
```

## Migration from Player Model

Existing `Player` records (DM-managed character data) migrate to `Character`:

1. Create `Character` with `userId: null` (DM-controlled)
2. Copy all character data fields
3. Create `CampaignCharacter` link
4. Players can later "claim" their character via invite

```typescript
// Migration script
const players = await prisma.player.findMany({
  include: { campaign: true },
});

for (const player of players) {
  const character = await prisma.character.create({
    data: {
      userId: null,  // Unclaimed
      name: player.characterName || player.name,
      race: player.characterRace,
      class: player.characterClass,
      level: player.level || 1,
      stats: player.characterData,
      dndBeyondUrl: player.dndBeyondUrl,
    },
  });

  await prisma.campaignCharacter.create({
    data: {
      campaignId: player.campaignId,
      characterId: character.id,
      isActive: true,
    },
  });
}
```

## Character Claiming

When a player joins a campaign, they can claim an existing unclaimed character:

```typescript
// DM assigns character to player
await trpc.campaigns.characters.assignToPlayer.mutate({
  campaignId,
  characterId,
  userId: playerUserId,
});

// Or player claims by matching D&D Beyond URL
await trpc.characters.claimByDndBeyond.mutate({
  campaignId,
  dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345678',
});
```
