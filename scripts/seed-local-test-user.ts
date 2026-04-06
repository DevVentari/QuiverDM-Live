/**
 * Seeds local test users with credentials auth.
 * Run: npx tsx scripts/seed-local-test-user.ts
 *
 * Seeds:
 *   - test@local.dev (primary test user, owner of all campaigns)
 *   - All QA persona emails from .env.local (nora, vic, dana, etc.)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const PASSWORD = process.env.TEST_USER_PASSWORD ?? process.env.QA_TEST_PASSWORD ?? 'TestPass123!';

const USERS = [
  { email: process.env.TEST_USER_EMAIL ?? 'test@local.dev', name: 'Local Tester' },
  { email: process.env.QA_VIC_EMAIL ?? 'vic@test.local', name: 'Vic (Veteran DM)' },
  { email: process.env.QA_NORA_EMAIL ?? 'nora@test.local', name: 'Nora (New DM)' },
  { email: process.env.QA_DANA_EMAIL ?? 'dana@test.local', name: 'Dana (Power DM)' },
  { email: process.env.QA_JORDAN_EMAIL ?? 'jordan@test.local', name: 'Jordan (Mobile DM)' },
  { email: process.env.QA_CHRIS_EMAIL ?? 'chris@test.local', name: 'Chris (Error Resilience)' },
  { email: process.env.QA_PLAYER_EMAIL ?? 'player@test.local', name: 'Player (Player Join)' },
];

async function seedUser(email: string, name: string, hashed: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, onboardingCompleted: true, onboardingStep: 'complete' },
    create: { email, name, onboardingCompleted: true, onboardingStep: 'complete' },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: email } },
    update: { password: hashed },
    create: {
      userId: user.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: email,
      password: hashed,
    },
  });

  return user;
}

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 12);

  // Seed all users
  const seededUsers = [];
  for (const { email, name } of USERS) {
    const user = await seedUser(email, name, hashed);
    seededUsers.push({ email, userId: user.id });
    console.log(`Seeded: ${email}`);
  }

  // Add the primary test user as OWNER of all existing campaigns
  const primaryUserId = seededUsers[0].userId;
  const campaigns = await prisma.campaign.findMany({ take: 5 });
  for (const campaign of campaigns) {
    // Primary test user gets OWNER
    await prisma.campaignMember.upsert({
      where: { campaignId_userId: { userId: primaryUserId, campaignId: campaign.id } },
      update: { role: 'OWNER' },
      create: { userId: primaryUserId, campaignId: campaign.id, role: 'OWNER' },
    });
    // Vic also gets OWNER (DM persona needs campaigns)
    const vicUserId = seededUsers.find(u => u.email.includes('vic'))?.userId;
    if (vicUserId) {
      await prisma.campaignMember.upsert({
        where: { campaignId_userId: { userId: vicUserId, campaignId: campaign.id } },
        update: { role: 'OWNER' },
        create: { userId: vicUserId, campaignId: campaign.id, role: 'OWNER' },
      });
    }
    console.log(`  → campaign: ${campaign.name}`);
  }

  console.log(`\nAll test users ready (password: ${PASSWORD})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
