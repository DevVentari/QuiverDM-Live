import { z } from 'zod';
import { router, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateScene } from '@/lib/ai/generate-scene';
import {
  gatherSceneContext,
  applyRegeneration,
  type RegenSection,
} from '../services/scene-generation.service';
import { addImageGenerationJob } from '@/lib/queue/image-generation-queue';
import { NotFoundError } from '../errors';

const sceneFields = z.object({
  title: z.string().min(1).max(160),
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']).default('rp'),
  description: z.string().optional(),
  dmNotes: z.string().optional(),
  imageUrl: z.string().optional(),
  musicCue: z.string().optional(),
  orderIndex: z.number().optional(),
});

const generateInput = z.object({
  title: z.string().max(160).optional(),
  description: z.string().min(1).max(4000),
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']).optional(),
  linkedEntityIds: z.array(z.string()).default([]),
  partyPresentIds: z.array(z.string()).default([]),
});

async function enqueueSceneArt(args: { sceneId: string; userId: string; title: string; readAloud: string }) {
  const job = await prisma.imageGenerationJob.create({
    data: { sceneId: args.sceneId, userId: args.userId, provider: 'auto', status: 'queued',
      prompt: 'Fantasy environment concept art, wide establishing shot, atmospheric lighting' },
  });
  await prisma.scene.update({ where: { id: args.sceneId }, data: { imageJobId: job.id } });
  await addImageGenerationJob({
    jobId: job.id, sceneId: args.sceneId, userId: args.userId, type: 'location',
    name: args.title, description: args.readAloud,
  });
  return job.id;
}

export const scenesRouter = router({
  list: campaignMemberProcedure.query(({ input }) =>
    prisma.scene.findMany({
      where: { campaignId: input.campaignId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }),
  ),

  taggableEntities: campaignMemberProcedure.query(({ input }) =>
    prisma.worldEntity.findMany({
      where: { campaignId: input.campaignId },
      select: { id: true, name: true, type: true, imageUrl: true },
      orderBy: { name: 'asc' },
    }),
  ),

  getStage: campaignMemberProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.id } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
      const entityIds = (scene.linkedEntityIds as string[]) ?? [];
      const partyIds = (scene.partyPresentIds as string[]) ?? [];
      const [entities, party] = await Promise.all([
        entityIds.length
          ? prisma.worldEntity.findMany({
              where: { id: { in: entityIds } },
              select: { id: true, name: true, type: true, description: true, imageUrl: true,
                statBlock: { select: { id: true, name: true, data: true } } },
            })
          : Promise.resolve([]),
        partyIds.length
          ? prisma.character.findMany({
              where: { id: { in: partyIds } },
              select: { id: true, name: true, portraitUrl: true },
            })
          : Promise.resolve([]),
      ]);
      return { scene, entities, party };
    }),

  generate: campaignDMProcedure
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const context = await gatherSceneContext(input.campaignId, {
        intent: input.description,
        mood: input.type,
        linkedEntityIds: input.linkedEntityIds,
        partyPresentIds: input.partyPresentIds,
      });
      const gen = await generateScene(context, { userId: ctx.session.user.id });

      const scene = await prisma.scene.create({
        data: {
          campaignId: input.campaignId,
          title: input.title?.trim() || gen.title,
          type: gen.type,
          description: gen.readAloud,
          dmNotes: gen.dmNotes,
          musicCue: gen.musicCue,
          linkedEntityIds: input.linkedEntityIds as Prisma.InputJsonValue,
          partyPresentIds: input.partyPresentIds as Prisma.InputJsonValue,
          suggestedChecks: gen.suggestedChecks as Prisma.InputJsonValue,
          entityBeats: gen.entityBeats as Prisma.InputJsonValue,
          generatedAt: new Date(),
          promptInput: {
            intent: input.description, mood: input.type ?? null,
            linkedEntityIds: input.linkedEntityIds, partyPresentIds: input.partyPresentIds,
          } as Prisma.InputJsonValue,
        },
      });

      enqueueSceneArt({ sceneId: scene.id, userId: ctx.session.user.id, title: scene.title, readAloud: gen.readAloud })
        .catch((e) => console.error('[scenes.generate] art enqueue failed', e));

      return scene;
    }),

  regenerate: campaignDMProcedure
    .input(z.object({ id: z.string(), section: z.enum(['all', 'readAloud', 'dmNotes', 'checks', 'music']).default('all') }))
    .mutation(async ({ input, ctx }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.id } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
      const p = scene.promptInput as { intent: string; mood?: string | null; linkedEntityIds: string[]; partyPresentIds: string[] } | null;
      if (!p) throw new NotFoundError('scene prompt', input.id);

      const context = await gatherSceneContext(scene.campaignId, {
        intent: p.intent,
        mood: (p.mood as any) ?? undefined,
        linkedEntityIds: p.linkedEntityIds ?? [],
        partyPresentIds: p.partyPresentIds ?? [],
      });
      const gen = await generateScene(context, { userId: ctx.session.user.id });
      const patch = applyRegeneration(scene, gen, input.section as RegenSection);
      return prisma.scene.update({ where: { id: input.id }, data: patch });
    }),

  update: campaignDMProcedure
    .input(sceneFields.partial().extend({ id: z.string() }))
    .mutation(({ input }) => {
      const { id, campaignId: _campaignId, ...data } = input;
      return prisma.scene.update({ where: { id }, data });
    }),

  create: campaignDMProcedure
    .input(sceneFields)
    .mutation(({ input }) => {
      const { campaignId, ...rest } = input;
      return prisma.scene.create({ data: { campaignId, ...rest } });
    }),

  present: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } });
      return prisma.scene.update({ where: { id: input.id }, data: { isPresented: true } });
    }),

  clearPresented: campaignDMProcedure.mutation(({ input }) =>
    prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } }),
  ),

  delete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => prisma.scene.delete({ where: { id: input.id } })),
});
