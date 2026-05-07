import { Queue } from 'bullmq';
import { router, wardenProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { getRedisConnection } from '@/lib/queue/queue';

const QUEUE_NAMES = [
  'ai-summary',
  'brain-ingestion',
  'co-dm-analysis',
  'co-dm-prep',
  'combat-copilot',
  'context-extraction',
  'ddb-chapter-extract',
  'ddb-sourcebook-sync',
  'ddb-sync-review',
  'derailment-detection',
  'embeddings',
  'feedback-triage',
  'image-generation',
  'multi-track-processing',
  'obsidian-import',
  'pdf-processing',
  'player-recap',
  'recap-generation',
  'session-events',
  'sourcebook-scene-extraction',
  'transcript-cleanup',
  'transcription-processing',
  'webhooks',
  'world-simulation',
] as const;

export const adminHealthRouter = router({
  getStatus: wardenProcedure.query(async () => {
    const connection = getRedisConnection();

    const queueResults = await Promise.allSettled(
      QUEUE_NAMES.map(async (name) => {
        const queue = new Queue(name, { connection: connection as any });
        try {
          const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
          const failed5 = await queue.getFailed(0, 4);
          return {
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
            recentFailed: failed5.map((job) => ({
              jobName: job.name,
              failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
              error: (job.failedReason ?? '').slice(0, 200),
            })),
          };
        } finally {
          await queue.close();
        }
      }),
    );

    const queues = queueResults.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            name: QUEUE_NAMES[i],
            waiting: 0,
            active: 0,
            failed: 0,
            delayed: 0,
            recentFailed: [],
            error: (r.reason as Error)?.message ?? 'Unknown error',
          },
    );

    const [
      userCount,
      campaignCount,
      sessionCount,
      homebrewCount,
      worldEntityCount,
      apiUsageLogCount,
      transcriptCount,
      npcCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.campaign.count(),
      prisma.gameSession.count(),
      prisma.homebrewContent.count(),
      prisma.worldEntity.count(),
      prisma.apiUsageLog.count(),
      prisma.transcript.count(),
      prisma.nPC.count(),
    ]);

    const tableCounts = [
      { table: 'User', count: userCount },
      { table: 'Campaign', count: campaignCount },
      { table: 'GameSession', count: sessionCount },
      { table: 'HomebrewContent', count: homebrewCount },
      { table: 'WorldEntity', count: worldEntityCount },
      { table: 'ApiUsageLog', count: apiUsageLogCount },
      { table: 'Transcript', count: transcriptCount },
      { table: 'NPC', count: npcCount },
    ];

    const allFailed = queues
      .flatMap((q) =>
        ('recentFailed' in q ? q.recentFailed : []).map((f) => ({
          queue: q.name,
          ...f,
        })),
      )
      .sort((a, b) => {
        if (!a.failedAt) return 1;
        if (!b.failedAt) return -1;
        return b.failedAt.localeCompare(a.failedAt);
      })
      .slice(0, 15);

    return { queues, tableCounts, recentFailed: allFailed };
  }),
});
