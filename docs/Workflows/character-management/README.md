# Character Management Workflow

## Overview

Handles player character creation, management, and campaign assignment.

## Components

### Backend
- `src/server/routers/characters.ts` - Character CRUD router
- `src/server/routers/npcs.ts` - NPC management
- `src/server/routers/players.ts` - Legacy player management

### Frontend
- `src/app/characters/` - Character pages
- `src/app/characters/create/` - Character creation

## Test Procedures

### 1. Character CRUD

#### Create Character
```typescript
trpc.characters.create.mutate({
  name: "Thorin Ironforge",
  race: "Dwarf",
  class: "Fighter",
  level: 5,
  background: "Soldier",
  abilityScores: {
    str: 16, dex: 12, con: 14,
    int: 10, wis: 13, cha: 8
  }
})
// Expected: Character created
```

#### Read Characters
```typescript
// Get user's characters
trpc.characters.getMyCharacters.query()
// Expected: Array of characters

// Get by ID
trpc.characters.getById.query({ id: "char-id" })
// Expected: Full character details
```

#### Update Character
```typescript
trpc.characters.update.mutate({
  id: "char-id",
  level: 6,
  hitPoints: { current: 45, max: 52 }
})
// Expected: Character updated
```

#### Delete Character
```typescript
trpc.characters.delete.mutate({ id: "char-id" })
// Expected: Character deleted
```

### 2. Campaign Assignment
```typescript
// Add to campaign
trpc.characters.addToCampaign.mutate({
  characterId: "char-id",
  campaignId: "campaign-id"
})
// Expected: CampaignCharacter link created with status: ACTIVE

// Remove from campaign
trpc.characters.removeFromCampaign.mutate({
  campaignCharacterId: "link-id"
})
// Expected: Character removed from campaign
```

### 3. NPC Management
```typescript
// Create NPC
trpc.npcs.create.mutate({
  campaignId: "campaign-id",
  name: "Mysterious Stranger",
  description: "A hooded figure...",
  role: "quest_giver",
  secrets: "Actually the villain in disguise"
})
// Expected: NPC created

// Get NPCs (secrets hidden for non-DMs)
trpc.npcs.getByCampaignId.query({ campaignId: "id" })
// Expected: NPCs with secrets based on permissions
```

## Authorization

| Action | Owner | Character Owner | Other |
|--------|-------|-----------------|-------|
| View Character | Yes | Yes | In same campaign |
| Edit Character | No | Yes | No |
| Add to Campaign | No | Yes | No |
| Remove from Campaign | Yes (DM) | Yes | No |

## Validation Checklist

- [ ] Character creation with all fields
- [ ] Ability score validation (1-30)
- [ ] Level validation (1-20)
- [ ] Campaign assignment
- [ ] Multiple characters per campaign
- [ ] Character status tracking (ACTIVE/INACTIVE/DEAD)
- [ ] NPC secrets hidden from players
- [ ] Portrait URL storage

## Test Results

See `results/` directory for test execution logs.
