// Usage: npx tsx scripts/seed-brain-hameria-ire.ts
// Seeds DM Brain for the Tales from the Bonfire Keep (Hameria Ire) campaign.
// Queues jobs to homelab Redis — the brain-ingestion worker on LXC 206 processes them.

import dotenv from 'dotenv';
dotenv.config();

import { WorldEntityType } from '@prisma/client';
import { prisma } from '../src/server/db';
import { brainRepository } from '../src/server/repositories/brain.repository';
// addBrainIngestionJob loaded dynamically inside main() so dotenv runs first

const CAMPAIGN_SLUG = 'tales-from-the-bonfire-keep';

async function main() {
  // Dynamic import AFTER dotenv — ensures REDIS_URL from .env is set before
  // queue.ts captures getRedisConnection() at module init time
  const { addBrainIngestionJob } = await import('../src/lib/queue/brain-ingestion-queue.js');

  const campaign = await prisma.campaign.findUnique({
    where: { slug: CAMPAIGN_SLUG },
    select: { id: true, name: true },
  });
  if (!campaign) {
    console.error(`Campaign not found: ${CAMPAIGN_SLUG}`);
    process.exit(1);
  }
  console.log(`Seeding DM Brain for: ${campaign.name} (${campaign.id})\n`);

  // 1. Seed NPCs directly as WorldEntity records (no AI, no queue)
  const existingEntities = await brainRepository.findEntities(campaign.id, { limit: 300 });
  const existingNpcNames = new Set(
    existingEntities.filter(e => e.type === WorldEntityType.NPC).map(e => e.name.toLowerCase())
  );

  const npcs = await prisma.nPC.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, name: true, description: true, role: true, faction: true },
  });

  let npcSeeded = 0;
  let npcSkipped = 0;
  for (const npc of npcs) {
    if (existingNpcNames.has(npc.name.toLowerCase())) {
      npcSkipped++;
      continue;
    }
    try {
      await brainRepository.upsertEntity(campaign.id, {
        type: WorldEntityType.NPC,
        name: npc.name,
        description: npc.description ?? undefined,
        properties: { role: npc.role, faction: npc.faction },
        sourceType: 'NPC',
        sourceId: npc.id,
      });
      npcSeeded++;
    } catch (e) {
      console.warn(`  [skip] NPC ${npc.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`NPCs: ${npcSeeded} seeded, ${npcSkipped} already exist\n`);

  // 2. Queue ingestion jobs for campaign documents
  const docs = await prisma.campaignDocument.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, title: true, type: true, content: true, brainIngestStatus: true },
    orderBy: { type: 'asc' },
  });

  let docsQueued = 0;
  let docsSkipped = 0;
  for (const doc of docs) {
    if (doc.brainIngestStatus === 'done') {
      console.log(`  [skip] "${doc.title}" — already ingested`);
      docsSkipped++;
      continue;
    }
    if (!doc.content?.trim()) {
      console.log(`  [skip] "${doc.title}" — no content`);
      docsSkipped++;
      continue;
    }

    await addBrainIngestionJob({
      sessionId: null,
      campaignId: campaign.id,
      summary: `[${doc.type.toUpperCase()}] ${doc.title}\n\n${doc.content}`,
      highlights: [],
      source: 'campaign_document',
    });

    await prisma.campaignDocument.update({
      where: { id: doc.id },
      data: { brainIngestStatus: 'pending' },
    });

    console.log(`  Queued doc: "${doc.title}" (${doc.type})`);
    docsQueued++;
  }
  console.log(`\nDocuments queued: ${docsQueued}, skipped: ${docsSkipped}`);

  // 3. Queue ingestion for session prep content
  const sessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign.id },
    orderBy: { sessionNumber: 'asc' },
    select: { id: true, sessionNumber: true, title: true, prepData: true },
  });

  const doneSources = await prisma.brainIngestSource.findMany({
    where: { campaignId: campaign.id, type: 'session_prep', status: 'done' },
    select: { sourceLabel: true },
  });
  const doneLabels = new Set(doneSources.map(s => s.sourceLabel));

  let sessionsQueued = 0;
  let sessionsSkipped = 0;
  for (const session of sessions) {
    const label = `Session ${session.sessionNumber} prep`;
    if (doneLabels.has(label)) {
      console.log(`  [skip] ${label} — already ingested`);
      sessionsSkipped++;
      continue;
    }

    const prepData = session.prepData as Record<string, unknown> | null;
    const rawContent = prepData?.rawContent as string | undefined;
    if (!rawContent?.trim()) {
      console.log(`  [skip] Session ${session.sessionNumber} "${session.title}" — no prep content`);
      sessionsSkipped++;
      continue;
    }

    await addBrainIngestionJob({
      sessionId: session.id,
      campaignId: campaign.id,
      summary: `[SESSION PREP] ${session.title ?? `Session ${session.sessionNumber}`}\n\n${rawContent}`,
      highlights: [],
      source: 'session_prep',
    });

    const existing = await prisma.brainIngestSource.findFirst({
      where: { campaignId: campaign.id, type: 'session_prep', sourceLabel: label },
    });
    if (!existing) {
      await prisma.brainIngestSource.create({
        data: { campaignId: campaign.id, type: 'session_prep', sourceLabel: label, status: 'pending' },
      });
    }

    console.log(`  Queued session ${session.sessionNumber}: "${session.title}"`);
    sessionsQueued++;
  }
  console.log(`\nSessions queued: ${sessionsQueued}, skipped: ${sessionsSkipped}`);

  console.log('\nDone. Homelab brain-ingestion worker will process the queue.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
