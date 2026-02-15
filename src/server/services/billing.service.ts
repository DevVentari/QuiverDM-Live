/**
 * Billing Service
 *
 * Handles all Stripe billing operations: customer management, checkout sessions,
 * customer portal, subscription lifecycle, and tier synchronization.
 */

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { usageService, type UserTier } from './usage.service';
import { NotFoundError, BadRequestError, InternalError } from '../errors';

// =============================================================================
// Price-to-Tier Mapping
// =============================================================================

/**
 * Map Stripe price IDs to internal tier names.
 * Price IDs are set via environment variables so they can differ
 * between Stripe test mode and live mode.
 */
function getTierForPriceId(priceId: string): UserTier | null {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID;

  if (priceId === proPriceId) return 'pro';
  if (priceId === teamPriceId) return 'team';

  return null;
}

/**
 * Extract the active price ID from a Stripe subscription.
 * Subscriptions can have multiple items; we take the first one
 * since QuiverDM subscriptions are single-product.
 */
function getPriceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0];
  return item?.price?.id ?? null;
}

// =============================================================================
// Billing Service
// =============================================================================

export const billingService = {
  /**
   * Get or create a Stripe customer for a user.
   * If the user already has a stripeCustomerId, validates it exists in Stripe.
   * Otherwise creates a new customer and saves the ID.
   */
  async getOrCreateCustomer(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new NotFoundError('user', userId);
    }

    // Return existing customer ID if present
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: {
        userId: user.id,
      },
    });

    // Save customer ID to database
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  },

  /**
   * Create a Stripe Checkout session for starting or changing a subscription.
   * Returns the checkout session URL for client-side redirect.
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    const customerId = await this.getOrCreateCustomer(userId);

    const defaultUrl = `${process.env.NEXTAUTH_URL}/settings`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl ?? `${defaultUrl}?billing=success`,
      cancel_url: cancelUrl ?? `${defaultUrl}?billing=cancelled`,
      subscription_data: {
        metadata: {
          userId,
        },
      },
      metadata: {
        userId,
      },
    });

    if (!session.url) {
      throw new InternalError('Failed to create checkout session — no URL returned');
    }

    return session.url;
  },

  /**
   * Create a Stripe Customer Portal session for managing an existing subscription.
   * Returns the portal URL for client-side redirect.
   */
  async createPortalSession(userId: string, returnUrl?: string): Promise<string> {
    const customerId = await this.getOrCreateCustomer(userId);

    const defaultReturnUrl = `${process.env.NEXTAUTH_URL}/settings`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl ?? defaultReturnUrl,
    });

    return session.url;
  },

  /**
   * Handle a subscription change event from Stripe.
   * Maps the subscription's price to a tier and updates the user accordingly.
   */
  async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, tier: true },
    });

    if (!user) {
      console.error(`[billing] No user found for Stripe customer ${customerId}`);
      return;
    }

    const priceId = getPriceIdFromSubscription(subscription);
    const newTier = priceId ? getTierForPriceId(priceId) : null;

    // Compute subscription end date (moved to item level in newer Stripe API)
    const firstItem = subscription.items.data[0];
    const periodEnd = firstItem?.current_period_end ?? subscription.created;
    const currentPeriodEnd = new Date(periodEnd * 1000);

    // Update user subscription fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionEndsAt: currentPeriodEnd,
        // Only change tier if we can resolve the price
        ...(newTier ? { tier: newTier } : {}),
      },
    });

    // Sync usage limits if tier changed
    if (newTier && newTier !== user.tier) {
      await usageService.updateTier(user.id, newTier);
      console.log(`[billing] User ${user.id} tier changed: ${user.tier} -> ${newTier}`);
    }
  },

  /**
   * Handle a subscription deletion (cancellation complete, or non-renewal).
   * Downgrades the user to the free tier.
   */
  async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, tier: true },
    });

    if (!user) {
      console.error(`[billing] No user found for Stripe customer ${customerId} (subscription deleted)`);
      return;
    }

    // Clear subscription fields and downgrade to free
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeSubscriptionId: null,
        subscriptionStatus: 'canceled',
        subscriptionEndsAt: null,
        tier: 'free',
      },
    });

    // Sync usage limits to free tier
    await usageService.updateTier(user.id, 'free');
    console.log(`[billing] User ${user.id} subscription deleted, downgraded to free`);
  },

  /**
   * Handle a failed invoice payment.
   * Updates subscription status to past_due so the UI can warn the user.
   */
  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!customerId) {
      console.error('[billing] Payment failed invoice has no customer');
      return;
    }

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (!user) {
      console.error(`[billing] No user found for Stripe customer ${customerId} (payment failed)`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'past_due',
      },
    });

    console.log(`[billing] User ${user.id} payment failed, status set to past_due`);
  },

  /**
   * Cancel the user's subscription at the end of the current billing period.
   * The user keeps access until the period ends, then handleSubscriptionDeleted fires.
   */
  async cancelSubscription(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundError('user', userId);
    }

    if (!user.stripeSubscriptionId) {
      throw new BadRequestError('No active subscription to cancel');
    }

    if (user.subscriptionStatus === 'canceled') {
      throw new BadRequestError('Subscription is already canceled');
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'canceling',
      },
    });

    console.log(`[billing] User ${userId} subscription set to cancel at period end`);
  },

  /**
   * Get the current billing status for a user.
   * Returns tier, subscription state, and period information.
   */
  async getBillingStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('user', userId);
    }

    return {
      tier: (user.tier as UserTier) || 'free',
      hasSubscription: !!user.stripeSubscriptionId,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.subscriptionEndsAt,
      stripeCustomerId: user.stripeCustomerId,
    };
  },
};
