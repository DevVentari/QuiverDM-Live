/**
 * Billing Router
 *
 * tRPC endpoints for Stripe billing: subscription status, checkout,
 * customer portal, and cancellation.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { billingService } from '../services/billing.service';

export const billingRouter = router({
  /**
   * Get Stripe plan price IDs for client-side checkout initiation.
   */
  getPlans: protectedProcedure.query(() => {
    return {
      pro: {
        priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
        displayPrice: '$9/mo',
      },
      team: {
        priceId: process.env.STRIPE_TEAM_PRICE_ID ?? null,
        displayPrice: '$19/mo',
      },
    };
  }),

  /**
   * Get current billing status (tier, subscription state, period end)
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    return billingService.getBillingStatus(ctx.session.user.id);
  }),

  /**
   * Create a Stripe Checkout session for subscribing to a plan.
   * Returns the checkout URL for client-side redirect.
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        priceId: z.string().min(1, 'Price ID is required'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const url = await billingService.createCheckoutSession(
        ctx.session.user.id,
        input.priceId
      );
      return { url };
    }),

  /**
   * Create a Stripe Customer Portal session for managing subscription.
   * Returns the portal URL for client-side redirect.
   */
  createPortal: protectedProcedure.mutation(async ({ ctx }) => {
    const url = await billingService.createPortalSession(ctx.session.user.id);
    return { url };
  }),

  /**
   * Cancel the current subscription at the end of the billing period.
   */
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    await billingService.cancelSubscription(ctx.session.user.id);
    return { success: true };
  }),
});
