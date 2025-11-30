# Global Search

A unified search experience across all content types. Find anything in your campaigns with a single search bar.

## Features

- **Universal Search Bar**: Single entry point (Cmd/Ctrl+K)
- **Multi-Type Results**: Sessions, NPCs, homebrew, wiki, transcripts
- **Faceted Filtering**: Filter by content type, campaign
- **Recent Searches**: Quick access to previous queries
- **Real-Time Results**: Instant search as you type

## Search Architecture

```
                    ┌─────────────────┐
                    │   Search Bar    │
                    │    (Cmd+K)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   tRPC Router   │
                    │  search.query   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   MeiliSearch   │
                    │     Index       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │Sessions │        │  NPCs   │        │Homebrew │
    └─────────┘        └─────────┘        └─────────┘
```

## Indexed Content

| Type | Indexed Fields | Searchable By |
|------|----------------|---------------|
| **Sessions** | title, quickNotes, recap, aiSummary | Content, session number |
| **Transcripts** | text, speakers | Spoken words, speaker names |
| **NPCs** | name, description, secrets (DM only) | Name, details |
| **Characters** | name, race, class, backstory | Name, details |
| **Homebrew** | name, description, tags, searchText | Name, type, content |
| **Wiki Pages** | title, content, tags | Title, content |

## Search Index Schema

```typescript
// MeiliSearch index configuration
const searchIndex = {
  uid: 'quiverdm',
  primaryKey: 'id',
  searchableAttributes: [
    'title',
    'name',
    'content',
    'description',
    'text',
    'tags',
  ],
  filterableAttributes: [
    'type',
    'campaignId',
    'userId',
    'visibility',
  ],
  sortableAttributes: [
    'createdAt',
    'updatedAt',
    'relevance',
  ],
};
```

## Document Structure

Each indexed document:

```typescript
interface SearchDocument {
  // Universal fields
  id: string;           // Unique across all types
  type: string;         // session, npc, homebrew, wiki, transcript
  campaignId: string;
  userId: string;       // Content owner
  visibility: string;   // private, campaign, public

  // Content fields (varies by type)
  title?: string;
  name?: string;
  content?: string;
  description?: string;
  text?: string;
  tags?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;

  // Type-specific
  sessionNumber?: number;   // For sessions
  homebrewType?: string;    // For homebrew
  category?: string;        // For wiki pages
}
```

## API Reference

### Search Router

```typescript
// Universal search
trpc.search.query.useQuery({
  query: 'dragon',
  campaignId: optionalCampaignId,  // Filter to campaign
  types: ['npc', 'homebrew'],      // Filter by type
  limit: 20,
});

// Search specific type
trpc.search.sessions.useQuery({ query, campaignId });
trpc.search.npcs.useQuery({ query, campaignId });
trpc.search.homebrew.useQuery({ query, campaignId });
trpc.search.wiki.useQuery({ query, campaignId });
trpc.search.transcripts.useQuery({ query, campaignId });

// Autocomplete (faster, fewer results)
trpc.search.autocomplete.useQuery({
  query: 'dra',
  limit: 5,
});

// Recent searches
trpc.search.getRecent.useQuery();

// Clear search history
trpc.search.clearHistory.useMutation();
```

### Search Results

```typescript
interface SearchResults {
  hits: SearchHit[];
  totalHits: number;
  processingTimeMs: number;
  facets: {
    type: Record<string, number>;     // { npc: 5, homebrew: 3 }
    campaign: Record<string, number>; // { campaign_1: 8 }
  };
}

interface SearchHit {
  id: string;
  type: string;
  campaignId: string;
  campaignName: string;

  // Matched content with highlights
  title?: string;
  name?: string;
  snippet?: string;        // Content excerpt with <mark>highlights</mark>

  // For navigation
  url: string;            // Direct link to content

  // Relevance
  score: number;
}
```

## Indexing Pipeline

### On Content Create/Update

```typescript
// In tRPC router after mutation
await indexDocument({
  id: `npc_${npc.id}`,
  type: 'npc',
  campaignId: npc.campaignId,
  userId: ctx.session.user.id,
  visibility: 'campaign',
  name: npc.name,
  description: npc.description,
  content: npc.secrets,  // Will be filtered in search
  tags: npc.tags,
  createdAt: npc.createdAt.toISOString(),
  updatedAt: npc.updatedAt.toISOString(),
});
```

### On Content Delete

```typescript
await deleteDocument(`npc_${npcId}`);
```

### Bulk Reindex

For maintenance or after schema changes:

```typescript
// Admin endpoint
await trpc.admin.reindexAll.mutate({
  types: ['npc', 'homebrew'], // Or all if omitted
});
```

## Search Permissions

Results are filtered by user permissions:

```typescript
// Build filter based on user context
const filter = buildSearchFilter({
  userId: ctx.session.user.id,
  campaignMemberships: ctx.memberships, // Campaigns user belongs to
});

// Filter logic:
// - Show user's own content (any visibility)
// - Show campaign content for campaigns user is member of
// - Show public content from anyone
// - DMs see NPC secrets, players don't
```

## Components

### SearchCommand

Global search command palette (Cmd+K):

```tsx
<SearchCommand
  onSelect={(hit) => router.push(hit.url)}
/>
```

### SearchBar

Inline search bar:

```tsx
<SearchBar
  campaignId={campaignId}
  placeholder="Search this campaign..."
  onSelect={handleSelect}
/>
```

### SearchResults

Results display:

```tsx
<SearchResults
  hits={results.hits}
  query={query}
  onHitClick={handleClick}
/>
```

### SearchFilters

Faceted filters:

```tsx
<SearchFilters
  facets={results.facets}
  selected={selectedFilters}
  onChange={setSelectedFilters}
/>
```

### SearchHit

Individual result:

```tsx
<SearchHit
  hit={hit}
  onClick={() => router.push(hit.url)}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/search.ts` | Search endpoints |
| `src/lib/meilisearch.ts` | MeiliSearch client + indexing |
| `src/lib/search-permissions.ts` | Permission filtering |
| `src/components/SearchCommand.tsx` | Cmd+K command palette |
| `src/components/search/` | Search UI components |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+K` | Open search |
| `Escape` | Close search |
| `↑/↓` | Navigate results |
| `Enter` | Go to selected |
| `Cmd/Ctrl+Enter` | Open in new tab |
| `Tab` | Cycle through filters |

## MeiliSearch Setup

### Docker Configuration

```yaml
# docker-compose.yml
services:
  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7701:7700"
    volumes:
      - meilisearch_data:/meili_data
    environment:
      MEILI_MASTER_KEY: ${MEILISEARCH_MASTER_KEY}
```

### Environment Variables

```env
MEILISEARCH_HOST=http://localhost:7701
MEILISEARCH_MASTER_KEY=your-master-key
```

### Index Initialization

```typescript
// On app startup
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,
  apiKey: process.env.MEILISEARCH_MASTER_KEY,
});

// Create index if not exists
await client.createIndex('quiverdm', { primaryKey: 'id' });

// Configure index settings
await client.index('quiverdm').updateSettings({
  searchableAttributes: ['title', 'name', 'content', 'description'],
  filterableAttributes: ['type', 'campaignId', 'userId', 'visibility'],
  sortableAttributes: ['createdAt', 'updatedAt'],
});
```

## Search Analytics

Track search usage for improvements:

```typescript
// Log search queries (anonymized)
await trpc.analytics.logSearch.mutate({
  query: searchQuery,
  resultCount: results.totalHits,
  clickedResult: selectedHit?.id,
  filters: appliedFilters,
});

// Get popular searches (admin)
const popular = await trpc.admin.getPopularSearches.query();
```

## Performance Optimization

### Debouncing

Search input is debounced to avoid excessive queries:

```tsx
const debouncedQuery = useDebounce(query, 300);

const { data } = trpc.search.query.useQuery(
  { query: debouncedQuery },
  { enabled: debouncedQuery.length >= 2 }
);
```

### Caching

Results are cached briefly:

```typescript
trpc.search.query.useQuery(
  { query },
  {
    staleTime: 30_000,  // 30 seconds
    cacheTime: 60_000,  // 1 minute
  }
);
```

### Pagination

For large result sets:

```typescript
const { data } = trpc.search.query.useQuery({
  query,
  limit: 20,
  offset: page * 20,
});
```
