/**
 * Make a user an admin with unlimited usage
 * Usage: npx tsx scripts/make-admin.ts <email>
 */

import { prisma } from '../src/lib/prisma';

async function makeAdmin(email: string) {
  console.log(`Making ${email} an admin...`);

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { usage: true },
  });

  if (!user) {
    console.error(`User ${email} not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email})`);
  console.log(`Current tier: ${user.tier}`);

  // Upgrade to team tier (highest tier)
  await prisma.user.update({
    where: { id: user.id },
    data: { tier: 'team' },
  });

  console.log(`✓ Upgraded to team tier`);

  // Create or update usage record with unlimited limits
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 365); // 1 year period

  if (user.usage) {
    await prisma.userUsage.update({
      where: { userId: user.id },
      data: {
        pdfUploadLimit: -1, // Unlimited
        transcriptionLimit: -1, // Unlimited
        campaignLimit: -1, // Unlimited
        periodEnd,
      },
    });
    console.log(`✓ Updated usage limits to unlimited`);
  } else {
    await prisma.userUsage.create({
      data: {
        userId: user.id,
        periodStart: now,
        periodEnd,
        pdfUploadLimit: -1, // Unlimited
        transcriptionLimit: -1, // Unlimited
        campaignLimit: -1, // Unlimited
      },
    });
    console.log(`✓ Created usage record with unlimited limits`);
  }

  console.log(`\n✅ ${email} is now a full admin with unlimited usage`);

  // Show final status
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { usage: true },
  });

  console.log(`\nFinal status:`);
  console.log(`- Tier: ${updatedUser?.tier}`);
  console.log(`- PDF Upload Limit: ${updatedUser?.usage?.pdfUploadLimit === -1 ? 'Unlimited' : updatedUser?.usage?.pdfUploadLimit}`);
  console.log(`- Transcription Limit: ${updatedUser?.usage?.transcriptionLimit === -1 ? 'Unlimited' : updatedUser?.usage?.transcriptionLimit}`);
  console.log(`- Campaign Limit: ${updatedUser?.usage?.campaignLimit === -1 ? 'Unlimited' : updatedUser?.usage?.campaignLimit}`);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/make-admin.ts <email>');
  process.exit(1);
}

makeAdmin(email)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
