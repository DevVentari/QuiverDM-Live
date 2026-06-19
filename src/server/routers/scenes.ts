import { z } from 'zod';
import { router, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  gatherSceneContext,
  primaryReadAloud,
} from '../services/scene-generation.service';
import { seedSceneNotes, draftNote, suggestNotes, refineNote } from '@/lib/ai/scene-notes';
import { addImageGenerationJob } from '@/lib/queue/image-generation-queue';
import { NotFoundError } from '../errors';

const noteOrder = { orderBy: [{ orderIndex: 'asc' as const }, { createdAt: 'asc' as const }] };

/** Recompute Scene.description from the primary read-aloud note (denormalised mirror). */
async function syncReadAloudMirror(sceneId: string) {
  const notes = await prisma.sceneNote.findMany({
    where: { sceneId }, select: { type: true, body: true, orderIndex: true, createdAt: true },
  });
  const body = primaryReadAloud(notes);
  await prisma.scene.update({ where: { id: sceneId }, data: { description: body ?? '' } });
}

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

/**
 * Queue a scene-art job (establishing-shot style) and return its id.
 * Best-effort and intentionally NOT transactional: if any step fails the scene
 * remains fully usable with no art (imageJobId stays null). Called fire-and-forget.
 */
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

function deriveTitle(intent: string): string {
  const s = intent.trim().replace(/\s+/g, ' ');
  return s.length <= 60 ? s : s.slice(0, 57) + '…';
}

async function contextForScene(campaignId: string, promptInput: unknown) {
  const p = (promptInput && typeof promptInput === 'object' && !Array.isArray(promptInput) ? promptInput : {}) as {
    intent?: string; mood?: string; linkedEntityIds?: string[]; partyPresentIds?: string[];
  };
  return gatherSceneContext(campaignId, {
    intent: typeof p.intent === 'string' ? p.intent : '',
    mood: (['rp','description','tavern','battle','theatre'] as const).includes(p.mood as never) ? (p.mood as never) : undefined,
    linkedEntityIds: Array.isArray(p.linkedEntityIds) ? p.linkedEntityIds : [],
    partyPresentIds: Array.isArray(p.partyPresentIds) ? p.partyPresentIds : [],
  });
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
      const scene = await prisma.scene.findUnique({ where: { id: input.id }, include: { notes: noteOrder } });
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
        intent: input.description, mood: input.type,
        linkedEntityIds: input.linkedEntityIds, partyPresentIds: input.partyPresentIds,
      });
      const notes = await seedSceneNotes(context);
      const title = input.title?.trim() || deriveTitle(input.description);
      const readAloud = notes.find((n) => n.type === 'read_aloud')?.body ?? '';

      const scene = await prisma.scene.create({ data: {
        campaignId: input.campaignId, title, type: input.type ?? 'rp',
        description: readAloud,
        linkedEntityIds: input.linkedEntityIds as Prisma.InputJsonValue,
        partyPresentIds: input.partyPresentIds as Prisma.InputJsonValue,
        generatedAt: new Date(),
        promptInput: { intent: input.description, mood: input.type ?? null, linkedEntityIds: input.linkedEntityIds, partyPresentIds: input.partyPresentIds } as Prisma.InputJsonValue,
        notes: { create: notes.map((n, i) => ({ type: n.type, title: n.title, body: n.body, data: (n.data ?? undefined) as Prisma.InputJsonValue, source: 'ai', orderIndex: i })) },
      } });

      enqueueSceneArt({ sceneId: scene.id, userId: ctx.session.user.id, title: scene.title, readAloud })
        .catch((e) => console.error('[scenes.generate] art enqueue failed', e));
      return scene;
    }),

  update: campaignDMProcedure
    .input(sceneFields.partial().extend({ id: z.string() }))
    .mutation(async ({ input }) => {
      const existing = await prisma.scene.findUnique({ where: { id: input.id }, select: { campaignId: true } });
      if (!existing || existing.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
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
      const scene = await prisma.scene.findUnique({ where: { id: input.id }, select: { campaignId: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
      await prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } });
      return prisma.scene.update({ where: { id: input.id }, data: { isPresented: true } });
    }),

  clearPresented: campaignDMProcedure.mutation(({ input }) =>
    prisma.scene.updateMany({ where: { campaignId: input.campaignId }, data: { isPresented: false } }),
  ),

  delete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.id }, select: { campaignId: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.id);
      return prisma.scene.delete({ where: { id: input.id } });
    }),

  notesCreate: campaignDMProcedure
    .input(z.object({
      sceneId: z.string(),
      type: z.enum(['read_aloud', 'tactic', 'secret', 'check', 'lore', 'trigger']),
      title: z.string().max(120).optional(),
      body: z.string().min(1).max(2000),
      data: z.any().optional(),
      source: z.enum(['manual', 'ai', 'ai_suggested']).default('manual'),
    }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const max = await prisma.sceneNote.aggregate({ where: { sceneId: input.sceneId }, _max: { orderIndex: true } });
      const note = await prisma.sceneNote.create({ data: {
        sceneId: input.sceneId, type: input.type, title: input.title, body: input.body,
        data: (input.data ?? undefined) as Prisma.InputJsonValue, source: input.source,
        orderIndex: (max._max.orderIndex ?? -1) + 1,
      } });
      if (input.type === 'read_aloud') await syncReadAloudMirror(input.sceneId);
      return note;
    }),

  notesUpdate: campaignDMProcedure
    .input(z.object({ id: z.string(), title: z.string().max(120).nullish(), body: z.string().min(1).max(2000).optional(), data: z.any().optional() }))
    .mutation(async ({ input }) => {
      const existing = await prisma.sceneNote.findUnique({ where: { id: input.id }, select: { sceneId: true, type: true, scene: { select: { campaignId: true } } } });
      if (!existing || existing.scene.campaignId !== input.campaignId) throw new NotFoundError('note', input.id);
      const note = await prisma.sceneNote.update({ where: { id: input.id }, data: {
        title: input.title === null ? null : input.title, body: input.body,
        data: input.data === undefined ? undefined : ((input.data ?? undefined) as Prisma.InputJsonValue),
      } });
      if (existing.type === 'read_aloud') await syncReadAloudMirror(existing.sceneId);
      return note;
    }),

  notesDelete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const existing = await prisma.sceneNote.findUnique({ where: { id: input.id }, select: { sceneId: true, type: true, scene: { select: { campaignId: true } } } });
      if (!existing || existing.scene.campaignId !== input.campaignId) throw new NotFoundError('note', input.id);
      await prisma.sceneNote.delete({ where: { id: input.id } });
      if (existing.type === 'read_aloud') await syncReadAloudMirror(existing.sceneId);
      return { ok: true };
    }),

  notesReorder: campaignDMProcedure
    .input(z.object({ sceneId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const owned = await prisma.sceneNote.findMany({ where: { sceneId: input.sceneId }, select: { id: true } });
      const ownedIds = new Set(owned.map((n) => n.id));
      if (input.orderedIds.some((id) => !ownedIds.has(id))) throw new NotFoundError('note', input.sceneId);
      await prisma.$transaction(input.orderedIds.map((id, i) =>
        prisma.sceneNote.update({ where: { id }, data: { orderIndex: i } })));
      await syncReadAloudMirror(input.sceneId);
      return { ok: true };
    }),

  notesDraft: campaignDMProcedure
    .input(z.object({ sceneId: z.string(), type: z.enum(['read_aloud','tactic','secret','check','lore','trigger']), hint: z.string().max(300).optional() }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true, promptInput: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const ctx = await contextForScene(scene.campaignId, scene.promptInput);
      return draftNote(ctx, input.type, input.hint);
    }),

  notesSuggest: campaignDMProcedure
    .input(z.object({ sceneId: z.string() }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true, promptInput: true, notes: { select: { type: true, body: true } } } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const ctx = await contextForScene(scene.campaignId, scene.promptInput);
      return suggestNotes(ctx, scene.notes);
    }),

  notesRefine: campaignDMProcedure
    .input(z.object({ id: z.string(), instruction: z.string().min(1).max(300) }))
    .mutation(async ({ input }) => {
      const note = await prisma.sceneNote.findUnique({ where: { id: input.id }, select: { body: true, scene: { select: { campaignId: true } } } });
      if (!note || note.scene.campaignId !== input.campaignId) throw new NotFoundError('note', input.id);
      return { body: await refineNote(note.body, input.instruction) };
    }),
});
