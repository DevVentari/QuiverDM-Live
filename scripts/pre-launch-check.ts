import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Stripe from 'stripe';

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const prisma = new PrismaClient();

function env(name: string): string | undefined {
  return process.env[name]?.trim();
}

function redisConnection() {
  if (env('REDIS_URL')) return env('REDIS_URL')!;
  return {
    host: env('REDIS_HOST') || 'localhost',
    port: Number(env('REDIS_PORT') || 6380),
    password: env('REDIS_PASSWORD') || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const requiredEnvVars = [
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRO_PRICE_ID',
    'STRIPE_TEAM_PRICE_ID',
    'ADMIN_EMAILS',
  ];

  for (const key of requiredEnvVars) {
    const value = env(key);
    results.push({
      name: `env:${key}`,
      ok: Boolean(value),
      detail: value ? 'set' : 'missing',
    });
  }

  const redisUrl = env('REDIS_URL');
  const hasRedisHostPort = Boolean(env('REDIS_HOST') || env('REDIS_PORT'));
  results.push({
    name: 'env:REDIS connection',
    ok: Boolean(redisUrl || hasRedisHostPort),
    detail: redisUrl ? 'using REDIS_URL' : hasRedisHostPort ? 'using host/port' : 'missing',
  });

  const adminEmails = env('ADMIN_EMAILS');
  const adminCount = adminEmails
    ? adminEmails.split(',').map((v) => v.trim()).filter(Boolean).length
    : 0;
  results.push({
    name: 'admin emails configured',
    ok: adminCount > 0,
    detail: `${adminCount} configured`,
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    results.push({ name: 'database connectivity', ok: true });
  } catch (error) {
    results.push({
      name: 'database connectivity',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const redis = new Redis(redisConnection() as any);
  try {
    const pong = await redis.ping();
    results.push({
      name: 'redis connectivity',
      ok: pong === 'PONG',
      detail: pong,
    });
  } catch (error) {
    results.push({
      name: 'redis connectivity',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await redis.quit().catch(() => undefined);
  }

  // Check MeiliSearch
  try {
    const meiliUrl = env('MEILI_URL') || 'http://localhost:7701';
    const meiliKey = env('MEILI_MASTER_KEY');
    const response = await fetch(`${meiliUrl}/health`, {
      headers: meiliKey ? { Authorization: `Bearer ${meiliKey}` } : {},
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json() as { status?: string };
    results.push({
      name: 'meilisearch connectivity',
      ok: body.status === 'available',
      detail: body.status ?? `http ${response.status}`,
    });
  } catch (error) {
    results.push({
      name: 'meilisearch connectivity',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Check Docling
  try {
    const response = await fetch(`${env('DOCLING_URL') || 'http://localhost:5001'}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    results.push({
      name: 'docling connectivity',
      ok: response.ok,
      detail: response.ok ? 'available' : `status ${response.status}`,
    });
  } catch (error) {
    results.push({
      name: 'docling connectivity',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const inviteCount = await prisma.inviteCode.count();
  results.push({
    name: 'invite codes exist',
    ok: inviteCount > 0,
    detail: `${inviteCount} codes`,
  });

  const stripeKey = env('STRIPE_SECRET_KEY');
  const proPriceId = env('STRIPE_PRO_PRICE_ID');
  const teamPriceId = env('STRIPE_TEAM_PRICE_ID');

  if (stripeKey && proPriceId && teamPriceId) {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });
    for (const [label, priceId] of [
      ['pro price', proPriceId],
      ['team price', teamPriceId],
    ] as const) {
      try {
        const price = await stripe.prices.retrieve(priceId);
        results.push({
          name: `stripe ${label}`,
          ok: Boolean(price && !price.deleted),
          detail: price.id,
        });
      } catch (error) {
        results.push({
          name: `stripe ${label}`,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else {
    results.push({
      name: 'stripe price validation',
      ok: false,
      detail: 'missing STRIPE_SECRET_KEY or price IDs',
    });
  }

  return results;
}

function printResults(results: CheckResult[]) {
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  console.log('\nQuiverDM Pre-Launch Checklist\n');
  for (const result of results) {
    const mark = result.ok ? '[PASS]' : '[FAIL]';
    console.log(`${mark} ${result.name}${result.detail ? ` - ${result.detail}` : ''}`);
  }

  console.log(`\nSummary: ${okCount}/${results.length} passed, ${failCount} failed.`);
}

async function main() {
  try {
    const results = await runChecks();
    printResults(results);
    const hasFailures = results.some((r) => !r.ok);
    process.exit(hasFailures ? 1 : 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[check:launch] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
