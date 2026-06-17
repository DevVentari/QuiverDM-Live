// src/server/services/session0-seeder.ts
/**
 * Seed an authored Session 0 when a sourcebook is linked to a campaign.
 * Player-facing scenes come from the per-sourcebook opening config + the shared
 * scene-note pipeline; CoS also rolls Madam Eva's Tarokka reading into a DM scene
 * and durable PrepSecret rows. Idempotent on re-run.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { resolveOpeningConfig } from '@/lib/sourcebook-openings';
import { gatherSceneContext } from './scene-generation.service';
import { seedSceneNotes } from '@/lib/ai/scene-notes';
import { resolveLinkedEntityIds, tarokkaToNotes, tarokkaToSecrets } from './session0-seeder.helpers';

const SEED_MARKER = 'session0';

export interface SeedSession0Input {
  sessionId: string;
  campaignId: string;
  sourcebookSlug: string;
}
export interface SeedSession0Result {
  scenesCreated: number;
  tarokka: boolean;
}

export async function seedSession0(input: SeedSession0Input): Promise<SeedSession0Result> {
  const { sessionId, campaignId, sourcebookSlug } = input;
  const config = resolveOpeningConfig(sourcebookSlug);

  // Idempotency: clear prior auto-seeded opening scenes for this campaign.
  await prisma.scene.deleteMany({
    where: { campaignId, promptInput: { path: ['seededBy'], equals: SEED_MARKER } },
  });

  // Campaign WorldEntities (cloned from the sourcebook before this job runs) for name-linking.
  const worldEntities = await prisma.worldEntity.findMany({
    where: { campaignId },
    select: { id: true, name: true },
  });

  let order = 0;
  let scenesCreated = 0;

  for (const bp of config.sceneBlueprints) {
    const linkedEntityIds = resolveLinkedEntityIds(bp.linkEntityNames, worldEntities);
    try {
      const ctx = await gatherSceneContext(campaignId, {
        intent: bp.intent, mood: bp.type, linkedEntityIds, partyPresentIds: [],
      });
      const notes = await seedSceneNotes(ctx);
      const readAloud = notes.find((n) => n.type === 'read_aloud')?.body ?? '';
      await prisma.scene.create({
        data: {
          campaignId, title: bp.title, type: bp.type, description: readAloud,
          orderIndex: order++,
          linkedEntityIds: linkedEntityIds as Prisma.InputJsonValue,
          partyPresentIds: [] as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
          promptInput: { intent: bp.intent, mood: bp.type, seededBy: SEED_MARKER, blueprintKey: bp.key } as Prisma.InputJsonValue,
          notes: { create: notes.map((n, i) => ({ type: n.type, title: n.title, body: n.body, data: (n.data ?? undefined) as Prisma.InputJsonValue, source: 'ai', orderIndex: i })) },
        },
      });
      scenesCreated++;
    } catch (err) {
      console.error(`[session0-seeder] scene "${bp.key}" failed, skipping:`, err);
    }
  }

  let tarokka = false;
  if (config.tarokka) {
    const reading = config.tarokka.roll(campaignId);
    const notes = tarokkaToNotes(reading);
    await prisma.scene.create({
      data: {
        campaignId, title: config.tarokka.sceneTitle, type: 'rp',
        description: '', dmNotes: 'Madam Eva’s Tarokka reading — the campaign spine. Reveal these to players only as they discover them.',
        orderIndex: order++,
        generatedAt: new Date(),
        promptInput: { seededBy: SEED_MARKER, blueprintKey: 'tarokka' } as Prisma.InputJsonValue,
        notes: { create: notes.map((n, i) => ({ type: n.type, title: n.title, body: n.body, source: 'ai', orderIndex: i })) },
      },
    });
    scenesCreated++;

    // Durable campaign spine as PrepSecret rows (upsert by name within campaign).
    for (const s of tarokkaToSecrets(reading)) {
      const existing = await prisma.prepSecret.findFirst({
        where: { campaignId, name: s.name }, select: { id: true },
      });
      if (existing) {
        await prisma.prepSecret.update({ where: { id: existing.id }, data: { content: s.content, sessionId } });
      } else {
        await prisma.prepSecret.create({
          data: { campaignId, sessionId, name: s.name, content: s.content, isRevealed: false },
        });
      }
    }
    tarokka = true;
  }

  await prisma.gameSession.update({
    where: { id: sessionId }, data: { prepStatus: 'complete' },
  });

  return { scenesCreated, tarokka };
}
