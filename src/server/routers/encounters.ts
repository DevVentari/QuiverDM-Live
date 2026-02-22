import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { encounterService } from '../services/encounter.service';

const conditionSchema = z.string().min(1);

export const encountersRouter = router({
  getBySession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input, ctx }) =>
      encounterService.getBySession(input.sessionId, ctx.session.user.id)
    ),

  getConditions: protectedProcedure.query(() =>
    encounterService.getDnd5eConditions()
  ),

  create: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().trim().min(1).max(100),
      })
    )
    .mutation(({ input, ctx }) =>
      encounterService.create(input.sessionId, ctx.session.user.id, input.name)
    ),

  addParticipant: protectedProcedure
    .input(
      z.object({
        encounterId: z.string(),
        name: z.string().trim().min(1).max(100),
        type: z.enum(['pc', 'npc', 'monster']),
        initiative: z.number().int().min(0).max(30),
        hp: z.number().int().min(0),
        maxHp: z.number().int().min(1),
        npcId: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { encounterId, ...data } = input;
      return encounterService.addParticipant(
        encounterId,
        ctx.session.user.id,
        data
      );
    }),

  updateParticipant: protectedProcedure
    .input(
      z.object({
        participantId: z.string(),
        hp: z.number().int().min(0).optional(),
        maxHp: z.number().int().min(1).optional(),
        initiative: z.number().int().min(0).max(30).optional(),
        conditions: z.array(conditionSchema).optional(),
        isAlive: z.boolean().optional(),
        name: z.string().trim().min(1).max(100).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { participantId, ...data } = input;
      return encounterService.updateParticipant(
        participantId,
        ctx.session.user.id,
        data
      );
    }),

  deleteParticipant: protectedProcedure
    .input(z.object({ participantId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.deleteParticipant(input.participantId, ctx.session.user.id)
    ),

  nextRound: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.nextRound(input.encounterId, ctx.session.user.id)
    ),

  complete: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.complete(input.encounterId, ctx.session.user.id)
    ),

  delete: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) =>
      encounterService.delete(input.encounterId, ctx.session.user.id)
    ),
});
