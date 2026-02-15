# Forward Stripe webhooks to local dev server.
#
# Prerequisites:
# 1) Install Stripe CLI:
#    - Windows: https://stripe.com/docs/stripe-cli
# 2) Login once:
#    stripe login
# 3) Run this script. It prints a webhook signing secret (whsec_...)
# 4) Copy that value to .env as STRIPE_WEBHOOK_SECRET

$ErrorActionPreference = "Stop"

stripe listen --forward-to localhost:3847/api/webhooks/stripe
