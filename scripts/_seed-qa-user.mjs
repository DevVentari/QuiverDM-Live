import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const email = 'demo@quiverdm.com';
const password = 'demo1234';
const hash = await bcrypt.hash(password, 10);

const user = await prisma.user.upsert({
  where: { email },
  update: { name: 'Demo DM', onboardingCompleted: true },
  create: { email, name: 'Demo DM', onboardingCompleted: true },
});
console.log('User:', user.id, user.email);

const existing = await prisma.account.findFirst({
  where: { userId: user.id, provider: 'credentials' },
});
if (existing) {
  await prisma.account.update({
    where: { id: existing.id },
    data: { password: hash, providerAccountId: email },
  });
  console.log('Updated credentials account');
} else {
  await prisma.account.create({
    data: {
      userId: user.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: email,
      password: hash,
    },
  });
  console.log('Created credentials account');
}

const campaign = await prisma.campaign.upsert({
  where: { slug: 'demo-campaign' },
  update: { userId: user.id, name: "Demo DM's Campaign", status: 'active' },
  create: {
    userId: user.id,
    slug: 'demo-campaign',
    name: "Demo DM's Campaign",
    description: 'QA test campaign',
    status: 'active',
  },
});
console.log('Campaign:', campaign.slug);

const membership = await prisma.campaignMember.findFirst({
  where: { campaignId: campaign.id, userId: user.id },
});
if (!membership) {
  await prisma.campaignMember.create({
    data: { campaignId: campaign.id, userId: user.id, role: 'OWNER' },
  });
  console.log('Created membership');
} else {
  console.log('Membership already exists');
}

await prisma.$disconnect();
console.log('Done! Login: demo@quiverdm.com / demo1234');
