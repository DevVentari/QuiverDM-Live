import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { evaluateEncounter, getEncounterNudges } from '../services/heartflame.service';

/**
 * Heartflame nudges for live combat. `getNudges` is the cheap read the perch
 * polls; `evaluate` recomputes against current board state and returns fresh
 * nudges (also caching them for subsequent reads).
 *
 * TODO(authz): scope to the encounter's campaign membership once combat screens
 * land (Track C); today `protectedProcedure` gates to authenticated users only.
 */
export const heartflameRouter = router({
  getNudges: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .query(({ input }) => getEncounterNudges(input.encounterId)),

  evaluate: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input }) => evaluateEncounter(input.encounterId)),
});
