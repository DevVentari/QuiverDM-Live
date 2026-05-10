import 'dotenv/config';
import { Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import {
  upsertCampaignDoc,
  deleteCampaignDoc,
  upsertSessionDoc,
  deleteSessionDoc,
  upsertWorldEntityDoc,
  deleteWorldEntityDoc,
  upsertWorldEntryDoc,
  deleteWorldEntryDoc,
  type CampaignSearchDoc,
  type SessionSearchDoc,
  type WorldEntitySearchDoc,
  type WorldEntrySearchDoc,
} from '@/lib/search';
import {
  MEILI_SYNC_QUEUE_NAME,
  type MeiliSyncJobData,
  type MeiliSyncKind,
} from './meili-sync-queue';
import { getRedisConnection } from './queue';

async function buildCampaignDoc(id: string): Promise<CampaignSearchDoc | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      members: { select: { userId: true } },
    },
  });
  if (!campaign) return null;
  const memberUserIds = Array.from(
    new Set([campaign.userId, ...campaign.members.map((m) => m.userId)])
  );
  return {
    id: campaign.id,
    ownerUserId: campaign.userId,
    memberUserIds,
    name: campaign.name,
    slug: campaign.slug,
    description: campaign.description,
    status: campaign.status,
    updatedAt: campaign.updatedAt.getTime(),
  };
}

async function buildSessionDoc(id: string): Promise<SessionSearchDoc | null> {
  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return null;
  return {
    id: session.id,
    campaignId: session.campaignId,
    sessionNumber: session.sessionNumber,
    title: session.title,
    recap: session.recap,
    aiSummary: session.aiSummary,
    playerRecap: session.playerRecap,
    status: session.status,
    date: session.date.getTime(),
    updatedAt: session.updatedAt.getTime(),
  };
}

async function buildWorldEntityDoc(id: string): Promise<WorldEntitySearchDoc | null> {
  const entity = await prisma.worldEntity.findUnique({ where: { id } });
  if (!entity) return null;
  return {
    id: entity.id,
    campaignId: entity.campaignId,
    name: entity.name,
    entityType: entity.type,
    description: entity.description,
    aliases: entity.aliases,
    status: entity.status,
    updatedAt: entity.updatedAt.getTime(),
  };
}

async function buildWorldEntryDoc(id: string): Promise<WorldEntrySearchDoc | null> {
  const entry = await prisma.worldEntry.findUnique({ where: { id } });
  if (!entry) return null;
  return {
    id: entry.id,
    campaignId: entry.campaignId,
    slug: entry.slug,
    name: entry.name,
    entryType: entry.type,
    summary: entry.summary,
    content: entry.content,
    tags: entry.tags,
    updatedAt: entry.updatedAt.getTime(),
  };
}

async function processUpsert(kind: MeiliSyncKind, id: string): Promise<void> {
  switch (kind) {
    case 'campaign': {
      const doc = await buildCampaignDoc(id);
      if (doc) await upsertCampaignDoc(doc);
      else await deleteCampaignDoc(id);
      return;
    }
    case 'session': {
      const doc = await buildSessionDoc(id);
      if (doc) await upsertSessionDoc(doc);
      else await deleteSessionDoc(id);
      return;
    }
    case 'world_entity': {
      const doc = await buildWorldEntityDoc(id);
      if (doc) await upsertWorldEntityDoc(doc);
      else await deleteWorldEntityDoc(id);
      return;
    }
    case 'world_entry': {
      const doc = await buildWorldEntryDoc(id);
      if (doc) await upsertWorldEntryDoc(doc);
      else await deleteWorldEntryDoc(id);
      return;
    }
  }
}

async function processDelete(kind: MeiliSyncKind, id: string): Promise<void> {
  switch (kind) {
    case 'campaign':
      return deleteCampaignDoc(id);
    case 'session':
      return deleteSessionDoc(id);
    case 'world_entity':
      return deleteWorldEntityDoc(id);
    case 'world_entry':
      return deleteWorldEntryDoc(id);
  }
}

const worker = new Worker<MeiliSyncJobData>(
  MEILI_SYNC_QUEUE_NAME,
  async (job) => {
    const { kind, op, id } = job.data;
    if (op === 'upsert') {
      await processUpsert(kind, id);
    } else {
      await processDelete(kind, id);
    }
    return { success: true };
  },
  { connection: getRedisConnection() as any, concurrency: 8 }
);

worker.on('failed', (job, err) => {
  console.error(
    `[MeiliSyncWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );
});

worker.on('error', (error) => {
  console.error('[MeiliSyncWorker] Worker error:', error);
});

console.log('[MeiliSyncWorker] Worker started');
