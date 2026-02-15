import Stripe from 'stripe';

type PlanConfig = {
  productName: string;
  description: string;
  amount: number;
  envKey: 'STRIPE_PRO_PRICE_ID' | 'STRIPE_TEAM_PRICE_ID';
};

const PLANS: PlanConfig[] = [
  {
    productName: 'QuiverDM Pro',
    description: 'Unlimited campaigns, 10 hrs transcription, 50 PDF uploads',
    amount: 900,
    envKey: 'STRIPE_PRO_PRICE_ID',
  },
  {
    productName: 'QuiverDM Team',
    description: 'Unlimited campaigns, 30 hrs transcription, 200 PDF uploads',
    amount: 1900,
    envKey: 'STRIPE_TEAM_PRICE_ID',
  },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function findOrCreateProduct(stripe: Stripe, plan: PlanConfig): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `name:'${plan.productName.replace(/'/g, "\\'")}' AND active:'true'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  return stripe.products.create({
    name: plan.productName,
    description: plan.description,
  });
}

async function findOrCreatePrice(
  stripe: Stripe,
  productId: string,
  amount: number
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });

  const existing = prices.data.find(
    (price) =>
      price.currency === 'usd' &&
      price.recurring?.interval === 'month' &&
      price.unit_amount === amount
  );

  if (existing) {
    return existing;
  }

  return stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: 'usd',
    recurring: { interval: 'month' },
  });
}

async function main() {
  const stripeSecret = requireEnv('STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2026-01-28.clover',
  });

  const envOutput: Record<string, string> = {};

  for (const plan of PLANS) {
    const product = await findOrCreateProduct(stripe, plan);
    const price = await findOrCreatePrice(stripe, product.id, plan.amount);
    envOutput[plan.envKey] = price.id;

    console.log(`${plan.productName}:`);
    console.log(`  Product ID: ${product.id}`);
    console.log(`  Price ID:   ${price.id}`);
  }

  console.log('\nAdd these to your .env:');
  for (const [key, value] of Object.entries(envOutput)) {
    console.log(`${key}=${value}`);
  }
}

main().catch((error) => {
  console.error('[setup:stripe] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
