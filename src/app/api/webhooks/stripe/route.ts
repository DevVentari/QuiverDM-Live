/**
 * Stripe Webhook Handler
 *
 * Receives and verifies Stripe webhook events, then delegates to the
 * billing service for subscription lifecycle management.
 *
 * Events handled:
 * - checkout.session.completed  -> activate subscription after checkout
 * - customer.subscription.updated -> tier change, renewal, status change
 * - customer.subscription.deleted -> downgrade to free tier
 * - invoice.payment_failed -> mark subscription as past_due
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { billingService } from '@/server/services/billing.service';

// Force Node.js runtime (not Edge) for raw body handling
export const runtime = 'nodejs';

// Disable Next.js body parsing so we can access the raw body for signature verification
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Read raw body as text for signature verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error('[stripe-webhook] Failed to read request body:', err);
    return NextResponse.json(
      { error: 'Failed to read request body' },
      { status: 400 }
    );
  }

  // Verify webhook signature
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    console.error('[stripe-webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[stripe-webhook] Signature verification failed: ${message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  // Process the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle subscription checkouts
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

          // Retrieve the full subscription to get price info
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await billingService.handleSubscriptionChange(subscription);
          console.log(`[stripe-webhook] Checkout completed for subscription ${subscriptionId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionChange(subscription);
        console.log(`[stripe-webhook] Subscription updated: ${subscription.id} (status: ${subscription.status})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionDeleted(subscription);
        console.log(`[stripe-webhook] Subscription deleted: ${subscription.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await billingService.handlePaymentFailed(invoice);
        console.log(`[stripe-webhook] Payment failed for invoice ${invoice.id}`);
        break;
      }

      default:
        // Log unhandled events at debug level for visibility
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[stripe-webhook] Error processing ${event.type}: ${message}`);
    // Return 200 to acknowledge receipt; Stripe will retry on 4xx/5xx
    // but we don't want retries for business logic errors
    return NextResponse.json(
      { error: `Webhook handler failed: ${message}` },
      { status: 500 }
    );
  }

  // Acknowledge receipt
  return NextResponse.json({ received: true });
}
