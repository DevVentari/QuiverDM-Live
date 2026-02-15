#!/usr/bin/env bash
# Forward Stripe webhooks to local dev server.
#
# Prerequisites:
# 1) Install Stripe CLI:
#    - macOS: brew install stripe/stripe-cli/stripe
#    - Other OS: https://stripe.com/docs/stripe-cli
# 2) Login once: stripe login
# 3) Run this script. It prints a webhook signing secret (whsec_...)
# 4) Copy that value to .env as STRIPE_WEBHOOK_SECRET

set -euo pipefail

stripe listen --forward-to localhost:3847/api/webhooks/stripe
