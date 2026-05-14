import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import {
  exchangeCobaltForJwt,
  fetchSourcebookToc,
  fetchChapterContentWithCookie,
  DdbAuthError,
  delay,
} from '@/lib/ddb-sourcebook';
import { ddbChapterExtractQueue, ddbSyncReviewQueue } from './ddb-sync-queue';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import type { DdbSyncCoordinatorJobData } from './ddb-sync-queue';

async function processCoordinatorJob(data: DdbSyncCoordinatorJobData) {
  const { sourcebookId, userId, isUpdateCheck } = data;

  // 1. Decrypt stored CobaltSession
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { dndBeyondCobaltCookie: true },
  });
  if (!settings?.dndBeyondCobaltCookie) {
    await ddbSyncRepository.setSyncStatus(sourcebookId, 'error', 'auth');
    throw new Error('No CobaltSession stored');
  }
  const cobaltSession = decrypt(settings.dndBeyondCobaltCookie);

  // 2. Exchange for JWT — raw session stays in coordinator, never goes to Redis
  let cobaltJwt: string;
  try {
    cobaltJwt = await exchangeCobaltForJwt(cobaltSession);
  } catch (e) {
    if (e instanceof DdbAuthError) {
      await ddbSyncRepository.setSyncStatus(sourcebookId, 'error', 'auth');
      throw e;
    }
    throw e;
  }

  const sourcebook = await prisma.ddbSourcebook.findUnique({
    where: { id: sourcebookId },
    include: { chapters: true },
  });
  if (!sourcebook) throw new Error(`Sourcebook ${sourcebookId} not found`);
  const linkedCampaigns = await prisma.campaignSourcebook.findMany({
    where: { sourcebookId },
    select: { campaignId: true },
  });
  const linkedCampaignIds = linkedCampaigns.map((link) => link.campaignId);

  // 3. Fetch TOC with cookie (www domain) — last time raw session is used
  const chapters = await fetchSourcebookToc(sourcebook.slug, cobaltSession);
  await ddbSyncRepository.upsertChapters(sourcebookId, chapters);
  await delay(500);

  if (isUpdateCheck) {
    // Lightweight: fetch chapter HTML and compare hashes — no extraction
    let changedCount = 0;
    for (const chapter of chapters) {
      const content = await fetchChapterContentWithCookie(sourcebook.slug, chapter.slug, cobaltSession);
      await delay(500);
      const existing = sourcebook.chapters.find(c => c.slug === chapter.slug);
      if (existing?.contentHash !== content.contentHash) changedCount++;
    }
    if (changedCount > 0) {
      console.log(`[ddb-coordinator] ${changedCount} chapters changed in ${sourcebook.slug} — notify DM`);
    }
    return;
  }

  // 4. Set running, enqueue chapter jobs with JWT (not raw session)
  await ddbSyncRepository.setSyncStatus(sourcebookId, 'running');

  const chapterRecords = await prisma.ddbSourcebookChapter.findMany({
    where: { sourcebookId },
    orderBy: { chapterIndex: 'asc' },
  });

  const bulkJobs = chapterRecords.map(ch => ({
    name: `chapter-${ch.id}`,
    data: {
      chapterId: ch.id,
      sourcebookId,
      userId,
      sourceSlug: sourcebook.slug,
      chapterSlug: ch.slug,
      cobaltJwt,
      cobaltSessionEncrypted: settings.dndBeyondCobaltCookie ?? '',
      campaignIds: linkedCampaignIds,
    },
  }));

  await ddbChapterExtractQueue.addBulk(bulkJobs);

  // 5. Poll for completion using getJobCounts — avoids global event listener contamination
  const pollIntervalMs = 10000;
  const maxWaitMs = 30 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    await delay(pollIntervalMs);
    const counts = await ddbChapterExtractQueue.getJobCounts('waiting', 'active', 'delayed');
    const pending = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
    if (pending === 0) break;
  }

  // Post-sync: link named NPCs/threats in this sourcebook to their matching
  // creature stat blocks (HomebrewContent type='creature') by name. Allows
  // the NPC inspector to render AC/HP/actions inline when a stat block
  // exists from the dedicated /monsters/<id>-<slug> scrape.
  const linked = await prisma.$executeRawUnsafe(`
    UPDATE "SourcebookEntity" se
    SET "statBlockId" = hc.id
    FROM "HomebrewContent" hc, "DdbSourcebookChapter" ch
    WHERE se."sourcebookId" = ch."sourcebookId"
      AND hc."ddbChapterId" = ch.id
      AND hc.type = 'creature'
      AND LOWER(hc.name) = LOWER(se.name)
      AND se.type IN ('NPC', 'THREAT')
      AND se."sourcebookId" = $1
      AND se."statBlockId" IS NULL
  `, sourcebookId);
  if (linked > 0) {
    console.log(`[ddb-coordinator] linked ${linked} entities to stat blocks (sourcebook ${sourcebookId})`);
  }

  for (const campaignId of linkedCampaignIds) {
    await ddbSyncRepository.seedCampaignFromSourcebook(
      campaignId,
      sourcebookId,
      userId,
    );
  }

  await ddbSyncReviewQueue.add(`review-${sourcebookId}`, {
    sourcebookId,
    userId,
    chaptersProcessed: chapterRecords.length,
  });
}

const worker = new Worker<DdbSyncCoordinatorJobData>(
  'ddb-sourcebook-sync',
  async (job: Job<DdbSyncCoordinatorJobData>) => processCoordinatorJob(job.data),
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('failed', (job, err) => console.error('[ddb-coordinator] failed:', err));
console.log('[ddb-sync-coordinator-worker] listening...');
