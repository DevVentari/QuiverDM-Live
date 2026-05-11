/**
 * MeiliSearch backfill for the four global-search indexes:
 *   campaigns, sessions, world_entities, world_entries
 *
 * Idempotent — safe to re-run. Initialises index settings, then walks each
 * table in batches and upserts documents via addDocuments (which is upsert
 * semantics in Meili when primary key matches).
 *
 * Usage:
 *   npm run backfill:meili            # all indexes, default batch size
 *   npm run backfill:meili -- --kind=campaigns
 *   npm run backfill:meili -- --batch=200
 */

import dotenv from 'dotenv';
dotenv.config();

// IMPORTANT: dynamic imports below — static imports run BEFORE the
// dotenv.config() above, which causes @/lib/search to capture
// MEILI_URL='http://localhost:7701' (the default) instead of the
// homelab URL from .env. By the time these dynamic imports
// resolve, process.env is populated.

type Kind = 'campaigns' | 'sessions' | 'world_entities' | 'world_entries' | 'all';

function parseArgs(): { kind: Kind; batch: number } {
  const args = process.argv.slice(2);
  let kind: Kind = 'all';
  let batch = 500;
  for (const arg of args) {
    if (arg.startsWith('--kind=')) kind = arg.split('=')[1] as Kind;
    if (arg.startsWith('--batch=')) batch = parseInt(arg.split('=')[1], 10);
  }
  return { kind, batch };
}

async function main() {
  const { kind, batch } = parseArgs();
  console.log(`[Backfill] target=${kind} batch=${batch}`);
  console.log(`[Backfill] MEILI_URL=${process.env.MEILI_URL ?? '(default)'}`);
  console.log(`[Backfill] DATABASE_URL host=${(() => { try { return new URL(process.env.DATABASE_URL ?? '').host; } catch { return '(invalid)'; } })()}`);

  const { prisma } = await import('@/lib/prisma');
  const search = await import('@/lib/search');
  const {
    initSearchIndexes,
    meiliClient,
    CAMPAIGN_INDEX,
    SESSION_INDEX,
    WORLD_ENTITY_INDEX,
    WORLD_ENTRY_INDEX,
  } = search;
  type CampaignSearchDoc = import('@/lib/search').CampaignSearchDoc;
  type SessionSearchDoc = import('@/lib/search').SessionSearchDoc;
  type WorldEntitySearchDoc = import('@/lib/search').WorldEntitySearchDoc;
  type WorldEntrySearchDoc = import('@/lib/search').WorldEntrySearchDoc;

  console.log('[Backfill] Initialising index settings...');
  await initSearchIndexes();

  async function backfillCampaigns(): Promise<number> {
    let cursor: string | undefined;
    let total = 0;
    while (true) {
      const campaigns = await prisma.campaign.findMany({
        take: batch,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        include: { members: { select: { userId: true } } },
      });
      if (campaigns.length === 0) break;
      const docs: CampaignSearchDoc[] = campaigns.map((c) => ({
        id: c.id,
        ownerUserId: c.userId,
        memberUserIds: Array.from(
          new Set([c.userId, ...c.members.map((m) => m.userId)])
        ),
        name: c.name,
        slug: c.slug,
        description: c.description,
        status: c.status,
        updatedAt: c.updatedAt.getTime(),
      }));
      await meiliClient.index(CAMPAIGN_INDEX).addDocuments(docs, { primaryKey: 'id' });
      total += docs.length;
      cursor = campaigns[campaigns.length - 1].id;
      console.log(`[Backfill] campaigns: ${total} synced`);
      if (campaigns.length < batch) break;
    }
    return total;
  }

  async function backfillSessions(): Promise<number> {
    let cursor: string | undefined;
    let total = 0;
    while (true) {
      const sessions = await prisma.gameSession.findMany({
        take: batch,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
      });
      if (sessions.length === 0) break;
      const docs: SessionSearchDoc[] = sessions.map((s) => ({
        id: s.id,
        campaignId: s.campaignId,
        sessionNumber: s.sessionNumber,
        title: s.title,
        recap: s.recap,
        aiSummary: s.aiSummary,
        playerRecap: s.playerRecap,
        status: s.status,
        date: s.date.getTime(),
        updatedAt: s.updatedAt.getTime(),
      }));
      await meiliClient.index(SESSION_INDEX).addDocuments(docs, { primaryKey: 'id' });
      total += docs.length;
      cursor = sessions[sessions.length - 1].id;
      console.log(`[Backfill] sessions: ${total} synced`);
      if (sessions.length < batch) break;
    }
    return total;
  }

  async function backfillWorldEntities(): Promise<number> {
    let cursor: string | undefined;
    let total = 0;
    while (true) {
      const entities = await prisma.worldEntity.findMany({
        take: batch,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
      });
      if (entities.length === 0) break;
      const docs: WorldEntitySearchDoc[] = entities.map((e) => ({
        id: e.id,
        campaignId: e.campaignId,
        name: e.name,
        entityType: e.type,
        description: e.description,
        aliases: e.aliases,
        status: e.status,
        updatedAt: e.updatedAt.getTime(),
      }));
      await meiliClient
        .index(WORLD_ENTITY_INDEX)
        .addDocuments(docs, { primaryKey: 'id' });
      total += docs.length;
      cursor = entities[entities.length - 1].id;
      console.log(`[Backfill] world_entities: ${total} synced`);
      if (entities.length < batch) break;
    }
    return total;
  }

  async function backfillWorldEntries(): Promise<number> {
    let cursor: string | undefined;
    let total = 0;
    while (true) {
      const entries = await prisma.worldEntry.findMany({
        take: batch,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
      });
      if (entries.length === 0) break;
      const docs: WorldEntrySearchDoc[] = entries.map((e) => ({
        id: e.id,
        campaignId: e.campaignId,
        slug: e.slug,
        name: e.name,
        entryType: e.type,
        summary: e.summary,
        content: e.content,
        tags: e.tags,
        updatedAt: e.updatedAt.getTime(),
      }));
      await meiliClient
        .index(WORLD_ENTRY_INDEX)
        .addDocuments(docs, { primaryKey: 'id' });
      total += docs.length;
      cursor = entries[entries.length - 1].id;
      console.log(`[Backfill] world_entries: ${total} synced`);
      if (entries.length < batch) break;
    }
    return total;
  }

  const totals: Record<string, number> = {};
  if (kind === 'all' || kind === 'campaigns') {
    totals.campaigns = await backfillCampaigns();
  }
  if (kind === 'all' || kind === 'sessions') {
    totals.sessions = await backfillSessions();
  }
  if (kind === 'all' || kind === 'world_entities') {
    totals.world_entities = await backfillWorldEntities();
  }
  if (kind === 'all' || kind === 'world_entries') {
    totals.world_entries = await backfillWorldEntries();
  }

  console.log('[Backfill] Done:', totals);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[Backfill] FAILED:', err);
  process.exit(1);
});
