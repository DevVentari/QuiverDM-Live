// Usage: npx tsx scripts/brain-backfill.ts <campaign-slug>
// Iterates sessions in ascending order, queues brain ingestion for each.
// Skips sessions with an existing BrainIngestSource status=done.

import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { addBrainIngestionJob } from '../src/lib/queue/brain-ingestion-queue';

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npx tsx scripts/brain-backfill.ts <campaign-slug>');
    process.exit(1);
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!campaign) {
    console.error(`Campaign not found: ${slug}`);
    process.exit(1);
  }

  console.log(`Backfilling brain for campaign: ${campaign.name} (${campaign.id})`);

  const sessions = await prisma.gameSession.findMany({
    where: {
      campaignId: campaign.id,
      aiSummary: { not: null },
      aiSummaryStatus: 'done',
    },
    orderBy: { sessionNumber: 'asc' },
    select: { id: true, sessionNumber: true, title: true, aiSummary: true, aiHighlights: true },
  });

  console.log(`Found ${sessions.length} sessions with summaries.`);

  const doneSources = await prisma.brainIngestSource.findMany({
    where: { campaignId: campaign.id, type: 'session_summary', status: 'done' },
    select: { sourceLabel: true },
  });
  const doneLabels = new Set(doneSources.map(s => s.sourceLabel));

  let queued = 0;
  let skipped = 0;

  for (const session of sessions) {
    const label = `Session ${session.sessionNumber}`;
    if (doneLabels.has(label)) {
      console.log(`  Skipping ${label} — already ingested.`);
      skipped++;
      continue;
    }

    const highlights = Array.isArray(session.aiHighlights)
      ? (session.aiHighlights as Array<{ type: string; text: string }>)
      : [];

    await addBrainIngestionJob({
      sessionId: session.id,
      campaignId: campaign.id,
      summary: session.aiSummary!,
      highlights,
      source: 'session_summary',
    });

    await prisma.brainIngestSource.create({
      data: {
        campaignId: campaign.id,
        type: 'session_summary',
        sourceLabel: label,
        status: 'pending',
      },
    });

    console.log(`  Queued ${label}`);
    queued++;
  }

  console.log(`\nDone. Queued: ${queued}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
