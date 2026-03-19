import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import {
  exchangeCobaltForJwt,
  fetchSourcebookToc,
  fetchChapterContent,
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

  // 3. Fetch TOC with cookie (www domain) — last time raw session is used
  const chapters = await fetchSourcebookToc(sourcebook.slug, cobaltSession);
  await ddbSyncRepository.upsertChapters(sourcebookId, chapters);
  await delay(500);

  if (isUpdateCheck) {
    // Lightweight: fetch chapter HTML and compare hashes — no extraction
    let changedCount = 0;
    for (const chapter of chapters) {
      const content = await fetchChapterContent(sourcebook.slug, chapter.slug, cobaltJwt);
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
      campaignIds: sourcebook.campaignIds,
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
