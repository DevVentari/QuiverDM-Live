/**
 * Stripe Client Singleton
 *
 * Provides a configured Stripe instance for server-side API calls.
 * Requires STRIPE_SECRET_KEY environment variable.
 */

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});
