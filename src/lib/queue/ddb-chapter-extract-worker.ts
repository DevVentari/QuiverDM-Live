import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '@/lib/prisma';
import { fetchChapterContent, fetchMonsterData, delay } from '@/lib/ddb-sourcebook';
import { chatWithAI } from '@/lib/ai/chat';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import type { DdbChapterExtractJobData } from './ddb-sync-queue';

async function processChapterJob(data: DdbChapterExtractJobData) {
  const { chapterId, sourcebookId, userId, sourceSlug, chapterSlug, cobaltJwt, campaignIds } = data;

  await ddbSyncRepository.setChapterSyncStatus(chapterId, 'running');

  // 1. Fetch chapter using JWT Bearer auth
  const content = await fetchChapterContent(sourceSlug, chapterSlug, cobaltJwt);

  const chapter = await prisma.ddbSourcebookChapter.findUnique({ where: { id: chapterId } });
  const priorHash = chapter?.contentHash;
  const isFirstSync = !priorHash;
  const isChanged = !isFirstSync && priorHash !== content.contentHash;

  const pendingChanges: object[] = [];

  // 2. Upsert monsters (user-scoped, dndBeyondId is the upsert key)
  for (const monster of content.monsterLinks) {
    await delay(500);
    const monsterData = await fetchMonsterData(monster.ddbId, monster.slug, cobaltJwt);
    if (!monsterData) continue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, dndBeyondId: monster.ddbId },
    });

    if (!existing) {
      await prisma.homebrewContent.create({
        data: {
          userId,
          type: 'creature',
          name: monsterData.name,
          dndBeyondId: monster.ddbId,
          dndBeyondUrl: monsterData.sourceUrl,
          ddbChapterId: chapterId,
          sourceType: 'dndbeyond_import',
          data: monsterData as any,
          searchText: monsterData.name,
          tags: [sourceSlug],
          images: [],
        },
      });
    } else if (isChanged && existing.name !== monsterData.name) {
      pendingChanges.push({
        entityType: 'HomebrewContent',
        entityId: existing.id,
        entityName: existing.name,
        field: 'name',
        oldValue: existing.name,
        newValue: monsterData.name,
      });
    }
  }

  // 3. Create EncounterPlans per H2 area per campaign (only on first sync)
  if (isFirstSync) {
    for (const campaignId of campaignIds) {
      for (const area of content.encounterAreas) {
        const existingPlan = await prisma.encounterPlan.findFirst({
          where: { campaignId, ddbChapterId: chapterId, name: area },
        });
        if (!existingPlan) {
          await prisma.encounterPlan.create({
            data: {
              campaignId,
              name: area,
              ddbChapterId: chapterId,
              sceneDescription: `Encounter area from ${chapterSlug}`,
              difficulty: 'medium',
            },
          });
        }
      }
    }
  }

  // 4. AI extraction: NPCs and locations (non-fatal)
  if (content.prose.length > 200) {
    try {
      const prompt = `Extract named NPCs and notable locations from this D&D adventure chapter. Return only JSON with no other text: { "npcs": [{"name": string, "description": string}], "locations": [{"name": string, "description": string}] }

Chapter text:
${content.prose.slice(0, 3000)}`;

      const raw = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.1 });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]) as {
          npcs: { name: string; description: string }[];
          locations: { name: string; description: string }[];
        };

        for (const campaignId of campaignIds) {
          for (const npc of extracted.npcs ?? []) {
            if (!npc.name?.trim()) continue;
            const existing = await prisma.worldEntity.findFirst({
              where: { campaignId, name: npc.name },
            });
            if (!existing) {
              await prisma.worldEntity.create({
                data: {
                  campaignId,
                  type: 'NPC' as any,
                  name: npc.name,
                  description: npc.description,
                  ddbChapterId: chapterId,
                  status: 'active' as any,
                  confidence: 0.7,
                  properties: {},
                } as any,
              });
            }
          }

          for (const loc of extracted.locations ?? []) {
            if (!loc.name?.trim()) continue;
            const existing = await prisma.worldEntity.findFirst({
              where: { campaignId, name: loc.name },
            });
            if (!existing) {
              await prisma.worldEntity.create({
                data: {
                  campaignId,
                  type: 'LOCATION' as any,
                  name: loc.name,
                  description: loc.description,
                  ddbChapterId: chapterId,
                  status: 'active' as any,
                  confidence: 0.7,
                  properties: {},
                } as any,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`[ddb-chapter] AI extraction failed for ${chapterSlug}:`, e);
    }
  }

  // 5. Update hash and pending changes
  await ddbSyncRepository.updateChapterHash(chapterId, content.contentHash, pendingChanges);
}

const worker = new Worker<DdbChapterExtractJobData>(
  'ddb-chapter-extract',
  async (job: Job<DdbChapterExtractJobData>) => processChapterJob(job.data),
  { connection: getRedisConnection() as any, concurrency: 3 }
);

worker.on('failed', async (job, err) => {
  if (job) await ddbSyncRepository.setChapterSyncStatus(job.data.chapterId, 'error').catch(() => {});
  console.error('[ddb-chapter-extract] failed:', err);
});

console.log('[ddb-chapter-extract-worker] listening...');
