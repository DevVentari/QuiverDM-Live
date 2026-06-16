import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import {
  evaluateEncounter,
  getEncounterNudges,
  getEncounterForBoard,
  getActiveBoardForCampaign,
  getOrCreateDemoBoard,
  setParticipantState,
  setTokenPosition,
  addFogRegion,
  removeFogRegion,
  coverAllFog,
  revealAllFog,
} from '../services/heartflame.service';

const fogRegionInput = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

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

  // The live combat board for a campaign (its active encounter, membership-scoped).
  getCampaignBoard: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input, ctx }) =>
      getActiveBoardForCampaign(input.campaignId, ctx.session.user.id),
    ),

  // Dev convenience: ensures the demo encounter exists and returns its board.
  demoBoard: protectedProcedure.query(() => getOrCreateDemoBoard()),

  setParticipantState: protectedProcedure
    .input(z.object({ participantId: z.string(), patch: patchSchema }))
    .mutation(({ input }) => setParticipantState(input.participantId, input.patch)),

  // ── Battle map: token positions + fog of war (membership-scoped) ───────────

  setTokenPosition: protectedProcedure
    .input(z.object({ participantId: z.string(), x: z.number(), y: z.number() }))
    .mutation(({ input, ctx }) =>
      setTokenPosition(input.participantId, input.x, input.y, ctx.session.user.id),
    ),

  addFogRegion: protectedProcedure
    .input(z.object({ encounterId: z.string(), region: fogRegionInput }))
    .mutation(({ input, ctx }) => addFogRegion(input.encounterId, input.region, ctx.session.user.id)),

  removeFogRegion: protectedProcedure
    .input(z.object({ regionId: z.string() }))
    .mutation(({ input, ctx }) => removeFogRegion(input.regionId, ctx.session.user.id)),

  coverAllFog: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) => coverAllFog(input.encounterId, ctx.session.user.id)),

  revealAllFog: protectedProcedure
    .input(z.object({ encounterId: z.string() }))
    .mutation(({ input, ctx }) => revealAllFog(input.encounterId, ctx.session.user.id)),
});
