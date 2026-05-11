import { config } from 'dotenv';
config();
config({ path: '.env', override: false });
import bcrypt from 'bcryptjs';
import { PrismaClient, PlatformRole, CampaignRole } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const DEV_EMAIL = 'dev@blakewales.au';
const DEV_PASSWORD = 'xaub6NaM7648';

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function truncateAllTables() {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;

  const tableNames = rows.map((row) => row.table_name);
  if (tableNames.length === 0) {
    throw new Error('No public tables found to truncate');
  }

  const joined = tableNames.map((name) => `"public"."${name}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${joined} RESTART IDENTITY CASCADE`);
  return tableNames.length;
}

async function main() {
  console.log(`Resetting database at ${new URL(DATABASE_URL!).host}...`);
  const truncatedCount = await truncateAllTables();
  console.log(`Truncated ${truncatedCount} table(s)`);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: DEV_EMAIL,
      name: 'Blake Wales',
      displayName: 'Blake Wales',
      emailVerified: now,
      onboardingCompleted: true,
      onboardingStep: 'complete',
      tier: 'team',
      platformRole: PlatformRole.MYTHKEEPER,
      accounts: {
        create: {
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: DEV_EMAIL,
          password: passwordHash,
        },
      },
      usage: {
        create: {
          periodStart: now,
          periodEnd,
          pdfUploadLimit: -1,
          transcriptionLimit: -1,
          campaignLimit: -1,
        },
      },
    },
  });
  console.log(`Created user ${DEV_EMAIL} (${user.id})`);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const campaign = await prisma.campaign.create({
    data: {
      name: 'Icewind Dale: Rime of the Frostmaiden',
      slug: 'icewind-dale-rime-of-the-frostmaiden',
      description: 'Baseline dev campaign for QA workflow specs.',
      status: 'active',
      userId: user.id,
      members: {
        create: {
          userId: user.id,
          role: CampaignRole.OWNER,
          canViewNPCSecrets: true,
          canEditNPCs: true,
          canManageSessions: true,
          canInviteMembers: true,
        },
      },
    },
  });
  console.log(`Created campaign "${campaign.name}" (${campaign.id})`);

  const session = await prisma.gameSession.create({
    data: {
      campaignId: campaign.id,
      sessionNumber: 1,
      title: 'Session 1 — Frostmaiden Awakens',
      status: 'planning',
      prepStatus: 'draft',
      date: tomorrow,
    },
  });
  console.log(`Created planning session #${session.sessionNumber} (${session.id}) on ${tomorrow.toISOString()}`);

  console.log('Database reset + seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
