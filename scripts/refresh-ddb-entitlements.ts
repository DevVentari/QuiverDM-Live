// Usage: npx tsx scripts/refresh-ddb-entitlements.ts [email]
//
// Decrypts the user's stored CobaltSession, fetches their D&D Beyond
// entitlements, and upserts them into DdbEntitlement. Prints the full
// list so you can see what's owned (including free claims like LMoP).
//
// Default email: dev@blakewales.au

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/lib/encryption';
import { exchangeCobaltForJwt, fetchUserEntitlements } from '../src/lib/ddb-sourcebook';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? 'dev@blakewales.au';

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { dndBeyondCobaltCookie: true },
  });
  if (!settings?.dndBeyondCobaltCookie) {
    console.error(`No CobaltSession stored for ${email}`);
    process.exit(1);
  }

  console.log(`[refresh-ddb] Decrypting CobaltSession for ${email}...`);
  const cobaltSession = decrypt(settings.dndBeyondCobaltCookie);

  console.log(`[refresh-ddb] Exchanging for JWT...`);
  try {
    await exchangeCobaltForJwt(cobaltSession);
    console.log(`[refresh-ddb] JWT exchange OK`);
  } catch (e) {
    console.error(`[refresh-ddb] JWT exchange failed:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log(`[refresh-ddb] Fetching entitlements from D&D Beyond...`);
  const entitlements = await fetchUserEntitlements(cobaltSession);
  console.log(`[refresh-ddb] Fetched ${entitlements.length} entitlement(s):\n`);

  for (const e of entitlements) {
    console.log(`  ${e.accessType.padEnd(12)} ${e.slug.padEnd(16)} ${e.title}`);
  }

  console.log(`\n[refresh-ddb] Upserting into DdbEntitlement...`);
  await Promise.all(
    entitlements.map((e) =>
      prisma.ddbEntitlement.upsert({
        where: { userId_slug: { userId: user.id, slug: e.slug } },
        create: { userId: user.id, ...e },
        update: {
          title: e.title,
          coverImageUrl: e.coverImageUrl,
          accessType: e.accessType,
          detectedAt: new Date(),
        },
      }),
    ),
  );

  console.log(`[refresh-ddb] Done.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
