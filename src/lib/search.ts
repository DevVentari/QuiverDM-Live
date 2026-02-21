/**
 * MeiliSearch client and indexing utilities.
 *
 * Indexes: homebrew_content, npcs
 * All indexing operations are fire-and-forget (errors logged, never thrown)
 * so search failures never block core CRUD paths.
 */

import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: process.env.MEILI_URL ?? 'http://localhost:7701',
  apiKey: process.env.MEILI_MASTER_KEY,
});

export const HOMEBREW_INDEX = 'homebrew_content';
export const NPC_INDEX = 'npcs';

// ---------------------------------------------------------------------------
// Document shapes
// ---------------------------------------------------------------------------

export interface HomebrewSearchDoc {
  id: string;
  userId: string;
  name: string;
  type: string;
  tags: string[];
  searchText: string;
  sourceType: string;
}

export interface NpcSearchDoc {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  faction: string | null;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Index initialisation (called once at startup or on demand)
// ---------------------------------------------------------------------------

export async function initSearchIndexes(): Promise<void> {
  try {
    await client.index(HOMEBREW_INDEX).updateSettings({
      searchableAttributes: ['name', 'searchText', 'tags'],
      filterableAttributes: ['userId', 'type', 'tags', 'sourceType'],
      sortableAttributes: ['name'],
    });

    await client.index(NPC_INDEX).updateSettings({
      searchableAttributes: ['name', 'description', 'faction', 'tags'],
      filterableAttributes: ['campaignId', 'faction', 'tags'],
      sortableAttributes: ['name'],
    });
  } catch (err) {
    console.warn('[Search] Failed to initialise indexes:', err);
  }
}

// ---------------------------------------------------------------------------
// Homebrew – index operations
// ---------------------------------------------------------------------------

export async function indexHomebrew(doc: HomebrewSearchDoc): Promise<void> {
  try {
    await client.index(HOMEBREW_INDEX).addDocuments([doc]);
  } catch (err) {
    console.warn('[Search] Failed to index homebrew content:', err);
  }
}

export async function deleteHomebrew(id: string): Promise<void> {
  try {
    await client.index(HOMEBREW_INDEX).deleteDocument(id);
  } catch (err) {
    console.warn('[Search] Failed to delete homebrew from index:', err);
  }
}

// ---------------------------------------------------------------------------
// Homebrew – search
// ---------------------------------------------------------------------------

export async function searchHomebrew(
  query: string,
  filters: { userId: string; type?: string; tags?: string[] },
  options?: { limit?: number; offset?: number }
): Promise<string[]> {
  const filterParts: string[] = [`userId = "${filters.userId}"`];
  if (filters.type) filterParts.push(`type = "${filters.type}"`);
  if (filters.tags?.length) {
    filterParts.push(
      filters.tags.map((t) => `tags = "${t}"`).join(' AND ')
    );
  }

  const results = await client.index(HOMEBREW_INDEX).search(query, {
    filter: filterParts.join(' AND '),
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  });

  return results.hits.map((h) => h.id as string);
}

// ---------------------------------------------------------------------------
// NPC – index operations
// ---------------------------------------------------------------------------

export async function indexNpc(doc: NpcSearchDoc): Promise<void> {
  try {
    await client.index(NPC_INDEX).addDocuments([doc]);
  } catch (err) {
    console.warn('[Search] Failed to index NPC:', err);
  }
}

export async function deleteNpc(id: string): Promise<void> {
  try {
    await client.index(NPC_INDEX).deleteDocument(id);
  } catch (err) {
    console.warn('[Search] Failed to delete NPC from index:', err);
  }
}

// ---------------------------------------------------------------------------
// NPC – search
// ---------------------------------------------------------------------------

export async function searchNpcs(
  query: string,
  filters: { campaignId: string; faction?: string },
  options?: { limit?: number }
): Promise<string[]> {
  const filterParts: string[] = [`campaignId = "${filters.campaignId}"`];
  if (filters.faction) filterParts.push(`faction = "${filters.faction}"`);

  const results = await client.index(NPC_INDEX).search(query, {
    filter: filterParts.join(' AND '),
    limit: options?.limit ?? 50,
  });

  return results.hits.map((h) => h.id as string);
}
