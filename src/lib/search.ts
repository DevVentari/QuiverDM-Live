/**
 * MeiliSearch client and indexing utilities.
 *
 * Indexes: homebrew_content, npcs, campaigns, sessions, world_entities, world_entries
 * All direct indexing operations are fire-and-forget (errors logged, never thrown)
 * so search failures never block core CRUD paths.
 *
 * Real-time sync for the four newer indexes (campaigns/sessions/world_*) flows
 * through the meili-sync BullMQ queue — see src/lib/queue/meili-sync-queue.ts.
 * The two original indexes (homebrew_content, npcs) still use direct calls.
 */

import { MeiliSearch } from 'meilisearch';

export const meiliClient = new MeiliSearch({
  host: process.env.MEILI_URL ?? 'http://localhost:7701',
  apiKey: process.env.MEILI_MASTER_KEY,
});

const client = meiliClient;

export const HOMEBREW_INDEX = 'homebrew_content';
export const NPC_INDEX = 'npcs';
export const CAMPAIGN_INDEX = 'campaigns';
export const SESSION_INDEX = 'sessions';
export const WORLD_ENTITY_INDEX = 'world_entities';
export const WORLD_ENTRY_INDEX = 'world_entries';

export const GLOBAL_SEARCH_INDEXES = [
  CAMPAIGN_INDEX,
  SESSION_INDEX,
  NPC_INDEX,
  WORLD_ENTITY_INDEX,
  WORLD_ENTRY_INDEX,
  HOMEBREW_INDEX,
] as const;

export type GlobalSearchIndex = (typeof GLOBAL_SEARCH_INDEXES)[number];

// ---------------------------------------------------------------------------
// Document shapes
// ---------------------------------------------------------------------------

export interface HomebrewSearchDoc {
  id: string;
  userId: string | null;
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

export interface CampaignSearchDoc {
  id: string;
  ownerUserId: string;
  memberUserIds: string[];
  name: string;
  slug: string;
  description: string | null;
  status: string;
  updatedAt: number;
}

export interface SessionSearchDoc {
  id: string;
  campaignId: string;
  sessionNumber: number;
  title: string | null;
  recap: string | null;
  aiSummary: string | null;
  playerRecap: string | null;
  status: string;
  date: number;
  updatedAt: number;
}

export interface WorldEntitySearchDoc {
  id: string;
  campaignId: string;
  name: string;
  entityType: string;
  description: string | null;
  aliases: string[];
  status: string;
  updatedAt: number;
}

export interface WorldEntrySearchDoc {
  id: string;
  campaignId: string;
  slug: string;
  name: string;
  entryType: string;
  summary: string | null;
  content: string;
  tags: string[];
  updatedAt: number;
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

    await client.index(CAMPAIGN_INDEX).updateSettings({
      searchableAttributes: ['name', 'description', 'slug'],
      filterableAttributes: ['ownerUserId', 'memberUserIds', 'status'],
      sortableAttributes: ['updatedAt', 'name'],
    });

    await client.index(SESSION_INDEX).updateSettings({
      searchableAttributes: ['title', 'recap', 'aiSummary', 'playerRecap'],
      filterableAttributes: ['campaignId', 'status'],
      sortableAttributes: ['updatedAt', 'date', 'sessionNumber'],
    });

    await client.index(WORLD_ENTITY_INDEX).updateSettings({
      searchableAttributes: ['name', 'aliases', 'description'],
      filterableAttributes: ['campaignId', 'entityType', 'status'],
      sortableAttributes: ['updatedAt', 'name'],
    });

    await client.index(WORLD_ENTRY_INDEX).updateSettings({
      searchableAttributes: ['name', 'summary', 'content', 'tags'],
      filterableAttributes: ['campaignId', 'entryType', 'tags'],
      sortableAttributes: ['updatedAt', 'name'],
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

// ---------------------------------------------------------------------------
// Campaign / Session / World indexes – upsert + delete helpers
// (called by the meili-sync worker; do not call directly from request paths)
// ---------------------------------------------------------------------------

export async function upsertCampaignDoc(doc: CampaignSearchDoc): Promise<void> {
  await client.index(CAMPAIGN_INDEX).addDocuments([doc]);
}

export async function deleteCampaignDoc(id: string): Promise<void> {
  await client.index(CAMPAIGN_INDEX).deleteDocument(id);
}

export async function upsertSessionDoc(doc: SessionSearchDoc): Promise<void> {
  await client.index(SESSION_INDEX).addDocuments([doc]);
}

export async function deleteSessionDoc(id: string): Promise<void> {
  await client.index(SESSION_INDEX).deleteDocument(id);
}

export async function upsertWorldEntityDoc(doc: WorldEntitySearchDoc): Promise<void> {
  await client.index(WORLD_ENTITY_INDEX).addDocuments([doc]);
}

export async function deleteWorldEntityDoc(id: string): Promise<void> {
  await client.index(WORLD_ENTITY_INDEX).deleteDocument(id);
}

export async function upsertWorldEntryDoc(doc: WorldEntrySearchDoc): Promise<void> {
  await client.index(WORLD_ENTRY_INDEX).addDocuments([doc]);
}

export async function deleteWorldEntryDoc(id: string): Promise<void> {
  await client.index(WORLD_ENTRY_INDEX).deleteDocument(id);
}
