# Homebrew Content Workflow

## Overview

Handles homebrew content creation, management, and D&D Beyond integration.

## Components

### Backend
- `src/server/routers/homebrew.ts` - Content CRUD router
- `src/server/routers/homebrew-dndbeyond.ts` - D&D Beyond integration
- `src/server/routers/homebrew-extraction.ts` - AI extraction

### Frontend
- `src/app/homebrew/` - Homebrew pages
- `src/app/homebrew/create/` - Content creation forms

## Content Types

- `item` - Magic items, equipment
- `creature` - Monsters, NPCs
- `spell` - Spells
- `location` - Places, dungeons
- `subclass` - Subclass options
- `feat` - Feats
- `rule` - House rules
- `race` - Races/species
- `class` - Classes
- `background` - Backgrounds
- `character` - Pre-built characters

## Test Procedures

### 1. Content CRUD

#### Create Content
```typescript
trpc.homebrew.createContent.mutate({
  type: "spell",
  name: "Fireball of Doom",
  data: {
    level: 3,
    school: "evocation",
    castingTime: "1 action",
    range: "150 feet",
    components: "V, S, M",
    duration: "Instantaneous",
    description: "A bright streak..."
  },
  tags: ["fire", "aoe"]
})
// Expected: Content created with searchText
```

#### Read Content
```typescript
// Get user's content
trpc.homebrew.getMyContent.query({ type: "spell" })
// Expected: Array of spells

// Get by ID
trpc.homebrew.getById.query({ id: "content-id" })
// Expected: Full content details
```

#### Update Content
```typescript
trpc.homebrew.updateContent.mutate({
  id: "content-id",
  name: "Updated Name",
  data: { ... }
})
// Expected: Content updated
```

#### Delete Content
```typescript
trpc.homebrew.deleteContent.mutate({ id: "content-id" })
// Expected: Content deleted
```

### 2. Campaign Association
```typescript
// Add to campaign
trpc.homebrew.addToCampaign.mutate({
  homebrewId: "content-id",
  campaignId: "campaign-id"
})
// Expected: Link created

// Remove from campaign
trpc.homebrew.removeFromCampaign.mutate({
  homebrewId: "content-id",
  campaignId: "campaign-id"
})
// Expected: Link removed
```

### 3. D&D Beyond Integration
```typescript
// Import from D&D Beyond (read-only API)
trpc.homebrewDndBeyond.importFromDndBeyond.mutate({
  dndBeyondUrl: "https://www.dndbeyond.com/...",
  cobaltToken: "user-token"
})
// Expected: Content imported

// Export to D&D Beyond format
trpc.homebrewDndBeyond.exportToDnDBeyondFormat.query({
  homebrewId: "content-id",
  format: "markdown"
})
// Expected: Formatted content for copy/paste
```

## Validation Checklist

- [ ] All content types creatable
- [ ] Search text generated correctly
- [ ] Campaign association works
- [ ] Content visible in campaign view
- [ ] D&D Beyond import parses correctly
- [ ] Export formats valid
- [ ] Tag filtering works

## Test Results

See `results/` directory for test execution logs.
