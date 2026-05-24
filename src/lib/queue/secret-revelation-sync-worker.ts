import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { Worker } from 'bullmq';
import { WorldEntityType } from '@prisma/client';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import type { RevelationSyncJobData, RevelationSyncJobResult } from './secret-revelation-sync-queue';

async function processRevelationSync(
  job: import('bullmq').Job<RevelationSyncJobData, RevelationSyncJobResult>
): Promise<RevelationSyncJobResult> {
  const { revelationId, campaignId } = job.data;

  const revelation = await prisma.secretRevelation.findUnique({
    where: { id: revelationId },
    include: { prepSecret: true },
  });

  if (!revelation) {
    return { success: false, error: `SecretRevelation ${revelationId} not found` };
  }

  const secretName = revelation.prepSecret.name;
  const secretContent = revelation.prepSecret.content;

  // Upsert the SECRET world entity
  const entity = await prisma.worldEntity.upsert({
    where: {
      campaignId_name_type: {
        campaignId,
        name: secretName,
        type: WorldEntityType.SECRET,
      },
    },
    create: {
      campaignId,
      name: secretName,
      type: WorldEntityType.SECRET,
      description: secretContent,
      aliases: [],
    },
    update: {
      description: secretContent,
    },
  });

  // Find PC entities to link "revealed_to_players"
  const pcs = await prisma.worldEntity.findMany({
    where: { campaignId, type: WorldEntityType.PC },
    select: { id: true },
  });

  let relationshipId: string | undefined;

  for (const pc of pcs) {
    const rel = await prisma.worldRelationship.upsert({
      where: {
        fromEntityId_toEntityId_type: {
          fromEntityId: pc.id,
          toEntityId: entity.id,
          type: 'revealed_to_players',
        },
      },
      create: {
        campaignId,
        fromEntityId: pc.id,
        toEntityId: entity.id,
        type: 'revealed_to_players',
        description: `Revealed in session ${job.data.sessionId}`,
      },
      update: {},
    });
    relationshipId = rel.id;
  }

  return { success: true, entityId: entity.id, relationshipId };
}

new Worker<RevelationSyncJobData, RevelationSyncJobResult>(
  'secret-revelation-sync',
  processRevelationSync,
  {
    connection: getRedisConnection() as any,
    concurrency: 5,
  }
);

console.log('[worker] secret-revelation-sync started');
