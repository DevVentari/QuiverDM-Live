# Campaign Wiki

The Campaign Wiki is a hierarchical knowledge base for world-building. Store locations, factions, lore, and any other campaign information.

## Features

- **Hierarchical Pages**: Organize content with parent/child relationships
- **Categories**: Locations, Factions, Lore, Items, and custom
- **Player Visibility**: Control what players can see
- **Rich Markdown**: Full markdown support with images
- **AI Generation**: Generate pages from descriptions
- **Cross-Linking**: Link to NPCs, sessions, homebrew

## Page Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `location` | Places in the world | Cities, dungeons, regions |
| `faction` | Organizations | Guilds, governments, cults |
| `lore` | World history | Mythology, history, cosmology |
| `item` | Notable items | Artifacts, quest items |
| `custom` | User-defined | Anything else |

## Database Schema

```prisma
model WikiPage {
  id           String    @id @default(cuid())
  campaignId   String
  campaign     Campaign  @relation(...)

  title        String
  slug         String    // URL-friendly
  content      String    @db.Text  // Markdown
  category     String    // location, faction, lore, item, custom
  customCategory String? // For category = 'custom'

  // Hierarchy
  parentId     String?
  parent       WikiPage?  @relation("WikiHierarchy", fields: [parentId], references: [id])
  children     WikiPage[] @relation("WikiHierarchy")

  // Visibility
  isPublic     Boolean   @default(false)  // Visible to players

  // Metadata
  tags         String[]
  coverImage   String?

  // Ordering within parent
  sortOrder    Int       @default(0)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([campaignId, slug])
  @@index([campaignId, category])
  @@index([parentId])
}
```

## Page Structure

### Basic Page

```markdown
# The City of Thornhold

![City Banner](/uploads/thornhold-banner.jpg)

Thornhold is a fortified city on the northern frontier, known for its
impregnable walls and fierce defenders.

## History

Founded 300 years ago by the dwarven lord Thrain Ironhold...

## Notable Locations

- [[The Iron Forge]] - Best weapons in the realm
- [[Temple of Moradin]] - Sacred dwarven temple
- [[The Rusty Anchor]] - Popular tavern

## Key NPCs

- [Lord Commander Aldric](/campaigns/abc/npcs/aldric)
- [Greta the Smith](/campaigns/abc/npcs/greta)

## Related Sessions

- [Session 3: Arrival at Thornhold](/campaigns/abc/sessions/3)
- [Session 5: The Siege](/campaigns/abc/sessions/5)
```

### Hierarchical Organization

```
Locations/
├── The Kingdom of Valdris/
│   ├── Thornhold/
│   │   ├── The Iron Forge
│   │   ├── Temple of Moradin
│   │   └── The Rusty Anchor
│   ├── Silverpine Forest/
│   │   └── The Druid Grove
│   └── The Sunken Temple
├── The Underdark/
│   └── City of Shadows
```

## API Reference

### Wiki Router

```typescript
// Get all pages for campaign
trpc.wiki.getAll.useQuery({ campaignId });

// Get page tree (hierarchical)
trpc.wiki.getTree.useQuery({ campaignId });

// Get single page by slug
trpc.wiki.getBySlug.useQuery({ campaignId, slug });

// Create page
trpc.wiki.create.useMutation();

// Update page
trpc.wiki.update.useMutation();

// Move page (change parent)
trpc.wiki.move.useMutation();

// Reorder pages
trpc.wiki.reorder.useMutation();

// Delete page
trpc.wiki.delete.useMutation();
```

### Create Page

```typescript
await trpc.wiki.create.mutate({
  campaignId,
  title: 'The City of Thornhold',
  category: 'location',
  content: '# The City of Thornhold\n\n...',
  parentId: parentPageId, // Optional
  isPublic: true,
  tags: ['city', 'dwarven', 'frontier'],
  coverImage: uploadedImageUrl,
});
```

### Move Page

```typescript
// Move under new parent
await trpc.wiki.move.mutate({
  pageId,
  newParentId: newParentPageId,
});

// Move to root level
await trpc.wiki.move.mutate({
  pageId,
  newParentId: null,
});
```

## AI Generation

### Generate from Description

```typescript
const page = await trpc.wiki.generate.mutate({
  campaignId,
  category: 'location',
  prompt: 'A mysterious elven forest with ancient ruins and protective spirits',
  parentId: parentPageId, // Optional
});

// Returns generated page content
```

### Expand Existing Page

```typescript
const expanded = await trpc.wiki.expand.mutate({
  pageId,
  section: 'history', // Which section to expand
  context: 'The forest was corrupted 100 years ago by a demon lord',
});
```

## Cross-Linking

### Link Syntax

```markdown
<!-- Link to another wiki page -->
[[The Iron Forge]]
[[locations/thornhold/iron-forge|The Famous Iron Forge]]

<!-- Link to NPC -->
[Lord Aldric](npc:aldric_id)

<!-- Link to session -->
[Session 5](session:session_5_id)

<!-- Link to homebrew -->
[Sword of Flames](homebrew:sword_id)
```

### Automatic Backlinks

Pages track what links to them:

```typescript
const page = await trpc.wiki.getBySlug.query({
  campaignId,
  slug: 'thornhold',
  includeBacklinks: true,
});

// page.backlinks = [
//   { id: 'page1', title: 'The Kingdom of Valdris' },
//   { id: 'page2', title: 'Session 5 Recap' },
// ]
```

## Components

### WikiSidebar

Navigation tree:

```tsx
<WikiSidebar
  campaignId={campaignId}
  currentPageId={pageId}
  onPageSelect={(slug) => router.push(`/wiki/${slug}`)}
/>
```

### WikiPage

Page content display:

```tsx
<WikiPage
  page={page}
  editable={canEdit}
  onEdit={() => setEditing(true)}
/>
```

### WikiEditor

Markdown editor with preview:

```tsx
<WikiEditor
  initialContent={page.content}
  onSave={handleSave}
  campaignId={campaignId} // For link autocomplete
/>
```

### WikiBreadcrumbs

Hierarchical navigation:

```tsx
<WikiBreadcrumbs
  page={page}
  onNavigate={(slug) => router.push(`/wiki/${slug}`)}
/>
```

### CategoryFilter

Filter by category:

```tsx
<CategoryFilter
  selected={selectedCategories}
  onChange={setSelectedCategories}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/wiki.ts` | Wiki CRUD + AI generation |
| `src/lib/wiki-links.ts` | Link parsing and resolution |
| `src/app/campaigns/[id]/wiki/page.tsx` | Wiki index |
| `src/app/campaigns/[id]/wiki/[...slug]/page.tsx` | Page view |
| `src/app/campaigns/[id]/wiki/new/page.tsx` | Create page |
| `src/components/wiki/` | UI components |

## Player Visibility

### Public vs Private Pages

- **Public pages**: Visible to all campaign members
- **Private pages**: DM and Co-DM only

```typescript
// Toggle visibility
await trpc.wiki.update.mutate({
  pageId,
  isPublic: true,
});
```

### Visibility Inheritance

Children don't inherit parent visibility. Each page controls its own.

Example:
- `Kingdom of Valdris` (public) - Players see
- `Kingdom Secrets` (private) - DM only
- `Thornhold` (public) - Players see
- `Thornhold Dungeon` (private) - DM only

## Search Integration

Wiki pages are indexed in global search:

```typescript
const results = await trpc.search.query({
  campaignId,
  query: 'ancient temple',
  types: ['wiki'], // Filter to wiki only
});
```

Searches:
- Page titles
- Page content
- Tags

## Import/Export

### Export Wiki

```typescript
const markdown = await trpc.wiki.export.query({
  campaignId,
  format: 'markdown', // or 'json'
});

// Downloads as ZIP with folder structure
```

### Import from Obsidian

```typescript
await trpc.wiki.importObsidian.mutate({
  campaignId,
  files: obsidianVaultFiles,
});

// Converts [[wikilinks]] to QuiverDM format
```

## Templates

### Built-in Templates

```typescript
// Get available templates
const templates = await trpc.wiki.getTemplates.query();

// Create from template
await trpc.wiki.createFromTemplate.mutate({
  campaignId,
  templateId: 'city',
  title: 'Thornhold',
});
```

### Template Examples

**City Template:**
```markdown
# {{title}}

## Overview
*Brief description of the city*

## History
*How the city came to be*

## Districts
*Major areas of the city*

## Government
*Who rules and how*

## Notable Locations
*Important places within the city*

## Key NPCs
*Important people*
```

**Faction Template:**
```markdown
# {{title}}

## Overview
*What is this faction?*

## Goals
*What do they want?*

## Methods
*How do they operate?*

## Leadership
*Who's in charge?*

## Membership
*Who joins and why?*

## Relationships
*Allies and enemies*

## Resources
*What do they have?*
```
