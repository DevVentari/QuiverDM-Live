/**
 * Onboarding Router
 * tRPC endpoints for new user onboarding flow
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { onboardingService } from '../services/onboarding.service';

const onboardingStepEnum = z.enum(['welcome', 'profile', 'first_campaign', 'complete']);

export const onboardingRouter = router({
  /**
   * Get current onboarding status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    return onboardingService.getStatus(ctx.session.user.id);
  }),

  /**
   * Complete welcome step
   */
  completeWelcome: protectedProcedure.mutation(async ({ ctx }) => {
    return onboardingService.completeWelcome(ctx.session.user.id);
  }),

  /**
   * Complete profile step with user data
   */
  completeProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return onboardingService.completeProfile(ctx.session.user.id, input);
    }),

  /**
   * Complete first campaign step
   * (Called automatically when user creates or joins first campaign)
   */
  completeFirstCampaign: protectedProcedure.mutation(async ({ ctx }) => {
    return onboardingService.completeFirstCampaign(ctx.session.user.id);
  }),

  /**
   * Skip onboarding
   */
  skip: protectedProcedure.mutation(async ({ ctx }) => {
    return onboardingService.skip(ctx.session.user.id);
  }),

  /**
   * Reset onboarding (for testing)
   */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    return onboardingService.reset(ctx.session.user.id);
  }),

  /**
   * Check if user needs onboarding
   */
  needsOnboarding: protectedProcedure.query(async ({ ctx }) => {
    return onboardingService.needsOnboarding(ctx.session.user.id);
  }),
});
