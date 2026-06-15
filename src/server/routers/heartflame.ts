import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import {
  evaluateEncounter,
  getEncounterNudges,
  getEncounterForBoard,
  getOrCreateDemoBoard,
  setParticipantState,
} from '../services/heartflame.service';

const patchSchema = z.object({
  hp: z.number().optional(),
  tempHp: z.number().optional(),
  conditions: z.array(z.string()).optional(),
  isAlive: z.boolean().optional(),
  actionUsed: z.boolean().optional(),
  bonusActionUsed: z.boolean().optional(),
  reactionUsed: z.boolean().optional(),
  concentration: z.boolean().optional(),
});

/**
 * Heartflame nudges + combat board for the v3 tracker. `getNudges` is the cheap
 * read the perch polls; `setParticipantState` writes action economy and returns
 * fresh nudges in one round-trip.
 *
 * TODO(authz): scope to the encounter's campaign membership once combat screens
 * land fully; today `protectedProcedure` gates to authenticated users only.
 */
export const heartflameRouter = router({
  getNudges: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .query(({ input }) => getEncounterNudges(input.encounterId)),

  evaluate: protectedProcedure
    .input(z.object({ encounterId: z.string(), reskinPrimary: z.boolean().optional() }))
    .mutation(({ input }) =>
      evaluateEncounter(input.encounterId, { reskinPrimary: input.reskinPrimary }),
    ),

  getEncounter: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .query(({ input }) => getEncounterForBoard(input.encounterId)),

  // Dev convenience: ensures the demo encounter exists and returns its board.
  demoBoard: protectedProcedure.query(() => getOrCreateDemoBoard()),

  setParticipantState: protectedProcedure
    .input(z.object({ participantId: z.string(), patch: patchSchema }))
    .mutation(({ input }) => setParticipantState(input.participantId, input.patch)),
});
