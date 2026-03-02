import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD;
if (!QA_TEST_PASSWORD) {
  console.error('QA_TEST_PASSWORD env var required');
  process.exit(1);
}

const personas = [
  { name: 'New DM Nora',   email: process.env.QA_NORA_EMAIL ?? 'nora@test.local', onboardingCompleted: false, resetCampaigns: true  },
  { name: 'Power DM Dana', email: process.env.QA_DANA_EMAIL ?? 'dana@test.local', onboardingCompleted: true,  resetCampaigns: false },
  { name: 'Veteran Vic',   email: process.env.QA_VIC_EMAIL  ?? 'vic@test.local',  onboardingCompleted: true,  resetCampaigns: false },
];

async function main() {
  const hashedPassword = await bcrypt.hash(QA_TEST_PASSWORD!, 10);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const persona of personas) {
    const existing = await prisma.user.findUnique({ where: { email: persona.email } });
    if (existing) {
      if (persona.resetCampaigns) {
        await prisma.campaign.deleteMany({ where: { userId: existing.id } });
        await prisma.userUsage.updateMany({
          where: { userId: existing.id },
          data: { campaignsOwned: 0 },
        });
        console.log(`[reset] ${persona.email} campaigns cleared`);
      } else {
        console.log(`[skip] ${persona.email} already exists`);
      }
      continue;
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: persona.name,
          email: persona.email,
          emailVerified: now,
          onboardingCompleted: persona.onboardingCompleted,
          onboardingStep: persona.onboardingCompleted ? 'complete' : 'welcome',
        },
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: newUser.id,
          password: hashedPassword,
        },
      });

      await tx.userUsage.create({
        data: {
          userId: newUser.id,
          periodStart: now,
          periodEnd,
        },
      });

      return newUser;
    });

    console.log(`[created] ${persona.email} (id: ${user.id})`);
  }

  // Seed Vic's test campaign (needs a campaign to run NPC scenario)
  const vic = await prisma.user.findUnique({ where: { email: personas[2].email } });
  if (vic) {
    const existing = await prisma.campaign.findFirst({ where: { userId: vic.id, name: "Vic's Test Campaign" } });
    if (!existing) {
      const campaign = await prisma.campaign.create({
        data: {
          name: "Vic's Test Campaign",
          slug: 'vics-test-campaign',
          userId: vic.id,
          members: {
            create: {
              userId: vic.id,
              role: 'OWNER',
            },
          },
        },
      });
      console.log(`[created] Vic's Test Campaign (id: ${campaign.id})`);
    } else {
      console.log(`[skip] Vic's Test Campaign already exists`);
    }
  }

  console.log('[done] QA accounts seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
